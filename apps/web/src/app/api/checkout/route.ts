import { z } from "zod";
import { body, handler } from "@/lib/api";
import { createCheckout, quote } from "@/lib/billing";

const schema = z.object({
  packId: z.string().uuid(),
  couponCode: z.string().max(40).nullish(),
  buyerName: z.string().max(120).nullish(),
  buyerGstin: z.string().max(15).nullish().transform((v) => (v ? v.trim().toUpperCase() : null)),
  buyerStateCode: z.string().length(2).nullish(),
  previewOnly: z.boolean().optional(),
});

export const POST = handler(async (req, ctx) => {
  const input = await body(req, schema);
  if (input.previewOnly) return { quote: await quote(ctx, input.packId, input) };
  return createCheckout(ctx, input);
});
