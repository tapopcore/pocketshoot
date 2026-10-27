import { ApiError, handler } from "@/lib/api";
import { assertRole } from "@/lib/auth";
import { admin } from "@/lib/supabase";

/**
 * Explicit human signoff on the actual preparation result.
 * The generation endpoint checks this before reserving credits.
 */
export const POST = handler<{ id: string }>(async (_req, ctx, { id }) => {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: p } = await db.from("products").select("id")
    .eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!p) throw new ApiError(404, "Product not found");
  const { data: asset } = await db.from("product_assets")
    .select("id,metadata,cutout_key").eq("product_id", id).order("created_at").limit(1).maybeSingle();
  if (!asset) throw new ApiError(400, "Upload a reference photo first");
  const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
  if (metadata.heroStatus === "processing" || (!asset.cutout_key && metadata.heroStatus !== "failed")) {
    throw new ApiError(409, "The product preview is still being prepared");
  }
  const preparedAs = asset.cutout_key && asset.cutout_key !== "none"
    ? (String(metadata.cutoutMethod ?? "").startsWith("retouch") ? "retouched" : "cutout_only")
    : "original";
  const approvedAt = new Date().toISOString();
  const { error } = await db.from("product_assets").update({
    metadata: { ...metadata, prepApprovedAt: approvedAt, prepApprovedAs: preparedAs },
  }).eq("id", asset.id).eq("organization_id", ctx.orgId);
  if (error) throw error;
  return { approved: true, preparation: preparedAs, approvedAt };
});
