/* eslint-disable @next/next/no-img-element -- Local previews and signed storage URLs. */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Loader2, Minus, Plus, Sparkles, X } from "lucide-react";
import {
  CATEGORIES, PRODUCT_COLLECTIONS, RECIPE_VERSION, SUGGESTION_KIND_LABEL, collectionById, categoryLook, inferCollection, lookEligibility, styleForLook,
  type CategoryId, type CategoryLook, type CollectionId, type Locale, type OutputId, type ProductAnalysis, type SceneIdea, type ShootProfile, type ShootSuggestion,
} from "@packshot/core";
import { api, ClientApiError, newKey, uploadFiles } from "@/lib/client";
import { checkPhoto, shrinkPhoto, takePendingFiles } from "@/lib/photo-client";
import type { JobSummary } from "@/components/job-card";

export interface StudioProduct { id: string; name: string; category: CategoryId; coverUrl: string | null }
interface Hero { status: string; originalUrl: string | null; cutoutUrl: string | null; previewUrl: string | null; method: string | null }
interface Ref { id: string; view_type: string; url?: string | null }
interface Prepared { product: { id: string; name: string; category: CategoryId; shootProfile?: ShootProfile | null }; analysis: ProductAnalysis | null; ideas: SceneIdea[]; suggestedScenes: string[]; hero: Hero; references?: Ref[]; suggestions?: ShootSuggestion[] }
export type Step = "source" | "product" | "looks" | "review" | "saved";
interface Draft { productId: string; profile: ShootProfile; name: string; lookId: string | null; output: OutputId; count: number; brief: string; picked?: string[]; key: string; step: Step; updatedAt: number }

/** Matches MAX_PRODUCT_PHOTOS on the server: every photo is studied and used as a reference. */
const MAX_PHOTOS = 6;
const MAX_IDEAS = 3;
const STEP_ORDER: Step[] = ["source", "product", "looks", "review"];
const STEP_NAMES = ["Photo", "Details", "Style", "Create"];
const VIEW_LABEL: Record<string, string> = { front: "Front", angle: "Angle", back: "Back", detail: "Close-up", other: "Other" };
const SHAPES: [OutputId, string, string, number, number][] = [["square", "Square", "Amazon, Flipkart", 30, 30], ["portrait", "Portrait", "Instagram post", 26, 33], ["story", "Story", "Reels, Stories", 20, 36], ["landscape", "Wide", "Website banner", 38, 22]];
const profileDefault = (type: CollectionId): ShootProfile => ({ type, construction: collectionById(type)?.category === "fashion" ? "unknown" : "not_applicable", referenceForm: "unknown" });

function LookThumb({ look, className }: { look: CategoryLook; className?: string }) {
  return <div role="img" aria-label={look.title} className={clsx("size-full", className)} style={{ backgroundImage: `url("${look.atlas}")`, backgroundSize: "300% 200%", backgroundPosition: ["0% 0%", "50% 0%", "100% 0%", "0% 100%", "50% 100%"][look.tile] }} />;
}

function Stepper({ step }: { step: Step }) {
  const at = Math.max(0, STEP_ORDER.indexOf(step));
  return <div className="steps" aria-label={`Step ${at + 1} of 4: ${STEP_NAMES[at]}`}>{STEP_NAMES.map((s, k) => <span key={s} className="contents">
    <div className={clsx("s", k < at && "done", k === at && "on")}><i>{k < at ? <Check size={14} strokeWidth={3} /> : k + 1}</i><span>{s}</span></div>
    {k < 3 && <span className={clsx("ln", k < at && "done")} />}
  </span>)}</div>;
}

