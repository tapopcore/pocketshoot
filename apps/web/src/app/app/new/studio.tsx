/* eslint-disable @next/next/no-img-element -- Local previews and signed storage URLs. */
"use client";
import { FitImg } from "@/components/fit-img";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, ArrowRight, Box, Camera, Check, Hand, ImagePlus, Images, Loader2, MapPin, Minus, Plus, ScanSearch, Sparkles, Sun, User, X, type LucideIcon } from "lucide-react";
import {
  CATEGORIES, PACKS, PACK_SIZE, PRODUCT_COLLECTIONS, RECIPE_VERSION, STUDIO_LOOKS, SUGGESTION_KIND_LABEL, collectionById, categoryLook, inferCollection, lookEligibility, packLooks, styleForLook,
  type CategoryId, type CategoryLook, type CollectionId, type PackId, type SuggestionKind, type Locale, type OutputId, type ProductAnalysis, type SceneIdea, type ShootProfile, type ShootSuggestion,
} from "@packshot/core";
import { api, ClientApiError, newKey, uploadFiles } from "@/lib/client";
import { checkPhoto, shrinkPhoto, takePendingFiles } from "@/lib/photo-client";
import type { JobSummary } from "@/components/job-card";

export interface StudioProduct { id: string; name: string; category: CategoryId; coverUrl: string | null }
interface Hero { status: string; originalUrl: string | null; cutoutUrl: string | null; previewUrl: string | null; method: string | null }
interface Ref { id: string; view_type: string; url?: string | null }
interface Prepared { product: { id: string; name: string; category: CategoryId; shootProfile?: ShootProfile | null }; analysis: ProductAnalysis | null; ideas: SceneIdea[]; suggestedScenes: string[]; hero: Hero; references?: Ref[]; suggestions?: ShootSuggestion[] }
export type Step = "source" | "product" | "looks" | "review" | "saved";
type Mode = PackId | "one";
interface Draft { productId: string; profile: ShootProfile; name: string; lookId: string | null; mode?: Mode; output: OutputId; count: number; brief: string; picked?: string[]; key: string; step: Step; updatedAt: number }

/** Matches MAX_PRODUCT_PHOTOS on the server: every photo is studied and used as a reference. */
const MAX_PHOTOS = 6;
const MAX_IDEAS = 3;
const STEP_ORDER: Step[] = ["source", "product", "looks", "review"];
const STEP_NAMES = ["Photo", "Details", "Shoot", "Create"];
const VIEW_LABEL: Record<string, string> = { front: "Front", angle: "Angle", back: "Back", detail: "Close-up", other: "Other" };
const SHAPES: [OutputId, string, string, number, number][] = [["square", "Square", "Amazon, Flipkart", 30, 30], ["portrait", "Portrait", "Instagram post", 26, 33], ["story", "Story", "Reels, Stories", 20, 36], ["landscape", "Wide", "Website banner", 38, 22]];
const profileDefault = (type: CollectionId): ShootProfile => ({ type, construction: collectionById(type)?.category === "fashion" ? "unknown" : "not_applicable", referenceForm: "unknown" });

/** Example photo for a look. Looks without an example show the customer's own product in a matching setting. */
function LookThumb({ look, cover, cutout, className }: { look: CategoryLook; cover?: string | null; cutout?: string | null; className?: string }) {
  if (look.atlas) return <div role="img" aria-label={look.title} className={clsx("size-full", className)} style={{ backgroundImage: `url("${look.atlas}")`, backgroundSize: "300% 200%", backgroundPosition: ["0% 0%", "50% 0%", "100% 0%", "0% 100%", "50% 100%"][look.tile] }} />;
  if (look.collection === "studio" && !cutout) return <div role="img" aria-label={look.title} className={clsx("lt", "env-white", className)}><StudioGlyph shot={look.id.slice(7)} /></div>;
  const src = cutout ?? cover;
  const Icon = look.framing === "close" ? ScanSearch : look.human !== "none" ? Hand : look.environment === "outdoor" ? Sun : look.collection === "studio" ? null : MapPin;
  return <div role="img" aria-label={look.title} className={clsx("lt", "env-" + (look.collection === "studio" ? "white" : look.environment), look.collection === "studio" && "shot-" + look.id.slice(7), cutout && "cut", className)}>
    {src && <img src={src} alt="" />}{Icon && <span className="lt-ic"><Icon size={14} /></span>}
  </div>;
}

