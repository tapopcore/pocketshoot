"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, Columns2, Download, Flag, Maximize2, RefreshCw, ShieldCheck, Sparkles, Store, Wand2, X, ZoomIn,
} from "lucide-react";
import { OUTPUTS, OUTPUT_LIST, STYLES, type OutputId, type StyleId } from "@packshot/core";
import { api, newKey, saveBlob, toast, ClientApiError } from "@/lib/client";
import { Button, Spinner } from "./ui";

interface Check_ { check_type: string; score: number | null; decision: string; details: Record<string, unknown> }
interface Asset {
  id: string; item_id: string; url: string | null; thumbUrl: string | null; width: number; height: number; quality_status: "pass" | "review";
  approval_status: string; watermarked: boolean; remakes_used: number; delivered_at: string; pushed_to_shopify_at: string | null;
  quality_checks: Check_[]; refund_requests: { status: string }[] | { status: string } | null;
}
interface Item { id: string; idx: number; status: string; attempts: number; last_error: string | null; decision: string | null; delivered_asset_id: string | null; style: string | null; params?: { ideaTitle?: string } | null }
interface JobData {
  job: {
    id: string; status: string; statusLabel: string; statusTone: string; mode: string; style: string; output: string; requested_count: number; is_trial: boolean;
    created_at: string; custom_brief: string | null; parent_asset_id: string | null; settings: { edit?: { instruction: string } } | null; products: { id: string; name: string; category: string };
  };
  items: Item[]; assets: Asset[]; references: { id: string; url: string | null; view_type: string }[];
}

const STAGE: Record<string, string[]> = {
  queued: ["In the queue"],
  preparing: ["Studying your product", "Directing the shot"],
  generating: ["Building the set", "Lighting the scene", "Placing your product"],
  checking: ["Restoring your label detail", "Checking every letter"],
};
const REASONS: [string, string][] = [
  ["logo_changed", "The logo changed"], ["text_changed", "Label text changed or is wrong"], ["wrong_product", "It's a different product"],
  ["missing_product", "The product is missing"], ["extra_items", "Extra or duplicate products"], ["colour_wrong", "Product colour is wrong"],
  ["shape_wrong", "Product shape is wrong"], ["corrupt_image", "Image is broken"], ["other", "Something else"],
];
const EDIT_IDEAS = ["Warmer, golden light", "Darker, moodier background", "Add fresh flowers around it", "More space on the left for text", "Add water droplets on the surface", "Make it look like evening"];

const styleName = (id?: string | null) => (id && STYLES[id as StyleId]?.name) || "Custom";

