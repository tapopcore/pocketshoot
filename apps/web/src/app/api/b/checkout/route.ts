import { z } from "zod";
import { body, handler } from "@/lib/api";
import { createBabyCheckout } from "@/lib/baby/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req, ctx) => {
  const p = await body(req, z.object({ pack: z.enum(["baby_1", "baby_6", "baby_10", "baby_15"]) }));
  return createBabyCheckout(ctx, p.pack);
});