/** Line drawing of a white-studio shot: camera angle and light, for when there is no cut-out of the product yet. */
function StudioGlyph({ shot }: { shot: string }) {
  const body = "M41 34h18a4 4 0 0 1 4 4v34a6 6 0 0 1-6 6H43a6 6 0 0 1-6-6V38a4 4 0 0 1 4-4z";
  const cap = <rect x="45" y="24" width="10" height="10" rx="2" />;
  const ground = <ellipse cx="50" cy="80" rx="20" ry="3" fill="#E9E7E3" stroke="none" />;
  const g: Record<string, React.ReactNode> = {
    front: <>{ground}<path d={body} />{cap}<path d="M41 50h18M41 60h18" opacity=".35" /></>,
    "three-quarter": <>{ground}<path d={body} />{cap}<path d="M59 36l7 4v32a6 6 0 0 1-6 6h-3" /><path d="M41 50h18M41 60h18" opacity=".35" /></>,
    high: <>{ground}<path d="M38 44v28a6 6 0 0 0 6 6h12a6 6 0 0 0 6-6V44" /><ellipse cx="50" cy="44" rx="12" ry="6" /><ellipse cx="50" cy="42" rx="5" ry="2.5" /></>,
    low: <>{ground}<path d="M43 26h14l5 46a6 6 0 0 1-6 6H44a6 6 0 0 1-6-6z" /><path d="M46 18h8v8h-8z" /></>,
    rim: <><path d={body} stroke="#FC4A12" strokeWidth="4" opacity=".25" /><path d={body} />{cap}</>,
    shadow: <><path d="M58 78l26-10" stroke="#D9D6D0" strokeWidth="9" strokeLinecap="round" />{ground}<path d={body} />{cap}</>,
    back: <>{ground}<path d={body} />{cap}<path d="M45 46h10M45 52h10M45 58h7" opacity=".35" /></>,
    side: <>{ground}<path d="M46 34h8a3 3 0 0 1 3 3v35a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6V37a3 3 0 0 1 3-3z" /><rect x="47" y="24" width="6" height="10" rx="2" /></>,
    detail: <><circle cx="46" cy="46" r="18" /><path d="M59 59l14 14" strokeWidth="5" /><path d="M38 44h16M38 50h12" opacity=".35" /></>,
  };
  return <svg viewBox="0 0 100 100" className="glyph" fill="none" stroke="#0B0F11" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" aria-hidden>{g[shot] ?? g.front}</svg>;
}

const IDEA_ICON: Record<SuggestionKind, LucideIcon> = { props: Box, setting: MapPin, angle: Camera, detail: ScanSearch, mood: Sun, human: User };
const TYPE_GROUPS = (Object.keys(CATEGORIES) as CategoryId[]).filter((c) => c !== "other").map((c) => [CATEGORIES[c].label, PRODUCT_COLLECTIONS.filter((x) => x.category === c)] as const);

function Stepper({ step }: { step: Step }) {
  const at = Math.max(0, STEP_ORDER.indexOf(step));
  return <div className="steps" aria-label={`Step ${at + 1} of 4: ${STEP_NAMES[at]}`}>{STEP_NAMES.map((s, k) => <span key={s} className="contents">
    <div className={clsx("s", k < at && "done", k === at && "on")}><i>{k < at ? <Check size={14} strokeWidth={3} /> : k + 1}</i><span>{s}</span></div>
    {k < 3 && <span className={clsx("ln", k < at && "done")} />}
  </span>)}</div>;
}