export function JobView({ jobId, surface = "web", freeRemakes = 1, embedded = false }: { jobId: string; surface?: "web" | "shopify"; freeRemakes?: number; embedded?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = surface === "shopify" ? "/shopify" : "/app";

  const load = useCallback(async () => {
    try {
      const d = await api<JobData>(`/api/jobs/${jobId}`);
      setData(d);
      setError(null);
      const done = ["completed", "review_needed", "failed", "cancelled"].includes(d.job.status);
      if (!done) timer.current = setTimeout(load, 2000);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't load this shoot.");
      timer.current = setTimeout(load, 5000);
    }
  }, [jobId]);

  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [load]);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 2200); return () => clearInterval(t); }, []);

  const byId = useMemo(() => new Map((data?.assets ?? []).map((a) => [a.id, a])), [data]);
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {error ? <div className="col-span-full text-mute">{error}</div> : Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton aspect-square rounded-2xl" />)}
      </div>
    );
  }

  const { job, items, references } = data;
  const delivered = items.filter((i) => i.delivered_asset_id && byId.get(i.delivered_asset_id));
  const failed = items.filter((i) => i.status === "failed").length;
  const active = items.filter((i) => !["delivered", "failed", "cancelled"].includes(i.status));
  const output = OUTPUTS[job.output as OutputId];
  const ratio = output ? `${output.width}/${output.height}` : "1";
  const order = delivered.map((i) => i.delivered_asset_id!) as string[];
  const pct = Math.round(((delivered.length + failed) / Math.max(1, items.length)) * 100);
  const ref = references[0]?.url ?? null;

  return (
    <div>
      <header className="mb-6">
        {!embedded && <button type="button" onClick={() => router.push(surface === "shopify" ? "/shopify" : "/app")} className="mb-3 inline-flex items-center gap-1 text-sm text-mute hover:text-ink">
          <ArrowLeft size={15} /> {surface === "shopify" ? "Products" : "Studio"}
        </button>}
        <div className={clsx("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", embedded && "hidden")}>
          <div className="min-w-0">
            <h1 className="display truncate text-3xl sm:text-4xl">{job.products.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {job.settings?.edit ? <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">Edit: “{job.settings.edit.instruction}”</span>
                : [...new Set(items.map((i) => i.params?.ideaTitle ?? styleName(i.style ?? job.style)))].map((s) => <span key={s} className="rounded-full bg-paper-2 px-2.5 py-1 font-medium">{s}</span>)}
              <span className="rounded-full bg-paper-2 px-2.5 py-1">{output?.name} {output?.ratio}</span>
              {job.mode === "preserve" && <span className="inline-flex items-center gap-1 rounded-full bg-good/10 px-2.5 py-1 font-medium text-good"><ShieldCheck size={12} /> Product reference</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {order.length > 1 && surface === "web" && <ZipButton ids={order} />}
            <Button variant="outline" size="sm" onClick={() => router.push(surface === "shopify" ? "/shopify" : `/app/new?product=${job.products.id}`)}><Sparkles size={14} /> New scenes</Button>
          </div>
        </div>
        {active.length > 0 && (
          <div className="mt-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-gradient-to-r from-[#ffc27a] via-accent to-[#ff4f7b] transition-all duration-700" style={{ width: `${Math.max(6, pct)}%` }} /></div>
            <div className="mt-2 text-xs text-mute">{delivered.length} of {items.length} ready · about 30 to 60 seconds per image · you can leave this page</div>
          </div>
        )}
      </header>

      <div className={clsx("grid gap-3 sm:gap-4", output && output.width > output.height * 1.3 ? "sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
        {items.map((it, i) => {
          const a = it.delivered_asset_id ? byId.get(it.delivered_asset_id) : undefined;
          const stages = STAGE[it.status] ?? [it.status];
          return (
            <div key={it.id} className="animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="group relative overflow-hidden rounded-2xl bg-paper-2 ring-1 ring-black/5" style={{ aspectRatio: ratio }}>
                {a?.thumbUrl ? (
                  <button type="button" className="size-full" onClick={() => setOpen(a.id)} aria-label="Open image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumbUrl} alt={`${job.products.name} ${i + 1}`} className="size-full object-cover animate-develop transition-transform duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/55 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {it.params?.ideaTitle ?? styleName(it.style ?? job.style)}<Maximize2 size={14} />
                    </span>
                  </button>
                ) : it.status === "failed" ? (
                  <div className="flex size-full flex-col items-center justify-center gap-1.5 p-4 text-center text-sm">
                    <AlertTriangle size={20} className="text-bad" />
                    <span className="font-medium">Couldn&apos;t make this one</span>
                    <span className="text-xs text-mute">{it.last_error ?? "No credit was used"}</span>
                  </div>
                ) : it.status === "cancelled" ? (
                  <div className="grid size-full place-items-center text-sm text-mute">Cancelled</div>
                ) : (
                  <div className="relative size-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {ref && <img src={ref} alt="" className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />}
                    <div className="skeleton absolute inset-0 opacity-70" />
                    <div className="scanline absolute inset-0" />
                    <div className="absolute inset-x-3 bottom-3">
                      <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm">
                        <Spinner className="size-3 text-accent" /> {stages[tick % stages.length]}
                      </div>
                      {it.attempts > 1 && <div className="mt-1.5 text-[11px] text-ink-2">Trying again for a better result</div>}
                    </div>
                  </div>
                )}
                {a && (
                  <div className="pointer-events-none absolute left-2 top-2 flex gap-1">
                    {a.quality_status === "review" && <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-[11px] font-medium text-warn">Check label</span>}
                    {a.approval_status === "approved" && <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-good"><Check size={11} /> Approved</span>}
                    {a.pushed_to_shopify_at && <span className="inline-flex items-center gap-0.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-good"><Store size={11} /> In store</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {references.length > 0 && (
        <div className="mt-10 flex items-center gap-3">
          <span className="text-xs font-medium text-mute">Your photo</span>
          {references.slice(0, 3).map((r) => (
            // eslint-disable-next-line @next/next/no-img-element
            r.url && <img key={r.id} src={r.url} alt="" className="size-12 rounded-lg border border-line object-cover" />
          ))}
        </div>
      )}

      {open && byId.get(open) && (
        <Viewer
          asset={byId.get(open)!}
          order={order}
          onNavigate={setOpen}
          reference={ref}
          productName={job.products.name}
          sceneName={(() => { const it = items.find((i) => i.delivered_asset_id === open); return it?.params?.ideaTitle ?? styleName(it?.style ?? job.style); })()}
          currentOutput={job.output as OutputId}
          surface={surface}
          freeRemakes={freeRemakes}
          onClose={() => setOpen(null)}
          onChanged={load}
          onNewJob={(id) => router.push(`${base}/jobs/${id}`)}
        />
      )}
    </div>
  );
}

function ZipButton({ ids }: { ids: string[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="ghost" size="sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try { saveBlob(await api<Blob>("/api/assets/zip", { method: "POST", json: { ids, format: "jpg" } }), "photos.zip"); } catch (e) { toast((e as Error).message, true); }
      setBusy(false);
    }}>{busy ? <Spinner /> : <Download size={15} />} Download all</Button>
  );
}

function Viewer({ asset, order, onNavigate, reference, productName, sceneName, currentOutput, surface, freeRemakes, onClose, onChanged, onNewJob }: {
  asset: Asset; order: string[]; onNavigate: (id: string) => void; reference: string | null; productName: string; sceneName: string;
  currentOutput: OutputId; surface: "web" | "shopify"; freeRemakes: number; onClose: () => void; onChanged: () => void; onNewJob: (jobId: string) => void;
}) {
  const [view, setView] = useState<"result" | "compare">("result");
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [split, setSplit] = useState(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("text_changed");
  const [details, setDetails] = useState("");
  const [format, setFormat] = useState<"png" | "jpg" | "webp">("jpg");
  const keys = useRef({ remake: newKey(), edit: newKey(), resize: newKey() });
  const reported = Array.isArray(asset.refund_requests) ? asset.refund_requests[0] : asset.refund_requests;
  const freeLeft = asset.remakes_used < freeRemakes && Date.now() - new Date(asset.delivered_at).getTime() < 7 * 86_400_000;
  const pos = order.indexOf(asset.id);
  const exact = asset.quality_checks.find((c) => c.check_type === "product_alignment")?.decision === "pass";
  const warnings = asset.quality_checks.filter((c) => c.decision !== "pass" && c.details?.note).map((c) => String(c.details.note));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && pos < order.length - 1) onNavigate(order[pos + 1]);
      if (e.key === "ArrowLeft" && pos > 0) onNavigate(order[pos - 1]);
    };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose, onNavigate, order, pos]);
  useEffect(() => { setZoom(null); setView("result"); keys.current = { remake: newKey(), edit: newKey(), resize: newKey() }; }, [asset.id]);

  async function run<T>(label: string, fn: () => Promise<T>, ok?: (r: T) => void) {
    setBusy(label);
    try { const r = await fn(); ok?.(r); onChanged(); } catch (e) { toast((e as Error).message, true); }
    setBusy(null);
  }

  const fileBase = productName.replace(/\W+/g, "-").toLowerCase();
  const panelBtn = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-paper-2 disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0c0c0e] lg:flex-row" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3">
          <div className="flex rounded-full bg-white/10 p-1 text-xs font-medium text-white backdrop-blur">
            <button type="button" onClick={() => setView("result")} className={clsx("rounded-full px-3 py-1.5", view === "result" && "bg-white text-ink")}>Result</button>
            <button type="button" disabled={!reference} onClick={() => setView("compare")} className={clsx("inline-flex items-center gap-1 rounded-full px-3 py-1.5 disabled:opacity-40", view === "compare" && "bg-white text-ink")}><Columns2 size={13} /> Before / after</button>
          </div>
          <div className="flex items-center gap-2 text-white">
            {order.length > 1 && <span className="text-xs tabular-nums text-white/60">{pos + 1} / {order.length}</span>}
            <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X size={18} /></button>
          </div>
        </div>

        <div className="flex size-full items-center justify-center p-4 pt-16 lg:p-10 lg:pt-16">
          {view === "compare" && reference ? (
            <div className="relative h-full max-h-full max-w-full select-none" style={{ aspectRatio: `${asset.width}/${asset.height}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url ?? ""} alt="Result" className="absolute inset-0 size-full rounded-lg object-contain" />
              <div className="absolute inset-0 overflow-hidden rounded-lg" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reference} alt="Your photo" className="size-full bg-[#0c0c0e] object-contain" />
              </div>
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)]" style={{ left: `${split}%` }}>
                <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-ink">⟷</span>
              </div>
              <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Compare" className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
              <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white">Your photo</span>
              <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white">PocketShoot</span>
            </div>
          ) : (
            <div
              className={clsx("relative h-full max-h-full max-w-full overflow-hidden rounded-lg", zoom ? "cursor-zoom-out" : "cursor-zoom-in")}
              style={{ aspectRatio: `${asset.width}/${asset.height}` }}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setZoom(zoom ? null : { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}
              onMouseMove={(e) => {
                if (!zoom) return;
                const r = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url ?? ""} alt={productName} className="size-full object-contain transition-transform duration-200"
                style={zoom ? { transform: "scale(2.6)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
              {!zoom && <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white"><ZoomIn size={12} /> Click to check the label</span>}
            </div>
          )}
        </div>

        {pos > 0 && <button type="button" onClick={() => onNavigate(order[pos - 1])} aria-label="Previous" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft /></button>}
        {pos < order.length - 1 && <button type="button" onClick={() => onNavigate(order[pos + 1])} aria-label="Next" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight /></button>}
      </div>

      <aside className="max-h-[52vh] w-full shrink-0 overflow-y-auto rounded-t-3xl bg-card p-4 lg:max-h-none lg:w-[380px] lg:rounded-none lg:p-5">
        <div className="text-xs font-medium text-mute">{sceneName} · {asset.width}×{asset.height}</div>
        {exact ? (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-good/10 px-3 py-2 text-sm text-good"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span><b>Real product pixels.</b> Your label and logo come straight from your photo.</span></div>
        ) : warnings.length ? (
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{warnings[0]}</span></div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" disabled={!!busy} onClick={() => run("dl", async () => saveBlob(await api<Blob>(`/api/assets/${asset.id}/download?format=${format}`), `${fileBase}.${format}`))}>
            {busy === "dl" ? <Spinner /> : <Download size={16} />} Download
          </Button>
          <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} aria-label="Format" className="rounded-full border border-line bg-card px-3 text-sm font-medium outline-none">
            <option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option>
          </select>
        </div>
        {surface === "shopify" && !asset.pushed_to_shopify_at && !asset.watermarked && (
          <Button variant="accent" className="mt-2 w-full" disabled={!!busy} onClick={() => run("push", () => api(`/api/assets/${asset.id}/shopify`, { method: "POST" }), () => toast("Added to your Shopify product"))}>
            {busy === "push" ? <Spinner /> : <Store size={16} />} Add to Shopify product
          </Button>
        )}

        <div className="mt-5 rounded-2xl border border-line p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><Wand2 size={15} className="text-accent" /> Edit with words</div>
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} maxLength={500}
            placeholder="Tell us what to change. Your product stays exact."
            className="mt-2 w-full resize-none rounded-xl bg-paper px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/30" />
          <div className="no-scrollbar mt-1 flex gap-1.5 overflow-x-auto">
            {EDIT_IDEAS.map((idea) => (
              <button key={idea} type="button" onClick={() => setInstruction(idea)} className="shrink-0 rounded-full bg-paper-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 hover:bg-line">{idea}</button>
            ))}
          </div>
          <Button size="sm" className="mt-2.5 w-full" disabled={!!busy || instruction.trim().length < 3}
            onClick={() => run("edit", () => api<{ jobId: string }>(`/api/assets/${asset.id}/edit`, { method: "POST", json: { instruction: instruction.trim(), idempotencyKey: keys.current.edit } }), (r) => onNewJob(r.jobId))}>
            {busy === "edit" ? <Spinner /> : "Apply edit · 1 credit"}
          </Button>
        </div>

        <div className="mt-3 space-y-0.5">
          <button type="button" className={panelBtn} disabled={!!busy}
            onClick={() => run("remake", () => api<{ jobId: string; free: boolean }>(`/api/assets/${asset.id}/remake`, { method: "POST", json: { idempotencyKey: keys.current.remake } }), (r) => { toast(r.free ? "Free variation started" : "Variation started"); onNewJob(r.jobId); })}>
            {busy === "remake" ? <Spinner /> : <RefreshCw size={16} />} New variation <span className="ml-auto text-xs text-mute">{freeLeft ? "Free" : "1 credit"}</span>
          </button>
          {asset.approval_status !== "approved" && !reported && (
            <button type="button" className={panelBtn} disabled={!!busy} onClick={() => run("approve", () => api(`/api/assets/${asset.id}/approve`, { method: "POST", json: { approved: true } }), () => toast("Approved"))}>
              <Check size={16} /> Mark as approved
            </button>
          )}
        </div>

        <div className="mt-3">
          <div className="px-1 text-xs font-medium text-mute">Same scene, other size · 1 credit</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {OUTPUT_LIST.filter((o) => o.id !== currentOutput && !o.forceStyle).map((o) => (
              <button key={o.id} type="button" disabled={!!busy}
                onClick={() => run(`resize-${o.id}`, () => api<{ jobId: string }>(`/api/assets/${asset.id}/resize`, { method: "POST", json: { output: o.id, idempotencyKey: `${keys.current.resize}-${o.id}` } }), (r) => onNewJob(r.jobId))}
                className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-ink disabled:opacity-40">
                {busy === `resize-${o.id}` ? <Spinner className="size-3" /> : `${o.name} ${o.ratio}`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-3">
          {!reported ? (
            <button type="button" className={clsx(panelBtn, "text-mute")} onClick={() => setReporting(true)}><Flag size={15} /> Product looks wrong? Get your credit back</button>
          ) : (
            <div className="px-3 text-xs text-mute">Report {reported.status.replace("_", " ")}</div>
          )}
        </div>
      </aside>

      {reporting && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-card p-6 text-ink shadow-[var(--shadow-pop)]">
            <h2 className="display text-2xl">What&apos;s wrong with the product?</h2>
            <p className="mt-1 text-sm text-mute">If your product changed, you get the credit back. If you just want a different look, use a free variation.</p>
            <div className="mt-4 space-y-1.5">
              {REASONS.map(([id, label]) => (
                <label key={id} className={clsx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm", reason === id ? "border-ink" : "border-line")}>
                  <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="accent-[#0f0f12]" /> {label}
                </label>
              ))}
            </div>
            <textarea className="mt-3 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink" rows={2} placeholder="What do you see? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReporting(false)}>Cancel</Button>
              <Button disabled={!!busy} onClick={() => run("report", () => api<{ status: string }>(`/api/assets/${asset.id}/report`, { method: "POST", json: { reason, details: details || null } }), (r) => {
                setReporting(false);
                toast(r.status === "auto_approved" ? "Confirmed. Your credit is back." : "Thanks. We'll review it within 1 working day.");
              })}>{busy === "report" ? <Spinner /> : "Send"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
