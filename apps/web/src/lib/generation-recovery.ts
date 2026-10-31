import "server-only";
import sharp from "sharp";
import { aggregate, categoryLook, styleForLook, type CategoryLook, type ProductAnalysis, type ShotDirection, type ShootStyleId } from "@packshot/core";
import { admin } from "./supabase";
import { getObject, putObject } from "./storage";
import { getSettings } from "./settings";
import { thumbnail } from "./images";
import { reviewGeneratedImage } from "./generation-review";

/** Recheck stored pixels: no image generation, no wallet mutation. Caller must authorize the org or platform access. */
export async function recheckSavedItem(itemId: string, orgId?: string) {
  const db = admin();
  let query = db.from("generation_items").select("id,job_id,organization_id,status,params").eq("id", itemId);
  if (orgId) query = query.eq("organization_id", orgId);
  const { data: item, error } = await query.single();
  if (error || !item) throw new Error("Photo not found");
  const [{ data: job }, { data: asset }] = await Promise.all([
    db.from("generation_jobs").select("product_id,settings").eq("id", item.job_id).single(),
    db.from("generated_assets").select("id,storage_key,quality_status,watermarked").eq("item_id", item.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!asset || !job || asset.watermarked) return null;
  const [{ data: product }, { data: refs }, settings] = await Promise.all([
    db.from("products").select("attributes").eq("id", job.product_id).single(),
    db.from("product_assets").select("storage_key,view_type").eq("product_id", job.product_id).order("created_at"),
    getSettings(),
  ]);
  if (!refs?.length) throw new Error("Product references unavailable");
  const params = item.params as { lookId?: string; brief?: string; shot?: ShotDirection } | null;
  const saved = job.settings as { recipe?: CategoryLook; shootStyle?: ShootStyleId; subjectCount?: number } | null;
  const base = params?.lookId ? categoryLook(params.lookId) : saved?.recipe;
  const recipe = base ? { ...base, brief: params?.brief ?? base.brief } : undefined;
  const image = await getObject("outputs", asset.storage_key);
  const originals = await Promise.all([...refs].sort((a,b) => Number(b.view_type === "front") - Number(a.view_type === "front")).slice(0, 6).map(r => getObject("originals", r.storage_key)));
  const review = await reviewGeneratedImage({ refs: originals, image, models: settings.providers.llm.models, context: { recipe, shot: params?.shot, selectedStyle: recipe ? styleForLook(recipe) : saved?.shootStyle, analysis: (product?.attributes as { analysis?: ProductAnalysis })?.analysis, confirmedSubjectCount: saved?.subjectCount } });
  return { item, asset, image, ...review, decision: aggregate(review.checks) };
}

/** A previously rejected image that now passes can be restored, free, without asking the image provider to repeat it. */
export async function tryRecoverFailedItem(itemId: string, orgId: string) {
  const result = await recheckSavedItem(itemId, orgId);
  if (!result || result.decision !== "pass" || result.item.status !== "failed") return null;
  const db = admin();
  const { width, height } = await sharp(result.image).metadata();
  const key = result.asset.storage_key.replace(/\.png$/, "-rechecked-thumb.webp");
  await putObject("outputs", key, await thumbnail(result.image), "image/webp");
  // Claim the still-failed item before changing the asset. Parallel retry calls cannot charge or duplicate delivery.
  const { data: claimed, error } = await db.from("generation_items").update({ status: "checking", locked_by: "saved-image-recovery", locked_until: new Date(Date.now() + 180_000).toISOString() }).eq("id", itemId).eq("status", "failed").is("delivered_asset_id", null).select("id").maybeSingle();
  if (error) throw error;
  if (!claimed) return null;
  try {
    const { error: aErr } = await db.from("generated_assets").update({ quality_status: "pass", approval_status: "pending", thumb_key: key, width, height, watermarked: false, delivered_at: new Date().toISOString() }).eq("id", result.asset.id);
    if (aErr) throw aErr;
    const { error: cErr } = await db.from("quality_checks").insert(result.checks.map(c => ({ generated_asset_id: result.asset.id, check_type: c.type, score: c.score, decision: c.decision, details: { ...c.details, recoveredWithoutGeneration: true } })));
    if (cErr) throw cErr;
    const { error: iErr } = await db.from("generation_items").update({ status: "delivered", decision: "pass", delivered_asset_id: result.asset.id, last_error: null, locked_by: null, locked_until: null, updated_at: new Date().toISOString() }).eq("id", itemId);
    if (iErr) throw iErr;
  } catch (e) {
    await db.from("generation_items").update({ status: "failed", locked_by: null, locked_until: null }).eq("id", itemId).eq("status", "checking");
    await db.from("generated_assets").update({ quality_status: "fail", approval_status: "rejected" }).eq("id", result.asset.id);
    throw e;
  }
  return { jobId: result.item.job_id, recovered: true, duplicate: false };
}
