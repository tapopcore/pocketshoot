"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight, Camera, Check, ChevronDown, Lock, Minus, PenLine, Plus, RotateCcw, ScanText, Sparkles, Upload, Wand2, X,
} from "lucide-react";
import {
  CATEGORIES, CATEGORY_LIST, OUTPUTS, OUTPUT_LIST, SCENE_GROUPS, STYLES, scenesFor,
  type CategoryId, type Locale, type OutputId, type ProductAnalysis, type SceneGroup, type SceneIdea, type StyleId,
} from "@packshot/core";
import { api, newKey, toast, uploadFiles, ClientApiError } from "@/lib/client";
import { checkPhoto, shrinkPhoto, takePendingFiles } from "@/lib/photo-client";
import { JobView } from "@/components/job-view";
import { JobCard, type JobSummary } from "@/components/job-card";
import { Spinner } from "@/components/ui";

export interface StudioProduct { id: string; name: string; category: CategoryId; coverUrl: string | null }
interface Hero { status: "pending" | "processing" | "ready" | "failed"; previewUrl: string | null; cutoutUrl: string | null; originalUrl: string | null; method: string | null }
interface Prepared { product: { id: string; name: string; category: CategoryId }; analysis: ProductAnalysis | null; ideas: SceneIdea[]; suggestedScenes: StyleId[]; hero: Hero }
type Shot = { key: string; kind: "idea" | "scene" | "custom"; title: string; description?: string; style: StyleId };
type Phase = "empty" | "reading" | "ready";
type Tab = "ideas" | "library" | "describe";

const READ_STEPS = ["Uploading", "Reading the label", "Studying the product", "Writing ideas for it"];
const MAX_SHOTS = 4;