export function Studio(props: { fixture?: Prepared; previewStep?: Step; previewLook?: string; previewMode?: Mode; initialIndustry?: string; initialLook?: string; draftScope?: string; locale: Locale; balance: number; creditsPerImage?: number; isTrial: boolean; creativeEnabled: boolean; maxImages: number; brandKits: { id: string; name: string; palette: string[] }[]; existing: StudioProduct | null; recentProducts: StudioProduct[]; recentJobs: JobSummary[]; previews?: Record<string, string>; notice?: string | null; canEdit?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("source"), [prep, setPrep] = useState<Prepared | null>(null), [profile, setProfile] = useState<ShootProfile | null>(null);
  const [industry, setIndustry] = useState<CategoryId>("other"), [name, setName] = useState(""), [locals, setLocals] = useState<string[]>([]), [lookId, setLookId] = useState<string | null>(null);
  const [output, setOutput] = useState<OutputId>("square"), [count, setCount] = useState(1), [mode, setMode] = useState<Mode | null>(null), [ideasOpen, setIdeasOpen] = useState(false), [brief, setBrief] = useState(""), [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState(props.notice ?? null);
  const [quote, setQuote] = useState<{ credits: number; recipeVersion: string } | null>(null), [quoteBusy, setQuoteBusy] = useState(false), [saved, setSaved] = useState(false), [nextView, setNextView] = useState("angle"), [over, setOver] = useState(false), [kitId, setKitId] = useState<string | null>(props.brandKits[0]?.id ?? null);
  const input = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null), extra = useRef<HTMLInputElement>(null), heading = useRef<HTMLHeadingElement>(null), objectUrls = useRef<string[]>([]), productId = useRef<string | null>(null), key = useRef(newKey()), locked = useRef(false), initialized = useRef(false), accepted = useRef<string | null>(null), nameTouched = useRef(false);
  const draftKey = "pocketshoot:draft:v2:" + (props.draftScope ?? "preview");
  const chosen = lookId ? categoryLook(lookId) : null, collection = profile ? collectionById(profile.type) : null, disabled = props.canEdit === false;
  const references: Ref[] = prep?.references ?? (prep ? [{ id: "primary", view_type: "front", url: prep.hero.originalUrl }] : []);
  const pickMode: Mode = mode ?? (props.balance >= PACK_SIZE * (props.creditsPerImage ?? 1) ? "studio" : "one");
  const pack: PackId | null = pickMode === "one" ? null : pickMode;
  const packSet = pack && profile ? packLooks(pack, profile, references) : [];
  const issue = pack ? (packSet.length === PACK_SIZE ? null : "Add one more photo of your product for this pack.") : chosen && profile ? lookEligibility(chosen, profile, references) : null;
  const ready = pack ? !issue : !!chosen && !issue;
  const photos = pack ? PACK_SIZE : count;
  const maxCount = Math.max(1, Math.min(props.maxImages, 4));
  const perPhoto = props.creditsPerImage ?? 1;
  const suggestions = (prep?.suggestions ?? prep?.analysis?.suggestions ?? []).filter((s) => !(pack === "studio" ? s.kind === "human" || s.kind === "setting" || s.kind === "props" : !pack && chosen?.human === "none" && s.kind === "human"));
  const pickedIdeas = suggestions.filter((s) => picked.includes(s.id));
  const cover = references[0]?.url ?? locals[0] ?? props.existing?.coverUrl ?? null;
  const move = (s: Step) => { setStep(s); setError(null); };

  const readProduct = useCallback(async (id: string, restore?: Draft) => {
    productId.current = id; setBusy("Studying your photos"); setError(null); setStep("product");
    try {
      const p = await api<Prepared>("/api/products/" + id + "/prepare", { method: "POST" });
      setPrep(p); setName(restore?.name ?? p.product.name); setIndustry(p.product.category); nameTouched.current = !!restore;
      const inferred = inferCollection(p.product.category, p.product.name + " " + (p.analysis?.description ?? ""));
      const nextProfile = restore?.profile ?? p.product.shootProfile ?? (inferred ? profileDefault(inferred) : null);
      setProfile(nextProfile);
      if (!restore) { const incoming = categoryLook(props.initialLook ?? ""); setLookId(incoming && incoming.collection === nextProfile?.type ? incoming.id : null); }
      if (restore) { setLookId(restore.lookId); if (restore.mode) setMode(restore.mode); setOutput(restore.output); setCount(Math.max(1, Math.min(maxCount, restore.count))); setBrief(restore.brief); setPicked(restore.picked ?? []); key.current = restore.key; }
      setStep(restore?.step === "looks" || restore?.step === "review" ? restore.step : "product");
    } catch (e) { setError(e instanceof Error ? e.message : "We couldn't study these photos. Try again without uploading them again."); setStep("product"); } finally { setBusy(null); }
  }, [maxCount, props.initialLook]);

  /** Re-reads the product after photos change. The analysis covers every photo, so new angles sharpen it. */
  const refresh = useCallback(async (id: string) => {
    const p = await api<Prepared>("/api/products/" + id + "/prepare", { method: "POST" });
    setPrep((prev) => ({ ...p, product: { ...p.product, name: prev?.product.name ?? p.product.name } }));
    if (!nameTouched.current) setName(p.product.name);
    setPicked((ids) => ids.filter((x) => (p.suggestions ?? []).some((s) => s.id === x)));
  }, []);

  useEffect(() => {
    if (initialized.current) return; initialized.current = true;
    const pending = takePendingFiles(); if (pending.length) { void upload(pending); return; }
    if (props.fixture) { setPrep(props.fixture); setName(props.fixture.product.name); setIndustry(props.fixture.product.category); const inferred = inferCollection(props.fixture.product.category, props.fixture.product.name); setProfile(inferred ? profileDefault(inferred) : null); setStep(props.previewStep ?? "product"); if (props.previewLook) setLookId(props.previewLook); if (props.previewMode) setMode(props.previewMode); if (props.previewStep === "review") setPicked((props.fixture.suggestions ?? []).slice(0, 2).map((x) => x.id)); return; }
    if (props.existing) { void readProduct(props.existing.id); return; }
    try { const raw = localStorage.getItem(draftKey); if (raw) { const d = JSON.parse(raw) as Draft; if (Date.now() - d.updatedAt < 30 * 86400000 && d.productId && collectionById(d.profile?.type)) { void readProduct(d.productId, d); setNotice("Your draft is ready to continue."); } } } catch { /* Storage unavailable: the product is kept on the server. */ }
  }, [draftKey, props.existing, props.fixture, props.previewStep, props.previewLook, readProduct]); // Start the initial upload once.
  useEffect(() => { if (!prep || !profile || props.fixture || accepted.current) return; try { const draft: Draft = { productId: prep.product.id, profile, name, lookId, mode: mode ?? undefined, output, count, brief, picked, key: key.current, step, updatedAt: Date.now() }; localStorage.setItem(draftKey, JSON.stringify(draft)); setSaved(true); } catch { setSaved(false); } }, [prep, profile, name, lookId, mode, output, count, brief, picked, step, draftKey, props.fixture]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); }, [step]);
  useEffect(() => () => { objectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  useEffect(() => {
    if (step !== "review" || !prep || !ready) { setQuote(null); return; }
    if (props.fixture) { setQuote({ credits: photos * perPhoto, recipeVersion: RECIPE_VERSION }); return; }
    const controller = new AbortController(); setQuote(null); setQuoteBusy(true);
    api<{ credits: number; recipeVersion: string }>("/api/jobs/quote", { method: "POST", json: pack ? { productId: prep.product.id, pack, count: PACK_SIZE } : { productId: prep.product.id, recipeId: chosen!.id, count }, signal: controller.signal })
      .then(setQuote).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setQuoteBusy(false); });
    return () => controller.abort();
  }, [step, prep, chosen, ready, pack, photos, count, props.fixture, perPhoto]);

  /** Checks a batch of picked files and returns the usable ones, with one plain message for the rest. */
  function usable(files: File[], room: number) {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(hei[cf]|jpe?g|png|webp)$/i.test(f.name));
    const problems = images.map(checkPhoto).filter(Boolean) as string[];
    const ok = images.filter((f) => !checkPhoto(f));
    if (problems.length) setError(problems[0]);
    if (ok.length > room) setNotice(`We kept the first ${room} photo${room === 1 ? "" : "s"}. A product can have up to ${MAX_PHOTOS}.`);
    return ok.slice(0, room);
  }

  async function upload(files: File[]) {
    if (locked.current || disabled || !files.length) return;
    const list = usable(files, MAX_PHOTOS); if (!list.length) return;
    locked.current = true; setError(null); setStep("product");
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.current = list.map((f) => URL.createObjectURL(f)); setLocals(objectUrls.current);
    setPrep(null); setProfile(null); setLookId(null); setPicked([]); productId.current = null; accepted.current = null; key.current = newKey(); nameTouched.current = false;
    try {
      setBusy(list.length === 1 ? "Preparing your photo" : `Preparing ${list.length} photos`);
      const small = await Promise.all(list.map((f) => shrinkPhoto(f)));
      setBusy(list.length === 1 ? "Uploading your photo" : `Uploading ${list.length} photos`);
      const keys = await uploadFiles(small);
      const p = await api<{ productId: string }>("/api/products", { method: "POST", json: { name: "New product", category: "other", locks: [], uploads: keys.map((k, i) => ({ key: k, viewType: i === 0 ? "front" : "angle" })) } });
      productId.current = p.productId;
      await readProduct(p.productId);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Your photos are still here; try again."); } finally { setBusy(null); locked.current = false; }
  }

  async function addPhotos(files: File[]) {
    if (!prep || locked.current || !files.length) return;
    const list = usable(files, MAX_PHOTOS - references.length); if (!list.length) return;
    locked.current = true; setError(null);
    try {
      setBusy(list.length === 1 ? "Adding your photo" : `Adding ${list.length} photos`);
      const small = await Promise.all(list.map((f) => shrinkPhoto(f)));
      const keys = await uploadFiles(small);
      if (!props.fixture) await api("/api/products/" + prep.product.id + "/photos", { method: "POST", json: { uploads: keys.map((k) => ({ key: k, viewType: nextView })) } });
      setBusy("Studying every angle");
      if (!props.fixture) await refresh(prep.product.id);
      setNotice(`${list.length === 1 ? "Photo" : `${list.length} photos`} added. We read all ${references.length + list.length} together.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); locked.current = false; }
  }

  async function removePhoto(ref: Ref) {
    if (!prep || locked.current || references.length <= 1) return;
    locked.current = true; setBusy("Removing photo"); setError(null);
    try { await api("/api/products/" + prep.product.id + "/photos?assetId=" + ref.id, { method: "DELETE" }); setBusy("Studying your photos"); await refresh(prep.product.id); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); locked.current = false; }
  }

  async function confirmProduct() {
    if (!prep || !profile || !name.trim()) return;
    setBusy("Saving product details"); setError(null);
    try {
      if (!props.fixture) await api("/api/products/" + prep.product.id, { method: "PATCH", json: { name: name.trim(), category: industry, locks: CATEGORIES[industry].defaultLocks, shootProfile: profile } });
      setPrep({ ...prep, product: { ...prep.product, name: name.trim(), category: industry, shootProfile: profile } });
      if (chosen && lookEligibility(chosen, profile, references)) setLookId(null);
      move("looks");
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  function toggleIdea(s: ShootSuggestion) {
    setPicked((ids) => {
      if (ids.includes(s.id)) return ids.filter((x) => x !== s.id);
      const sameKind = suggestions.filter((o) => o.kind === s.kind).map((o) => o.id);
      const next = [...ids.filter((x) => !sameKind.includes(x)), s.id];
      return next.slice(-MAX_IDEAS);
    });
  }

  async function generate() {
    if (!prep || !ready || !quote || locked.current || disabled) return;
    if (props.fixture) { setNotice("Design preview only. No credit was used."); return; }
    locked.current = true; setBusy("Starting your shoot"); setError(null);
    try {
      const result = await api<{ jobId: string }>("/api/jobs", { method: "POST", json: { productId: prep.product.id, mode: "preserve", ...(pack ? { pack, style: packSet[0].scene, count: PACK_SIZE } : { style: chosen!.scene, shootStyle: styleForLook(chosen!), recipeId: chosen!.id, count }), recipeVersion: quote.recipeVersion, quotedCredits: quote.credits, output, customBrief: brief.trim() || null, suggestions: pickedIdeas.map((s) => s.text), brandKitId: kitId, idempotencyKey: key.current } });
      accepted.current = result.jobId; try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      router.push("/app/jobs/" + result.jobId); router.refresh(); setStep("saved");
    } catch (e) { setError(e instanceof ClientApiError ? e.message : "We couldn't confirm the shoot. Trying again checks the same shoot, so you will not be charged twice."); } finally { locked.current = false; setBusy(null); }
  }

  // One style: the product type's own looks first, then white background and looks that suit any product.
  const looks = collection && profile ? [...collection.looks, STUDIO_LOOKS[0], ...(collection.id === "general" ? [] : collectionById("general")!.looks.filter((g) => !collection.looks.some((l) => l.environment + l.human + l.framing === g.environment + g.human + g.framing)))]
    .sort((a, b) => Number(!!lookEligibility(a, profile, references)) - Number(!!lookEligibility(b, profile, references))) : [];
  const typeLabel = collection ? (collection.id === "general" ? "Any product" : collection.label) : null;
  const guessed = !!prep && !prep.product.shootProfile && profile?.type === "general";
  const back = () => move(step === "review" ? "looks" : step === "looks" ? "product" : "source");
  const head: Record<Step, [string, string]> = {
    source: ["Add photos of your product", `One clear photo works. Add up to ${MAX_PHOTOS} angles (front, back, sides, close-ups) and we use every one.`],
    product: ["Is this right?", `We studied ${references.length > 1 ? `all ${references.length} photos` : "your photo"}. Check the name and type, then pick your shoot.`],
    looks: ["Choose your shoot", "Nothing is made or charged until the last step."],
    review: ["Ready to create", "Pick a size, then start. Your product stays exactly the same."],
    saved: ["Your shoot is starting", "You can leave this page. Your photos are saved in My shoots."],
  };
  const thumbs: Ref[] = references.length ? references : locals.map((u, i) => ({ id: "local-" + i, view_type: i === 0 ? "front" : "angle", url: u }));

  return <div data-create-flow className="create">
    <div className="flowtop">
      <button type="button" className="link sm" style={{ color: "var(--muted)" }} onClick={step === "source" ? () => router.push("/app") : back}><ArrowLeft size={18} />{step === "source" ? "Home" : "Back"}</button>
      <Stepper step={step} />
      <Link href="/app" className="link sm d-only" style={{ color: "var(--muted)" }}>{saved ? "Save and exit" : "Exit"}</Link>
    </div>
    <div className="flowhead"><h1 ref={heading} tabIndex={-1} className="outline-none">{head[step][0]}</h1><p>{head[step][1]}</p></div>

    {notice && <div role="status" className="note"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}
    {error && <div role="alert" className="note bad"><span><AlertTriangle size={16} />{error}</span>{productId.current && !prep && <button type="button" className="link sm" onClick={() => readProduct(productId.current!)}>Try again</button>}</div>}
    {disabled && <div className="note">Your role can view shoots. Ask a workspace editor to create one.</div>}

    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void (prep ? addPhotos : upload)(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    <input ref={extra} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void addPhotos(Array.from(e.target.files ?? [])); e.target.value = ""; }} />

    {step === "source" && <div className="two">
      <div className={clsx("drop", over && "over")} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); void upload(Array.from(e.dataTransfer.files)); }}>
        <span className="ico dark"><ImagePlus /></span>
        <div><h2 className="h3">Drop your photos here</h2><p className="sm muted" style={{ marginTop: 6 }}>Up to {MAX_PHOTOS} photos of the same product. JPG, PNG or WebP.</p></div>
        <div className="row" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="btn btn-lime" disabled={disabled || !!busy} onClick={() => input.current?.click()}>Choose photos</button>
          <button type="button" className="btn btn-line" disabled={disabled || !!busy} onClick={() => camera.current?.click()}><Camera size={18} />Take a photo</button>
        </div>
        <p className="xs muted angles">Best order: front, back, side, close-up</p>
      </div>
      <div className="side-col">
        {props.recentProducts.length > 0 && <section>
          <h2 className="h5">Or use a saved product</h2>
          <div className="stack">{props.recentProducts.slice(0, 4).map((p) => <button key={p.id} type="button" className="saved" onClick={() => readProduct(p.id)} disabled={!!busy}>
            <div className="ph">{p.coverUrl && <FitImg src={p.coverUrl} />}</div><div style={{ minWidth: 0, textAlign: "left" }}><b>{p.name}</b><span>Use its photos and details</span></div><ArrowRight />
          </button>)}</div>
          <Link href="/app/products" className="link sm" style={{ marginTop: "var(--s3)" }}>All products <ArrowRight size={16} /></Link>
        </section>}
        <section className="card p tipcard">
          <h3 className="h5">More angles, better photos</h3>
          <ul>{["Front photo first, label facing you", "Add the back and sides if they look different", "A close-up of fabric, print or texture helps detail shots", "Daylight near a window, no flash"].map((t) => <li key={t}><Check size={16} />{t}</li>)}</ul>
        </section>
      </div>
    </div>}

    {step === "product" && <div className="two pstep">
      <section className="pphotos">
        <div className="ph r11 hero-ph d-only">{cover && <FitImg src={cover} eager alt="Your product" />}
          {busy ? <span className="pill glass" style={{ position: "absolute", left: 16, top: 16 }}><Loader2 size={15} className="animate-spin" />{busy}</span>
            : prep?.analysis ? <span className="pill good" style={{ position: "absolute", left: 16, top: 16 }}><Check size={15} />{references.length > 1 ? `${references.length} photos studied` : "Photo studied"}</span> : null}
        </div>
        <div className="photos-head">
          <h3 className="h5">Your photos <span className="sm muted" style={{ fontWeight: 400 }}>{thumbs.length} of {MAX_PHOTOS}</span></h3>
          {busy && <span className="xs muted m-only row" style={{ gap: 6 }}><Loader2 size={14} className="animate-spin" />{busy}</span>}
        </div>
        <div className="thumbs">
          {thumbs.map((r, i) => <div key={r.id} className={clsx("thumb", i === 0 && "main")}>
            <div className="ph r11">{r.url && <FitImg src={r.url} eager alt={`${VIEW_LABEL[r.view_type] ?? "Photo"} view`} />}{!prep && <span className="veil"><Loader2 size={16} className="animate-spin" /></span>}</div>
            <span className="vt">{VIEW_LABEL[r.view_type] ?? "Photo"}</span>
            {prep && i > 0 && !busy && <button type="button" className="rm" aria-label="Remove this photo" onClick={() => removePhoto(r)}><X size={13} /></button>}
          </div>)}
          {prep && references.length < MAX_PHOTOS && <button type="button" className="slot" disabled={!!busy || disabled} onClick={() => extra.current?.click()} aria-label={`Add a ${VIEW_LABEL[nextView].toLowerCase()} photo`}><Plus /><span>Add</span></button>}
        </div>
        {prep && references.length < MAX_PHOTOS && <div className="viewpick" role="group" aria-label="The next photo shows"><span className="xs muted">Next photo is a</span>{(["angle", "back", "detail"] as const).map((v) => <button key={v} type="button" className={clsx("pill sm", nextView === v && "on")} onClick={() => setNextView(v)}>{VIEW_LABEL[v].toLowerCase()}</button>)}</div>}
      </section>

      {prep ? <section className="card found">
        <div className="field"><label className="label" htmlFor="product-name">Product name</label><input id="product-name" className="input" value={name} maxLength={120} onChange={(e) => { nameTouched.current = true; setName(e.target.value); }} /></div>
        <div className="field ptype"><label className="label" htmlFor="ptype">Product type</label>
          <select id="ptype" className="input" value={profile?.type ?? ""} onChange={(e) => { const t = e.target.value as CollectionId; setProfile(profileDefault(t)); if (t !== "general") setIndustry(collectionById(t)!.category); setLookId(null); }}>
            <option value="" disabled>Choose the closest</option>
            {TYPE_GROUPS.map(([label, list]) => <optgroup key={label} label={label}>{list.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</optgroup>)}
            <option value="general">Something else (looks for any product)</option>
          </select>
          <p className="xs muted">{guessed ? "We couldn't match this to a type we know, so you get looks that suit any product. Pick a type if one fits." : profile?.type === "general" ? "You get looks that suit any product, plus white studio photos." : "Looks are made for this type. Change it if we got it wrong."}</p>
        </div>
        {industry === "fashion" && profile && profile.type !== "general" && <div className="chipsets">
          <div><span className="label">Your photos show</span><div className="seg">{([["worn", "Worn"], ["flat", "Laid flat"], ["object", "On its own"]] as const).map(([v, l]) => <button key={v} type="button" className={clsx(profile.referenceForm === v && "on")} onClick={() => setProfile({ ...profile, referenceForm: v })}>{l}</button>)}</div></div>
          <div><span className="label">It is</span><div className="seg">{([["stitched", "Stitched"], ["unstitched", "Unstitched"], ["semi_stitched", "Semi-stitched"]] as const).map(([v, l]) => <button key={v} type="button" className={clsx(profile.construction === v && "on")} onClick={() => setProfile({ ...profile, construction: v })}>{l}</button>)}</div></div>
        </div>}
        {prep.analysis && <div className="facts">
          {prep.analysis.visible_text.length > 0 && <span title={prep.analysis.visible_text.join(" · ")}><b>Label</b>{prep.analysis.visible_text.slice(0, 2).join(" · ")}</span>}
          {prep.analysis.materials.length > 0 && <span><b>Material</b>{prep.analysis.materials.slice(0, 2).join(", ")}</span>}
          <span><b>Size</b>{{ tiny: "Very small", small: "Fits in a hand", medium: "Medium", large: "Large" }[prep.analysis.size]}</span>
          {prep.analysis.colours.length > 0 && <span><b>Colours</b><i className="sws">{prep.analysis.colours.slice(0, 5).map((c) => <i key={c} className="sw" style={{ background: c }} />)}</i></span>}
        </div>}
        {prep.analysis?.photo_issues.length ? <details className="issues"><summary>Tips for sharper results</summary><ul>{prep.analysis.photo_issues.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul></details> : null}
        {profile && ["beauty", "food"].includes(industry) && profile.type !== "general" && <label className="confirm"><input type="checkbox" checked={!!profile.contentsConfirmed} onChange={(e) => setProfile({ ...profile, contentsConfirmed: e.target.checked })} /><span>My photos show the real contents, shade or texture</span></label>}
      </section> : <section className="card found">
        <div className="skeleton" style={{ height: 54, borderRadius: 14 }} />
        <div className="skeleton" style={{ height: 54, borderRadius: 14, marginTop: "var(--s4)" }} />
        <p className="sm muted" style={{ marginTop: "var(--s4)" }}>{busy ?? "Getting ready"}. We read the label, material and shape from every photo.</p>
      </section>}
    </div>}

    {step === "looks" && collection && profile && <div className="shoot">
      <div className="modes" role="radiogroup" aria-label="Kind of shoot">
        {(["studio", "variety", "one"] as const).map((m) => {
          const on = pickMode === m, credits = (m === "one" ? 1 : PACK_SIZE) * perPhoto;
          const preview = m === "studio" ? STUDIO_LOOKS.slice(0, 3) : m === "variety" ? packLooks("variety", profile, references).slice(0, 3) : [chosen ?? looks[0]].filter(Boolean) as CategoryLook[];
          return <button key={m} type="button" role="radio" aria-checked={on} className={clsx("mode", on && "on")} onClick={() => { setMode(m); setError(null); }}>
            <span className={clsx("mv", "mv-" + m)}>{preview.map((l) => <span key={l.id}><LookThumb look={l} cover={cover} cutout={prep?.hero.cutoutUrl} /></span>)}</span>
            <span className="mt"><b>{m === "one" ? "One style" : PACKS[m].title}{m === (props.balance >= PACK_SIZE * perPhoto ? "studio" : "one") && <em>Best start</em>}</b><span>{m === "one" ? "Pick one look, 1 to 4 photos" : PACKS[m].short}</span><span className="mpm">{m === "one" ? `${perPhoto} credit per photo` : `${credits} credits`}</span></span>
            <span className="mp"><b className="num">{credits}</b><span>{m === "one" ? "credit each" : "credits"}</span></span>
            <span className="mr" aria-hidden>{on && <Check size={14} strokeWidth={3} />}</span>
          </button>;
        })}
      </div>

      {pack ? <section className="packsec">
        <div className="between"><h2 className="h5">Your {PACK_SIZE} photos</h2><span className="xs muted">{pack === "studio" ? "Pure white, product only" : "Each one a different scene"}</span></div>
        <div className="packgrid">{packSet.map((l) => <div key={l.id} className="pk"><div className="ph r11"><LookThumb look={l} cover={cover} cutout={prep?.hero.cutoutUrl} /></div><b>{l.title}</b><span>{l.subtitle}</span></div>)}</div>
        {pack === "studio" && !(references.some((r) => r.view_type === "back") && references.some((r) => r.view_type === "detail")) && <p className="xs muted">Add a back or close-up photo in Details and the pack swaps in those views.</p>}
        {pack === "variety" && <p className="xs muted">Picked for your {typeLabel === "Any product" ? "product" : typeLabel?.toLowerCase()} from looks your photos can support.</p>}
      </section> : <section className="packsec">
        <h2 className="h5">Pick a style</h2>
        <div className="styles">{looks.map((l) => {
          const gate = lookEligibility(l, profile, references);
          return <button key={l.id} type="button" aria-pressed={lookId === l.id} className={clsx("sty", lookId === l.id && "on", gate && "gated")} onClick={() => { if (gate) { setError(gate); return; } setLookId(l.id); setError(null); }}>
            <div className="ph r11 zoom"><LookThumb look={l} cover={cover} cutout={prep?.hero.cutoutUrl} />{lookId === l.id && <span className="tick"><Check /></span>}{gate && <span className="needs">Needs another photo</span>}</div>
            <b>{l.title}</b><span>{l.subtitle}</span>
          </button>;
        })}</div>
        {chosen && chosen.atlas && <p className="xs muted">Example only. Your photos show your own {name || "product"}. People shown are AI-made adults.</p>}
      </section>}

      {suggestions.length > 0 && <section className={clsx("touch", ideasOpen && "open")}>
        <button type="button" className="touch-h" aria-expanded={ideasOpen} onClick={() => setIdeasOpen(!ideasOpen)}>
          <span className="ico-s"><Sparkles size={16} /></span>
          <span className="t"><b>Add a touch</b><span>{pickedIdeas.length ? pickedIdeas.map((s) => s.title).join(", ") : `Optional ideas from your photos, up to ${MAX_IDEAS}`}</span></span>
          <span className="pill sm">{pickedIdeas.length ? `${pickedIdeas.length} added` : ideasOpen ? "Hide" : "Show"}</span>
        </button>
        {ideasOpen && <div className="touch-grid">{suggestions.map((s) => {
          const on = picked.includes(s.id), Icon = IDEA_ICON[s.kind];
          return <button key={s.id} type="button" aria-pressed={on} title={s.text} className={clsx("tc", on && "on")} onClick={() => toggleIdea(s)}>
            <span className="tc-i"><Icon size={16} /></span>
            <span className="tc-t"><b>{s.title}</b><span>{on ? s.text : SUGGESTION_KIND_LABEL[s.kind]}</span></span>
            <span className="tc-c" aria-hidden>{on ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}</span>
          </button>;
        })}</div>}
      </section>}
    </div>}

    {step === "review" && ready && prep && <div className="two rv2">
      <div className="rvl">
        <div className="sumrow"><div className="ph">{cover && <FitImg src={cover} eager />}</div><div style={{ flex: 1, minWidth: 0 }}><small>{typeLabel}</small><b>{name}</b></div><button type="button" className="link sm" onClick={() => move("product")}>Change</button></div>
        <div className="sumrow"><div className={clsx("ph", pack && "stack3")}>{pack ? packSet.slice(0, 3).map((l) => <span key={l.id}><LookThumb look={l} cover={cover} cutout={prep?.hero.cutoutUrl} /></span>) : <LookThumb look={chosen!} cover={cover} cutout={prep?.hero.cutoutUrl} />}</div><div style={{ flex: 1, minWidth: 0 }}><small>{pack ? PACKS[pack].title : "Style"}</small><b>{pack ? packSet.map((l) => l.title).join(" · ") : chosen!.title}</b>{pickedIdeas.length > 0 && <span className="xs muted">+ {pickedIdeas.map((s) => s.title).join(", ")}</span>}</div><button type="button" className="link sm" onClick={() => move("looks")}>Change</button></div>
        <div className="card p"><h3 className="h5">Photo size</h3><div className="shapes">{SHAPES.map(([id, label, hint, w, h]) => <button key={id} type="button" aria-pressed={output === id} className={clsx(output === id && "on")} onClick={() => setOutput(id)}><i style={{ width: w, height: h }} /><b>{label}</b><span>{hint}</span></button>)}</div></div>
        {!pack && <div className="card p between"><div><h3 className="h5">How many photos</h3><p className="sm muted">Each one is a new take</p></div><div className="qty"><button type="button" className="ib" aria-label="Fewer photos" disabled={count <= 1} onClick={() => setCount(count - 1)}><Minus size={18} /></button><b className="num">{count}</b><button type="button" className="ib" aria-label="More photos" disabled={count >= maxCount} onClick={() => setCount(count + 1)}><Plus size={18} /></button></div></div>}
        <details className="card p more-opts" open={!!brief || undefined}>
          <summary><span><b>More options</b><span className="xs muted">{[props.brandKits.length ? "Brand kit" : "", "Note for the shoot"].filter(Boolean).join(" · ")}</span></span><ArrowRight size={16} /></summary>
          {props.brandKits.length > 0 && <div className="field" style={{ marginTop: "var(--s4)" }}><label className="label" htmlFor="kit">Brand kit</label><select id="kit" className="input" value={kitId ?? ""} onChange={(e) => setKitId(e.target.value || null)}><option value="">Do not use</option>{props.brandKits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div>}
          <div className="field" style={{ marginTop: "var(--s4)" }}><label className="label" htmlFor="note">Note for the shoot</label><textarea id="note" className="input" style={{ minHeight: 80 }} value={brief} maxLength={600} onChange={(e) => setBrief(e.target.value)} placeholder="For example: summer feel, a few peach slices on the table" /></div>
        </details>
      </div>
      <aside className="total">
        <span className="sm" style={{ color: "var(--on-night-2)" }}>Total</span>
        <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: "var(--s2)" }}><span className="v num">{quoteBusy ? "…" : quote ? quote.credits : photos * perPhoto}</span><span style={{ color: "var(--on-night-2)" }}>credit{(quote?.credits ?? photos * perPhoto) === 1 ? "" : "s"} for {photos} photo{photos === 1 ? "" : "s"}</span></div>
        <div className="lines"><div><span>Credits you have</span><b>{props.balance}</b></div><div><span>Left after this</span><b>{Math.max(0, props.balance - (quote?.credits ?? photos * perPhoto))}</b></div></div>
        {quote && quote.credits > props.balance
          ? <Link className="btn btn-lg btn-lime btn-block" href="/app/wallet?returnTo=%2Fapp%2Fnew">Get {quote.credits - props.balance} more credit{quote.credits - props.balance === 1 ? "" : "s"}</Link>
          : <button type="button" className="btn btn-lg btn-lime btn-block" disabled={!quote || quoteBusy || !!busy || disabled} onClick={generate}>{busy ? <Loader2 size={18} className="animate-spin" /> : null}{busy ?? `Create ${photos} photo${photos === 1 ? "" : "s"}`}</button>}
        <ul><li><Check />Ready in about 2 minutes</li><li><Check />Photos that fail are not charged</li><li><Check />Try any failed photo again</li></ul>
      </aside>
    </div>}

    {step === "saved" && accepted.current && <Link className="btn btn-lg btn-lime" href={"/app/jobs/" + accepted.current}>Open your shoot <ArrowRight size={18} /></Link>}

    {step === "review" && <div className="abar m-only rbar">
      <div style={{ minWidth: 0 }}><b className="num">{quoteBusy ? "…" : quote ? quote.credits : photos * perPhoto} credit{(quote?.credits ?? photos * perPhoto) === 1 ? "" : "s"}</b><div className="xs muted">{props.balance} available</div></div>
      {quote && quote.credits > props.balance
        ? <Link className="btn btn-lg btn-lime" href="/app/wallet?returnTo=%2Fapp%2Fnew">Get credits</Link>
        : <button type="button" className="btn btn-lg btn-lime" disabled={!quote || quoteBusy || !!busy || disabled} onClick={generate}>{busy ? <Loader2 size={18} className="animate-spin" /> : null}{busy ? "Starting" : `Create ${photos} photo${photos === 1 ? "" : "s"}`}</button>}
    </div>}

    {(step === "product" || step === "looks") && <div className="abar">
      {step === "product" && <span className="sm muted d-only">{busy ? <><Loader2 size={15} className="animate-spin inline" /> {busy}</> : "Next: choose your shoot. Nothing is charged yet."}</span>}
      {step === "looks" && <div className="row abar-sum" style={{ gap: "var(--s3)", minWidth: 0 }}>{pack || chosen ? <><Images size={18} className="d-only" /><div style={{ minWidth: 0 }}><b className="sm">{pack ? PACKS[pack].title : chosen!.title}</b><div className="xs muted">{pack ? `${PACK_SIZE} photos · ${PACK_SIZE * perPhoto} credits` : `${perPhoto} credit per photo`}{pickedIdeas.length ? ` · ${pickedIdeas.length} touch${pickedIdeas.length === 1 ? "" : "es"}` : ""}</div></div></> : <span className="sm muted">Pick a style to continue</span>}</div>}
      {step === "product" && <button type="button" className="btn btn-lg btn-lime" style={{ marginLeft: "auto" }} disabled={!prep || !profile || !name.trim() || !!busy || disabled} onClick={confirmProduct}>Looks right <ArrowRight size={18} /></button>}
      {step === "looks" && <button type="button" className="btn btn-lg btn-lime" style={{ marginLeft: "auto" }} disabled={!ready || !!busy || disabled} onClick={() => move("review")}>Continue <ArrowRight size={18} /></button>}
    </div>}
  </div>;
}
