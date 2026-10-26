"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, Download, Flag, RefreshCw, Store, X, ZoomIn, ShieldCheck, AlertTriangle } from "lucide-react";
import { OUTPUTS, STYLES, type OutputId, type StyleId } from "@packshot/core";
import { api, newKey, saveBlob, toast, ClientApiError } from "@/lib/client";
import { Badge, Button, Notice, Select, Spinner, Textarea } from "./ui";

interface Check_ { check_type: string; score: number | null; decision: string; details: Record<string, unknown> }
interface Asset {
  id: string; item_id: string; url: string | null; thumbUrl: string | null; width: number; height: number; quality_status: "pass" | "review";
  approval_status: string; watermarked: boolean; remakes_used: number; delivered_at: string; pushed_to_shopify_at: string | null;
  quality_checks: Check_[]; refund_requests: { status: string }[] | { status: string } | null;
}
interface Item { id: string; idx: number; status: string; attempts: number; last_error: string | null; decision: string | null; delivered_asset_id: string | null }
interface JobData {
  job: { id: string; status: string; statusLabel: string; statusTone: "neutral" | "busy" | "good" | "warn" | "bad"; mode: string; style: string; output: string; requested_count: number; is_trial: boolean; created_at: string; products: { id: string; name: string; category: string } };
  items: Item[]; assets: Asset[]; references: { id: string; url: string | null; view_type: string }[];
}

const ITEM_LABEL: Record<string, string> = { queued: "Waiting", preparing: "Preparing", generating: "Creating", checking: "Checking accuracy" };
const REASONS: [string, string][] = [
  ["logo_changed", "The logo changed"], ["text_changed", "Label text changed or is wrong"], ["wrong_product", "It's a different product"],
  ["missing_product", "The product is missing"], ["extra_items", "Extra or duplicate products"], ["colour_wrong", "Product colour is wrong"],
  ["shape_wrong", "Product shape is wrong"], ["corrupt_image", "Image is broken"], ["other", "Something else"],
];
const CHECK_LABEL: Record<string, string> = {
  product_alignment: "Product kept from your photo", colour_delta: "Product colour", vlm_judge: "AI accuracy review", dimensions: "Output size", blank_output: "Image content",
};

