/* eslint-disable @next/next/no-img-element -- Signed storage URLs. */
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

export function ago(d: string) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "Yesterday";
  if (s < 604800) return new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(new Date(d));
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(d));
}

/** One shoot in a grid: cover photo, photo count, product, style and a status pill. */
export function JobCard({ job, index, hrefBase = "/app/jobs" }: { job: JobSummary; index: number; hrefBase?: string }) {
  const s = JOB_STATUS_LABEL[job.status as JobStatus] ?? { label: job.status, tone: "neutral" as const };
  const busy = s.tone === "busy" || job.status === "queued";
  const cover = job.thumbs[0];
  const pill = busy ? <span className="pill sm"><span className="live" />Creating</span>
    : s.tone === "good" ? <span className="pill good sm">Ready</span>
    : s.tone === "warn" ? <span className="pill warn sm">Check</span>
    : s.tone === "bad" ? <span className="pill bad sm">Failed</span>
    : <span className="pill sm">{s.label}</span>;
  return (
    <Link href={`${hrefBase}/${job.id}`} className="shoot lift animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="ph r45 zoom">
        {cover ? <img src={cover} alt="" className="animate-develop" /> : <div className={busy ? "skeleton size-full" : "size-full"} />}
        <span className="pill glass sm cnt">{job.count} photo{job.count === 1 ? "" : "s"}</span>
      </div>
      <div className="meta">
        <div><b>{job.product?.name ?? "Product"}</b><span>{STYLES[job.style as StyleId]?.name ?? "Custom"} · {OUTPUTS[job.output as OutputId]?.ratio ?? "1:1"} · {ago(job.createdAt)}</span></div>
        {pill}
      </div>
    </Link>
  );
}
