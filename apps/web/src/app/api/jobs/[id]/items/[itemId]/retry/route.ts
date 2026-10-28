import { z } from "zod";
import { body, handler } from "@/lib/api";
import { retryItem } from "@/lib/jobs";

/** Try a failed photo again. Charged only if the new photo is delivered. */
export const POST = handler<{ id: string; itemId: string }>(async (req, ctx, { id, itemId }) => {
  const { idempotencyKey } = await body(req, z.object({ idempotencyKey: z.string().min(8).max(100) }));
  return retryItem(ctx, id, itemId, idempotencyKey);
});
