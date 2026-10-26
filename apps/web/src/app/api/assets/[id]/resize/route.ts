import { z } from "zod";
import { body, handler } from "@/lib/api";
import { resizeAsset } from "@/lib/jobs";

/** The same scene in another format. */
export const POST = handler<{ id: string }>(async (req, ctx, { id }) => {
  const { output, idempotencyKey } = await body(req, z.object({ output: z.string().min(2).max(40), idempotencyKey: z.string().min(8).max(100) }));
  return resizeAsset(ctx, id, output, idempotencyKey);
});
