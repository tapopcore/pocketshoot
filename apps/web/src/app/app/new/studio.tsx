"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, ArrowRight, Camera, Check, ChevronDown, ImagePlus, Lock, Minus, Plus, ScanText, Sparkles, Upload, X } from "lucide-react";
import {
  CATEGORIES, CATEGORY_LIST, OUTPUTS, OUTPUT_LIST, STYLES, scenesFor, type CategoryId, type Locale, type OutputId, type ProductAnalysis, type StyleId,
} from "@packshot/core";
import { api, newKey, toast, uploadFiles, ClientApiError } from "@/lib/client";
import { checkPhoto, shrinkPhoto, takePendingFiles } from "@/lib/photo-client";
import { ScenePicker } from "@/components/scene-picker";
import { Button, LinkButton, Spinner } from "@/components/ui";

export interface StudioProduct { id: string; name: string; category: CategoryId; coverUrl: string | null }
interface Prepared { product: { id: string; name: string; category: CategoryId }; cutoutUrl: string | null; cutoutMethod: string | null; analysis: ProductAnalysis | null; suggestedScenes: StyleId[] }

type Phase = "empty" | "working" | "ready";
const STEPS = ["Uploading your photo", "Removing the background", "Reading the label", "Planning scenes for your product"];

export function Studio({ locale, balance, isTrial, creativeEnabled, maxImages, brandKits, existing, recentProducts }: {
  locale: Locale; balance: number; isTrial: boolean; creativeEnabled: boolean; maxImages: number;
  brandKits: { id: string; name: string; palette: string[] }[]; existing: StudioProduct | null; recentProducts: StudioProduct[];
}) {
  void locale;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(existing ? "working" : "empty");
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<string | null>(existing?.coverUrl ?? null);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState<CategoryId>(existing?.category ?? "other");
  const [view, setView] = useState<"cutout" | "original">("cutout");
  const [scenes, setScenes] = useState<StyleId[]>([]);
  const [output, setOutput] = useState<OutputId>("square");
  const [perScene, setPerScene] = useState(1);
  const [mode, setMode] = useState<"preserve" | "creative">("preserve");
  const [brief, setBrief] = useState("");
  const [kit, setKit] = useState<string | null>(brandKits[0]?.id ?? null);
  const [advanced, setAdvanced] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const key = useRef(newKey());
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const prepare = useCallback(async (productId: string) => {
    setStep(1);
    const timer = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 2600);
    try {
      const p = await api<Prepared>(`/api/products/${productId}/prepare`, { method: "POST" });
      setPrep(p);
      setName(p.product.name);
      setCategory(p.product.category);
      const picks = (p.suggestedScenes.length ? p.suggestedScenes : scenesFor(p.product.category).map((s) => s.id)).filter((s) => s !== "custom");
      setScenes(picks.slice(0, 2));
      setView(p.cutoutUrl ? "cutout" : "original");
      setPhase("ready");
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "We couldn't read that photo. Try another one.");
      setPhase("empty");
    } finally {
      clearInterval(timer);
    }
  }, []);

  const start = useCallback(async (files: File[]) => {
    setError(null);
    const file = files[0];
    if (!file) return;
    const problem = checkPhoto(file);
    if (problem) { setError(problem); return; }
    setPhase("working"); setStep(0); setPrep(null);
    setPreview(URL.createObjectURL(file));
    try {
      const small = await shrinkPhoto(file);
      const [k] = await uploadFiles([small]);
      const res = await api<{ productId: string }>("/api/products", {
        method: "POST",
        json: { name: "New product", category: "other", locks: CATEGORIES.other.defaultLocks, uploads: [{ key: k, viewType: "front" }] },
      });
      await prepare(res.productId);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Upload failed. Check your connection and try again.");
      setPhase("empty");
    }
  }, [prepare]);

  // Existing product (Shoot again) or files dropped on the dashboard.
  useEffect(() => {
    if (existing) { prepare(existing.id); return; }
    const pending = takePendingFiles();
    if (pending.length) start(pending);
  }, [existing, prepare, start]);

  // Paste a photo from the clipboard.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const f = Array.from(e.clipboardData?.files ?? []).filter((x) => x.type.startsWith("image/"));
      if (f.length && phase === "empty") start(f);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [phase, start]);

  const count = Math.min(maxImages, scenes.length * perScene);
  const short = count > balance;
  const needsBrief = scenes.includes("custom") && brief.trim().length < 6;
  const forced = OUTPUTS[output].forceStyle;
  const productId = prep?.product.id ?? existing?.id;

  async function saveMeta(patch: { name?: string; category?: CategoryId }) {
    if (!productId) return;
    try {
      await api(`/api/products/${productId}`, { method: "PATCH", json: { ...patch, ...(patch.category ? { locks: CATEGORIES[patch.category].defaultLocks } : {}) } });
    } catch { /* non-blocking */ }
  }

  async function generate() {
    if (!productId) return;
    setStarting(true); setError(null);
    try {
      const styles = forced ? [forced] : scenes;
      const job = await api<{ jobId: string }>("/api/jobs", {
        method: "POST",
        json: {
          productId, mode, style: styles[0], styles, output, count: forced ? perScene : count,
          customBrief: brief.trim() || null, brandKitId: kit, idempotencyKey: key.current,
        },
      });
      router.push(`/app/jobs/${job.jobId}`);
    } catch (e) {
      setStarting(false);
      const msg = e instanceof ClientApiError ? e.message : "Couldn't start the shoot. Try again.";
      setError(msg); toast(msg, true);
      key.current = newKey();
    }
  }

  const a = prep?.analysis;
  const total = forced ? perScene : count;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        {/* ---------------- Stage */}
        <section className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (phase !== "working") start(Array.from(e.dataTransfer.files)); }}
            className={clsx(
              "relative aspect-square max-h-[62vh] w-full overflow-hidden rounded-[28px] lg:max-h-none border bg-card shadow-[var(--shadow-lift)] transition-all",
              dragging ? "border-ink scale-[1.01]" : "border-line",
              phase === "ready" && view === "cutout" && prep?.cutoutUrl && "checker",
            )}
          >
            {phase === "empty" && (
              <button type="button" onClick={() => fileInput.current?.click()} className="flex size-full flex-col items-center justify-center gap-5 p-8 text-center">
                <span className="grid size-20 place-items-center rounded-3xl bg-ink text-white shadow-[var(--shadow-pop)] transition-transform hover:scale-105"><Upload size={30} /></span>
                <span>
                  <span className="block text-2xl font-semibold tracking-tight"><span className="sm:hidden">Add a product photo</span><span className="hidden sm:inline">Drop a product photo</span></span>
                  <span className="mt-1.5 block text-mute"><span className="sm:hidden">Tap to choose from your gallery</span><span className="hidden sm:inline">or click to choose · paste works too</span></span>
                </span>
                <span className="mt-2 flex flex-wrap justify-center gap-2 text-xs text-ink-2">
                  {["Label facing the camera", "Any background", "One product per photo"].map((t) => <span key={t} className="rounded-full bg-paper-2 px-3 py-1">{t}</span>)}
                </span>
              </button>
            )}

            {phase !== "empty" && preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={phase === "ready" && view === "cutout" && prep?.cutoutUrl ? prep.cutoutUrl : preview}
                alt="Your product"
                className={clsx("absolute inset-0 size-full object-contain p-6 transition-all duration-700", phase === "working" && "scale-[0.97] opacity-80")}
              />
            )}

            {phase === "working" && (
              <div className="scanline absolute inset-0">
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="glass mx-auto max-w-sm rounded-2xl px-4 py-3 shadow-[var(--shadow-lift)]">
                    {STEPS.map((s, i) => (
                      <div key={s} className={clsx("flex items-center gap-2.5 py-1 text-sm transition-opacity", i > step && "opacity-35")}>
                        {i < step ? <Check size={15} className="text-good" /> : i === step ? <Spinner className="size-3.5 text-ai" /> : <span className="size-3.5 rounded-full border border-line" />}
                        <span className={clsx(i === step && "font-medium")}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {phase === "ready" && (
              <>
                <div className="absolute left-4 top-4 flex rounded-full bg-white/90 p-1 text-xs font-medium shadow-sm backdrop-blur">
                  {prep?.cutoutUrl && (["cutout", "original"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setView(v)} className={clsx("rounded-full px-3 py-1.5 transition-colors", view === v ? "bg-ink text-white" : "text-ink-2")}>
                      {v === "cutout" ? "Cut-out" : "Original"}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { setPhase("empty"); setPrep(null); setPreview(null); }} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white" aria-label="Use a different photo">
                  <X size={16} />
                </button>
              </>
            )}
          </div>

          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { start(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { start(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

          {phase === "empty" && (
            <>
              <div className="mt-3 flex gap-2 sm:hidden">
                <Button variant="primary" className="flex-1" onClick={() => cameraInput.current?.click()}><Camera size={17} /> Take a photo</Button>
                <Button variant="outline" className="flex-1" onClick={() => fileInput.current?.click()}><ImagePlus size={17} /> Gallery</Button>
              </div>
              {recentProducts.length > 0 && (
                <div className="mt-6">
                  <div className="eyebrow mb-2.5">Or shoot a product again</div>
                  <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
                    {recentProducts.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setPreview(p.coverUrl); setPhase("working"); setName(p.name); prepare(p.id); }}
                        className="w-24 shrink-0 text-left">
                        <div className="aspect-square overflow-hidden rounded-xl border border-line bg-card">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover" />}
                        </div>
                        <div className="mt-1 truncate text-xs text-ink-2">{p.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* What the AI understood */}
          {phase === "ready" && (
            <div className="mt-4 rounded-2xl border border-line bg-card p-4 animate-rise">
              <div className="flex flex-wrap items-center gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && saveMeta({ name: name.trim() })}
                  className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight outline-none focus:underline" aria-label="Product name" />
                <select value={category} onChange={(e) => { const c = e.target.value as CategoryId; setCategory(c); saveMeta({ category: c }); }}
                  className="rounded-full bg-paper-2 px-3 py-1.5 text-xs font-medium outline-none" aria-label="Category">
                  {CATEGORY_LIST.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              {a?.visible_text.length ? (
                <div className="mt-3 flex items-start gap-2 text-sm">
                  <ScanText size={16} className="mt-0.5 shrink-0 text-ai" />
                  <div className="text-ink-2"><span className="font-medium text-ink">Label reads:</span> {a.visible_text.slice(0, 8).join(" · ")}{a.visible_text.length > 8 ? " …" : ""}</div>
                </div>
              ) : null}
              <div className="mt-2 flex items-start gap-2 text-sm text-ink-2">
                <Lock size={15} className="mt-0.5 shrink-0 text-good" />
                {prep?.cutoutUrl
                  ? <span>We&apos;ll keep your <b className="text-ink">real product pixels</b>, so the label and logo stay exact.</span>
                  : <span>This photo is hard to cut out, so the AI will re-draw the product. For exact labels, use a photo on a plain background.</span>}
              </div>
              {a?.photo_issues.length ? (
                <div className="mt-2 flex items-start gap-2 text-sm text-warn"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{a.photo_issues.slice(0, 2).join(". ")}.</span></div>
              ) : null}
            </div>
          )}
          {error && <div className="mt-3 rounded-xl border border-bad/25 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</div>}
        </section>

        {/* ---------------- Controls */}
        <section className={clsx("min-w-0 pb-28 transition-opacity lg:pb-0", phase !== "ready" && "pointer-events-none opacity-40")} aria-disabled={phase !== "ready"}>
          <h1 className="display text-3xl sm:text-4xl">{phase === "ready" ? "Pick your scenes" : "Create a photoshoot"}</h1>
          <p className="mt-1.5 text-mute">{phase === "ready" ? "Choose up to 4. Each scene is art-directed for this product." : "Upload a photo to get scene ideas made for your product."}</p>

          <div className="mt-5">
            <ScenePicker selected={scenes} onChange={setScenes} suggested={(prep?.suggestedScenes ?? scenesFor(category).slice(0, 7).map((s) => s.id)) as StyleId[]} />
          </div>

          {scenes.includes("custom") && (
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={500} rows={3}
              placeholder="Describe the scene: e.g. on a wet black rock by a waterfall, morning mist, moss around the base"
              className="mt-3 w-full rounded-2xl border border-line bg-card px-4 py-3 text-[15px] outline-none focus:border-ink" />
          )}

          <div className="mt-7">
            <div className="mb-2.5 text-sm font-semibold">Size</div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {OUTPUT_LIST.map((o) => {
                const r = o.width / o.height;
                return (
                  <button key={o.id} type="button" onClick={() => setOutput(o.id)}
                    className={clsx("flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                      output === o.id ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-ink/40")}>
                    <span className={clsx("block rounded-[4px] border-2", output === o.id ? "border-white" : "border-ink/70")}
                      style={{ width: r >= 1 ? 22 : Math.round(22 * r), height: r >= 1 ? Math.round(22 / r) : 22 }} />
                    <span>
                      <span className="block text-[13px] font-semibold leading-tight">{o.name}</span>
                      <span className={clsx("block text-[11px]", output === o.id ? "text-white/70" : "text-mute")}>{o.ratio}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-mute">{OUTPUTS[output].hint}{forced ? " Scenes don't apply to this size." : ""}</p>
          </div>

          <div className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Images per scene</div>
              <div className="text-xs text-mute">Different angles and arrangements</div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setPerScene((n) => Math.max(1, n - 1))} className="grid size-8 place-items-center rounded-full border border-line hover:border-ink" aria-label="Fewer"><Minus size={14} /></button>
              <span className="w-4 text-center font-semibold tabular-nums">{perScene}</span>
              <button type="button" onClick={() => setPerScene((n) => Math.min(4, n + 1))} className="grid size-8 place-items-center rounded-full border border-line hover:border-ink" aria-label="More"><Plus size={14} /></button>
            </div>
          </div>

          <button type="button" onClick={() => setAdvanced((v) => !v)} className="mt-5 flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
            More options <ChevronDown size={15} className={clsx("transition-transform", advanced && "rotate-180")} />
          </button>
          {advanced && (
            <div className="mt-3 space-y-4 rounded-2xl border border-line bg-card p-4 animate-rise">
              <div>
                <div className="mb-2 text-sm font-semibold">Product accuracy</div>
                <div className="grid grid-cols-2 gap-2">
                  {([["preserve", "Exact product", "Real pixels kept. Best for labels."], ["creative", "Creative", "More freedom, product may vary."]] as const).map(([m, t, d]) => (
                    <button key={m} type="button" disabled={m === "creative" && !creativeEnabled} onClick={() => setMode(m)}
                      className={clsx("rounded-xl border p-3 text-left transition-colors disabled:opacity-40", mode === m ? "border-ink bg-paper" : "border-line hover:border-ink/40")}>
                      <div className="text-sm font-semibold">{t}</div><div className="text-xs text-mute">{d}</div>
                    </button>
                  ))}
                </div>
              </div>
              {!scenes.includes("custom") && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold">Extra direction <span className="font-normal text-mute">(optional)</span></span>
                  <input value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={300} placeholder="e.g. add rose petals, cooler tones, more space on the left for text"
                    className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-ink" />
                </label>
              )}
              {brandKits.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Brand colours</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setKit(null)} className={clsx("rounded-full border px-3 py-1.5 text-xs", !kit ? "border-ink" : "border-line")}>None</button>
                    {brandKits.map((k) => (
                      <button key={k.id} type="button" onClick={() => setKit(k.id)} className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", kit === k.id ? "border-ink" : "border-line")}>
                        <span className="flex">{k.palette.slice(0, 4).map((c) => <span key={c} className="-ml-1 size-3.5 rounded-full border border-white first:ml-0" style={{ background: c }} />)}</span>{k.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ---------------- Action bar */}
      <div className={clsx("fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 px-3 transition-all lg:bottom-6 lg:left-[248px]", phase === "ready" ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0")}>
        <div className="glass mx-auto flex max-w-3xl items-center gap-3 rounded-full border border-line py-2 pl-5 pr-2 shadow-[var(--shadow-pop)]">
          <div className="min-w-0 flex-1 text-sm">
            <div className="truncate font-semibold">{total} image{total === 1 ? "" : "s"} · {total} credit{total === 1 ? "" : "s"}</div>
            <div className="truncate text-xs text-mute">{balance} available{isTrial ? " · trial images are watermarked" : ""}</div>
          </div>
          {short ? (
            <LinkButton href="/app/wallet" variant="accent" size="lg">Buy credits</LinkButton>
          ) : (
            <Button variant="primary" size="lg" disabled={starting || (!forced && scenes.length === 0) || needsBrief} onClick={generate} className="min-w-40">
              {starting ? <Spinner /> : <><Sparkles size={17} /> Generate <ArrowRight size={16} /></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function sceneName(id: string) {
  return STYLES[id as StyleId]?.name ?? id;
}
