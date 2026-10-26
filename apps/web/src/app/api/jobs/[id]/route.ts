import { JOB_STATUS_LABEL, type JobStatus } from "@packshot/core";
import { ApiError, handler } from "@/lib/api";
import { jobView } from "@/lib/jobs";
import { withAssetUrls, withRefUrls } from "@/lib/views";

export const GET = handler<{ id: string }>(async (_req, ctx, { id }) => {
  const v = await jobView(ctx.orgId, id);
  if (!v) throw new ApiError(404, "Shoot not found");
  const status = v.job.status as JobStatus;
  return {
    job: { ...v.job, statusLabel: JOB_STATUS_LABEL[status]?.label ?? status, statusTone: JOB_STATUS_LABEL[status]?.tone ?? "neutral" },
    items: v.items.map((i) => ({ ...i, last_error: i.last_error?.split(": ").slice(1).join(": ") || i.last_error })),
    assets: await withAssetUrls(v.assets),
    references: await withRefUrls(v.refs),
  };
});
