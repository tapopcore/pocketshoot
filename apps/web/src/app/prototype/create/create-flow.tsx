"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Camera, Check, ChevronDown, ImageUp, Info, Plus, RefreshCw, X } from "lucide-react";
import type { AspectRatio, Offering } from "@packshot/core/contracts";
import { DEMO, FORMATS, OFFERINGS, planFor, type Direction } from "@/lib/prototype/demo";
import { RatioIcon, Sheet, Viewer, type ViewerItem } from "@/components/prototype/ui";
import { useToast } from "@/components/prototype/shell";

type Step = "capture" | "understand" | "shoot" | "review";
const STEPS: Step[] = ["capture", "understand", "shoot", "review"];
type View = "front" | "angle" | "side" | "back" | "detail";
const VIEW_LABEL: Record<View, string> = { front: "Front", angle: "Angled", side: "Side", back: "Back", detail: "Close-up" };
interface Src { id: string; view: View; src: string; progress: number; error?: boolean }
interface Draft { sources: Src[]; clutterExcluded: boolean; collection: string; offering: Offering | null; direction: string | null; quantity: number; format: AspectRatio; note: string }

const KEY = "pt-draft-v1";
const initial: Draft = { sources: [], clutterExcluded: true, collection: DEMO.product.collection, offering: null, direction: null, quantity: 6, format: "4:5", note: "" };
const EXTRA = { detail: "/showcase/skincare-3.webp", side: "/showcase/skincare-before.webp" } as const;

function load(): Draft { try { const r = sessionStorage.getItem(KEY); if (r) return { ...initial, ...JSON.parse(r) }; } catch { /* storage unavailable */ } return initial; }

