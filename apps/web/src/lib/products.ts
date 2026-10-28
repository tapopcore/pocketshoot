import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CATEGORIES, isCategoryId, collectionById, type CategoryId } from "@packshot/core";
import { admin } from "./supabase";
import { getObject, putObject, removeObjects, signedUpload } from "./storage";
import { normalizeUpload, ImageRejected } from "./images";
import { ApiError } from "./api";
import { assertRole, type AuthContext } from "./auth";
import { rateLimit, track } from "./observe";
import { productSchema } from "./jobs";
import { getProduct as getShopifyProduct } from "./shopify/admin";

export const VIEW_TYPES = ["front", "angle", "back", "detail", "other"] as const;
/** Photos per product. Every one is studied and sent to the image engine. */
export const MAX_PRODUCT_PHOTOS = 6;

export const uploadRequestSchema = z.object({
  files: z.array(z.object({ name: z.string().max(200), type: z.string().max(100), size: z.number().int().positive() })).min(1).max(10),
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 25 * 1024 * 1024;

export async function createUploadUrls(ctx: AuthContext, files: z.infer<typeof uploadRequestSchema>["files"]) {
  assertRole(ctx, "editor");
  if (!(await rateLimit(`upload:${ctx.orgId}`, 200, 3600))) throw new ApiError(429, "Too many uploads this hour. Please wait a little.");
  return Promise.all(files.map(async (f) => {
    if (!ALLOWED_TYPES.includes(f.type)) throw new ApiError(400, `${f.name}: use a JPG, PNG or WebP image. (iPhone HEIC photos: export as JPG first.)`);
    if (f.size > MAX_BYTES) throw new ApiError(400, `${f.name} is larger than 25 MB`);
    const key = `${ctx.orgId}/${randomUUID()}`;
    const signed = await signedUpload("uploads", key);
    return { key, url: signed.url, token: signed.token, name: f.name };
  }));
}

export const createProductSchema = productSchema.extend({
  uploads: z.array(z.object({ key: z.string(), viewType: z.enum(VIEW_TYPES).default("front") })).min(1).max(MAX_PRODUCT_PHOTOS),
});

/** Validates uploaded files and stores clean copies as the product's reference photos. */
async function ingestUploads(ctx: AuthContext, productId: string, uploads: { key: string; viewType: string }[]) {
  const db = admin();
  const results = [];
  for (const u of uploads) {
    if (!u.key.startsWith(`${ctx.orgId}/`) || u.key.includes("..")) throw new ApiError(403, "Upload doesn't belong to this workspace");
    let raw: Buffer;
    try {
      raw = await getObject("uploads", u.key);
    } catch {
      throw new ApiError(400, "An upload didn't finish. Please add the photo again.");
    }
    let clean;
    try {
      clean = await normalizeUpload(raw);
    } catch (e) {
      await removeObjects("uploads", [u.key]);
      if (e instanceof ImageRejected) throw new ApiError(400, e.message);
      throw e;
    }
    const id = randomUUID();
    const key = `${ctx.orgId}/${productId}/${id}.jpg`;
    await putObject("originals", key, clean.buffer, "image/jpeg");
    await removeObjects("uploads", [u.key]);
    results.push({ id, product_id: productId, organization_id: ctx.orgId, storage_key: key, view_type: u.viewType, width: clean.width, height: clean.height, bytes: clean.buffer.length, mime: "image/jpeg", checksum: clean.checksum });
  }
  const { error } = await db.from("product_assets").insert(results);
  if (error) throw error;
  return results;
}

export async function createProduct(ctx: AuthContext, input: z.infer<typeof createProductSchema>, source: "upload" | "mobile" | "csv" = "upload") {
  assertRole(ctx, "editor");
  const db = admin();
  const category = input.category as CategoryId;
  const { data: product, error } = await db.from("products").insert({
    organization_id: ctx.orgId, name: input.name, category, sku: input.sku ?? null,
    locks: input.locks.length ? input.locks : CATEGORIES[category].defaultLocks,
    must_not_change: input.mustNotChange ?? null, source, created_by: ctx.userId,
  }).select("id").single();
  if (error) throw error;
  try {
    await ingestUploads(ctx, product.id, input.uploads);
  } catch (e) {
    await db.from("products").delete().eq("id", product.id);
    throw e;
  }
  await track("upload_completed", ctx, { photos: input.uploads.length, category, source });
  return { productId: product.id };
}

export async function addProductPhotos(ctx: AuthContext, productId: string, uploads: { key: string; viewType: string }[]) {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: p } = await db.from("products").select("id").eq("id", productId).eq("organization_id", ctx.orgId).maybeSingle();
  if (!p) throw new ApiError(404, "Product not found");
  const { count } = await db.from("product_assets").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if ((count ?? 0) + uploads.length > MAX_PRODUCT_PHOTOS) throw new ApiError(400, `Up to ${MAX_PRODUCT_PHOTOS} photos per product. Remove one to add another.`);
  return ingestUploads(ctx, productId, uploads);
}

export async function updateProduct(ctx: AuthContext, productId: string, input: Partial<z.infer<typeof productSchema>> & { archived?: boolean }) {
  assertRole(ctx, "editor");
  const patch: Record<string, unknown> = {};
  if (input.shootProfile) {
    const { data: current } = await admin().from("products").select("attributes, category").eq("id", productId).eq("organization_id", ctx.orgId).maybeSingle();
    if (!current) throw new ApiError(404, "Product not found");
    if (collectionById(input.shootProfile.type)?.category !== (input.category ?? current.category)) throw new ApiError(400, "Choose a product type in this industry.");
    patch.attributes = { ...(current.attributes ?? {}), shootProfile: input.shootProfile };
  }
  if (input.name !== undefined) patch.name = input.name;
  if (input.category !== undefined) patch.category = input.category;
  if (input.sku !== undefined) patch.sku = input.sku;
  if (input.locks !== undefined) patch.locks = input.locks;
  if (input.mustNotChange !== undefined) patch.must_not_change = input.mustNotChange;
  if (input.archived !== undefined) patch.archived_at = input.archived ? new Date().toISOString() : null;
  const { data } = await admin().from("products").update(patch).eq("id", productId).eq("organization_id", ctx.orgId).select("id");
  if (!data?.length) throw new ApiError(404, "Product not found");
}

export async function deleteProductPhoto(ctx: AuthContext, assetId: string) {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: a } = await db.from("product_assets").select("id, product_id, storage_key, cutout_key").eq("id", assetId).eq("organization_id", ctx.orgId).maybeSingle();
  if (!a) throw new ApiError(404, "Photo not found");
  const { count } = await db.from("product_assets").select("id", { count: "exact", head: true }).eq("product_id", a.product_id);
  if ((count ?? 0) <= 1) throw new ApiError(400, "A product needs at least one photo");
  await db.from("product_assets").delete().eq("id", assetId);
  await removeObjects("originals", [a.storage_key, a.cutout_key].filter((k): k is string => !!k && k !== "none"));
}

