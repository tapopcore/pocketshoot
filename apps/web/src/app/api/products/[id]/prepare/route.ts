import { CATEGORIES, STYLES, scenesFor, type ProductAnalysis } from "@packshot/core";
import { handler } from "@/lib/api";
import { assertRole } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { admin } from "@/lib/supabase";
import { analyzeProduct, getCutout } from "@/lib/prep";
import { signedUrl } from "@/lib/storage";

export const maxDuration = 120;

/**
 * Runs right after upload: cuts the product out and has the AI study it, so the studio can
 * show the cut-out, fill in the name and category, and suggest scenes before the user spends credits.
 */
export const POST = handler<{ id: string }>(async (_req, ctx, { id }) => {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: product } = await db.from("products").select("id, name, category").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!product) throw new ApiError(404, "Product not found");
  const { data: refs } = await db.from("product_assets").select("id, storage_key, cutout_key, view_type, organization_id, product_id, metadata").eq("product_id", id).order("created_at");
  if (!refs?.length) throw new ApiError(400, "Add a photo first");
  const primary = refs.find((r) => r.view_type === "front") ?? refs[0];

  const [cut, analysis] = await Promise.all([getCutout(primary, { allowModel: true }), analyzeProduct(id)]);
  const { data: fresh } = await db.from("product_assets").select("cutout_key, metadata").eq("id", primary.id).single();
  const cutoutUrl = cut && fresh?.cutout_key && fresh.cutout_key !== "none" ? await signedUrl("originals", fresh.cutout_key, 3600) : null;

  // Fill in what the user hasn't: a clean name and the right category.
  const a = analysis as ProductAnalysis | null;
  const patch: Record<string, string | string[]> = {};
  if (a && (!product.name || /^(new product|product|untitled|img|image|photo)\b/i.test(product.name))) patch.name = a.name;
  if (a && product.category === "other" && a.category !== "other") {
    patch.category = a.category;
    patch.locks = CATEGORIES[a.category].defaultLocks;
  }
  if (Object.keys(patch).length) await db.from("products").update(patch).eq("id", id);

  const category = (patch.category ?? product.category) as Parameters<typeof scenesFor>[0];
  const ranked = scenesFor(category).map((s) => s.id);
  const suggested = [...new Set([...(a?.suggested_scenes ?? []), ...ranked])].filter((s) => s in STYLES).slice(0, 8);
  return {
    product: { id, name: (patch.name as string | undefined) ?? product.name, category },
    cutoutUrl,
    cutoutMethod: (fresh?.metadata as { cutoutMethod?: string } | null)?.cutoutMethod ?? null,
    analysis: a,
    suggestedScenes: suggested,
  };
});
