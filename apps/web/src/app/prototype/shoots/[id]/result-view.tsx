"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Camera, Download, ImageUp, Info, RefreshCw, SlidersHorizontal } from "lucide-react";
import type { ResultItemDTO } from "@packshot/core/contracts";
import { DEMO, FORMATS, OFFERINGS, STATE_LABEL, demoResult, planFor } from "@/lib/prototype/demo";
import { Sheet, Viewer, type ViewerItem } from "@/components/prototype/ui";
import { useToast } from "@/components/prototype/shell";

/** G16: five scoped controls. Each changes one thing and keeps the rest of the shot. */
const REFINES = [
  { id: "light", title: "Keep lighting", line: "Same light and mood, a new arrangement." },
  { id: "pose", title: "Another pose", line: "Same scene, the product placed or held differently." },
  { id: "clear", title: "Clearer product", line: "Closer framing so the label and pump read well." },
  { id: "setting", title: "Change setting", line: "A new surface or background in the same idea." },
  { id: "replace", title: "Replace photo", line: "Use a different photo of your product for this shot." },
] as const;

type Item = ResultItemDTO;

/** Moves items through queued → generating → checking → final, the way a real job reports progress. */
function useTimeline(fresh: boolean, stuck: boolean, n: number, labels: string[] | null) {
  const final = demoResult().items.slice(0, n).map((i, k) => labels?.[k] ? { ...i, label: labels[k] } : i);
  const start = (): Item[] => final.map((i) => fresh ? { ...i, state: "queued", output: undefined, failure: undefined, reviewNote: undefined, credit: "reserved" } : i);
  const [items, setItems] = useState<Item[]>(start);
  useEffect(() => {
    if (stuck) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    final.forEach((f, i) => {
      const done = f.state === "checking" || f.state === "generating" ? { ...f, state: "accepted" as const, output: { thumbUrl: `/showcase/skincare-${i === 4 ? 1 : 0}.webp`, fullUrl: `/showcase/skincare-${i === 4 ? 1 : 0}.webp`, width: 1632, height: 2048, nativeLongEdge: 1024 }, credit: "charged" as const } : f;
      const base = fresh ? 600 + i * 700 : 2500 + (i - 3) * 1500;
      if (fresh) {
        timers.push(setTimeout(() => setItems((xs) => xs.map((x) => x.itemId === f.itemId ? { ...x, state: "generating" } : x)), base));
        timers.push(setTimeout(() => setItems((xs) => xs.map((x) => x.itemId === f.itemId ? { ...x, state: "checking" } : x)), base + 1600));
        timers.push(setTimeout(() => setItems((xs) => xs.map((x) => x.itemId === f.itemId ? done : x)), base + 2600));
      } else if (f.state === "checking" || f.state === "generating") {
        timers.push(setTimeout(() => setItems((xs) => xs.map((x) => x.itemId === f.itemId ? done : x)), base));
      }
    });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, stuck]);
  return [items, setItems] as const;
}

