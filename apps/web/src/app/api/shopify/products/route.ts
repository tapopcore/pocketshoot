import { ApiError, handler } from "@/lib/api";
import { listProducts } from "@/lib/shopify/admin";
import { admin } from "@/lib/supabase";

/** Lists the store's products, marking which ones already have shoots here. */
export const GET = handler(async (req, ctx) => {
  if (!ctx.shop) throw new ApiError(400, "Open this from the Shopify app");
  const u = new URL(req.url);
  const q = u.searchParams.get("q");
  const { products, pageInfo } = await listProducts(ctx.shop, { after: u.searchParams.get("after"), query: q ? `title:*${q.replace(/[^\w\s-]/g, "")}*` : null });
  const ids = products.map((p) => p.id);
  const { data: linked } = await admin().from("products").select("id, shopify_product_id, generated_assets(id, pushed_to_shopify_at)").eq("organization_id", ctx.orgId).in("shopify_product_id", ids.length ? ids : ["none"]);
  const byId = new Map((linked ?? []).map((l) => [l.shopify_product_id, l as unknown as { id: string; generated_assets: { id: string; pushed_to_shopify_at: string | null }[] }]));
  return {
    pageInfo,
    products: products.map((p) => {
      const l = byId.get(p.id);
      return { ...p, localProductId: l?.id ?? null, shots: l?.generated_assets.length ?? 0, pushed: l?.generated_assets.filter((a) => a.pushed_to_shopify_at).length ?? 0 };
    }),
  };
});