export function Studio(props: {
  locale: Locale; balance: number; isTrial: boolean; creativeEnabled: boolean; maxImages: number;
  brandKits: { id: string; name: string; palette: string[] }[]; existing: StudioProduct | null; recentProducts: StudioProduct[];
  recentJobs: JobSummary[]; previews?: Record<string, string>; notice?: string | null; canEdit?: boolean;
}) {
  const { balance, isTrial, creativeEnabled, maxImages, brandKits, existing, recentProducts, recentJobs, previews = {}, notice } = props;
  const [phase, setPhase] = useState<Phase>(existing ? "reading" : "empty");
  const [step, setStep] = useState(0);
  const [localPreview, setLocalPreview] = useState<string | null>(existing?.coverUrl ?? null);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [view, setView] = useState<"retouched" | "original">("retouched");
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState<CategoryId>(existing?.category ?? "other");
  const [shots, setShots] = useState<Shot[]>([]);
  const [tab, setTab] = useState<Tab>("ideas");
  const [group, setGroup] = useState<SceneGroup | "for_you">("for_you");
  const [custom, setCustom] = useState("");
  const [output, setOutput] = useState<OutputId>("square");
  const [perShot, setPerShot] = useState(1);
  const [mode, setMode] = useState<"preserve" | "creative">("preserve");
  const [extra, setExtra] = useState("");
  const [kit, setKit] = useState<string | null>(brandKits[0]?.id ?? null);
  const [more, setMore] = useState(false);
  const [starting, setStarting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const key = useRef(newKey());
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const productId = prep?.product.id ?? existing?.id ?? null;

  // ---- hero (retouched packshot) polling
  useEffect(() => {
    if (!productId || !hero || hero.status === "ready" || hero.status === "failed") return;
    let stop = false;
    const tick = async () => {
      try {
        const h = await api<Hero>(`/api/products/${productId}/hero`);
        if (stop) return;
        setHero(h);
        if (h.status !== "ready" && h.status !== "failed") setTimeout(tick, 3000);
      } catch { if (!stop) setTimeout(tick, 5000); }
    };
    const t = setTimeout(tick, 2500);
    return () => { stop = true; clearTimeout(t); };
  }, [productId, hero]);

  const prepare = useCallback(async (id: string) => {
    setStep(1);
    const timer = setInterval(() => setStep((s) => Math.min(READ_STEPS.length - 1, s + 1)), 2200);
    try {
      const p = await api<Prepared>(`/api/products/${id}/prepare`, { method: "POST" });
      setPrep(p);
      setHero(p.hero);
      setName(p.product.name);
      setCategory(p.product.category);
      // Pre-select the first two AI ideas: the fastest path to a great first shoot.
      const firstIdeas = p.ideas.slice(0, 2).map((i, k) => ideaShot(i, k));
      setShots(firstIdeas.length ? firstIdeas : p.suggestedScenes.slice(0, 2).map((s) => sceneShot(s)));
      setTab(p.ideas.length ? "ideas" : "library");
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
    setPhase("reading"); setStep(0); setPrep(null); setHero(null); setJobId(null); setShots([]);
    setLocalPreview(URL.createObjectURL(file));
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

  useEffect(() => {
    if (existing) { prepare(existing.id); return; }
    const pending = takePendingFiles();
    if (pending.length) start(pending);
  }, [existing, prepare, start]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const f = Array.from(e.clipboardData?.files ?? []).filter((x) => x.type.startsWith("image/"));
      if (f.length && phase !== "reading") start(f);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [phase, start]);

  function reset() {
    setPhase("empty"); setPrep(null); setHero(null); setLocalPreview(null); setShots([]); setJobId(null); setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveMeta(patch: { name?: string; category?: CategoryId }) {
    if (!productId) return;
    try { await api(`/api/products/${productId}`, { method: "PATCH", json: { ...patch, ...(patch.category ? { locks: CATEGORIES[patch.category].defaultLocks } : {}) } }); } catch { /* non-blocking */ }
  }

  function toggle(s: Shot) {
    setShots((cur) => cur.some((x) => x.key === s.key) ? cur.filter((x) => x.key !== s.key) : cur.length >= MAX_SHOTS ? [...cur.slice(1), s] : [...cur, s]);
  }

  const forced = OUTPUTS[output].forceStyle;
  const total = forced ? perShot : Math.min(maxImages, shots.length * perShot);
  const short = total > balance;

  async function generate() {
    if (!productId) return;
    setStarting(true); setError(null);
    try {
      const styles = shots.filter((s) => s.kind === "scene").map((s) => s.style);
      const ideas = shots.filter((s) => s.kind !== "scene").map((s) => ({ title: s.title, description: s.description ?? s.title, base_scene: s.style }));
      const first = forced ?? shots[0]?.style ?? "neutral_studio";
      const job = await api<{ jobId: string }>("/api/jobs", {
        method: "POST",
        json: {
          productId, mode, style: first, output, count: total,
          styles: forced ? [forced] : styles.length ? styles : null,
          ideas: forced ? null : ideas.length ? ideas : null,
          customBrief: extra.trim() || null, brandKitId: kit, idempotencyKey: key.current,
        },
      });
      key.current = newKey();
      setJobId(job.jobId);
      setStarting(false);
      setTimeout(() => sheet.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (e) {
      setStarting(false);
      const msg = e instanceof ClientApiError ? e.message : "Couldn't start the shoot. Try again.";
      setError(msg); toast(msg, true);
      key.current = newKey();
    }
  }

  const a = prep?.analysis;
  const heroReady = hero?.status === "ready" && !!hero.cutoutUrl;
  const showRetouched = phase === "ready" && view === "retouched" && heroReady;

  // ---------------------------------------------------------------- empty
  if (phase === "empty") {
    return (
      <div>
        {notice && <div className="mb-5 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink-2 reveal">{notice}</div>}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); start(Array.from(e.dataTransfer.files)); }}
            className={clsx("set-light grain relative flex min-h-[520px] flex-col justify-between overflow-hidden rounded-[32px] border p-7 transition-all sm:p-10 lg:min-h-[640px]",
              dragging ? "scale-[1.01] border-accent" : "border-line")}
          >
            <div className="reveal">
              <div className="tracked text-mute">Studio · new shoot</div>
              <h1 className="mt-5 max-w-xl text-[44px] font-semibold leading-[0.98] tracking-[-0.04em] sm:text-[64px] lg:text-[76px]">
                Drop a product.<br /><span className="serif-i text-[1.12em] font-normal text-accent">Get the shoot.</span>
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">Any photo works, even in your hand. We retouch it, read the label, and art-direct campaign shots made for it.</p>
            </div>
            <div className="reveal" style={{ animationDelay: "120ms" }}>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => fileInput.current?.click()} className="cta-strobe inline-flex h-14 items-center gap-2.5 rounded-full px-7 text-[16px] font-semibold">
                  <Upload size={19} /> Upload a photo
                </button>
                <button type="button" onClick={() => cameraInput.current?.click()} className="inline-flex h-14 items-center gap-2 rounded-full border border-line bg-card px-6 font-medium sm:hidden">
                  <Camera size={18} /> Camera
                </button>
                <span className="hidden text-sm text-mute sm:inline">or drop it here · paste works too</span>
              </div>
              {error && <div className="mt-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</div>}
            </div>
            <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-4 select-none text-[220px] font-semibold leading-none tracking-[-0.06em] text-ink/[0.035] sm:text-[300px]">01</span>
          </div>

          <aside className="flex flex-col gap-6">
            <ProofCollage previews={previews} />
            <ol className="space-y-4">
              {[
                ["Retouch", "Hands, dust, glare and background removed. Your label stays exact."],
                ["Direct", "AI writes campaign ideas for your product, not generic templates."],
                ["Shoot", "Studio-grade images in under a minute, ready for your store and ads."],
              ].map(([t, d], i) => (
                <li key={t} className="reveal flex gap-4" style={{ animationDelay: `${200 + i * 100}ms` }}>
                  <span className="serif-i w-8 shrink-0 text-3xl leading-none text-accent">{i + 1}</span>
                  <span><span className="block font-semibold">{t}</span><span className="block text-sm text-mute">{d}</span></span>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { start(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { start(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

        {recentProducts.length > 0 && (
          <section className="mt-12">
            <SectionHead title="Shoot again" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-8 sm:px-8">
              {recentProducts.map((p) => (
                <button key={p.id} type="button" onClick={() => { setLocalPreview(p.coverUrl); setName(p.name); setPhase("reading"); prepare(p.id); }} className="group w-32 shrink-0 text-left">
                  <div className="aspect-square overflow-hidden rounded-2xl border border-line bg-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                  </div>
                  <div className="mt-1.5 truncate text-sm text-ink-2">{p.name}</div>
                </button>
              ))}
            </div>
          </section>
        )}
        {recentJobs.length > 0 && (
          <section className="mt-10">
            <SectionHead title="Recent shoots" href="/app/library" link="All images" />
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
              {recentJobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- workspace
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-8">
        {/* Stage */}
        <section className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); if (phase !== "reading") start(Array.from(e.dataTransfer.files)); }}
            className={clsx("set-light grain relative aspect-[4/5] max-h-[78vh] w-full overflow-hidden rounded-[32px] border", dragging ? "border-accent" : "border-line")}
          >
            {(hero?.originalUrl ?? localPreview) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero?.originalUrl ?? localPreview!} alt="Your photo"
                className={clsx("absolute inset-0 size-full object-contain p-[7%] transition-all duration-700",
                  phase === "reading" && "scale-[0.97] opacity-70 blur-[1px]",
                  showRetouched && "scale-[0.96] opacity-0 blur-md")} />
            )}
            {heroReady && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero!.cutoutUrl!} alt="Your product, retouched"
                className={clsx("absolute inset-0 size-full object-contain p-[11%] drop-shadow-[0_40px_40px_rgba(0,0,0,0.55)] transition-all duration-1000 ease-out",
                  showRetouched ? "scale-100 opacity-100" : "scale-[1.04] opacity-0")} />
            )}
            <div className={clsx("pointer-events-none absolute inset-x-[24%] bottom-[9%] h-6 rounded-[50%] bg-black/60 blur-xl transition-opacity duration-1000", showRetouched ? "opacity-100" : "opacity-0")} />

            {phase === "reading" && (
              <div className="scanline absolute inset-0">
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="glass mx-auto max-w-xs rounded-2xl border border-line px-4 py-3">
                    {READ_STEPS.map((s, i) => (
                      <div key={s} className={clsx("flex items-center gap-2.5 py-1 text-sm transition-opacity", i > step && "opacity-30")}>
                        {i < step ? <Check size={15} className="text-good" /> : i === step ? <Spinner className="size-3.5 text-accent" /> : <span className="size-3.5 rounded-full border border-line" />}
                        <span className={clsx(i === step && "font-medium")}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {phase === "ready" && (
              <>
                <div className="absolute left-4 top-4 flex rounded-full border border-line bg-paper/70 p-1 text-xs font-medium backdrop-blur-md">
                  {(["retouched", "original"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setView(v)} disabled={v === "retouched" && !heroReady && hero?.status !== "processing"}
                      className={clsx("rounded-full px-3 py-1.5 transition-colors disabled:opacity-40", view === v ? "bg-ink text-paper" : "text-ink-2")}>
                      {v === "retouched" ? "Retouched" : "Original"}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={reset} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-line bg-paper/70 backdrop-blur-md hover:bg-paper" aria-label="New product">
                  <X size={16} />
                </button>
                {hero && hero.status !== "ready" && hero.status !== "failed" && (
                  <div className="absolute inset-x-0 bottom-5 flex justify-center">
                    <div className="glass inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm">
                      <Spinner className="size-3.5 text-accent" /> Retouching your photo · about 40 s · pick ideas meanwhile
                    </div>
                  </div>
                )}
                {hero?.status === "failed" && (
                  <div className="absolute inset-x-4 bottom-5 rounded-2xl border border-warn/30 bg-paper/80 px-4 py-2.5 text-sm text-warn backdrop-blur">We couldn&apos;t retouch this photo, so the AI will work from the original.</div>
                )}
              </>
            )}
          </div>

          {/* Product read-out */}
          {phase === "ready" && (
            <div className="mt-5 reveal">
              <div className="flex flex-wrap items-center gap-3">
                <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && saveMeta({ name: name.trim() })} aria-label="Product name"
                  className="min-w-0 flex-1 bg-transparent text-[28px] font-semibold leading-tight tracking-[-0.03em] outline-none placeholder:text-mute focus:underline focus:decoration-accent/60 focus:underline-offset-8" />
                <select value={category} onChange={(e) => { const c = e.target.value as CategoryId; setCategory(c); saveMeta({ category: c }); }} aria-label="Category"
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium outline-none">
                  {CATEGORY_LIST.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {a?.visible_text.length ? (
                  <div className="flex items-start gap-2.5"><ScanText size={16} className="mt-0.5 shrink-0 text-accent" />
                    <div className="flex flex-wrap gap-1.5">{a.visible_text.slice(0, 10).map((t, i) => <span key={i} className="rounded-md bg-paper-2 px-2 py-0.5 font-mono text-[12px] text-ink-2">{t}</span>)}</div>
                  </div>
                ) : null}
                <div className="flex items-start gap-2.5 text-ink-2"><Lock size={15} className="mt-0.5 shrink-0 text-good" />
                  <span>Your label and logo detail are restored from your photo in every shot.</span></div>
                {a?.photo_issues.length ? (
                  <div className="flex items-start gap-2.5 text-mute"><Wand2 size={15} className="mt-0.5 shrink-0" /><span>Fixed in retouch: {a.photo_issues.slice(0, 3).join(", ")}.</span></div>
                ) : null}
              </div>
            </div>
          )}
          {error && <div className="mt-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">{error}</div>}
        </section>

        {/* Direction */}
        <section className={clsx("min-w-0 pb-32 transition-opacity lg:pb-6", phase !== "ready" && "pointer-events-none opacity-40")}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="tracked text-mute">Direction</div>
              <h2 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">What should we <span className="serif-i font-normal">shoot?</span></h2>
            </div>
            <span className="shrink-0 rounded-full border border-line px-3 py-1 text-xs tabular-nums text-ink-2">{shots.length}/{MAX_SHOTS} shots</span>
          </div>

          <div className="mt-5 flex gap-1 rounded-full border border-line bg-card p-1 text-sm font-medium">
            {([["ideas", "Made for you"], ["library", "Scene library"], ["describe", "Describe"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={clsx("flex-1 rounded-full px-3 py-2 transition-colors", tab === id ? "bg-ink text-paper" : "text-mute hover:text-ink")}>
                {id === "ideas" && <Sparkles size={13} className="-mt-0.5 mr-1.5 inline" />}{id === "ideas" ? <><span className="sm:hidden">For you</span><span className="hidden sm:inline">{label}</span></> : id === "library" ? <><span className="sm:hidden">Scenes</span><span className="hidden sm:inline">{label}</span></> : label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === "ideas" && (
              prep?.ideas.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {prep.ideas.map((idea, i) => {
                    const s = ideaShot(idea, i);
                    const on = shots.some((x) => x.key === s.key);
                    return <IdeaCard key={s.key} idea={idea} index={i} selected={on} order={shots.findIndex((x) => x.key === s.key) + 1} preview={previews[idea.base_scene]} onClick={() => toggle(s)} />;
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-mute">Ideas appear here once we&apos;ve studied your product.</div>
              )
            )}
            {tab === "library" && (
              <SceneLibrary group={group} setGroup={setGroup} suggested={(prep?.suggestedScenes ?? scenesFor(category).slice(0, 7).map((s) => s.id)) as StyleId[]}
                previews={previews} selected={shots} onToggle={(id) => toggle(sceneShot(id))} />
            )}
            {tab === "describe" && (
              <div className="rounded-2xl border border-line bg-card p-4">
                <textarea value={custom} onChange={(e) => setCustom(e.target.value)} rows={4} maxLength={300}
                  placeholder="Describe the shot. For example: on a wet black rock beside a waterfall, morning mist, moss around the base."
                  className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-mute" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["On a marble bathroom shelf with eucalyptus", "Floating above a pastel podium with petals", "On a café table in golden-hour light", "Flat lay on linen with dried flowers"].map((x) => (
                    <button key={x} type="button" onClick={() => setCustom(x)} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:border-ink/30">{x}</button>
                  ))}
                </div>
                <button type="button" disabled={custom.trim().length < 8}
                  onClick={() => { toggle({ key: `custom-${Date.now()}`, kind: "custom", title: "Your idea", description: custom.trim(), style: "custom" }); setCustom(""); }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40">
                  <Plus size={15} /> Add to shot list
                </button>
              </div>
            )}
          </div>

          {/* Shot list */}
          {shots.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {shots.map((s, i) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1 pr-2 text-sm animate-pop">
                  <span className="grid size-6 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper">{i + 1}</span>
                  <span className="max-w-44 truncate">{s.title}</span>
                  <button type="button" onClick={() => toggle(s)} aria-label={`Remove ${s.title}`} className="text-mute hover:text-ink"><X size={14} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Format */}
          <div className="mt-7">
            <div className="tracked mb-2.5 text-mute">Format</div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {OUTPUT_LIST.map((o) => {
                const r = o.width / o.height;
                return (
                  <button key={o.id} type="button" onClick={() => setOutput(o.id)}
                    className={clsx("flex shrink-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                      output === o.id ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink/30")}>
                    <span className="block rounded-[3px] border-[1.5px] border-current opacity-80" style={{ width: r >= 1 ? 22 : Math.round(22 * r), height: r >= 1 ? Math.round(22 / r) : 22 }} />
                    <span><span className="block text-[13px] font-semibold leading-tight">{o.name}</span><span className="block text-[11px] opacity-60">{o.ratio}</span></span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-mute">{OUTPUTS[output].hint}{forced ? " Shots don't apply to this format." : ""}</p>
          </div>

          <button type="button" onClick={() => setMore((v) => !v)} className="mt-5 flex items-center gap-1.5 text-sm font-medium text-mute hover:text-ink">
            More options <ChevronDown size={15} className={clsx("transition-transform", more && "rotate-180")} />
          </button>
          {more && (
            <div className="mt-3 space-y-5 rounded-2xl border border-line bg-card p-4 reveal">
              <div className="flex items-center justify-between">
                <div><div className="text-sm font-semibold">Images per shot</div><div className="text-xs text-mute">Different arrangements of the same idea</div></div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setPerShot((n) => Math.max(1, n - 1))} className="grid size-8 place-items-center rounded-full border border-line hover:border-ink/40" aria-label="Fewer"><Minus size={14} /></button>
                  <span className="w-4 text-center font-semibold tabular-nums">{perShot}</span>
                  <button type="button" onClick={() => setPerShot((n) => Math.min(4, n + 1))} className="grid size-8 place-items-center rounded-full border border-line hover:border-ink/40" aria-label="More"><Plus size={14} /></button>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold">Product accuracy</div>
                <div className="grid grid-cols-2 gap-2">
                  {([["preserve", "Exact product", "Label detail restored from your photo"], ["creative", "Creative", "Freer angles, product may vary"]] as const).map(([m, t, d]) => (
                    <button key={m} type="button" disabled={m === "creative" && !creativeEnabled} onClick={() => setMode(m)}
                      className={clsx("rounded-xl border p-3 text-left transition-colors disabled:opacity-40", mode === m ? "border-ink bg-paper-2" : "border-line hover:border-ink/30")}>
                      <div className="text-sm font-semibold">{t}</div><div className="text-xs text-mute">{d}</div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><PenLine size={14} /> Extra direction for every shot</span>
                <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={300} placeholder="e.g. cooler tones, more space on the left for text"
                  className="h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-[15px] outline-none focus:border-ink/40" />
              </label>
              {brandKits.length > 0 && (
                <div>
                  <div className="mb-2 text-sm font-semibold">Brand colours</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setKit(null)} className={clsx("rounded-full border px-3 py-1.5 text-xs", !kit ? "border-ink" : "border-line")}>None</button>
                    {brandKits.map((k) => (
                      <button key={k.id} type="button" onClick={() => setKit(k.id)} className={clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", kit === k.id ? "border-ink" : "border-line")}>
                        <span className="flex">{k.palette.slice(0, 4).map((c) => <span key={c} className="-ml-1 size-3.5 rounded-full border border-paper first:ml-0" style={{ background: c }} />)}</span>{k.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Shoot */}
          <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-paper/90 px-4 py-3 backdrop-blur-xl lg:static lg:mt-7 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            {short ? (
              <Link href="/app/wallet" className="cta-strobe flex h-14 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold">Buy credits to shoot {total} images</Link>
            ) : (
              <button type="button" onClick={generate} disabled={starting || phase !== "ready" || (!forced && shots.length === 0)}
                className="cta-strobe flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[16px] font-semibold">
                {starting ? <Spinner /> : <><Sparkles size={18} /> Shoot {total} image{total === 1 ? "" : "s"} <span className="font-normal opacity-80">· {total} credit{total === 1 ? "" : "s"}</span> <ArrowRight size={17} /></>}
              </button>
            )}
            <div className="mt-2 text-center text-xs text-mute">{balance} credits available{isTrial ? " · trial images carry a watermark" : ""}</div>
          </div>
        </section>
      </div>

      {jobId && (
        <section ref={sheet} className="mt-14 scroll-mt-6 border-t border-line pt-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <div className="tracked text-mute">Contact sheet</div>
              <h2 className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.035em]">Your <span className="serif-i font-normal">shoot</span></h2>
            </div>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium hover:border-ink/30">
              <RotateCcw size={14} /> Shoot more ideas
            </button>
          </div>
          <JobView jobId={jobId} embedded />
        </section>
      )}
    </div>
  );
}

function ideaShot(i: SceneIdea, k: number): Shot {
  return { key: `idea-${k}-${i.title}`, kind: "idea", title: i.title, description: i.description, style: (i.base_scene in STYLES ? i.base_scene : "neutral_studio") as StyleId };
}
function sceneShot(id: StyleId): Shot {
  return { key: `scene-${id}`, kind: "scene", title: STYLES[id]?.name ?? id, style: id };
}

function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="text-[22px] font-semibold tracking-[-0.03em]">{title}</h2>
      {href && <Link href={href} className="text-sm text-mute hover:text-ink">{link} →</Link>}
    </div>
  );
}

function IdeaCard({ idea, index, selected, order, preview, onClick }: { idea: SceneIdea; index: number; selected: boolean; order: number; preview?: string; onClick: () => void }) {
  const base = STYLES[idea.base_scene as StyleId];
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={clsx("group relative flex min-h-44 flex-col justify-end overflow-hidden rounded-3xl border p-4 text-left transition-all duration-300 reveal",
        selected ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-line hover:-translate-y-0.5 hover:border-ink/25")}
      style={{ animationDelay: `${index * 70}ms` }}>
      <div className="absolute inset-0" style={{ background: base?.art }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {preview && <img src={preview} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
      <span className="relative tracked text-white/60">Idea {index + 1}</span>
      <span className="relative mt-1 text-[22px] leading-tight text-white"><span className="serif-i">{idea.title}</span></span>
      <span className="relative mt-1 line-clamp-2 text-[13px] leading-snug text-white/75">{idea.description}</span>
      <span className={clsx("absolute right-3 top-3 grid size-7 place-items-center rounded-full text-[12px] font-semibold transition-all",
        selected ? "bg-accent text-white" : "border border-white/40 bg-black/20 text-transparent group-hover:text-white/70")}>
        {selected ? order : <Plus size={14} />}
      </span>
    </button>
  );
}

function SceneLibrary({ group, setGroup, suggested, previews, selected, onToggle }: {
  group: SceneGroup | "for_you"; setGroup: (g: SceneGroup | "for_you") => void; suggested: StyleId[]; previews: Record<string, string>; selected: Shot[]; onToggle: (id: StyleId) => void;
}) {
  const list = useMemo(() => group === "for_you" ? suggested.filter((s) => s !== "custom") : Object.values(STYLES).filter((s) => s.group === group && s.id !== "custom").map((s) => s.id), [group, suggested]);
  return (
    <div>
      <div className="no-scrollbar -mx-1 mb-3 flex gap-1 overflow-x-auto px-1">
        {[{ id: "for_you" as const, name: "Suggested" }, ...SCENE_GROUPS].map((g) => (
          <button key={g.id} type="button" onClick={() => setGroup(g.id)}
            className={clsx("shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors", group === g.id ? "bg-paper-2 text-ink" : "text-mute hover:text-ink")}>{g.name}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {list.map((id) => {
          const s = STYLES[id];
          const idx = selected.findIndex((x) => x.key === `scene-${id}`);
          return (
            <button key={id} type="button" onClick={() => onToggle(id)} aria-pressed={idx >= 0}
              className={clsx("group relative overflow-hidden rounded-2xl border text-left transition-all", idx >= 0 ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-line hover:border-ink/25")}>
              <div className="relative aspect-[4/5]" style={{ background: s.art }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {previews[id] && <img src={previews[id]} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-8">
                  <div className="truncate text-[13px] font-semibold text-white">{s.name}</div>
                </div>
                {idx >= 0 && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white animate-pop">{idx + 1}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProofCollage({ previews }: { previews: Record<string, string> }) {
  const picks: StyleId[] = ["pastel_podium", "botanical", "luxury_dark"];
  return (
    <div className="relative h-[300px] reveal sm:h-[340px]" style={{ animationDelay: "160ms" }}>
      {picks.map((id, i) => (
        <div key={id} className="absolute overflow-hidden rounded-3xl border border-line shadow-[var(--shadow-pop)]"
          style={{ width: "52%", aspectRatio: "4/5", left: `${i * 24}%`, top: `${[14, 0, 18][i]}%`, transform: `rotate(${[-5, 1.5, 6][i]}deg)`, zIndex: i === 1 ? 2 : 1, background: STYLES[id].art }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previews[id] && <img src={previews[id]} alt="" className="size-full object-cover" />}
          <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white backdrop-blur">{STYLES[id].name}</span>
        </div>
      ))}
    </div>
  );
}
