import { z } from "zod";
import { body, handler } from "@/lib/api";
import { remakeAsset } from "@/lib/jobs";

export const POST = handler<{ id: string }>(async (req, ctx, { id }) => {
  const { idempotencyKey } = await body(req, z.object({ idempotencyKey: z.string().min(8).max(100) }));
  return remakeAsset(ctx, id, idempotencyKey);
});
