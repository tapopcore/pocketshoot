import Link from "next/link";
import { JOB_STATUS_LABEL, OUTPUTS, STYLES, type JobStatus, type OutputId, type StyleId } from "@packshot/core";

export interface JobSummary {
  id: string;
  status: string;
  style: string;
  output: string;
  count: number;
  createdAt: string;
  isTrial: boolean;
  product: { id: string; name: string };
  thumbs: string[];
}

function ago(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(d));
}

export function JobCard({ job, index, hrefBase = "/app/jobs" }: { job: JobSummary; index: number; hrefBase?: string }) {
  const s = JOB_STATUS_LABEL[job.status as JobStatus] ?? { label: job.status, tone: "neutral" as const };
  const busy = s.tone === "busy" || job.status === "queued";
  const cover = job.thumbs[0];
  return (
    <Link href={`${hrefBase}/${job.id}`} className="group block animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-paper-2 ring-1 ring-black/5">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04] animate-develop" />
        ) : (
          <div className={`size-full ${busy ? "skeleton" : ""}`} />
        )}
        {job.thumbs.length > 1 && (
          <div className="absolute bottom-2 right-2 flex -space-x-2">
            {job.thumbs.slice(1, 4).map((t, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={t} alt="" className="size-9 rounded-lg border-2 border-white object-cover shadow-sm" />
            ))}
          </div>
        )}
        {busy && <span className="glass absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-medium">Creating…</span>}
        {s.tone === "warn" && !busy && <span className="absolute left-2 top-2 rounded-full bg-[#fff3d6] px-2.5 py-1 text-[11px] font-medium text-warn">Check label</span>}
        {s.tone === "bad" && <span className="absolute left-2 top-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-bad">Failed</span>}
      </div>
      <div className="mt-2 min-w-0 px-0.5">
        <div className="truncate text-sm font-semibold">{job.product?.name ?? "Product"}</div>
        <div className="truncate text-xs text-mute">{STYLES[job.style as StyleId]?.name ?? job.style} · {OUTPUTS[job.output as OutputId]?.ratio} · {ago(job.createdAt)}</div>
      </div>
    </Link>
  );
}
