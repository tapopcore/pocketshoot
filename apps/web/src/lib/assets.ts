import "server-only";
import JSZip from "jszip";
import sharp from "sharp";
import { z } from "zod";
import { OUTPUTS } from "@packshot/core";
import { admin } from "./supabase";
import { getObject, signedUrl } from "./storage";
import { encodeFor, type DownloadFormat } from "./images";
import { ApiError } from "./api";
import { assertRole, type AuthContext } from "./auth";
import { audit, track } from "./observe";
import { addProductImage } from "./shopify/admin";

export const REFUND_REASONS = {
  logo_changed: "The logo changed",
  text_changed: "Label text changed or is wrong",
  wrong_product: "It's a different product",
  missing_product: "The product is missing",
  extra_items: "Extra or duplicate products",
  colour_wrong: "Product colour is wrong",
  shape_wrong: "Product shape is wrong",
  corrupt_image: "Image is broken or won't open",
  other: "Something else",
} as const;

export const reportSchema = z.object({
  reason: z.enum(Object.keys(REFUND_REASONS) as [keyof typeof REFUND_REASONS, ...(keyof typeof REFUND_REASONS)[]]),
  details: z.string().max(1000).nullish(),
});

async function loadAsset(ctx: AuthContext, id: string) {
  const { data } = await admin().from("generated_assets").select("*, products(id, name, shopify_product_id)").eq("id", id).eq("organization_id", ctx.orgId).neq("quality_status", "fail").maybeSingle();
  if (!data) throw new ApiError(404, "Image not found");
  return data as typeof data & { products: { id: string; name: string; shopify_product_id: string | null } };
}

export async function setApproval(ctx: AuthContext, id: string, status: "approved" | "pending") {
  assertRole(ctx, "editor");
  await loadAsset(ctx, id);
  await admin().from("generated_assets").update({ approval_status: status }).eq("id", id);
  if (status === "approved") await track("image_approved", ctx, {});
}

/** Maps a report reason to the screening check that would confirm it. */
const REASON_TO_JUDGE: Record<string, string> = {
  logo_changed: "logo_changed", text_changed: "text_changed", wrong_product: "same_product",
  missing_product: "extra_or_missing_items", extra_items: "extra_or_missing_items", colour_wrong: "colour_changed", shape_wrong: "shape_changed",
};

export async function reportAsset(ctx: AuthContext, id: string, input: z.infer<typeof reportSchema>) {
  assertRole(ctx, "editor");
  const db = admin();
  const asset = await loadAsset(ctx, id);
  const { data: existing } = await db.from("refund_requests").select("id, status").eq("generated_asset_id", id).maybeSingle();
  if (existing) return { requestId: existing.id, status: existing.status, duplicate: true };

  const { data: checks } = await db.from("quality_checks").select("check_type, decision, details").eq("generated_asset_id", id);
  const judge = checks?.find((c) => c.check_type === "vlm_judge")?.details as Record<string, unknown> | undefined;
  const align = checks?.find((c) => c.check_type === "product_alignment");
  const evidence: Record<string, unknown> = { qualityStatus: asset.quality_status, judge: judge ?? null, alignment: align ?? null };

  // Automated screening. Approves only when our own checks back up the report.
  let auto = false;
  let note = "";
  if (input.reason === "corrupt_image") {
    try {
      await sharp(await getObject("outputs", asset.storage_key)).stats();
    } catch {
      auto = true;
      note = "The file failed to decode.";
    }
  }
  const key = REASON_TO_JUDGE[input.reason];
  if (!auto && judge && key) {
    const confirmed = key === "same_product" ? judge.same_product === false : judge[key] === true;
    if (confirmed) { auto = true; note = "Our accuracy check flagged the same problem."; }
  }
  if (!auto && asset.quality_status === "review" && align && (align.details as { recomposited?: boolean })?.recomposited === false && ["logo_changed", "text_changed", "wrong_product", "shape_wrong"].includes(input.reason)) {
    auto = true;
    note = "The product was re-created by the AI rather than kept from your photo.";
  }
  // Abuse guard: lots of reports from one workspace go to a person instead.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ count: reports }, { count: delivered }] = await Promise.all([
    db.from("refund_requests").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).gte("created_at", since),
    db.from("generated_assets").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).neq("quality_status", "fail").gte("created_at", since),
  ]);
  if ((reports ?? 0) >= 5 && (reports ?? 0) / Math.max(1, delivered ?? 1) > 0.35) {
    auto = false;
    evidence.abuseHold = true;
  }

  const { data: req, error } = await db.from("refund_requests").insert({
    organization_id: ctx.orgId, generated_asset_id: id, reason: input.reason, details: input.details ?? null, evidence,
    status: auto ? "auto_approved" : "open", resolution: auto ? note : null, created_by: ctx.userId,
    decided_at: auto ? new Date().toISOString() : null,
  }).select("id").single();
  if (error) throw error;
  if (auto) await restoreCredit(req.id, asset.item_id, null);
  await db.from("generated_assets").update({ approval_status: "rejected" }).eq("id", id);
  await track("issue_reported", ctx, { reason: input.reason, auto });
  return { requestId: req.id, status: auto ? "auto_approved" : "open", note };
}

