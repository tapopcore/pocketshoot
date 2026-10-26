import { ApiError, body, handler } from "@/lib/api";
import { reportAsset, reportSchema } from "@/lib/assets";
import { rateLimit } from "@/lib/observe";

export const POST = handler<{ id: string }>(async (req, ctx, { id }) => {
  if (!(await rateLimit(`report:${ctx.orgId}`, 30, 86400))) throw new ApiError(429, "Too many reports today. Contact support and we'll look at them together.");
  return reportAsset(ctx, id, await body(req, reportSchema));
});
