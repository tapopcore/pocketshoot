import { z } from "zod";
import { ApiError, body, handler } from "@/lib/api";
import { updateProduct } from "@/lib/products";
import { productSchema } from "@/lib/jobs";
import { admin } from "@/lib/supabase";
import { withRefUrls, recentJobs } from "@/lib/views";

export const GET = handler<{ id: string }>(async (_req, ctx, { id }) => {
  const { data: product } = await admin().from("products").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!product) throw new ApiError(404, "Product not found");
  const { data: photos } = await admin().from("product_assets").select("id, storage_key, view_type, width, height, metadata").eq("product_id", id).order("created_at");
  return { product, photos: await withRefUrls(photos ?? []), jobs: await recentJobs(ctx.orgId, 20, 0, { productId: id }) };
});

export const PATCH = handler<{ id: string }>(async (req, ctx, { id }) => {
  const input = await body(req, productSchema.partial().extend({ archived: z.boolean().optional() }));
  await updateProduct(ctx, id, input);
  return { ok: true };
});
