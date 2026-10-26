"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Camera, ImagePlus, X } from "lucide-react";
import { CATEGORY_LIST, CATEGORIES, LOCKS, OUTPUTS, STYLES, estimateCredits, t, type CategoryId, type LockId, type Locale } from "@packshot/core";
import { api, newKey, toast, uploadFiles, ClientApiError } from "@/lib/client";
import { Button, Field, Input, LinkButton, Notice, Spinner, Textarea } from "@/components/ui";
import { ShootSetup, defaultChoices, type ShootChoices } from "@/components/shoot-setup";

type View = "front" | "angle" | "back";
const VIEWS: { id: View; label: string }[] = [{ id: "front", label: "Front" }, { id: "angle", label: "Angle" }, { id: "back", label: "Back" }];

interface Existing { id: string; name: string; category: CategoryId; coverUrl: string | null }

export function Wizard({ locale, balance, isTrial, creativeEnabled, maxImages, brandKits, existing, recentProducts }: {
  locale: Locale; balance: number; isTrial: boolean; creativeEnabled: boolean; maxImages: number;
  brandKits: { id: string; name: string; palette: string[] }[]; existing: Existing | null; recentProducts: Existing[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(existing ? 3 : 1);
  const [product, setProduct] = useState<Existing | null>(existing);
  const [photos, setPhotos] = useState<{ file: File; url: string; view: View }[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<CategoryId>(existing?.category ?? "beauty");
  const [locks, setLocks] = useState<LockId[]>(CATEGORIES.beauty.defaultLocks);
  const [mustNot, setMustNot] = useState("");
  const [choices, setChoices] = useState<ShootChoices>(defaultChoices(existing?.category ?? "beauty"));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newKey());
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);
  useEffect(() => { setLocks(CATEGORIES[category].defaultLocks); setChoices((c) => ({ ...c, style: CATEGORIES[category].recommendedPresets[0] as ShootChoices["style"] })); }, [category]);

  const cost = estimateCredits(choices.count);
  const short = cost > balance;

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...photos];
    for (const f of Array.from(list)) {
      if (next.length >= 3) break;
      if (/heic|heif/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) { setError("iPhone HEIC photos aren't supported. In Settings > Camera > Formats choose 'Most Compatible', or share the photo as JPG."); continue; }
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setError(`${f.name} isn't a JPG, PNG or WebP image.`); continue; }
      if (f.size > 25 * 1024 * 1024) { setError(`${f.name} is larger than 25 MB.`); continue; }
      next.push({ file: f, url: URL.createObjectURL(f), view: VIEWS[next.length]?.id ?? "angle" });
    }
    setPhotos(next);
    if (!name && next[0]) setName(next[0].file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\b(img|dsc|photo|image)\s*\d+/i, "").trim());
  }

  async function submit() {
    setError(null);
    try {
      let productId = product?.id;
      if (!productId) {
        setBusy("Uploading photos");
        const keys = await uploadFiles(photos.map((p) => p.file));
        setBusy("Checking photos");
        const res = await api<{ productId: string }>("/api/products", {
          method: "POST",
          json: { name: name.trim(), category, sku: sku.trim() || null, locks, mustNotChange: mustNot.trim() || null, uploads: keys.map((k, i) => ({ key: k, viewType: photos[i].view })) },
        });
        productId = res.productId;
        setProduct({ id: productId, name, category, coverUrl: photos[0]?.url ?? null });
      }
      setBusy("Starting your shoot");
      const job = await api<{ jobId: string }>("/api/jobs", {
        method: "POST",
        json: { productId, mode: choices.mode, style: choices.style, output: choices.output, count: choices.count, brandKitId: choices.brandKitId, customBrief: choices.customBrief || null, idempotencyKey: key.current },
      });
      router.push(`/app/jobs/${job.jobId}`);
    } catch (e) {
      setBusy(null);
      const msg = e instanceof ClientApiError ? e.message : "Something went wrong. Please try again.";
      setError(msg);
      toast(msg, true);
      if (e instanceof ClientApiError && e.status === 400 && !product) setStep(1);
    }
  }

  const steps = [t(locale, "wizard.step1"), t(locale, "wizard.step2"), t(locale, "wizard.step3"), t(locale, "wizard.step4")];
  const canNext = useMemo(() => {
    if (step === 1) return photos.length > 0;
    if (step === 2) return name.trim().length > 0;
    if (step === 3) return choices.style !== "custom" || choices.customBrief.trim().length > 5 || OUTPUTS[choices.output].forceStyle;
    return !short;
  }, [step, photos, name, choices, short]);
  const cat = CATEGORIES[category];

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-10 grid grid-cols-4 gap-2" aria-label="Steps">
        {steps.map((s, i) => {
          const n = i + 1;
          const done = step > n, active = step === n;
          const locked = existing && n < 3;
          return (
            <li key={s}>
              <button type="button" disabled={!done || !!locked || !!busy} onClick={() => setStep(n)} className="w-full text-left">
                <div className={clsx("h-1 rounded-full transition-colors", done || active ? "bg-ink" : "bg-line", active && "bg-accent")} />
                <div className={clsx("mt-2 hidden text-xs sm:block", active ? "text-ink font-medium" : "text-mute")}><span className="frame-no mr-1">0{n}</span>{s}</div>
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section className="animate-rise">
          <h1 className="display text-5xl">Show us the product</h1>
          <p className="mt-2 text-ink-2">{t(locale, "wizard.uploadHint")}</p>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => {
              const p = photos[i];
              return (
                <div key={i} className="cropmarks relative aspect-[4/5] overflow-hidden rounded-xl border border-dashed border-line bg-card">
                  {p ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="" className="size-full object-cover" />
                      <button type="button" aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-ink/80 text-paper"><X size={14} /></button>
                      <select aria-label="Which side" value={p.view} onChange={(e) => setPhotos(photos.map((q, j) => (j === i ? { ...q, view: e.target.value as View } : q)))}
                        className="absolute inset-x-2 bottom-2 rounded-full bg-paper/90 px-3 py-1 text-xs">
                        {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    </>
                  ) : (
                    <button type="button" onClick={() => input.current?.click()} className="flex size-full flex-col items-center justify-center gap-2 text-mute transition-colors hover:text-ink">
                      <ImagePlus size={26} strokeWidth={1.5} />
                      <span className="text-sm">{i === 0 ? "Front (required)" : i === 1 ? "Angle" : "Back"}</span>
                    </button>
                  )}
                  <span className="frame-no absolute left-2 top-2">{String(i + 1).padStart(2, "0")}</span>
                </div>
              );
            })}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={() => camera.current?.click()} className="sm:hidden"><Camera size={17} /> Take a photo</Button>
            <Button variant="ghost" type="button" onClick={() => input.current?.click()} disabled={photos.length >= 3}><ImagePlus size={17} /> Choose files</Button>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            className="mt-4 hidden rounded-xl border border-dashed border-line p-6 text-center text-sm text-mute sm:block">
            Or drop photos here
          </div>
          {recentProducts.length > 0 && (
            <div className="mt-10">
              <div className="eyebrow mb-3">Or reuse a product you&apos;ve shot before</div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentProducts.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setProduct(p); setCategory(p.category); setStep(3); }} className="w-28 shrink-0 text-left">
                    <div className="aspect-square overflow-hidden rounded-lg bg-paper-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover" />}
                    </div>
                    <div className="mt-1 truncate text-sm">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="animate-rise space-y-8">
          <div>
            <h1 className="display text-5xl">About the product</h1>
            <p className="mt-2 text-ink-2">This tells the AI what to protect. It never changes what&apos;s printed on your product.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label={t(locale, "wizard.name")}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Vitamin C face serum 30ml" /></Field>
            <Field label="SKU (optional)"><Input value={sku} onChange={(e) => setSku(e.target.value)} maxLength={80} /></Field>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">{t(locale, "wizard.category")}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CATEGORY_LIST.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)} aria-pressed={category === c.id}
                  className={clsx("rounded-xl border p-3.5 text-left transition-colors", category === c.id ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink")}>
                  <div className="flex items-center justify-between font-medium">{locale === "hi" ? c.labelHi : c.label}{c.difficulty === "harder" && <span className="frame-no rounded border border-current px-1">Harder</span>}</div>
                  <div className={clsx("mt-0.5 text-xs", category === c.id ? "text-paper/60" : "text-mute")}>{c.short}</div>
                </button>
              ))}
            </div>
            {cat.caution && <Notice tone={cat.difficulty === "harder" ? "warn" : "neutral"} className="mt-3">{cat.caution}</Notice>}
          </div>
          <div>
            <div className="mb-2 text-sm font-medium">{t(locale, "wizard.locks")}</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(LOCKS) as LockId[]).map((l) => {
                const on = locks.includes(l);
                return (
                  <button key={l} type="button" aria-pressed={on} onClick={() => setLocks(on ? locks.filter((x) => x !== l) : [...locks, l])}
                    className={clsx("rounded-full border px-3.5 py-1.5 text-sm transition-colors", on ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2 hover:border-ink")}>
                    {on ? "✓ " : ""}{locale === "hi" ? LOCKS[l].labelHi : LOCKS[l].label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Anything else that must stay the same? (optional)" hint="For example: the gold foil on the cap, or the window on the box.">
            <Textarea value={mustNot} onChange={(e) => setMustNot(e.target.value)} maxLength={300} className="min-h-20" />
          </Field>
        </section>
      )}

      {step === 3 && (
        <section className="animate-rise">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h1 className="display text-5xl">Pick the look</h1>
              {product && <p className="mt-2 text-ink-2">Shooting <b>{product.name}</b></p>}
            </div>
            {existing && <LinkButton href="/app/new" variant="ghost" size="sm">Different product</LinkButton>}
          </div>
          <ShootSetup value={choices} onChange={setChoices} category={category} locale={locale} creativeEnabled={creativeEnabled} brandKits={brandKits} maxImages={maxImages} />
        </section>
      )}

      {step === 4 && (
        <section className="animate-rise">
          <h1 className="display text-5xl">Ready to shoot</h1>
          <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_1.2fr]">
            <div className="cropmarks aspect-[4/5] overflow-hidden rounded-xl bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {(photos[0]?.url || product?.coverUrl) && <img src={photos[0]?.url || product!.coverUrl!} alt="" className="size-full object-cover" />}
            </div>
            <dl className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
              {[
                ["Product", product?.name ?? name],
                ["Category", (locale === "hi" ? CATEGORIES[category].labelHi : CATEGORIES[category].label)],
                ["Mode", choices.mode === "preserve" ? t(locale, "wizard.mode.preserve") : t(locale, "wizard.mode.creative")],
                ["Style", OUTPUTS[choices.output].forceStyle ? "Pure White" : STYLES[choices.style].name],
                ["Size", `${OUTPUTS[choices.output].name} (${OUTPUTS[choices.output].ratio})${isTrial ? ", trial images up to 1024px" : `, ${OUTPUTS[choices.output].width}×${OUTPUTS[choices.output].height}`}`],
                ["Images", String(choices.count)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="text-mute">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
              <div className="flex items-baseline justify-between px-4 py-4">
                <dt className="font-medium">Credits</dt>
                <dd><span className="display text-4xl text-accent">{cost}</span> <span className="text-mute">of {balance}</span></dd>
              </div>
            </dl>
          </div>
          <div className="mt-6 space-y-3">
            <Notice>{t(locale, "wizard.cost", { n: cost, b: balance })} Credits are only used for images we deliver. If an image fails, the credit comes back automatically.</Notice>
            {isTrial && <Notice tone="warn">Trial images carry a small watermark and are up to 1024px. Buy any pack for full-size, clean images.</Notice>}
            {short && <Notice tone="bad">You need {cost - balance} more credits. <a className="underline" href="/app/wallet">Buy a pack</a> or choose fewer images.</Notice>}
          </div>
        </section>
      )}

      {error && <Notice tone="bad" className="mt-6">{error}</Notice>}

      <div className="sticky bottom-20 z-20 mt-10 flex items-center justify-between gap-3 rounded-full border border-line bg-paper/95 p-2 backdrop-blur lg:bottom-4">
        <Button variant="ghost" type="button" onClick={() => setStep(Math.max(existing ? 3 : 1, step - 1))} disabled={step === (existing ? 3 : 1) || !!busy}><ArrowLeft size={17} /> Back</Button>
        {step < 4 ? (
          <Button type="button" onClick={() => setStep(step === 1 && product ? 3 : step + 1)} disabled={!canNext}>Continue <ArrowRight size={17} /></Button>
        ) : (
          <Button variant="accent" type="button" onClick={submit} disabled={!canNext || !!busy}>
            {busy ? <><Spinner /> {busy}…</> : <>{t(locale, "wizard.submit")} · {cost} {t(locale, "common.credits")}</>}
          </Button>
        )}
      </div>
    </div>
  );
}