export function Studio(props: { fixture?: Prepared; previewStep?: Step; previewLook?: string; initialIndustry?: string; initialLook?: string; draftScope?: string; locale: Locale; balance: number; creditsPerImage?: number; isTrial: boolean; creativeEnabled: boolean; maxImages: number; brandKits: { id: string; name: string; palette: string[] }[]; existing: StudioProduct | null; recentProducts: StudioProduct[]; recentJobs: JobSummary[]; previews?: Record<string, string>; notice?: string | null; canEdit?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("source"), [prep, setPrep] = useState<Prepared | null>(null), [profile, setProfile] = useState<ShootProfile | null>(null);
  const [industry, setIndustry] = useState<CategoryId>("other"), [name, setName] = useState(""), [locals, setLocals] = useState<string[]>([]), [lookId, setLookId] = useState<string | null>(null);
  const [output, setOutput] = useState<OutputId>("square"), [count, setCount] = useState(1), [brief, setBrief] = useState(""), [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState(props.notice ?? null);
  const [quote, setQuote] = useState<{ credits: number; recipeVersion: string } | null>(null), [quoteBusy, setQuoteBusy] = useState(false), [saved, setSaved] = useState(false), [nextView, setNextView] = useState("angle"), [over, setOver] = useState(false), [kitId, setKitId] = useState<string | null>(props.brandKits[0]?.id ?? null);
  const input = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null), extra = useRef<HTMLInputElement>(null), heading = useRef<HTMLHeadingElement>(null), objectUrls = useRef<string[]>([]), productId = useRef<string | null>(null), key = useRef(newKey()), locked = useRef(false), initialized = useRef(false), accepted = useRef<string | null>(null), nameTouched = useRef(false);
  const draftKey = "pocketshoot:draft:v2:" + (props.draftScope ?? "preview");
  const chosen = lookId ? categoryLook(lookId) : null, collection = profile ? collectionById(profile.type) : null, disabled = props.canEdit === false;
  const references: Ref[] = prep?.references ?? (prep ? [{ id: "primary", view_type: "front", url: prep.hero.originalUrl }] : []);
  const issue = chosen && profile ? lookEligibility(chosen, profile, references) : null;
  const maxCount = Math.max(1, Math.min(props.maxImages, 4));
  const perPhoto = props.creditsPerImage ?? 1;
  const suggestions = (prep?.suggestions ?? prep?.analysis?.suggestions ?? []).filter((s) => !(chosen?.human === "none" && s.kind === "human"));
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
      if (restore) { setLookId(restore.lookId); setOutput(restore.output); setCount(Math.max(1, Math.min(maxCount, restore.count))); setBrief(restore.brief); setPicked(restore.picked ?? []); key.current = restore.key; }
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
    if (props.fixture) { setPrep(props.fixture); setName(props.fixture.product.name); setIndustry(props.fixture.product.category); const inferred = inferCollection(props.fixture.product.category, props.fixture.product.name); setProfile(inferred ? profileDefault(inferred) : null); setStep(props.previewStep ?? "product"); if (props.previewLook) setLookId(props.previewLook); if (props.previewStep === "review") setPicked((props.fixture.suggestions ?? []).slice(0, 2).map((x) => x.id)); return; }
    if (props.existing) { void readProduct(props.existing.id); return; }
    try { const raw = localStorage.getItem(draftKey); if (raw) { const d = JSON.parse(raw) as Draft; if (Date.now() - d.updatedAt < 30 * 86400000 && d.productId && collectionById(d.profile?.type)) { void readProduct(d.productId, d); setNotice("Your draft is ready to continue."); } } } catch { /* Storage unavailable: the product is kept on the server. */ }
  }, [draftKey, props.existing, props.fixture, props.previewStep, props.previewLook, readProduct]); // Start the initial upload once.
  useEffect(() => { if (!prep || !profile || props.fixture || accepted.current) return; try { const draft: Draft = { productId: prep.product.id, profile, name, lookId, output, count, brief, picked, key: key.current, step, updatedAt: Date.now() }; localStorage.setItem(draftKey, JSON.stringify(draft)); setSaved(true); } catch { setSaved(false); } }, [prep, profile, name, lookId, output, count, brief, picked, step, draftKey, props.fixture]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "instant" }); }, [step]);
  useEffect(() => () => { objectUrls.current.forEach((u) => URL.revokeObjectURL(u)); }, []);
  useEffect(() => {
    if (step !== "review" || !prep || !chosen || issue) { setQuote(null); return; }
    if (props.fixture) { setQuote({ credits: count * perPhoto, recipeVersion: RECIPE_VERSION }); return; }
    const controller = new AbortController(); setQuote(null); setQuoteBusy(true);
    api<{ credits: number; recipeVersion: string }>("/api/jobs/quote", { method: "POST", json: { productId: prep.product.id, recipeId: chosen.id, count }, signal: controller.signal })
      .then(setQuote).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setQuoteBusy(false); });
    return () => controller.abort();
  }, [step, prep, chosen, issue, count, props.fixture, perPhoto]);

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
      if (chosen?.collection !== profile.type) setLookId(null);
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
    if (!prep || !chosen || !quote || issue || locked.current || disabled) return;
    if (props.fixture) { setNotice("Design preview only. No credit was used."); return; }
    locked.current = true; setBusy("Starting your shoot"); setError(null);
    try {
      const result = await api<{ jobId: string }>("/api/jobs", { method: "POST", json: { productId: prep.product.id, mode: "preserve", style: chosen.scene, shootStyle: styleForLook(chosen), recipeId: chosen.id, recipeVersion: quote.recipeVersion, quotedCredits: quote.credits, output, count, customBrief: brief.trim() || null, suggestions: pickedIdeas.map((s) => s.text), brandKitId: kitId, idempotencyKey: key.current } });
      accepted.current = result.jobId; try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      router.push("/app/jobs/" + result.jobId); router.refresh(); setStep("saved");
    } catch (e) { setError(e instanceof ClientApiError ? e.message : "We couldn't confirm the shoot. Trying again checks the same shoot, so you will not be charged twice."); } finally { locked.current = false; setBusy(null); }
  }

  const looks = collection && profile ? [...collection.looks].sort((a, b) => Number(!!lookEligibility(a, profile, references)) - Number(!!lookEligibility(b, profile, references))) : [];
  const back = () => move(step === "review" ? "looks" : step === "looks" ? "product" : "source");
  const head: Record<Step, [string, string]> = {
    source: ["Add photos of your product", `One clear photo works. Add up to ${MAX_PHOTOS} angles (front, back, sides, close-ups) and we use every one.`],
    product: ["Check your product details", `We studied ${references.length > 1 ? `all ${references.length} photos` : "your photo"} so the shoot fits your product. Fix anything that is wrong.`],
    looks: ["Choose a style", collection ? `Picked for ${collection.label.toLowerCase()}. Browsing is free and nothing is made yet.` : "Browsing is free and nothing is made yet."],
    review: ["Review and create", "Check everything before we make your photos."],
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
            <div className="ph">{p.coverUrl && <img src={p.coverUrl} alt="" />}</div><div style={{ minWidth: 0, textAlign: "left" }}><b>{p.name}</b><span>Use its photos and details</span></div><ArrowRight />
          </button>)}</div>
          <Link href="/app/products" className="link sm" style={{ marginTop: "var(--s3)" }}>All products <ArrowRight size={16} /></Link>
        </section>}
        <section className="card p tipcard">
          <h3 className="h5">More angles, better photos</h3>
          <ul>{["Front photo first, label facing you", "Add the back and sides if they look different", "A close-up of fabric, print or texture helps detail shots", "Daylight near a window, no flash"].map((t) => <li key={t}><Check size={16} />{t}</li>)}</ul>
        </section>
      </div>
    </div>}

    {step === "product" && <div className="two">
      <section>
        <div className="ph r11 hero-ph">{cover && <img src={cover} alt="Your product" style={{ objectFit: "contain", background: "var(--surface)" }} />}
          {busy ? <span className="pill glass" style={{ position: "absolute", left: 16, top: 16 }}><Loader2 size={15} className="animate-spin" />{busy}</span>
            : prep?.analysis ? <span className="pill good" style={{ position: "absolute", left: 16, top: 16 }}><Check size={15} />{references.length > 1 ? `${references.length} photos studied` : "Photo studied"}</span> : null}
        </div>
        <div className="between photos-head" style={{ marginTop: "var(--s5)" }}>
          <h3 className="h5">Your photos <span className="sm muted" style={{ fontWeight: 400 }}>· {thumbs.length} of {MAX_PHOTOS}</span></h3>
          {prep && references.length < MAX_PHOTOS && <div className="pills viewpick" role="group" aria-label="The next photo shows"><span className="xs muted nowrap">Next photo:</span>{(["angle", "back", "detail"] as const).map((v) => <button key={v} type="button" className={clsx("pill sm", nextView === v && "on")} onClick={() => setNextView(v)}>{VIEW_LABEL[v]}</button>)}</div>}
        </div>
        <div className="thumbs">
          {thumbs.map((r, i) => <div key={r.id} className={clsx("thumb", i === 0 && "main")}>
            <div className="ph r11">{r.url && <img src={r.url} alt={`${VIEW_LABEL[r.view_type] ?? "Photo"} view`} />}{!prep && <span className="veil"><Loader2 size={16} className="animate-spin" /></span>}</div>
            <span className="vt">{VIEW_LABEL[r.view_type] ?? "Photo"}</span>
            {prep && i > 0 && !busy && <button type="button" className="rm" aria-label="Remove this photo" onClick={() => removePhoto(r)}><X size={13} /></button>}
          </div>)}
          {prep && references.length < MAX_PHOTOS && <button type="button" className="slot" disabled={!!busy || disabled} onClick={() => extra.current?.click()} aria-label={`Add a ${VIEW_LABEL[nextView].toLowerCase()} photo`}><Plus /></button>}
        </div>
        <p className="xs muted" style={{ marginTop: "var(--s3)" }}>{collection?.references ? `Helpful for ${collection.label.toLowerCase()}: ${collection.references}` : "Every photo is sent to the image engine, so the back, sides and details stay true in your shoot."}</p>
      </section>

      {prep ? <section className="card pl found">
        <div className="between"><h2 className="h4">What we found</h2>{prep.analysis ? <span className="pill good sm">{prep.analysis.visible_text.length ? "Label read" : "Product read"}</span> : <span className="pill warn sm">Please check</span>}</div>
        <div className="field" style={{ marginTop: "var(--s5)" }}><label className="label" htmlFor="product-name">Product name</label><input id="product-name" className="input" value={name} maxLength={120} onChange={(e) => { nameTouched.current = true; setName(e.target.value); }} /></div>
        <div className="fields" style={{ marginTop: "var(--s4)" }}>
          <div className="field"><label className="label" htmlFor="industry">Category</label><select id="industry" className="input" value={industry} onChange={(e) => { setIndustry(e.target.value as CategoryId); setProfile(null); setLookId(null); }}>{Object.values(CATEGORIES).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="ptype">Product type</label><select id="ptype" className="input" value={profile?.type ?? ""} onChange={(e) => { setProfile(profileDefault(e.target.value as CollectionId)); setLookId(null); }}><option value="" disabled>Choose the closest</option>{PRODUCT_COLLECTIONS.filter((c) => c.category === industry).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
        </div>
        {industry === "other" && <p className="xs muted" style={{ marginTop: 8 }}>Pick the closest category to see styles made for it.</p>}
        {industry === "fashion" && profile && <div className="g2" style={{ marginTop: "var(--s4)" }}>
          <div className="field"><label className="label" htmlFor="cons">How it is made</label><select id="cons" className="input" value={profile.construction} onChange={(e) => setProfile({ ...profile, construction: e.target.value as ShootProfile["construction"] })}><option value="unknown">Not sure yet</option><option value="stitched">Stitched, ready to wear</option><option value="unstitched">Unstitched fabric</option><option value="semi_stitched">Semi-stitched</option><option value="not_applicable">Shoes or accessory</option></select></div>
          <div className="field"><label className="label" htmlFor="form">Your photos show</label><select id="form" className="input" value={profile.referenceForm} onChange={(e) => setProfile({ ...profile, referenceForm: e.target.value as ShootProfile["referenceForm"] })}><option value="unknown">Choose one</option><option value="worn">It being worn</option><option value="flat">It laid flat</option><option value="object">A bag, shoe or accessory</option></select></div>
        </div>}
        {prep.analysis && <div className="kv" style={{ marginTop: "var(--s4)" }}>
          {prep.analysis.visible_text.length > 0 && <div><span>Label text</span><b className="trunc">{prep.analysis.visible_text.slice(0, 3).join(" · ")}</b></div>}
          {prep.analysis.materials.length > 0 && <div><span>Material</span><b className="trunc">{prep.analysis.materials.slice(0, 2).join(", ")}</b></div>}
          <div><span>Size</span><b>{{ tiny: "Very small", small: "Fits in one hand", medium: "Medium", large: "Large" }[prep.analysis.size]}</b></div>
          {prep.analysis.colours.length > 0 && <div><span>Colours</span><span className="row" style={{ gap: 6 }}>{prep.analysis.colours.slice(0, 5).map((c) => <i key={c} className="sw" style={{ background: c }} />)}</span></div>}
        </div>}
        {prep.analysis?.photo_issues.length ? <div className="issues"><b>To get better results</b><ul>{prep.analysis.photo_issues.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul></div> : null}
        {profile && ["beauty", "food"].includes(industry) && <label className="confirm"><input type="checkbox" checked={!!profile.contentsConfirmed} onChange={(e) => setProfile({ ...profile, contentsConfirmed: e.target.checked })} /><span>My photos show the real contents, shade or texture used in the shoot.</span></label>}
        <p className="xs muted" style={{ marginTop: "var(--s4)" }}>Nothing has been charged yet.</p>
      </section> : <section className="card pl found">
        <div className="skeleton" style={{ height: 28, width: "55%", borderRadius: 8 }} />
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 14, marginTop: "var(--s4)" }} />)}
        <p className="sm muted" style={{ marginTop: "var(--s4)" }}>{busy ?? "Getting ready"}. We read the label, material and shape from every photo.</p>
      </section>}
    </div>}

    {step === "looks" && collection && profile && <>
      <div className="two sp">
        <div className="styles">{looks.map((l) => {
          const gate = lookEligibility(l, profile, references);
          return <button key={l.id} type="button" aria-pressed={lookId === l.id} className={clsx("sty", lookId === l.id && "on", gate && "gated")} onClick={() => { if (gate) { setError(gate); return; } setLookId(l.id); setError(null); }}>
            <div className="ph r11 zoom"><LookThumb look={l} />{lookId === l.id && <span className="tick"><Check /></span>}{gate && <span className="needs">Needs another photo</span>}</div>
            <b>{l.title}</b><span>{l.subtitle}</span>
          </button>;
        })}</div>
        <aside className="prev card p">
          {chosen ? <>
            <span className="sm muted">Selected style</span><h2 className="h4" style={{ marginTop: 4 }}>{chosen.title}</h2>
            <p className="sm muted" style={{ marginTop: 6 }}>{chosen.brief.split(" Eligibility:")[0]}</p>
            <div className="ph r11" style={{ marginTop: "var(--s4)", borderRadius: "var(--r3)" }}><LookThumb look={chosen} /></div>
            <p className="xs muted" style={{ marginTop: "var(--s3)" }}>Example only. Your photos will show your own {name || "product"}. People shown are AI-made adults.</p>
          </> : <>
            <span className="sm muted">No style yet</span><h2 className="h4" style={{ marginTop: 4 }}>Pick one on the left</h2>
            <p className="sm muted" style={{ marginTop: 6 }}>Styles that need another photo are marked. Add it in Details and they unlock.</p>
            {cover && <div className="ph r11" style={{ marginTop: "var(--s4)", borderRadius: "var(--r3)" }}><img src={cover} alt="" style={{ objectFit: "contain" }} /></div>}
          </>}
        </aside>
      </div>

      <section className="ideas-sec">
        <div className="between"><div><h2 className="h3">Shoot ideas for this product</h2>
          <p className="sm muted" style={{ marginTop: 4 }}>Optional. Written from what we saw in your photos. Tick up to {MAX_IDEAS} and we add them to the style you chose.</p></div>
          {picked.length > 0 && <button type="button" className="link sm d-only" onClick={() => setPicked([])}>Clear</button>}
        </div>
        {suggestions.length ? <div className="idea-grid">{suggestions.map((s) => {
          const on = picked.includes(s.id);
          return <button key={s.id} type="button" aria-pressed={on} className={clsx("idea", on && "on")} onClick={() => toggleIdea(s)}>
            <span className="box">{on && <Check size={14} strokeWidth={3} />}</span>
            <span className="tx"><span className="k">{SUGGESTION_KIND_LABEL[s.kind]}</span><b>{s.title}</b><span>{s.text}</span></span>
          </button>;
        })}</div> : <div className="idea-empty"><Sparkles size={18} /><span>{props.fixture ? "Ideas appear here once your photos are studied." : "We could not write ideas for this product yet. You can still add your own note in the last step."}</span></div>}
      </section>
    </>}

    {step === "review" && chosen && prep && <div className="two rv2">
      <div style={{ display: "grid", gap: "var(--s3)" }}>
        <div className="sumrow"><div className="ph">{cover && <img src={cover} alt="" />}</div><div style={{ flex: 1, minWidth: 0 }}><small>Product · {references.length} photo{references.length === 1 ? "" : "s"}</small><b>{name}</b></div><button type="button" className="link sm" onClick={() => move("product")}>Change</button></div>
        <div className="sumrow"><div className="ph"><LookThumb look={chosen} /></div><div style={{ flex: 1, minWidth: 0 }}><small>Style</small><b>{chosen.title}</b></div><button type="button" className="link sm" onClick={() => move("looks")}>Change</button></div>
        <div className="sumrow ideas-row"><div className="ph ico-ph"><Sparkles size={22} /></div><div style={{ flex: 1, minWidth: 0 }}><small>Ideas added</small>{pickedIdeas.length ? <ul>{pickedIdeas.map((s) => <li key={s.id}>{s.title}</li>)}</ul> : <b>None</b>}</div><button type="button" className="link sm" onClick={() => move("looks")}>{pickedIdeas.length ? "Change" : "Add"}</button></div>
        {props.brandKits.length > 0 && <div className="card p between kitrow"><div style={{ minWidth: 0 }}><h3 className="h5">Brand kit</h3><p className="sm muted" style={{ marginTop: 2 }}>Your colours, mood and notes guide the scene</p></div>
          <select className="input" aria-label="Brand kit" value={kitId ?? ""} onChange={(e) => setKitId(e.target.value || null)}><option value="">Do not use</option>{props.brandKits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div>}
        <div className="card p"><h3 className="h5">Photo size</h3><div className="shapes">{SHAPES.map(([id, label, hint, w, h]) => <button key={id} type="button" aria-pressed={output === id} className={clsx(output === id && "on")} onClick={() => setOutput(id)}><i style={{ width: w, height: h }} /><b>{label}</b><span>{hint}</span></button>)}</div></div>
        <div className="card p between"><div><h3 className="h5">Photos</h3><p className="sm muted" style={{ marginTop: 2 }}>Each one is a different shot</p></div><div className="qty"><button type="button" className="ib" aria-label="Fewer photos" disabled={count <= 1} onClick={() => setCount(count - 1)}><Minus size={18} /></button><b className="num">{count}</b><button type="button" className="ib" aria-label="More photos" disabled={count >= maxCount} onClick={() => setCount(count + 1)}><Plus size={18} /></button></div></div>
        <div className="card p"><h3 className="h5"><label htmlFor="note">Add a note</label> <span className="sm muted" style={{ fontWeight: 400 }}>· optional</span></h3><textarea id="note" className="input" style={{ marginTop: "var(--s3)", minHeight: 88, height: "auto", padding: "14px 16px" }} value={brief} maxLength={600} onChange={(e) => setBrief(e.target.value)} placeholder="For example: summer feel, a few peach slices on the table" /><p className="xs muted" style={{ marginTop: 8 }}>Your product and label always stay the same.</p></div>
      </div>
      <aside className="total">
        <span className="sm" style={{ color: "var(--on-night-2)" }}>Total cost</span>
        <div className="row" style={{ alignItems: "baseline", gap: 10, marginTop: "var(--s2)" }}><span className="v num">{quoteBusy ? "…" : quote ? quote.credits : count * perPhoto}</span><span style={{ color: "var(--on-night-2)" }}>credit{(quote?.credits ?? count * perPhoto) === 1 ? "" : "s"}</span></div>
        <div className="lines"><div><span>{count} photo{count === 1 ? "" : "s"} × {perPhoto} credit</span><b>{count * perPhoto}</b></div><div><span>Credits you have</span><b>{props.balance}</b></div><div><span>Left after this</span><b>{Math.max(0, props.balance - (quote?.credits ?? count * perPhoto))}</b></div></div>
        {quote && quote.credits > props.balance
          ? <Link className="btn btn-lg btn-lime btn-block" style={{ marginTop: "var(--s5)" }} href="/app/wallet?returnTo=%2Fapp%2Fnew">Get {quote.credits - props.balance} more credit{quote.credits - props.balance === 1 ? "" : "s"}</Link>
          : <button type="button" className="btn btn-lg btn-lime btn-block" style={{ marginTop: "var(--s5)" }} disabled={!quote || quoteBusy || !!busy || !!issue || disabled} onClick={generate}>{busy ? <Loader2 size={18} className="animate-spin" /> : null}{busy ?? `Create ${count} photo${count === 1 ? "" : "s"}`}</button>}
        <ul><li><Check />Ready in about 2 minutes</li><li><Check />Failed photos are not charged</li><li><Check />Try any failed photo again</li></ul>
        {props.isTrial && <p className="xs" style={{ color: "var(--on-night-2)", marginTop: "var(--s3)" }}>Free trial photos are smaller and carry no watermark.</p>}
      </aside>
    </div>}

    {step === "saved" && accepted.current && <Link className="btn btn-lg btn-lime" href={"/app/jobs/" + accepted.current}>Open your shoot <ArrowRight size={18} /></Link>}

    {(step === "product" || step === "looks") && <div className="abar">
      {step === "product" && <span className="sm muted d-only">{busy ? <><Loader2 size={15} className="animate-spin inline" /> {busy}</> : "Next, you will choose a style. Browsing is free."}</span>}
      {step === "looks" && <div className="row d-only" style={{ gap: "var(--s3)", minWidth: 0 }}>{chosen ? <><div className="ph r11" style={{ width: 44, borderRadius: 10, flex: "none" }}><LookThumb look={chosen} /></div><div style={{ minWidth: 0 }}><b className="sm">{chosen.title}</b><div className="xs muted">{pickedIdeas.length ? `${pickedIdeas.length} idea${pickedIdeas.length === 1 ? "" : "s"} added · ` : ""}{perPhoto} credit per photo</div></div></> : <span className="sm muted">Choose a style to continue</span>}</div>}
      {step === "product" && <button type="button" className="btn btn-lg btn-lime" style={{ marginLeft: "auto" }} disabled={!prep || !profile || !name.trim() || !!busy || disabled} onClick={confirmProduct}>Choose a style <ArrowRight size={18} /></button>}
      {step === "looks" && <button type="button" className="btn btn-lg btn-lime" style={{ marginLeft: "auto" }} disabled={!chosen || !!issue || !!busy || disabled} onClick={() => move("review")}>Continue <ArrowRight size={18} /></button>}
    </div>}
  </div>;
}
