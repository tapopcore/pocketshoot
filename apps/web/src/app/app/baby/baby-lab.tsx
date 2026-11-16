"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ImagePlus, Moon, RefreshCw, Share2, Shuffle, Sun, X } from "lucide-react";
import { BABY_FAMILIES, BABY_LEGACY_NAMES, BABY_THEMES, mixThemes, type BabyShape, type BabyState, type BabyTheme } from "@/lib/baby/themes";

type Photo = { blob: Blob; url: string };
type Result = { id: string; theme: BabyTheme; state: BabyState; status: "queued" | "making" | "ready" | "failed"; url?: string; width?: number; height?: number; message?: string; detail?: string; code?: string; retryable?: boolean; ms?: number; sandbox?: boolean; thumb?: string; moment?: number };
const COUNTS = [6, 10, 15] as const;
const SHAPES: { id: BabyShape; label: string; hint: string }[] = [{ id: "4:5", label: "Portrait", hint: "Instagram post" }, { id: "1:1", label: "Square", hint: "Grid" }, { id: "9:16", label: "Tall", hint: "Story or Reel" }];

/** Shrink on the phone first so uploads stay small and fast. */
async function shrink(file: File): Promise<Photo> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  if (Math.max(bmp.width, bmp.height) < 1000) throw new Error("too_small");
  const k = Math.min(1, 1536 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), "image/jpeg", 0.9));
  return { blob, url: URL.createObjectURL(blob) };
}

