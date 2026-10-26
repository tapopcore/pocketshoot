import { z } from "zod";
import { body, handler } from "@/lib/api";
import { editAsset } from "@/lib/jobs";

/** Change a finished image with plain words ("make the background warmer"). The product stays exact. */
export const POST = handler<{ id: string }>(async (req, ctx, { id }) => {
  const { instruction, idempotencyKey } = await body(req, z.object({ instruction: z.string().trim().min(3).max(500), idempotencyKey: z.string().min(8).max(100) }));
  return editAsset(ctx, id, instruction, idempotencyKey);
});
