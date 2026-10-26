import { z } from "zod";
import { body, handler } from "@/lib/api";
import { setApproval } from "@/lib/assets";

export const POST = handler<{ id: string }>(async (req, ctx, { id }) => {
  const { approved } = await body(req, z.object({ approved: z.boolean().default(true) }));
  await setApproval(ctx, id, approved ? "approved" : "pending");
  return { ok: true };
});
