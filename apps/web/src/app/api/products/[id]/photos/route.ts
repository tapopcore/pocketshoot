import { z } from "zod";
import { ApiError, body, handler } from "@/lib/api";
import { addProductPhotos, deleteProductPhoto, MAX_PRODUCT_PHOTOS, VIEW_TYPES } from "@/lib/products";

export const POST = handler<{ id: string }>(async (req, ctx, { id }) => {
  const { uploads } = await body(req, z.object({ uploads: z.array(z.object({ key: z.string(), viewType: z.enum(VIEW_TYPES).default("angle") })).min(1).max(MAX_PRODUCT_PHOTOS) }));
  return { photos: await addProductPhotos(ctx, id, uploads) };
});

export const DELETE = handler<{ id: string }>(async (req, ctx) => {
  const assetId = new URL(req.url).searchParams.get("assetId");
  if (!assetId) throw new ApiError(400, "assetId is required");
  await deleteProductPhoto(ctx, assetId);
  return { ok: true };
});