export function ResultView() {
  const sp = useSearchParams();
  const toast = useToast();
  const off = OFFERINGS.find((o) => o.id === sp.get("o")) ?? OFFERINGS[2];
  const look = off.directions.find((x) => x.id === sp.get("look")) ?? off.directions[0];
  const fmt = FORMATS.find((f) => f.id === sp.get("fmt")) ?? FORMATS[1];
  const n = Math.min(6, Math.max(1, Number(sp.get("n")) || 6));
  const [items, setItems] = useTimeline(sp.get("fresh") === "1", sp.get("state") === "running", n, sp.get("o") ? planFor(off.id, n).map((p) => p.label) : null);
  const [viewer, setViewer] = useState<(ViewerItem & { itemId: string }) | null>(null);
  const [refine, setRefine] = useState<Item | null>(null);
  const [retry, setRetry] = useState<Item | null>(null);
  const [choice, setChoice] = useState<string>(REFINES[0].id);
  const closeViewer = useCallback(() => setViewer(null), []);
  const closeRefine = useCallback(() => setRefine(null), []);
  const closeRetry = useCallback(() => setRetry(null), []);

  const done = items.filter((i) => ["accepted", "review", "failed"].includes(i.state)).length;
  const ready = items.filter((i) => i.state === "accepted");
  const held = items.filter((i) => i.state === "review");
  const failed = items.filter((i) => i.state === "failed");
  const charged = items.filter((i) => i.credit === "charged").length;
  const running = done < items.length;

  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => x.itemId === id ? { ...x, ...p } : x));
  const download = (n: number) => toast(n === 1 ? "Photo saved to your downloads." : `${n} photos saved to your downloads.`);
  const open = (i: Item) => i.output && setViewer({ itemId: i.itemId, src: i.output.fullUrl, alt: i.label, title: i.label, original: DEMO.product.raw, caption: i.state === "review" ? i.reviewNote : `${i.output.width} × ${i.output.height} px · made at ${i.output.nativeLongEdge} px and enlarged` });

  return (
    <main className="pt-page">
      <Link href="/prototype/shoots" className="pt-link pt-small" style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }}><ArrowLeft size={16} aria-hidden />All shoots</Link>
      <header className="pt-jobhead">
        <h1 className="pt-clamp2" style={{ fontSize: "var(--pt-h2)" }}>{DEMO.product.name}</h1>
        <p className="pt-small pt-muted">{off.title} · {look.title} · {fmt.name} {fmt.id}</p>
        <div className="pt-progress" role="status" aria-live="polite">
          <span className="pt-bar" aria-hidden><i style={{ width: `${(done / items.length) * 100}%` }} /></span>
          <span className="pt-num">{running ? `${done} of ${items.length} done` : "Finished"}</span>
        </div>
        {running && <p className="pt-xs pt-muted">You can leave this page. We&apos;ll keep working and your photos will be here.</p>}
      </header>

      {!running && (failed.length > 0 || held.length > 0) && (
        <div className="pt-note info" role="status"><Info />
          <span>{ready.length} ready{held.length ? `, ${held.length} to check` : ""}{failed.length ? `, ${failed.length} not delivered` : ""}. You paid {charged} credit{charged === 1 ? "" : "s"}{failed.length ? `; ${failed.length} returned` : ""}{held.length ? `; ${held.length} held until you decide` : ""}.</span>
        </div>
      )}

      <section className="pt-results" aria-label="Photos in this shoot">
        {items.map((i) => (
          <article key={i.itemId} className="pt-res" aria-label={`${i.label}: ${STATE_LABEL[i.state]}`}>
            {i.output && (i.state === "accepted" || i.state === "review") ? (
              <button type="button" className="pt-ph pt-ar-45" aria-label={`Open ${i.label}`} onClick={() => open(i)}><img src={i.output.thumbUrl} alt="" /></button>
            ) : i.state === "failed" && i.failure ? (
              <div className="pt-failbox"><div className="pt-state fail">
                <span className="pt-fail-ico" aria-hidden><AlertTriangle /></span>
                <b>{i.failure.title}</b><p>{i.failure.message}</p>
                {i.failure.action === "retry" && <button type="button" className="pt-btn line sm" onClick={() => setRetry(i)}><RefreshCw />{i.failure.retryLabel}</button>}
              </div></div>
            ) : (
              <div className="pt-ph pt-ar-45" aria-busy="true"><span className="pt-shimmer" aria-hidden /><div className="pt-state pending"><span className="pt-status busy"><i aria-hidden />{STATE_LABEL[i.state]}</span></div></div>
            )}
            <div className="pt-cap">
              <b className="pt-clamp2">{i.label}</b>
              {i.state === "accepted" && <span className="pt-status good"><i aria-hidden />Ready</span>}
              {i.state === "review" && <span className="pt-status warn"><i aria-hidden />Check before use</span>}
              {i.state === "failed" && <span className="pt-status bad"><i aria-hidden />Not delivered · credit returned</span>}
            </div>
            {i.state === "review" && (
              <div className="pt-stack-s">
                <p className="pt-xs pt-muted">{i.reviewNote} Keeping it uses 1 credit; removing it returns the credit.</p>
                <div className="pt-pair">
                  <button type="button" className="pt-btn line sm" onClick={() => { patch(i.itemId, { state: "cancelled", credit: "released" }); toast("Removed. Your credit was returned."); }}>Remove</button>
                  <button type="button" className="pt-btn primary sm" onClick={() => { patch(i.itemId, { state: "accepted", credit: "charged" }); toast("Kept. 1 credit used."); }}>Keep</button>
                </div>
              </div>
            )}
            {i.state === "accepted" && (
              <button type="button" className="pt-btn ghost sm" style={{ justifySelf: "start", paddingLeft: 0 }} onClick={() => setRefine(i)}><SlidersHorizontal />Make a variation</button>
            )}
          </article>
        ))}
      </section>

      <div className="pt-actionbar">
        <div className="pt-sum"><b className="pt-num">{ready.length} ready to use</b><span className="pt-num">{charged} credit{charged === 1 ? "" : "s"} used{failed.length ? ` · ${failed.length} returned` : ""}</span></div>
        <button type="button" className="pt-btn primary" disabled={!ready.length} onClick={() => download(ready.length)}><Download />Download {ready.length || ""}</button>
      </div>

      <Viewer item={viewer} onClose={closeViewer} onDownload={() => download(1)} />

      <Sheet open={!!refine} onClose={closeRefine} title="Make a variation">
        {refine && (
          <>
            <p className="pt-small pt-muted">Makes 1 new photo from &ldquo;{refine.label}&rdquo;. This photo stays as it is.</p>
            <div className="pt-stack-s" role="radiogroup" aria-label="Kind of variation">
              {REFINES.map((r) => (
                <button key={r.id} type="button" role="radio" aria-checked={choice === r.id} className="pt-opt" style={{ gridTemplateColumns: "minmax(0,1fr) 24px", padding: 14 }} onClick={() => setChoice(r.id)}>
                  <span className="pt-stack-s"><b>{r.title}</b><span className="pt-small pt-muted">{r.line}</span></span>
                  <span className="pt-check" aria-hidden />
                </button>
              ))}
            </div>
            {choice === "replace" ? (
              <div className="pt-stack-s">
                <p className="pt-xs pt-muted">Pick the photo first. You&apos;ll confirm before anything is made.</p>
                <div className="pt-pair">
                  <button type="button" className="pt-btn line" onClick={() => toast("Photo added. Tap Make 1 photo to continue.")}><Camera />Take photo</button>
                  <button type="button" className="pt-btn line" onClick={() => toast("Photo added. Tap Make 1 photo to continue.")}><ImageUp />Upload photo</button>
                </div>
              </div>
            ) : <p className="pt-xs pt-muted">Your product stays exactly the same.</p>}
            <button type="button" className="pt-btn primary block" onClick={() => { closeRefine(); toast("Variation started. 1 credit, returned if we can't deliver."); }}>Make 1 photo · 1 credit</button>
          </>
        )}
      </Sheet>

      <Sheet open={!!retry} onClose={closeRetry} title="Try this photo again">
        {retry && (
          <>
            <p className="pt-small">We&apos;ll make &ldquo;{retry.label}&rdquo; again with the same plan. It uses 1 credit, and it&apos;s returned again if this one can&apos;t be delivered either.</p>
            <div className="pt-pair">
              <button type="button" className="pt-btn line" onClick={closeRetry}>Not now</button>
              <button type="button" className="pt-btn primary" onClick={() => { patch(retry.itemId, { state: "generating", failure: undefined, credit: "reserved" }); closeRetry(); setTimeout(() => patch(retry.itemId, { state: "accepted", credit: "charged", output: { thumbUrl: "/showcase/skincare-3.webp", fullUrl: "/showcase/skincare-3.webp", width: 1632, height: 2048, nativeLongEdge: 1024 } }), 3200); }}>Try again · 1 credit</button>
            </div>
          </>
        )}
      </Sheet>
    </main>
  );
}
