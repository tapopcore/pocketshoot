/* eslint-disable @next/next/no-img-element -- Catalogue images are pre-sized and compressed. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, ImagePlus, Loader2, Minus, Plus, X } from "lucide-react";
import { CATEGORIES, isCategoryId, SHOOT_STYLE_IDS, SHOOT_STYLES, type CategoryId, type Locale, type OutputId, type ProductAnalysis, type SceneIdea, type ShootStyleId } from "@packshot/core";
import { INDUSTRIES } from "@/lib/shoot-catalog";
import { api, ClientApiError, newKey, uploadFiles } from "@/lib/client";
import { checkPhoto, shrinkPhoto, takePendingFiles } from "@/lib/photo-client";
import dynamic from "next/dynamic";
const JobView = dynamic(() => import("@/components/job-view").then(m => m.JobView), { loading: () => <p role="status" className="py-8 text-sm text-mute">Opening your shoot…</p> });
import { JobCard, type JobSummary } from "@/components/job-card";

export interface StudioProduct { id: string; name: string; category: CategoryId; coverUrl: string | null }
interface Hero { status: string; originalUrl: string | null; cutoutUrl: string | null; previewUrl: string | null; method: string | null }
interface Prepared { product: { id: string; name: string; category: CategoryId }; analysis: ProductAnalysis | null; ideas: SceneIdea[]; suggestedScenes: string[]; hero: Hero }
type Step = 0 | 1 | 2 | 3;
const STEPS = ["Industry", "Style", "Product", "Create"];
export function Studio(props: {
  fixture?: Prepared; initialIndustry?: string; initialLook?: string;
  locale: Locale; balance: number; creditsPerImage?: number; isTrial: boolean; creativeEnabled: boolean; maxImages: number;
  brandKits: { id: string; name: string; palette: string[] }[]; existing: StudioProduct | null; recentProducts: StudioProduct[];
  recentJobs: JobSummary[]; previews?: Record<string, string>; notice?: string | null; canEdit?: boolean;
}) {
  const initialIndustry = props.initialIndustry && isCategoryId(props.initialIndustry) ? props.initialIndustry : null;
  const initialLook = SHOOT_STYLE_IDS.includes(props.initialLook as ShootStyleId) ? props.initialLook as ShootStyleId : null;
  const [industry, setIndustry] = useState<CategoryId | null>(props.existing?.category ?? initialIndustry);
  const [look, setLook] = useState<ShootStyleId | null>(initialLook);
  const [step, setStep] = useState<Step>(initialIndustry ? initialLook ? 2 : 1 : 0);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(props.notice ?? null);
  const [photo, setPhoto] = useState<string | null>(props.existing?.coverUrl ?? null);
  const [output, setOutput] = useState<OutputId>("square");
  const [count, setCount] = useState(1);
  const [brief, setBrief] = useState("");
  const [kit, setKit] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const key = useRef(newKey());
  const submitLock = useRef(false);
  const pendingFiles = useRef<File[]>([]);
  const objectUrl = useRef<string | null>(null);
  const maxCount = Math.max(1, Math.min(props.maxImages, 4));
  const cost = count * (props.creditsPerImage ?? 1);
  const selected = look ? SHOOT_STYLES[look] : null;
  const disabled = props.canEdit === false;
  const go = (next: Step) => { setError(null); setStep(next); };

  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); }, [step, jobId]);
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  useEffect(() => { pendingFiles.current = takePendingFiles(); }, []);

  const prepare = useCallback(async (id: string) => {
    const p = await api<Prepared>("/api/products/" + id + "/prepare", { method: "POST" });
    setPrep(p); setName(p.product.name); setPhoto(previous => p.hero.originalUrl ?? previous); setStep(3);
  }, []);

  async function upload(files: File[]) {
    const file = files[0];
    if (!file || busy || disabled || !industry || !look) return;
    const issue = checkPhoto(file);
    if (issue) { setError(issue); return; }
    setBusy(true); setError(null);
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file); setPhoto(objectUrl.current);
    try {
      const small = await shrinkPhoto(file);
      const [storageKey] = await uploadFiles([small]);
      const p = await api<{ productId: string }>("/api/products", { method: "POST", json: {
        name: "New product", category: industry, locks: CATEGORIES[industry].defaultLocks,
        uploads: [{ key: storageKey, viewType: "front" }],
      } });
      await prepare(p.productId);
    } catch (e) { setError(e instanceof ClientApiError ? e.message : "We couldn't read that photo. Please try again."); }
    finally { setBusy(false); }
  }

  async function next() {
    if (step === 0 && industry) {
      if (prep && prep.product.category !== industry && !props.fixture) {
        setBusy(true);
        try {
          await api("/api/products/" + prep.product.id, { method: "PATCH", json: { category: industry, locks: CATEGORIES[industry].defaultLocks } });
          setPrep({ ...prep, product: { ...prep.product, category: industry } });
        } catch { setError("We couldn't update the industry. Try again."); return; }
        finally { setBusy(false); }
      }
      go(1);
    } else if (step === 1 && look) go(prep ? 3 : 2);
    else if (step === 2) {
      if (prep) go(3);
      else if (props.existing) {
        setBusy(true); setError(null);
        try { await prepare(props.existing.id); } catch { setError("We couldn't open this product. Please try again."); } finally { setBusy(false); }
      } else if (pendingFiles.current.length) { const files = pendingFiles.current; pendingFiles.current = []; await upload(files); }
      else fileInput.current?.click();
    }
  }

  async function generate() {
    if (!prep || !look || submitLock.current || disabled) return;
    if (props.fixture) { setNotice("Design preview only. No images generated and no credits used."); return; }
    submitLock.current = true; setStarting(true); setError(null);
    try {
      if (name.trim() && name.trim() !== prep.product.name) await api("/api/products/" + prep.product.id, { method: "PATCH", json: { name: name.trim() } });
      const result = await api<{ jobId: string }>("/api/jobs", { method: "POST", json: {
        productId: prep.product.id, mode: "preserve", style: SHOOT_STYLES[look].scene,
        shootStyle: look, output, count, customBrief: brief.trim() || null,
        brandKitId: kit, idempotencyKey: key.current,
      } });
      key.current = newKey(); setJobId(result.jobId);
    } catch (e) { setError(e instanceof ClientApiError ? e.message : "We couldn't start this shoot. Please try again."); }
    finally { setStarting(false); submitLock.current = false; }
  }

  const back = () => go(step === 3 ? 2 : step === 2 ? 1 : 0);
  return <div className="shoot-flow mx-auto max-w-[1040px] pb-12">
    {notice && <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm" role="status"><span>{notice}</span><button type="button" className="grid size-11 shrink-0 place-items-center" onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={16} /></button></div>}
    {jobId ? <section>
      <Link href="/app/library" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm"><ArrowLeft size={16} /> Your library</Link>
      <h1 ref={heading} tabIndex={-1} className="mb-2 text-3xl font-semibold tracking-tight">Your shoot is taking shape.</h1>
      <p className="mb-7 text-sm text-ink-2">Results appear here as they finish. Review product details before publishing.</p>
      <JobView jobId={jobId} embedded />
      <button type="button" onClick={() => { setJobId(null); setPrep(null); setPhoto(null); setName(""); go(2); }} className="mt-6 min-h-12 rounded-full border border-line px-6 font-semibold">Shoot another product</button>
    </section> : <>
      <nav aria-label="Shoot progress" className="mb-7 grid grid-cols-4 gap-2 border-b border-line pb-5 sm:mb-10">
        {STEPS.map((label, i) => <button key={label} type="button" disabled={i > step || busy || starting} onClick={() => go(i as Step)} aria-current={i === step ? "step" : undefined} className={clsx("flex min-h-11 items-center justify-center gap-1.5 text-xs font-medium sm:text-sm", i === step ? "text-ink" : "text-mute")}>
          <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full text-[11px]", i === step ? "bg-ink text-paper" : i < step ? "bg-accent/10 text-accent-ink" : "bg-paper-2")}>{i < step ? <Check size={12} /> : i + 1}</span>{label}
        </button>)}
      </nav>
      <header className="mb-6 sm:mb-8">
        <h1 ref={heading} tabIndex={-1} className="text-[30px] font-semibold leading-[1.1] tracking-[-0.04em] sm:text-[46px]">{["What do you sell?", "Find your photographic style.", "Meet your product.", "Ready for its close-up."][step]}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-base">{["Choose your industry. We'll tailor the shoot to your product.", "Pick one look. The example shows the style, not your final image.", "One clear product photo is enough to start.", "Check your choices, then create your first shot."][step]}</p>
      </header>
      {error && <p role="alert" className="mb-5 rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{error}</p>}
      {disabled && <p className="mb-5 text-sm text-warn">Your workspace role can view shoots. Ask an editor to create one.</p>}
      {step === 0 && <section aria-label="Industries">
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-5">
          {INDUSTRIES.map(item => <PhotoChoice key={item.id} image={item.image} title={item.title} selected={industry === item.id} onClick={() => setIndustry(item.id)} />)}
        </div>
        <button type="button" aria-pressed={industry === "other"} onClick={() => setIndustry("other")} className={clsx("mt-6 min-h-11 rounded-full border px-5 text-sm", industry === "other" ? "border-ink bg-ink text-paper" : "border-line")}>Something else</button>
      </section>}
      {step === 1 && <section aria-label="Photographic styles">
        <div className="mb-5 flex items-center gap-2 text-xs text-mute"><span className="size-1.5 rounded-full bg-accent" /> {industry ? INDUSTRIES.find(i => i.id === industry)?.title ?? "Your industry" : "All products"} <span aria-hidden="true">·</span> All six styles available</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-5">
          {SHOOT_STYLE_IDS.map(id => { const item = SHOOT_STYLES[id]; return <PhotoChoice key={id} image={item.image} title={item.title} subtitle={item.subtitle} selected={look === id} onClick={() => setLook(id)} />; })}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-mute">AI-created style examples. Your product&apos;s colours, branding and construction guide the final shot.</p>
      </section>}
      {step === 2 && <section className="grid gap-6 md:grid-cols-[1.15fr_1fr]">
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) void upload(Array.from(e.dataTransfer.files)); }} className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-ink/25 bg-card p-6 text-center sm:min-h-[360px]">
          {busy ? <><Loader2 className="mb-4 size-8 animate-spin text-accent" /><h2 className="text-xl font-semibold">Studying your product</h2><p className="mt-2 text-sm text-mute">Reading the visible details. No images are being generated.</p></> : <>
            {photo ? <img src={photo} alt="Your original product" className="mb-5 h-36 w-40 object-contain" /> : <ImagePlus className="mb-5 size-10 text-accent-ink" strokeWidth={1.4} />}
            <h2 className="text-xl font-semibold">{props.existing ? props.existing.name : "Add your product photo"}</h2>
            <p className="mt-2 text-sm text-mute">JPG, PNG or WebP · a sharp label works best</p>
            <button type="button" disabled={disabled} onClick={() => fileInput.current?.click()} className="mt-6 min-h-12 rounded-full bg-ink px-7 text-sm font-semibold text-paper disabled:opacity-40">Choose a photo</button>
            <button type="button" disabled={disabled} onClick={() => cameraInput.current?.click()} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-ink-2"><Camera size={17} /> Take a photo</button>
            {props.fixture && <button type="button" className="mt-3 min-h-11 text-sm underline" onClick={() => { setPrep(props.fixture!); setName(props.fixture!.product.name); setPhoto(props.fixture!.hero.originalUrl); go(3); }}>Use example product</button>}
          </>}
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload product photo" disabled={busy || disabled} onChange={e => { void upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Take product photo" disabled={busy || disabled} onChange={e => { void upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        </div>
        <div className="rounded-2xl bg-paper-2/70 p-5 sm:p-7">
          {selected && <div className="flex items-center gap-4"><img src={selected.image} alt={selected.title + " style example"} className="size-24 rounded-xl object-cover" /><div><p className="text-xs text-mute">Your style</p><h2 className="mt-1 text-xl font-semibold">{selected.title}</h2><button type="button" onClick={() => go(1)} className="mt-1 min-h-11 text-sm underline underline-offset-4">Change style</button></div></div>}
          <h3 className="mt-6 text-sm font-semibold">For the best starting photo</h3>
          <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">{["Show the whole product.", "Use soft daylight and a plain background.", "Keep the label sharp and uncovered."].map(t => <li className="flex gap-2" key={t}><Check size={16} className="mt-0.5 shrink-0 text-accent-ink" />{t}</li>)}</ul>
        </div>
      </section>}
      {step === 3 && prep && selected && <section className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <div className="grid grid-cols-2 gap-3 self-start">
          <figure className="min-w-0"><div className="aspect-square overflow-hidden rounded-2xl border border-line bg-card"><img src={photo ?? prep.hero.originalUrl ?? ""} alt="Your original product photo" className="size-full object-contain p-4" /></div><figcaption className="mt-2 text-xs text-mute">Your product</figcaption></figure>
          <figure className="min-w-0"><img src={selected.image} alt={selected.title + " style reference, not a generated preview"} className="aspect-square w-full rounded-2xl object-cover" /><figcaption className="mt-2 text-xs text-mute">{selected.title} · style example</figcaption></figure>
          <div className="col-span-2 mt-2"><label htmlFor="product-name" className="text-xs text-mute">Product name</label><input id="product-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} className="mt-1 min-h-12 w-full border-b border-line bg-transparent text-lg font-semibold outline-none focus:border-ink" /></div>
          {prep.analysis?.photo_issues.length ? <p className="col-span-2 text-xs leading-relaxed text-warn">Photo note: {prep.analysis.photo_issues[0]}</p> : null}
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Make it yours.</h2>
          <fieldset className="mt-6"><legend className="mb-3 text-sm font-medium">Image shape</legend><div className="grid grid-cols-3 gap-2">{([["square", "Square", "1:1"], ["portrait", "Portrait", "4:5"], ["story", "Story", "9:16"]] as const).map(([id, title, ratio]) => <button key={id} type="button" aria-pressed={output === id} onClick={() => setOutput(id)} className={clsx("min-h-16 rounded-xl border px-2 py-2 text-sm", output === id ? "border-ink bg-paper-2" : "border-line")}><span className="block font-semibold">{title}</span><span className="text-xs text-mute">{ratio}</span></button>)}</div></fieldset>
          <div className="mt-6 flex items-center justify-between"><span className="text-sm font-medium">Images</span><div className="flex items-center rounded-full border border-line"><button type="button" aria-label="Fewer images" disabled={count === 1} onClick={() => setCount(n => n - 1)} className="grid size-11 place-items-center disabled:opacity-25"><Minus size={16} /></button><span className="w-8 text-center text-sm font-semibold" aria-live="polite">{count}</span><button type="button" aria-label="More images" disabled={count >= maxCount} onClick={() => setCount(n => n + 1)} className="grid size-11 place-items-center disabled:opacity-25"><Plus size={16} /></button></div></div>
          <details className="mt-6 border-t border-line pt-2"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-sm text-ink-2">Add a note or brand colours <ChevronDown size={16} /></summary><label htmlFor="shoot-note" className="sr-only">Optional creative note</label><textarea id="shoot-note" value={brief} onChange={e => setBrief(e.target.value)} maxLength={160} rows={3} placeholder="Optional. E.g. warm morning light, lots of space on the left." className="mt-2 w-full rounded-xl border border-line bg-paper p-3 text-base sm:text-sm" />{props.brandKits.length > 0 && <label className="mt-3 block text-sm">Brand colours<select value={kit ?? ""} onChange={e => setKit(e.target.value || null)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-paper px-3"><option value="">No brand kit</option>{props.brandKits.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>}</details>
          <div className="mt-5 flex items-center justify-between border-t border-line pt-5"><span className="text-sm">Total</span><strong className="text-xl">{cost} credit{cost !== 1 ? "s" : ""}</strong></div>
          <p className="mt-2 text-xs leading-relaxed text-mute">Review labels, fine details and any human interaction before publishing.</p>
        </div>
      </section>}
      <div className="shoot-action fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-20 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-md lg:bottom-0 lg:left-[236px] sm:px-8">
        <div className="mx-auto flex max-w-[1040px] items-center gap-3">
          {step > 0 && <button type="button" onClick={back} disabled={busy || starting} aria-label="Previous step" className="grid size-12 shrink-0 place-items-center rounded-full border border-line disabled:opacity-40"><ArrowLeft size={19} /></button>}
          <div className="hidden flex-1 text-sm text-ink-2 sm:block">{step === 3 ? props.balance + " credits available" : step === 0 ? "Start with your industry" : step === 1 ? selected?.title ?? "Choose one style" : "Your product, your chosen style"}</div>
          {step === 3 && cost > props.balance ? <Link href="/app/wallet" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-paper sm:flex-none">Get credits · {cost} needed <ArrowRight size={17} /></Link> :
          <button type="button" onClick={() => { if (step === 3) void generate(); else void next(); }} disabled={busy || starting || disabled || (step === 0 && !industry) || (step === 1 && !look) || (step === 3 && (!prep || !look || !name.trim()))} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-accent-ink disabled:bg-paper-2 disabled:text-mute sm:flex-none">
            {busy || starting ? <Loader2 size={18} className="animate-spin" /> : null}
            {step === 3 ? "Create " + count + (count === 1 ? " image" : " images") + " · " + cost + (cost === 1 ? " credit" : " credits") : step === 2 ? prep ? "Review shoot" : props.existing ? "Use this product" : "Choose a photo" : "Continue"}{!busy && !starting && <ArrowRight size={17} />}
          </button>}
        </div>
      </div>
      {step === 0 && props.recentJobs.length > 0 && <section className="mt-12 border-t border-line pt-7"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent shoots</h2><Link href="/app/library" className="min-h-11 py-3 text-sm underline">View all</Link></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{props.recentJobs.slice(0, 4).map((job, i) => <JobCard key={job.id} job={job} index={i} />)}</div></section>}
    </>}
  </div>;
}
function PhotoChoice({ image, title, subtitle, selected, onClick }: { image: string; title: string; subtitle?: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className="group min-w-0 self-start text-left">
    <span className={clsx("relative block aspect-square overflow-hidden rounded-2xl border-2 transition-colors", selected ? "border-accent" : "border-transparent")}>
      <img src={image} alt={title + " example"} width={512} height={512} className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.025] motion-reduce:transform-none" />
      <span className={clsx("absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full border", selected ? "border-accent bg-accent text-white" : "border-white/75 bg-black/15 text-transparent")}><Check size={16} strokeWidth={2.5} /></span>
    </span>
    <span className="mt-2.5 block text-[14px] font-semibold leading-snug tracking-tight sm:text-base">{title}</span>
    {subtitle && <span className="mt-1 block text-[11px] leading-relaxed text-mute sm:text-xs">{subtitle}</span>}
  </button>;
}
