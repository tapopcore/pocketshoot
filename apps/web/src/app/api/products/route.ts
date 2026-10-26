import { body, handler } from "@/lib/api";
import { createProduct, createProductSchema } from "@/lib/products";
import { productList } from "@/lib/views";

export const GET = handler(async (req, ctx) => {
  const u = new URL(req.url);
  return productList(ctx.orgId, {
    q: u.searchParams.get("q"),
    limit: Math.min(60, Number(u.searchParams.get("limit") ?? 24)),
    offset: Number(u.searchParams.get("offset") ?? 0),
  });
});

export const POST = handler(async (req, ctx) => {
  const input = await body(req, createProductSchema);
  return createProduct(ctx, input, ctx.via === "mobile" ? "mobile" : "upload");
});
