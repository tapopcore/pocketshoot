import { z } from "zod";
import { body, handler } from "@/lib/api";
import { importShopifyProducts } from "@/lib/products";

export const maxDuration = 120;

export const POST = handler(async (req, ctx) => {
  const { productIds } = await body(req, z.object({ productIds: z.array(z.string().startsWith("gid://shopify/Product/")).min(1).max(50) }));
  return { results: await importShopifyProducts(ctx, productIds) };
});