/** Guesses one of our categories from a Shopify product type, tags and title. */
export function guessCategory(text: string): CategoryId {
  const t = text.toLowerCase();
  const rules: [CategoryId, RegExp][] = [
    ["jewellery", /jewel|ring|earring|necklace|bracelet|bangle|pendant|watch|chain|anklet|kundan|sunglass|wallet|handbag|bag/],
    ["beauty", /serum|cream|lotion|lipstick|lip |skin|beauty|cosmetic|perfume|fragrance|shampoo|conditioner|face|makeup|nail|hair oil|soap|body wash|sunscreen/],
    ["food", /food|snack|spice|masala|tea|coffee bean|chocolate|sweet|pickle|juice|beverage|drink|honey|ghee|namkeen|chips|cookie|biscuit|sauce|oil 1l/],
    ["home_kitchen", /mug|cup|bottle|kitchen|cookware|pan|pot|jar|container|decor|lamp|vase|planter|candle|cushion|home|tableware|plate|bowl/],
  ];
  for (const [id, re] of rules) if (re.test(t)) return id;
  return "other";
}

/** Imports Shopify products (and up to 3 of their images) as reference products. */
export async function importShopifyProducts(ctx: AuthContext, productIds: string[]) {
  assertRole(ctx, "editor");
  if (!ctx.shop) throw new ApiError(400, "Not a Shopify session");
  const db = admin();
  const out: { shopifyId: string; productId?: string; error?: string }[] = [];
  for (const gid of productIds.slice(0, 50)) {
    try {
      const { data: existing } = await db.from("products").select("id").eq("organization_id", ctx.orgId).eq("shopify_product_id", gid).maybeSingle();
      if (existing) {
        const { count } = await db.from("product_assets").select("id", { count: "exact", head: true }).eq("product_id", existing.id);
        if ((count ?? 0) > 0) { out.push({ shopifyId: gid, productId: existing.id }); continue; }
      }
      const sp = await getShopifyProduct(ctx.shop, gid);
      if (!sp) throw new Error("Product not found in Shopify");
      if (sp.images.length === 0) throw new Error("This product has no images in Shopify");
      const category = guessCategory(`${sp.productType} ${sp.title}`);
      let productId = existing?.id;
      if (!productId) {
        const { data: created, error } = await db.from("products").insert({
          organization_id: ctx.orgId, name: sp.title.slice(0, 120), category, sku: sp.sku, locks: CATEGORIES[category].defaultLocks,
          source: "shopify", shopify_product_id: gid, attributes: { handle: sp.handle, vendor: sp.vendor, productType: sp.productType },
        }).select("id").single();
        if (error) throw error;
        productId = created.id;
      }
      const assets = [];
      for (const [i, img] of sp.images.slice(0, 3).entries()) {
        const r = await fetch(img.url, { signal: AbortSignal.timeout(30_000) });
        if (!r.ok) continue;
        try {
          const clean = await normalizeUpload(Buffer.from(await r.arrayBuffer()));
          const id = randomUUID();
          const key = `${ctx.orgId}/${productId}/${id}.jpg`;
          await putObject("originals", key, clean.buffer, "image/jpeg");
          assets.push({ id, product_id: productId, organization_id: ctx.orgId, storage_key: key, view_type: i === 0 ? "front" : "angle", width: clean.width, height: clean.height, bytes: clean.buffer.length, mime: "image/jpeg", checksum: clean.checksum, metadata: { shopifyMediaId: img.id } });
        } catch {
          // skip images that are too small or unreadable
        }
      }
      if (assets.length === 0) throw new Error("The product images are too small to use (need 500px or more)");
      await db.from("product_assets").insert(assets);
      out.push({ shopifyId: gid, productId });
    } catch (e) {
      out.push({ shopifyId: gid, error: (e as Error).message });
    }
  }
  await track("shopify_products_imported", ctx, { count: out.filter((o) => o.productId).length });
  return out;
}

export function categoryOrOther(v: string): CategoryId {
  return isCategoryId(v) ? v : "other";
}