async function enlarge(url: string, longEdge: number): Promise<Blob> {
  const img = new Image(); img.src = url; await img.decode();
  const k = longEdge / Math.max(img.naturalWidth, img.naturalHeight);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const g = c.getContext("2d")!; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, c.width, c.height);
  return new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), "image/jpeg", 0.95));
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function BabyLab({ live, examples, saved, canManage }: { live: boolean; examples: Record<string, string>; saved: { key: string; themeId: string }[]; canManage: boolean }) {
  const [ex, setEx] = useState(examples);
  const [seeding, setSeeding] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<BabyState, Photo>>>({});
  const [uploadError, setUploadError] = useState("");
  const [mode, setMode] = useState<"one" | "shoot">("one");
  const [themeId, setThemeId] = useState(BABY_THEMES[0].id);
  const [count, setCount] = useState<(typeof COUNTS)[number]>(6);
  const [seed, setSeed] = useState(1);
  const [state, setState] = useState<BabyState>("asleep");
  const [shape, setShape] = useState<BabyShape>("4:5");
  const [results, setResults] = useState<Result[]>(() => saved.map((p) => {
    const q = `/api/baby/photo?key=${encodeURIComponent(p.key)}`;
    return { id: p.key, theme: BABY_THEMES.find((t) => t.id === p.themeId) ?? { ...BABY_THEMES[0], id: p.themeId, name: BABY_LEGACY_NAMES[p.themeId] ?? "Saved photo" }, state: "asleep" as BabyState, status: "ready" as const, url: q, thumb: `${q}&w=600` };
  }));
  const [open, setOpen] = useState<string | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const running = useRef(0); const queue = useRef<Result[]>([]);

  const mix = useMemo(() => mixThemes(count, seed * 7919 + count), [count, seed]);
  const plan = mode === "one" ? [BABY_THEMES.find((t) => t.id === themeId)!] : mix;
  const hasPhoto = !!(photos.asleep || photos.awake);
  const busy = results.some((r) => r.status === "queued" || r.status === "making");
  const patch = (id: string, p: Partial<Result>) => setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const pump = useCallback(() => {
    while (running.current < 2 && queue.current.length) {
      const job = queue.current.shift()!; running.current++;
      patch(job.id, { status: "making" });
      const fd = new FormData();
      const order = job.state === "awake" ? [photos.awake, photos.asleep] : [photos.asleep, photos.awake];
      order.filter(Boolean).forEach((p, i) => fd.append("photo", p!.blob, `baby-${i}.jpg`));
      fd.set("theme", job.theme.id); fd.set("state", job.state); fd.set("shape", shape); fd.set("quality", "standard"); fd.set("moment", String(job.moment ?? 0));
      fetch("/api/baby/generate", { method: "POST", body: fd })
        .then(async (r) => ({ r, j: await r.json().catch(() => ({})) }))
        .then(({ r, j }) => {
          if (r.ok && j.ok) patch(job.id, { status: "ready", url: j.image, width: j.width, height: j.height, ms: j.ms, sandbox: j.sandbox });
          else patch(job.id, { status: "failed", message: j.message ?? "This photo could not be made.", detail: j.detail, code: j.code, retryable: j.retryable !== false, ms: j.ms });
        })
        .catch(() => patch(job.id, { status: "failed", message: "The connection dropped. Please try again.", retryable: true }))
        .finally(() => { running.current--; pump(); });
    }
  }, [photos, shape]);

  const create = () => {
    const jobs: Result[] = plan.map((theme, i) => ({ id: `${Date.now()}-${i}`, theme, state, status: "queued", moment: (results.length + i) % 4 }));
    setResults((rs) => [...jobs, ...rs]); queue.current.push(...jobs); pump();
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const retry = (r: Result) => { const job: Result = { ...r, status: "queued", message: undefined, detail: undefined }; patch(r.id, job); queue.current.push(job); pump(); };

  const missing = BABY_THEMES.filter((t) => !ex[t.id]);
  const makeExamples = async () => {
    const todo = [...missing]; let done = 0, failed = 0;
    setSeeding({ done, total: todo.length, failed });
    const worker = async () => {
      for (let t = todo.shift(); t; t = todo.shift()) {
        const id = t.id;
        const j = await fetch("/api/baby/example", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ theme: id }) }).then((r) => r.json()).catch(() => ({}));
        if (j.ok) setEx((m) => ({ ...m, [id]: j.url })); else failed++;
        done++; setSeeding({ done, total: done + todo.length, failed });
      }
    };
    await Promise.all([worker(), worker()]);
    setSeeding((s) => (s ? { ...s, total: s.done } : s));
  };

  const pick = async (which: BabyState, file?: File) => {
    if (!file) return;
    setUploadError("");
    try { const p = await shrink(file); setPhotos((ps) => ({ ...ps, [which]: p })); if (!photos.asleep && !photos.awake) setState(which); }
    catch (e) { setUploadError((e as Error).message === "too_small" ? "That photo is too small to keep your baby's face accurate. Please use the original photo from your phone, not a screenshot or a downloaded copy." : "That file could not be opened as a photo. Please try another one."); }
  };

  const current = results.find((r) => r.id === open);
  return (
    <div className="bb bb-page">
      <header className="bb-head">
        <h1 className="bb-logo">Baby <i>Shoot</i></h1>
        <span className="bb-tag">{live ? "Team preview" : "Sandbox, no real photos"}</span>
      </header>
      <p className="bb-lede">A studio newborn shoot from two phone photos. For babies up to about 10 weeks.</p>

      <section className="bb-stack" aria-labelledby="bb-s1">
        <h2 id="bb-s1"><b>1</b> Your baby</h2>
        <div className="bb-uploads">
          {(["asleep", "awake"] as BabyState[]).map((w) => (
            <label key={w} className="bb-upload" data-filled={!!photos[w]}>
              <input type="file" accept="image/*" onChange={(e) => { pick(w, e.target.files?.[0]); e.target.value = ""; }} />
              {photos[w] ? <img src={photos[w]!.url} alt={`Your ${w} photo`} /> : <span className="bb-upload-empty">{w === "asleep" ? <Moon aria-hidden /> : <Sun aria-hidden />}<ImagePlus aria-hidden size={18} /></span>}
              <span className="bb-upload-label">{photos[w] ? `Change ${w} photo` : `Add ${w === "asleep" ? "a sleeping" : "an awake"} photo`}</span>
            </label>
          ))}
        </div>
        <p className="bb-small bb-muted">Use the original photos from your phone, with a clear face in soft daylight and no filters. Two photos, one asleep and one awake, give the closest likeness. Your uploaded photos are only used to make the result and are not kept. The photos we make for you are saved to your account.</p>
        {uploadError && <p className="bb-error" role="alert">{uploadError}</p>}
      </section>

      <section className="bb-stack" aria-labelledby="bb-s2">
        <h2 id="bb-s2"><b>2</b> What to make</h2>
        <div className="bb-seg" role="group" aria-label="What to make">
          <button type="button" aria-pressed={mode === "one"} onClick={() => setMode("one")}>One photo</button>
          <button type="button" aria-pressed={mode === "shoot"} onClick={() => setMode("shoot")}>Full shoot</button>
        </div>
        {Object.keys(ex).length > 0 && <p className="bb-small bb-muted">Example photos show an invented baby, to give you the look of each theme.</p>}
        {mode === "one" ? BABY_FAMILIES.map((f) => (
          <div key={f} className="bb-stack-s">
            <h3>{f}</h3>
            <div className="bb-themes">
              {BABY_THEMES.filter((t) => t.family === f).map((t) => (
                <button key={t.id} type="button" className="bb-theme" aria-pressed={themeId === t.id} onClick={() => setThemeId(t.id)}>
                  <span className="bb-swatch" data-photo={!!ex[t.id]} style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }} aria-hidden>{ex[t.id] && <img src={ex[t.id]} alt="" loading="lazy" decoding="async" />}{ex[t.id] && <em>Example</em>}{themeId === t.id && <i><Check size={16} /></i>}</span>
                  <span className="bb-theme-name">{t.name}</span><span className="bb-theme-blurb">{t.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        )) : (
          <div className="bb-stack-s">
            <div className="bb-chips" role="group" aria-label="Number of photos">
              {COUNTS.map((n) => <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)}>{n} photos</button>)}
            </div>
            <div className="bb-mixhead"><h3>Your mix of themes</h3><button type="button" className="bb-link" onClick={() => setSeed((s) => s + 1)}><Shuffle size={16} aria-hidden />Shuffle</button></div>
            <ol className="bb-mix">
              {mix.map((t) => <li key={t.id}><span className="bb-dot" style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }} aria-hidden>{ex[t.id] && <img src={ex[t.id]} alt="" loading="lazy" decoding="async" />}</span><span><b>{t.name}</b><small>{t.family} · {t.blurb}</small></span></li>)}
            </ol>
          </div>
        )}
      </section>

      <section className="bb-stack" aria-labelledby="bb-s3">
        <h2 id="bb-s3"><b>3</b> Finish</h2>
        <div className="bb-row">
          <div className="bb-seg small" role="group" aria-label="Baby in the photo">
            <button type="button" aria-pressed={state === "asleep"} onClick={() => setState("asleep")}><Moon size={16} aria-hidden />Asleep</button>
            <button type="button" aria-pressed={state === "awake"} onClick={() => setState("awake")}><Sun size={16} aria-hidden />Awake</button>
          </div>
        </div>
        <div className="bb-chips" role="group" aria-label="Photo shape">
          {SHAPES.map((s) => <button key={s.id} type="button" aria-pressed={shape === s.id} onClick={() => setShape(s.id)}>{s.label}<small>{s.hint}</small></button>)}
        </div>
      </section>

      {results.length > 0 && (
        <section className="bb-stack" aria-labelledby="bb-s4" ref={resultsRef}>
          <h2 id="bb-s4">Your photos</h2>
          <p className="bb-small bb-muted" role="status">{busy ? `Making ${results.filter((r) => r.status !== "ready" && r.status !== "failed").length} of ${results.length}. Each photo takes about 20 seconds.` : "Tap a photo to save it or share it. Your photos are kept here for when you come back."}</p>
          <div className="bb-grid" data-shape={shape}>
            {results.map((r) => (
              <article key={r.id} className="bb-tile" data-status={r.status}>
                {r.status === "ready" ? <button type="button" className="bb-tile-img" onClick={() => setOpen(r.id)} aria-label={`Open ${r.theme.name}`}><img src={r.thumb ?? r.url} alt={`${r.theme.name} photo`} loading="lazy" decoding="async" /></button>
                  : r.status === "failed" ? <div className="bb-tile-fail"><p><b>Not made</b>{r.message}</p>{r.detail && <details><summary>What the model said</summary><p>{r.detail}</p></details>}{r.retryable && <button type="button" className="bb-btn small" onClick={() => retry(r)}><RefreshCw size={14} aria-hidden />Try again</button>}</div>
                  : <div className="bb-tile-wait" aria-label={`${r.theme.name}, ${r.status === "queued" ? "waiting" : "being made"}`} />}
                <p className="bb-tile-cap">{r.theme.name}{r.sandbox && <small> · sandbox</small>}{r.ms && r.status === "ready" ? <small> · {Math.round(r.ms / 1000)}s</small> : null}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {canManage && live && (missing.length > 0 || seeding) && (
        <section className="bb-admin bb-stack-s" aria-labelledby="bb-adm">
          <h3 id="bb-adm">Team only: theme example photos</h3>
          <p className="bb-small" role="status">{seeding ? (seeding.done < seeding.total ? `Making example ${Math.min(seeding.done + 1, seeding.total)} of ${seeding.total}. Keep this page open.` : `Finished. ${seeding.total - seeding.failed} made${seeding.failed ? `, ${seeding.failed} not made. You can run it again for those.` : "."}`) : `${BABY_THEMES.length - missing.length} of ${BABY_THEMES.length} theme cards have an example photo. Making the other ${missing.length} takes about ${Math.ceil(missing.length / 2)} minutes.`}</p>
          {(!seeding || seeding.done >= seeding.total) && missing.length > 0 && <button type="button" className="bb-btn small" onClick={makeExamples}>Make {missing.length} example photo{missing.length === 1 ? "" : "s"}</button>}
        </section>
      )}

      <div className="bb-bar">
        <p>{plan.length === 1 ? plan[0].name : `${plan.length} photos, mixed themes`}<small>{plan.length === 1 ? plan[0].blurb : "A mix of styles"}</small></p>
        <button type="button" className="bb-btn primary" disabled={!hasPhoto || busy} onClick={create}>{busy ? "Making…" : !hasPhoto ? "Add a photo first" : plan.length === 1 ? "Create photo" : `Create ${plan.length} photos`}</button>
      </div>

      {current?.url && <Viewer r={current} original={saved.some((p) => p.key === current.id) ? undefined : (photos[current.state] ?? photos.asleep ?? photos.awake)?.url} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Viewer({ r, original, onClose }: { r: Result; original?: string; onClose: () => void }) {
  const [compare, setCompare] = useState(false);
  const [working, setWorking] = useState("");
  const [dims, setDims] = useState<{ w: number; h: number } | null>(r.width && r.height ? { w: r.width, h: r.height } : null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; prev?.focus(); };
  }, [onClose]);
  const name = `baby-shoot-${r.theme.id}`;
  const blobOf = async (k: "hd" | "4k") => (k === "hd" ? await (await fetch(r.url!)).blob() : await enlarge(r.url!, 3840));
  const act = async (k: "hd" | "4k" | "share") => {
    setWorking(k);
    try {
      const blob = await blobOf(k === "share" ? "hd" : k);
      if (k === "share") {
        const file = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
        else save(blob, `${name}.jpg`);
      } else save(blob, `${name}${k === "4k" ? "-4k" : ""}.jpg`);
    } finally { setWorking(""); }
  };
  return (
    <div className="bb-viewer" role="dialog" aria-modal="true" aria-label={r.theme.name}>
      <div className="bb-viewer-top"><p>{r.theme.name}</p><button ref={closeRef} type="button" className="bb-icon" onClick={onClose} aria-label="Close"><X /></button></div>
      <div className="bb-viewer-img"><img src={compare && original ? original : r.url} alt={compare ? "Your original photo" : `${r.theme.name} photo`} onLoad={(e) => { if (!compare) setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight }); }} /></div>
      <div className="bb-viewer-actions">
        {original && <button type="button" className="bb-btn" aria-pressed={compare} onClick={() => setCompare((c) => !c)}>{compare ? "Show result" : "Compare with your photo"}</button>}
        <div className="bb-row">
          <button type="button" className="bb-btn" disabled={!!working} onClick={() => act("hd")}><Download size={16} aria-hidden />HD<small>as made</small></button>
          <button type="button" className="bb-btn" disabled={!!working} onClick={() => act("4k")}><Download size={16} aria-hidden />4K<small>enlarged</small></button>
          <button type="button" className="bb-btn primary" disabled={!!working} onClick={() => act("share")}><Share2 size={16} aria-hidden />Share</button>
        </div>
        <p className="bb-small">{dims ? `Made at ${dims.w} × ${dims.h} px. ` : ""}The 4K file is this photo enlarged to 3840 px. Share opens your phone&apos;s share menu, where you can pick Instagram.</p>
      </div>
    </div>
  );
}
