import Link from "next/link";
import { JOB_STATUS_LABEL, OUTPUTS, STYLES, type JobStatus, type OutputId, type StyleId } from "@packshot/core";
import { Badge, formatDate } from "./ui";

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

export function JobCard({ job, index, hrefBase = "/app/jobs" }: { job: JobSummary; index: number; hrefBase?: string }) {
  const s = JOB_STATUS_LABEL[job.status as JobStatus] ?? { label: job.status, tone: "neutral" as const };
  const busy = s.tone === "busy" || job.status === "queued";
  return (
    <Link href={`${hrefBase}/${job.id}`} className="group block animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="cropmarks relative grid aspect-square grid-cols-2 gap-1 overflow-hidden rounded-lg bg-paper-2 p-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-[5px] bg-card">
            {job.thumbs[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={job.thumbs[i]} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04] animate-develop" />
            ) : (
              <div className={`size-full ${busy && i < job.count ? "scanline relative bg-paper-2" : ""}`} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{job.product?.name ?? "Product"}</div>
          <div className="frame-no mt-0.5">{STYLES[job.style as StyleId]?.name ?? job.style} · {OUTPUTS[job.output as OutputId]?.ratio} · {formatDate(job.createdAt)}</div>
        </div>
        <Badge tone={s.tone}>{s.label.split(",")[0]}</Badge>
      </div>
    </Link>
  );
}