export async function restoreCredit(requestId: string, itemId: string, actorId: string | null) {
  const db = admin();
  const { data: ok } = await db.rpc("refund_item_credit", { p_item: itemId, p_refund_request: requestId, p_actor: actorId });
  await db.from("refund_requests").update({ credits_restored: ok ? 1 : 0 }).eq("id", requestId);
  return !!ok;
}

export async function decideRefund(actor: AuthContext, requestId: string, approve: boolean, resolution: string) {
  const db = admin();
  const { data: r } = await db.from("refund_requests").select("id, status, generated_asset_id, organization_id, generated_assets(item_id)").eq("id", requestId).single();
  if (!r) throw new ApiError(404, "Request not found");
  if (r.status !== "open") throw new ApiError(400, "Already decided");
  await db.from("refund_requests").update({ status: approve ? "approved" : "rejected", resolution, decided_by: actor.userId, decided_at: new Date().toISOString() }).eq("id", requestId);
  if (approve) await restoreCredit(requestId, (r as unknown as { generated_assets: { item_id: string } }).generated_assets.item_id, actor.userId);
  await audit(actor, approve ? "refund.approve" : "refund.reject", { type: "refund_request", id: requestId }, { org: r.organization_id, resolution });
}

export async function downloadAsset(ctx: AuthContext, id: string, format: DownloadFormat, size: "full" | "web") {
  const asset = await loadAsset(ctx, id);
  const raw = await getObject("outputs", asset.storage_key);
  const out = await encodeFor(raw, format, size === "web" ? 1600 : undefined);
  await track("image_downloaded", ctx, { format, size });
  const name = `${slug(asset.products.name)}-${id.slice(0, 6)}.${format}`;
  return { ...out, name };
}

export async function exportZip(ctx: AuthContext, assetIds: string[], format: DownloadFormat) {
  if (assetIds.length === 0 || assetIds.length > 100) throw new ApiError(400, "Choose between 1 and 100 images");
  const { data } = await admin().from("generated_assets").select("id, storage_key, products(name), generation_jobs!generated_assets_job_id_fkey(output, style)").in("id", assetIds).eq("organization_id", ctx.orgId).neq("quality_status", "fail");
  const zip = new JSZip();
  for (const a of data ?? []) {
    const row = a as unknown as { id: string; storage_key: string; products: { name: string }; generation_jobs: { output: string; style: string } };
    const enc = await encodeFor(await getObject("outputs", row.storage_key), format);
    const ratio = OUTPUTS[row.generation_jobs.output as keyof typeof OUTPUTS]?.ratio.replace(":", "x") ?? "";
    zip.file(`${slug(row.products.name)}/${slug(row.products.name)}-${row.generation_jobs.style}-${ratio}-${row.id.slice(0, 6)}.${format}`, enc.data);
  }
  await track("zip_exported", ctx, { count: data?.length ?? 0 });
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

export async function pushToShopify(ctx: AuthContext, id: string) {
  assertRole(ctx, "editor");
  if (!ctx.shop) throw new ApiError(400, "Open this from the Shopify app to add images to your store");
  const asset = await loadAsset(ctx, id);
  if (!asset.products.shopify_product_id) throw new ApiError(400, "This product isn't linked to a Shopify product");
  if (asset.watermarked) throw new ApiError(400, "This older image contains a watermark. Use a clean replacement for your store.");
  if (asset.pushed_to_shopify_at) return { mediaId: asset.shopify_media_id, already: true };
  const url = await signedUrl("outputs", asset.storage_key, 3600);
  const mediaId = await addProductImage(ctx.shop, asset.products.shopify_product_id, url, `${asset.products.name} product photo`);
  await admin().from("generated_assets").update({ shopify_media_id: mediaId, pushed_to_shopify_at: new Date().toISOString(), approval_status: "approved" }).eq("id", id);
  await track("shopify_image_pushed", ctx, {});
  return { mediaId, already: false };
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";
}