export function CreateFlow() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const step = (STEPS.includes(sp.get("step") as Step) ? sp.get("step") : "capture") as Step;
  const state = sp.get("state");
  const [d, setD] = useState<Draft>(initial);
  const [ready, setReady] = useState(false);
  const [viewer, setViewer] = useState<ViewerItem | null>(null);
  const [needs, setNeeds] = useState<Direction | null>(null);
  const closeViewer = useCallback(() => setViewer(null), []);
  const closeNeeds = useCallback(() => setNeeds(null), []);

  // Restore the draft, and seed the saved-product path with its confirmed photo.
  useEffect(() => {
    const draft = load();
    if ((sp.get("saved") || sp.get("resume")) && !draft.sources.length) draft.sources = [{ id: "a-front", view: "front", src: DEMO.product.raw, progress: 100 }];
    if (state === "smaller") Object.assign(draft, { offering: "studio", direction: "white", quantity: 6 });
    if (["expired", "insufficient", "session"].includes(state ?? "") && !draft.offering) Object.assign(draft, { offering: "campaign", direction: "botanical", quantity: 6 });
    if (step !== "capture" && !draft.sources.length) draft.sources = [{ id: "a-front", view: "front", src: DEMO.product.raw, progress: 100 }];
    setD(draft); setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (ready) try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage unavailable */ } }, [d, ready]);

  const go = (s: Step) => { const q = new URLSearchParams(sp); q.set("step", s); q.delete("state"); router.push(`/prototype/create?${q}`); window.scrollTo({ top: 0 }); };
  const back = () => { const i = STEPS.indexOf(step); if (i <= 0) router.push("/prototype"); else router.back(); };
  const close = () => { toast("Draft saved. Continue any time from Home."); router.push("/prototype"); };
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  const addPhoto = (view: View, src: string, fail = false) => {
    const id = "a-" + view + "-" + Date.now();
    setD((x) => ({ ...x, sources: [...x.sources, { id, view, src, progress: 0 }] }));
    let p = 0;
    const tick = setInterval(() => {
      p += 25;
      setD((x) => ({ ...x, sources: x.sources.map((s) => s.id === id ? { ...s, progress: Math.min(100, p), error: fail && p >= 75 } : s) }));
      if (p >= 100 || (fail && p >= 75)) clearInterval(tick);
    }, 180);
  };

  const offering = OFFERINGS.find((o) => o.id === d.offering) ?? null;
  const hasView = (v: View) => d.sources.some((s) => s.view === v && s.progress === 100 && !s.error);
  const unmet = (dir: Direction) => dir.needs && !hasView(dir.needs.view === "angle" ? "angle" : dir.needs.view);
  const dir = offering?.directions.find((x) => x.id === d.direction) ?? null;
  const feasible = offering ? (offering.id === "studio" && !hasView("side") && !hasView("angle") ? offering.maxFeasible : 6) : 6;
  const quantity = Math.min(d.quantity, Math.max(...(offering?.quantities ?? [6])));
  const balance = state === "insufficient" ? 2 : DEMO.user.balance;
  const plan = useMemo(() => offering ? planFor(offering.id, Math.min(quantity, feasible)) : [], [offering, quantity, feasible]);
  const uploading = d.sources.some((s) => s.progress < 100 && !s.error);
  const good = d.sources.filter((s) => s.progress === 100 && !s.error);
  if (!ready) return null;

  return (
    <>
      <div className="pt-flowbar">
        <button type="button" className="pt-icon" aria-label={step === "capture" ? "Back to Home" : "Back"} onClick={back}><ArrowLeft /></button>
        <div className="pt-steps" role="progressbar" aria-label="Shoot setup" aria-valuemin={1} aria-valuemax={4} aria-valuenow={STEPS.indexOf(step) + 1} aria-valuetext={`Step ${STEPS.indexOf(step) + 1} of 4`}>
          {STEPS.map((s, i) => <i key={s} data-on={i <= STEPS.indexOf(step) ? "" : undefined} />)}
        </div>
        <button type="button" className="pt-icon" aria-label="Close and keep draft" onClick={close}><X /></button>
      </div>

      {step === "capture" && (
        <main className="pt-page flow">
          <div className="pt-stack-s"><h1>Add your product</h1><p className="pt-muted">One clear photo is enough. Front first; more views let us make more angles.</p></div>
          {state === "denied" && <div className="pt-note warn" role="alert"><AlertTriangle />Camera access is off for this site. Upload a photo instead, or allow the camera in your browser settings.</div>}
          {good.length === 0 && !uploading ? (
            <div className="pt-drop">
              <p className="pt-small pt-muted">JPG, PNG or WebP, up to 6 photos of the same product</p>
              <div className="pt-pair">
                <button type="button" className="pt-btn line" disabled={state === "denied"} onClick={() => addPhoto("front", DEMO.product.raw)}><Camera />Take photo</button>
                <button type="button" className="pt-btn primary" onClick={() => addPhoto("front", DEMO.product.raw, state === "uploadError")}><ImageUp />Upload photo</button>
              </div>
              <Link href="/prototype/create?step=shoot&saved=1" className="pt-link pt-small">Use a saved product</Link>
            </div>
          ) : (
            <section className="pt-stack">
              <div className="pt-between"><h2>Your photos</h2><span className="pt-xs pt-muted">{good.length} of 6</span></div>
              <div className="pt-sources" role="list">
                {d.sources.map((s) => (
                  <div key={s.id} className="pt-src" role="listitem">
                    <button type="button" className="pt-ph" aria-label={`Open ${VIEW_LABEL[s.view].toLowerCase()} photo`} onClick={() => setViewer({ src: s.src, alt: "Your product photo", title: VIEW_LABEL[s.view] + " photo" })}>
                      <img src={s.src} alt="" />
                      {s.progress < 100 && !s.error && <span className="pt-state pending"><span className="pt-prog"><i style={{ width: s.progress + "%" }} /></span></span>}
                      {s.error && <span className="pt-state fail"><span className="pt-xs" style={{ fontWeight: 650 }}>Upload failed</span></span>}
                    </button>
                    {s.error ? (
                      <div className="pt-row" style={{ gap: 4 }}>
                        <button type="button" className="pt-btn line sm" style={{ flex: 1, padding: 0 }} onClick={() => { set({ sources: d.sources.filter((x) => x.id !== s.id) }); addPhoto(s.view, s.src); }}><RefreshCw />Retry</button>
                        <button type="button" className="pt-icon" aria-label="Remove failed photo" onClick={() => set({ sources: d.sources.filter((x) => x.id !== s.id) })}><X size={18} /></button>
                      </div>
                    ) : (
                      <label className="pt-xs"><span className="sr-only">What this photo shows</span>
                        <select value={s.view} onChange={(e) => set({ sources: d.sources.map((x) => x.id === s.id ? { ...x, view: e.target.value as View } : x) })}>
                          {(Object.keys(VIEW_LABEL) as View[]).map((v) => <option key={v} value={v}>{VIEW_LABEL[v]}</option>)}
                        </select>
                      </label>
                    )}
                  </div>
                ))}
                {good.length < 6 && (
                  <button type="button" className="pt-addsrc" onClick={() => addPhoto(hasView("detail") ? "side" : "detail", hasView("detail") ? EXTRA.side : EXTRA.detail)}><Plus />Add a view</button>
                )}
              </div>
              <p className="pt-xs pt-muted">Tip: a back or close-up photo unlocks more shots. Tap a photo to check it.</p>
            </section>
          )}
          <div className="pt-actionbar">
            <div className="pt-sum"><b>{good.length ? `${good.length} photo${good.length === 1 ? "" : "s"} added` : "No photos yet"}</b><span>{uploading ? "Uploading…" : "Next: we check what you're selling"}</span></div>
            <button type="button" className="pt-btn primary" disabled={!good.length || uploading} onClick={() => go("understand")}>Continue</button>
          </div>
        </main>
      )}

      {step === "understand" && <Understand d={d} set={set} state={state} onView={setViewer} onNext={() => go("shoot")} />}

      {step === "shoot" && (
        <main className="pt-page flow">
          <div className="pt-stack-s"><h1>Choose your <span className="pt-it">shoot</span></h1><p className="pt-muted">Pick the kind of photos first. You&apos;ll see the exact plan and credits next.</p></div>
          <section className="pt-stack" aria-labelledby="off">
            <h2 id="off" className="sr-only">Kind of shoot</h2>
            <div className="pt-options three" role="radiogroup" aria-label="Kind of shoot">
              {OFFERINGS.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={d.offering === o.id} className="pt-opt" onClick={() => set({ offering: o.id, direction: o.directions[0].id, quantity: Math.min(d.quantity, Math.max(...o.quantities)) })}>
                  <span className="pt-ph"><img src={o.img} alt="" /><span className="pt-tag">Example</span></span>
                  <span className="pt-stack-s"><h3>{o.title}</h3><span className="pt-small pt-muted">{o.promise}</span></span>
                  <span className="pt-check" aria-hidden>{d.offering === o.id && <Check />}</span>
                </button>
              ))}
            </div>
          </section>

          {offering && (
            <>
              <section className="pt-stack" aria-labelledby="dir">
                <div className="pt-between"><h2 id="dir">Look</h2><span className="pt-xs pt-muted">Examples show a demo product</span></div>
                <div className="pt-dirs" role="radiogroup" aria-label="Look">
                  {offering.directions.map((x) => {
                    const blocked = unmet(x);
                    return (
                      <button key={x.id} type="button" role="radio" aria-checked={d.direction === x.id} data-blocked={blocked ? "" : undefined} aria-describedby={blocked ? `need-${x.id}` : undefined} className="pt-dir" onClick={() => blocked ? setNeeds(x) : set({ direction: x.id })}>
                        <span className="pt-ph"><img src={x.img} alt="" loading="lazy" /></span>
                        <b>{x.title}</b><span>{x.line}</span>
                        {blocked && <span className="pt-need" id={`need-${x.id}`}><Info size={13} aria-hidden />Needs one more photo</span>}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="pt-stack" aria-labelledby="qty">
                <h2 id="qty">How many photos</h2>
                <div className="pt-qty" role="radiogroup" aria-label="Number of photos">
                  {offering.quantities.map((q) => (
                    <button key={q} type="button" role="radio" aria-checked={quantity === q} onClick={() => set({ quantity: q })}>
                      <span className="pt-num">{q}</span><small>{q === 1 ? "single photo" : q === 6 ? "full set" : "small set"}</small>
                    </button>
                  ))}
                </div>
                {quantity > feasible && (
                  <div className="pt-note warn" role="status"><Info />Your photo supports {feasible} different studio photos, not {quantity}. {offering.unlock}
                  </div>
                )}
              </section>

              <section className="pt-stack" aria-labelledby="fmt">
                <h2 id="fmt">Photo shape</h2>
                <div className="pt-formats" role="radiogroup" aria-label="Photo shape">
                  {FORMATS.map((f) => (
                    <button key={f.id} type="button" role="radio" aria-checked={d.format === f.id} className="pt-fmt" onClick={() => set({ format: f.id })}>
                      <RatioIcon w={f.w} h={f.h} />{f.name}<small>{f.id} · {f.use}</small>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          <div className="pt-actionbar">
            <div className="pt-sum"><b>{offering ? `${Math.min(quantity, feasible)} ${offering.title.toLowerCase()}` : "Choose a kind of shoot"}</b><span>{dir ? `${dir.title} · ${d.format}` : "Nothing is made until you confirm"}</span></div>
            <button type="button" className="pt-btn primary" disabled={!offering || !dir} onClick={() => go("review")}>Review</button>
          </div>

          <Sheet open={!!needs} onClose={closeNeeds} title="One more photo needed">
            {needs && (
              <>
                <div className="pt-row" style={{ alignItems: "flex-start" }}>
                  <span className="pt-ph" style={{ width: 88, height: 88, flex: "none" }}><img src={needs.img} alt="" /><span className="pt-tag">Example</span></span>
                  <p>{needs.needs?.ask}. <span className="pt-muted">&ldquo;{needs.title}&rdquo; shows a part of your product that your photos don&apos;t show yet, and we won&apos;t guess it.</span></p>
                </div>
                <div className="pt-pair">
                  <button type="button" className="pt-btn line" onClick={() => { addPhoto(needs.needs!.view === "angle" ? "angle" : needs.needs!.view as View, needs.needs!.view === "detail" ? EXTRA.detail : EXTRA.side); set({ direction: needs.id }); closeNeeds(); toast("Photo added. Your choices are kept."); }}><Camera />Take photo</button>
                  <button type="button" className="pt-btn primary" onClick={() => { addPhoto(needs.needs!.view === "angle" ? "angle" : needs.needs!.view as View, needs.needs!.view === "detail" ? EXTRA.detail : EXTRA.side); set({ direction: needs.id }); closeNeeds(); toast("Photo added. Your choices are kept."); }}><ImageUp />Upload photo</button>
                </div>
              </>
            )}
          </Sheet>
        </main>
      )}

      {step === "review" && offering && dir && (
        <Review d={d} set={set} offering={offering} dir={dir} quantity={Math.min(quantity, feasible)} requested={quantity} plan={plan} balance={balance} state={state} onView={setViewer} onCreate={() => { try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ } router.push(`/prototype/shoots/demo-job?fresh=1&n=${Math.min(quantity, feasible)}&o=${offering.id}&look=${dir.id}&fmt=${encodeURIComponent(d.format)}`); }} onBack={() => go("shoot")} />
      )}
      {step === "review" && (!offering || !dir) && ready && (
        <main className="pt-page flow"><div className="pt-empty"><h2>Pick a shoot first</h2><button type="button" className="pt-btn primary" onClick={() => go("shoot")}>Choose a shoot</button></div></main>
      )}

      <Viewer item={viewer} onClose={closeViewer} />
    </>
  );
}

function Understand({ d, set, state, onView, onNext }: { d: Draft; set: (p: Partial<Draft>) => void; state: string | null; onView: (v: ViewerItem) => void; onNext: () => void }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(state === "analysing"), 900); return () => clearTimeout(t); }, [state]);
  const front = d.sources[0];
  return (
    <main className="pt-page flow">
      <div className="pt-stack-s"><h1>Is this right?</h1><p className="pt-muted">Check what we&apos;ll photograph. You can change anything.</p></div>
      <section className="pt-card pt-stack" aria-busy={loading}>
        <div className="pt-row" style={{ alignItems: "flex-start", gap: 14 }}>
          <button type="button" className="pt-ph" style={{ width: 104, height: 130, flex: "none" }} aria-label="Open your photo" onClick={() => onView({ src: front.src, alt: "Your product photo", title: "Your photo" })}><img src={front.src} alt="" /></button>
          <div className="pt-stack-s" style={{ minWidth: 0, flex: 1 }}>
            {loading ? (<><span className="pt-skel" style={{ height: 18, width: "90%" }} /><span className="pt-skel" style={{ height: 14, width: "70%" }} /><span className="pt-skel" style={{ height: 14, width: "50%" }} /><span className="pt-xs pt-muted" role="status">Looking at your photo…</span></>) : (
              <>
                <b>{DEMO.product.summary}</b>
                <p className="pt-small pt-muted">{DEMO.product.preserve}</p>
                <label className="pt-row pt-small" style={{ gap: 8 }}>
                  <span className="pt-muted">Type</span>
                  <select className="pt-chip" value={d.collection} onChange={(e) => set({ collection: e.target.value })} aria-label="Product type">
                    {["Skincare", "Makeup", "Fragrance", "Bottle or drinkware", "Something else"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </>
            )}
          </div>
        </div>
      </section>

      {!loading && (
        <>
          <section className="pt-card pt-stack" aria-labelledby="inv">
            <h2 id="inv" className="pt-h3">Anything else in the photo?</h2>
            <p className="pt-small">{DEMO.product.clutter}.</p>
            <div className="pt-wrapc" role="radiogroup" aria-label="Other items in the photo">
              <button type="button" role="radio" aria-checked={d.clutterExcluded} className="pt-chip" onClick={() => set({ clutterExcluded: true })}>Not part of the sale</button>
              <button type="button" role="radio" aria-checked={!d.clutterExcluded} className="pt-chip" onClick={() => set({ clutterExcluded: false })}>Include them</button>
            </div>
          </section>
          <section className="pt-stack-s" aria-label="What your photos can't show">
            {DEMO.product.unknowns.map((u) => <div key={u} className="pt-note info"><Info />{u}</div>)}
          </section>
          <details className="pt-more pt-card">
            <summary>Edit product details<ChevronDown size={18} aria-hidden /></summary>
            <div className="pt-stack" style={{ paddingTop: 8 }}>
              <label className="pt-stack-s pt-small"><b>Name</b><input defaultValue={DEMO.product.name} style={{ minHeight: 44, border: "1px solid var(--pt-line-2)", borderRadius: 10, padding: "0 12px", font: "inherit" }} /></label>
              <label className="pt-stack-s pt-small"><b>Must stay exactly the same</b><textarea rows={2} placeholder="For example: the leaf print on the label" style={{ border: "1px solid var(--pt-line-2)", borderRadius: 10, padding: 12, font: "inherit" }} /></label>
            </div>
          </details>
        </>
      )}
      <div className="pt-actionbar">
        <div className="pt-sum"><b>{loading ? "Checking your photo" : "Looks right?"}</b><span>{loading ? "This takes a few seconds" : "Next: choose the kind of photos"}</span></div>
        <button type="button" className="pt-btn primary" disabled={loading} onClick={onNext}>Choose shoot</button>
      </div>
    </main>
  );
}

function Review({ d, set, offering, dir, quantity, requested, plan, balance, state, onView, onCreate, onBack }: {
  d: Draft; set: (p: Partial<Draft>) => void; offering: (typeof OFFERINGS)[number]; dir: Direction; quantity: number; requested: number; plan: { label: string }[];
  balance: number; state: string | null; onView: (v: ViewerItem) => void; onCreate: () => void; onBack: () => void;
}) {
  const [expired, setExpired] = useState(state === "expired");
  const [signedOut, setSignedOut] = useState(state === "session");
  const [busy, setBusy] = useState(false);
  const total = quantity;
  const short = balance < total;
  const fmt = FORMATS.find((f) => f.id === d.format)!;
  const create = () => { if (busy) return; setBusy(true); setTimeout(onCreate, 250); };
  return (
    <main className="pt-page flow">
      <div className="pt-stack-s"><h1>Ready to <span className="pt-it">create</span></h1><p className="pt-muted">Check the plan. Photos we can&apos;t deliver are never charged.</p></div>
      {requested > quantity && <div className="pt-note warn" role="status"><Info />You asked for {requested}. Your photos support {quantity} different studio photos, so we&apos;ll make {quantity} and charge {quantity} credits. {offering.unlock}</div>}
      {signedOut && <div className="pt-note warn" role="alert"><Info /><span>You were signed out. Sign in again to create. Your shoot setup is kept. <button type="button" className="pt-link" style={{ minHeight: 0 }} onClick={() => setSignedOut(false)}>Sign in</button></span></div>}
      {expired && <div className="pt-note warn" role="alert"><RefreshCw />Prices were updated since you started. <button type="button" className="pt-link" style={{ minHeight: 0 }} onClick={() => setExpired(false)}>Refresh total</button></div>}
      <section className="pt-card">
        <div className="pt-row" style={{ marginBottom: 8 }}>
          <button type="button" className="pt-ph" style={{ width: 56, height: 70, flex: "none" }} aria-label="Open your photo" onClick={() => onView({ src: d.sources[0].src, alt: "Your product photo", title: "Your photo" })}><img src={d.sources[0].src} alt="" /></button>
          <div className="pt-stack-s" style={{ minWidth: 0 }}><b className="pt-clamp2 pt-small">{DEMO.product.name}</b><span className="pt-xs pt-muted">{d.sources.length} photo{d.sources.length === 1 ? "" : "s"} · {d.collection}</span></div>
        </div>
        <dl className="pt-rows">
          <div><dt>Shoot</dt><dd>{offering.title}</dd></div>
          <div><dt>Look</dt><dd>{dir.title}</dd></div>
          <div><dt>Photos</dt><dd className="pt-num">{quantity}</dd></div>
          <div><dt>Shape</dt><dd>{fmt.name} {fmt.id} · {fmt.use}</dd></div>
          <div><dt>Size</dt><dd>2048 px delivered <span className="pt-muted" style={{ fontWeight: 500 }}>(made at 1024 px and enlarged)</span></dd></div>
        </dl>
        <button type="button" className="pt-btn ghost sm" style={{ paddingLeft: 0 }} onClick={onBack}>Change</button>
      </section>
      <details className="pt-more pt-card" open>
        <summary>Your {quantity} photos<ChevronDown size={18} aria-hidden /></summary>
        <ol className="pt-slots" style={{ paddingTop: 8 }}>{plan.map((p, i) => <li key={i}><span>{p.label}</span></li>)}</ol>
      </details>
      <details className="pt-more pt-card">
        <summary>Add a note (optional)<ChevronDown size={18} aria-hidden /></summary>
        <textarea rows={3} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="For example: keep it bright, for a summer launch" style={{ width: "100%", marginTop: 8, border: "1px solid var(--pt-line-2)", borderRadius: 10, padding: 12, font: "inherit" }} />
      </details>
      {short && <div className="pt-note bad" role="alert"><AlertTriangle />This shoot needs {total} credits. You have {balance}.</div>}
      <div className="pt-actionbar">
        <div className="pt-sum"><b className="pt-num">{total} credit{total === 1 ? "" : "s"}</b><span className="pt-num">You have {balance}</span></div>
        {short ? <Link href="/prototype/you?buy=1" className="pt-btn primary">Get {total - balance} more credit{total - balance === 1 ? "" : "s"}</Link>
          : <button type="button" className="pt-btn primary" disabled={expired || signedOut || busy} aria-busy={busy} onClick={create}>{busy ? "Starting…" : `Create ${quantity} photo${quantity === 1 ? "" : "s"}`}</button>}
      </div>
    </main>
  );
}
