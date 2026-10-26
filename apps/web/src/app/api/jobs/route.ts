import { body, handler } from "@/lib/api";
import { createJob, createJobSchema } from "@/lib/jobs";
import { recentJobs } from "@/lib/views";

export const GET = handler(async (req, ctx) => {
  const u = new URL(req.url);
  return { jobs: await recentJobs(ctx.orgId, Math.min(50, Number(u.searchParams.get("limit") ?? 20)), Number(u.searchParams.get("offset") ?? 0), { productId: u.searchParams.get("productId") ?? undefined }) };
});

export const POST = handler(async (req, ctx) => {
  const input = await body(req, createJobSchema);
  return createJob(ctx, input);
});