export function JobView({ jobId, surface = "web", freeRemakes = 1 }: { jobId: string; surface?: "web" | "shopify"; freeRemakes?: number }) {
  const router = useRouter();
  const [data, setData] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<JobData>(`/api/jobs/${jobId}`);
      setData(d);
      setError(null);
      const done = ["completed", "review_needed", "failed", "cancelled"].includes(d.job.status);
      if (!done) timer.current = setTimeout(load, 2500);
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Couldn't load this shoot.");
      timer.current = setTimeout(load, 6000);
    }
  }, [jobId]);

  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current); }; }, [load]);

  if (!data) return <div className="grid min-h-[40vh] place-items-center text-mute">{error ?? <Spinner className="size-6" />}</div>;

  const { job, items, assets, references } = data;
  const byItem = new Map(assets.map((a) => [a.id, a]));
  const ready = items.filter((i) => i.status === "delivered").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const active = items.filter((i) => !["delivered", "failed", "cancelled"].includes(i.status));
  const output = OUTPUTS[job.output as OutputId];
  const openAsset = assets.find((a) => a.id === open) ?? null;
  const base = surface === "shopify" ? "/shopify" : "/app";

  async function cancel() {
    try {
      const r = await api<{ cancelled: number }>(`/api/jobs/${jobId}/cancel`, { method: "POST" });
      toast(r.cancelled ? `Cancelled ${r.cancelled} image(s). Credits returned.` : "Those images had already started.");
      load();
    } catch (e) { toast((e as Error).message, true); }
  }

  return (
    <div>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="animate-rise">
          <div className="eyebrow mb-2">{STYLES[job.style as StyleId]?.name} · {output?.name} {output?.ratio} · {job.mode === "preserve" ? "Product kept exact" : "Creative"}</div>
          <h1 className="display text-4xl sm:text-5xl">{job.products.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={job.statusTone}>{active.length > 0 && <Spinner className="size-3" />}{job.statusLabel}</Badge>
            <span className="text-sm text-mute">{ready} of {job.requested_count} ready{failed ? `, ${failed} failed (credits returned)` : ""}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {active.some((i) => i.status === "queued") && <Button variant="ghost" size="sm" onClick={cancel}>Cancel waiting images</Button>}
          {assets.length > 1 && surface === "web" && <ZipButton ids={assets.map((a) => a.id)} />}
          <Button variant="outline" size="sm" onClick={() => router.push(surface === "shopify" ? "/shopify" : `/app/new?product=${job.products.id}`)}>Shoot again</Button>
        </div>
      </header>

      {active.length > 0 && (
        <Notice className="mb-6">Your images are being made now. This usually takes 20 to 60 seconds each. You can leave this page; we&apos;ll keep working{surface === "web" ? " and email you when they're ready" : ""}.</Notice>
      )}
      {job.is_trial && assets.length > 0 && <Notice tone="warn" className="mb-6">These are trial images with a watermark. <a className="underline" href={`${base}/${surface === "shopify" ? "credits" : "wallet"}`}>Buy credits</a> for full-size clean images.</Notice>}

      <div className={clsx("grid gap-4", output && output.width > output.height * 1.3 ? "sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
        {items.map((it, i) => {
          const a = it.delivered_asset_id ? byItem.get(it.delivered_asset_id) : undefined;
          const reported = a && (Array.isArray(a.refund_requests) ? a.refund_requests[0] : a.refund_requests);
          return (
            <div key={it.id} className="animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="cropmarks relative overflow-hidden rounded-lg bg-paper-2" style={{ aspectRatio: output ? `${output.width}/${output.height}` : "1" }}>
                {a?.thumbUrl ? (
                  <button type="button" className="group size-full" onClick={() => setOpen(a.id)} aria-label="Open image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.thumbUrl} alt={`${job.products.name} shot ${i + 1}`} className="size-full object-cover animate-develop transition-transform duration-500 group-hover:scale-[1.03]" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-ink/60 to-transparent p-2 text-xs text-paper opacity-0 transition-opacity group-hover:opacity-100"><span>Open</span><ZoomIn size={14} /></span>
                  </button>
                ) : it.status === "failed" ? (
                  <div className="flex size-full flex-col items-center justify-center gap-1 p-4 text-center text-sm text-mute">
                    <AlertTriangle size={20} className="text-bad" />
                    <span className="text-ink">Couldn&apos;t make this one</span>
                    <span className="text-xs">{it.last_error ?? "Credit returned"}</span>
                  </div>
                ) : it.status === "cancelled" ? (
                  <div className="grid size-full place-items-center text-sm text-mute">Cancelled</div>
                ) : (
                  <div className="scanline relative grid size-full place-items-center">
                    <div className="text-center">
                      <div className="eyebrow">{ITEM_LABEL[it.status] ?? it.status}</div>
                      {it.attempts > 1 && <div className="mt-1 text-xs text-mute">Retrying for a better result</div>}
                    </div>
                  </div>
                )}
                <span className="frame-no absolute left-2 top-2 rounded bg-paper/80 px-1">{String(i + 1).padStart(2, "0")}A</span>
                {a && (
                  <div className="absolute right-2 top-2 flex gap-1">
                    {a.quality_status === "review" && <Badge tone="warn" className="!bg-[#fff3d6]">Check closely</Badge>}
                    {a.approval_status === "approved" && <Badge tone="good" className="!bg-[#e3f1e7]"><Check size={11} /> Approved</Badge>}
                    {reported && <Badge tone="bad" className="!bg-[#fde8e6]">Reported</Badge>}
                    {a.pushed_to_shopify_at && <Badge tone="good" className="!bg-[#e3f1e7]"><Store size={11} /> In store</Badge>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {references.length > 0 && (
        <div className="mt-12">
          <div className="eyebrow mb-3">Your reference photos</div>
          <div className="flex gap-3">
            {references.map((r) => (
              <div key={r.id} className="w-24 overflow-hidden rounded-md border border-line bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.url && <img src={r.url} alt={`${r.view_type} reference`} className="aspect-square w-full object-cover" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {openAsset && (
        <Lightbox
          asset={openAsset}
          reference={references[0]?.url ?? null}
          productName={job.products.name}
          surface={surface}
          freeRemakes={freeRemakes}
          onClose={() => setOpen(null)}
          onChanged={load}
          onRemade={(id) => router.push(`${base}/jobs/${id}`)}
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

function Lightbox({ asset, reference, productName, surface, freeRemakes, onClose, onChanged, onRemade }: {
  asset: Asset; reference: string | null; productName: string; surface: "web" | "shopify"; freeRemakes: number;
  onClose: () => void; onChanged: () => void; onRemade: (jobId: string) => void;
}) {
  const [mode, setMode] = useState<"fit" | "zoom" | "compare">("fit");
  const [split, setSplit] = useState(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("text_changed");
  const [details, setDetails] = useState("");
  const [format, setFormat] = useState<"png" | "jpg" | "webp">("jpg");
  const remakeKey = useRef(newKey());
  const reported = Array.isArray(asset.refund_requests) ? asset.refund_requests[0] : asset.refund_requests;
  const freeLeft = asset.remakes_used < freeRemakes && Date.now() - new Date(asset.delivered_at).getTime() < 7 * 86_400_000;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);

  async function run<T>(label: string, fn: () => Promise<T>, ok?: (r: T) => void) {
    setBusy(label);
    try { const r = await fn(); ok?.(r); onChanged(); } catch (e) { toast((e as Error).message, true); }
    setBusy(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-paper" role="dialog" aria-modal="true" aria-label="Image viewer">
      <div className="flex items-center justify-between gap-2 border-b border-paper/10 px-4 py-3">
        <div className="flex gap-1 rounded-full bg-paper/10 p-1 text-sm">
          {(["fit", "zoom", "compare"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} disabled={m === "compare" && !reference} className={clsx("rounded-full px-3 py-1", mode === m && "bg-paper text-ink")}>{m === "fit" ? "Fit" : m === "zoom" ? "100%" : "Compare"}</button>
          ))}
        </div>
        <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-paper/10"><X /></button>
      </div>

      <div className="relative flex-1 overflow-auto">
        {mode === "zoom" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.url ?? ""} alt="" className="max-w-none" style={{ width: asset.width, height: asset.height }} />
        ) : mode === "compare" && reference ? (
          <div className="relative mx-auto h-full max-h-[78vh] select-none" style={{ aspectRatio: `${asset.width}/${asset.height}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url ?? ""} alt="Result" className="absolute inset-0 size-full object-contain" />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={reference} alt="Your photo" className="size-full bg-ink object-contain" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${split}%` }} />
            <span className="eyebrow absolute left-3 top-3 !text-paper/80">Your photo</span>
            <span className="eyebrow absolute right-3 top-3 !text-paper/80">Result</span>
            <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Compare" className="absolute inset-x-6 bottom-4 accent-[#e2531b]" />
          </div>
        ) : (
          <div className="grid h-full place-items-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={asset.url ?? ""} alt={productName} className="max-h-[78vh] max-w-full object-contain" />
          </div>
        )}
      </div>

      <div className="border-t border-paper/10 px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-paper/70">
            {asset.quality_checks.filter((c) => CHECK_LABEL[c.check_type]).map((c) => (
              <li key={c.check_type} className="flex items-center gap-1.5" title={String(c.details?.note ?? "")}>
                {c.decision === "pass" ? <ShieldCheck size={13} className="text-[#7bc596]" /> : <AlertTriangle size={13} className="text-[#f0b54a]" />}
                {CHECK_LABEL[c.check_type]}{c.decision !== "pass" && c.details?.note ? `: ${String(c.details.note)}` : ""}
              </li>
            ))}
            <li className="text-paper/40">Automatic checks catch most problems, not all. Look at the label at 100% before publishing.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            {asset.approval_status !== "approved" && !reported && (
              <Button size="sm" variant="accent" disabled={!!busy} onClick={() => run("approve", () => api(`/api/assets/${asset.id}/approve`, { method: "POST", json: { approved: true } }), () => toast("Approved"))}><Check size={15} /> Approve</Button>
            )}
            {surface === "shopify" && !asset.pushed_to_shopify_at && !asset.watermarked && (
              <Button size="sm" variant="accent" disabled={!!busy} onClick={() => run("push", () => api(`/api/assets/${asset.id}/shopify`, { method: "POST" }), () => toast("Added to your Shopify product"))}>{busy === "push" ? <Spinner /> : <Store size={15} />} Add to Shopify product</Button>
            )}
            <div className="flex items-center gap-1 rounded-full bg-paper/10 pl-1">
              <Select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className="!h-8 !w-20 !rounded-full !border-0 !bg-transparent !text-paper text-sm" aria-label="Format">
                <option value="jpg">JPG</option><option value="png">PNG</option><option value="webp">WebP</option>
              </Select>
              <Button size="sm" variant="ghost" className="!text-paper hover:!bg-paper/10" disabled={!!busy}
                onClick={() => run("dl", async () => saveBlob(await api<Blob>(`/api/assets/${asset.id}/download?format=${format}`), `${productName.replace(/\W+/g, "-").toLowerCase()}.${format}`))}>
                {busy === "dl" ? <Spinner /> : <Download size={15} />} Download
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="!text-paper hover:!bg-paper/10" disabled={!!busy}
              onClick={() => run("remake", () => api<{ jobId: string; free: boolean }>(`/api/assets/${asset.id}/remake`, { method: "POST", json: { idempotencyKey: remakeKey.current } }), (r) => { toast(r.free ? "Free remake started" : "Remake started (1 credit)"); onRemade(r.jobId); })}>
              <RefreshCw size={15} /> {freeLeft ? "Free remake" : "Remake · 1 credit"}
            </Button>
            {!reported && <Button size="sm" variant="ghost" className="!text-paper hover:!bg-paper/10" onClick={() => setReporting(true)}><Flag size={15} /> Report a problem</Button>}
            {reported && <Badge tone="warn" className="!bg-paper/10 !text-paper">Report {reported.status.replace("_", " ")}</Badge>}
          </div>
        </div>
      </div>

      {reporting && (
        <div className="absolute inset-0 grid place-items-center bg-ink/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-paper p-6 text-ink">
            <h2 className="display text-3xl">What&apos;s wrong?</h2>
            <p className="mt-1 text-sm text-mute">If your product changed (logo, label, shape, colour), you get the credit back. For &quot;I just don&apos;t like it&quot;, use a free remake instead.</p>
            <div className="mt-4 space-y-1.5">
              {REASONS.map(([id, label]) => (
                <label key={id} className={clsx("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm", reason === id ? "border-ink" : "border-line")}>
                  <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="accent-[#e2531b]" /> {label}
                </label>
              ))}
            </div>
            <Textarea className="mt-3" placeholder="Tell us what you see (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReporting(false)}>Cancel</Button>
              <Button disabled={!!busy} onClick={() => run("report", () => api<{ status: string; note?: string }>(`/api/assets/${asset.id}/report`, { method: "POST", json: { reason, details: details || null } }), (r) => {
                setReporting(false);
                toast(r.status === "auto_approved" ? "Confirmed. Your credit is back." : "Thanks. We'll review it within 1 working day.");
              })}>{busy === "report" ? <Spinner /> : "Send report"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
