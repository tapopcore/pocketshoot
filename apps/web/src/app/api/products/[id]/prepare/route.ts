import { CATEGORIES, STYLES, scenesFor, type ProductAnalysis } from "@packshot/core";
import { ApiError, handler } from "@/lib/api";
import { assertRole } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { analyzeProduct } from "@/lib/prep";
import { heroState } from "@/lib/hero";

export const maxDuration = 300;

/**
 * Runs right after upload. Returns the AI's read of the product (name, category, label text,
 * campaign ideas). Image generation is deferred until the customer creates a paid job.
 */
export const POST = handler<{ id: string }>(async (_req, ctx, { id }) => {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: product } = await db.from("products").select("id, name, category, attributes").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!product) throw new ApiError(404, "Product not found");
  const { data: refs } = await db.from("product_assets").select("id, storage_key, cutout_key, view_type, organization_id, product_id, metadata").eq("product_id", id).order("created_at");
  if (!refs?.length) throw new ApiError(400, "Add a photo first");
  const primary = refs.find((r) => r.view_type === "front") ?? refs[0];

  const analysis = (await analyzeProduct(id)) as ProductAnalysis | null;

  // Fill in what the user hasn't: a clean name and the right category.
  const patch: Record<string, string | string[]> = {};
  if (analysis && (!product.name || /^(new product|product|untitled|img|image|photo)\b/i.test(product.name))) patch.name = analysis.name;
  if (analysis && product.category === "other" && analysis.category !== "other") {
    patch.category = analysis.category;
    patch.locks = CATEGORIES[analysis.category].defaultLocks;
  }
  if (Object.keys(patch).length) await db.from("products").update(patch).eq("id", id);

  const category = (patch.category ?? product.category) as Parameters<typeof scenesFor>[0];
  const ranked = scenesFor(category).map((s) => s.id);
  const suggested = [...new Set([...(analysis?.suggested_scenes ?? []), ...ranked])].filter((s) => s in STYLES).slice(0, 7);
  return {
    product: { id, name: (patch.name as string | undefined) ?? product.name, category, shootProfile: (product.attributes as Record<string, unknown> | null)?.shootProfile ?? null },
    references: refs.map(r => ({ id: r.id, view_type: r.view_type })),
    analysis,
    ideas: analysis?.ideas ?? [],
    suggestedScenes: suggested,
    hero: await heroState(primary.id),
  };
});
