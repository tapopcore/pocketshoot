import "server-only";
import { z } from "zod";
import { after } from "next/server";
import { CATEGORIES, LOCKS, OUTPUTS, STYLES, isFreeRemake, isCategoryId, type LockId } from "@packshot/core";
import { admin } from "./supabase";
import { getFlag, getSettings } from "./settings";
import { isTrialOrg } from "./credits";
import { ApiError } from "./api";
import { assertRole, type AuthContext } from "./auth";
import { audit, rateLimit, track } from "./observe";
import { env } from "./env";

export const createJobSchema = z.object({
  productId: z.string().uuid(),
  projectId: z.string().uuid().nullish(),
  batchId: z.string().uuid().nullish(),
  mode: z.enum(["preserve", "creative"]).default("preserve"),
  style: z.string().refine((s) => s in STYLES, "Unknown style"),
  output: z.string().refine((s) => s in OUTPUTS, "Unknown output size"),
  count: z.number().int().min(1).max(20),
  customBrief: z.string().max(600).nullish(),
  brandKitId: z.string().uuid().nullish(),
  idempotencyKey: z.string().min(8).max(100),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const productSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().refine(isCategoryId, "Unknown category"),
  sku: z.string().trim().max(80).nullish(),
  locks: z.array(z.string().refine((l) => l in LOCKS)).max(10).default([]),
  mustNotChange: z.string().trim().max(400).nullish(),
});

export async function createJob(ctx: AuthContext, input: CreateJobInput, opts: { source?: AuthContext["via"] | "api"; parentAssetId?: string; freeRemake?: boolean } = {}) {
  assertRole(ctx, "editor");
  const db = admin();
  const settings = await getSettings();
  const policy = settings.credit_policy;

  if (!input.batchId && !(await rateLimit(`gen:${ctx.orgId}`, 60, 3600))) throw new ApiError(429, "You've started a lot of shoots this hour. Please wait a few minutes.");
  if (input.count > policy.maxImagesPerJob) throw new ApiError(400, `Up to ${policy.maxImagesPerJob} images per shoot`);
  if (input.mode === "creative" && !(await getFlag("creative_mode", ctx.orgId))) throw new ApiError(400, "Creative mode is turned off right now");

  // Same idempotency key: return the existing job instead of charging again.
  const { data: existing } = await db.from("generation_jobs").select("id,status").eq("organization_id", ctx.orgId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing) return { jobId: existing.id, duplicate: true };

  const { data: product } = await db.from("products").select("id, name, category, locks, must_not_change, archived_at").eq("id", input.productId).eq("organization_id", ctx.orgId).maybeSingle();
  if (!product || product.archived_at) throw new ApiError(404, "Product not found");
  const { count: assetCount } = await db.from("product_assets").select("id", { count: "exact", head: true }).eq("product_id", product.id);
  if (!assetCount) throw new ApiError(400, "Add at least one photo of the product first");

  let palette: string[] = [];
  if (input.brandKitId) {
    const { data: kit } = await db.from("brand_kits").select("palette").eq("id", input.brandKitId).eq("organization_id", ctx.orgId).maybeSingle();
    palette = kit?.palette ?? [];
  }

  const isTrial = policy.trialWatermark && (await isTrialOrg(ctx.orgId));
  const { data: job, error } = await db
    .from("generation_jobs")
    .insert({
      organization_id: ctx.orgId,
      project_id: input.projectId ?? null,
      batch_id: input.batchId ?? null,
      product_id: product.id,
      created_by: ctx.userId,
      source: opts.source ?? ctx.via,
      mode: input.mode,
      style: input.style,
      output: input.output,
      requested_count: input.count,
      custom_brief: input.customBrief ?? null,
      settings: { palette, brandKitId: input.brandKitId ?? null, category: product.category },
      idempotency_key: input.idempotencyKey,
      is_trial: isTrial,
      parent_asset_id: opts.parentAssetId ?? null,
      is_free_remake: !!opts.freeRemake,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: dup } = await db.from("generation_jobs").select("id").eq("organization_id", ctx.orgId).eq("idempotency_key", input.idempotencyKey).single();
      return { jobId: dup!.id, duplicate: true };
    }
    throw error;
  }

  await db.from("generation_items").insert(Array.from({ length: input.count }, (_, idx) => ({ job_id: job.id, organization_id: ctx.orgId, idx })));

  if (!opts.freeRemake) {
    const { data: ok, error: rErr } = await db.rpc("reserve_credits", { p_job: job.id, p_quantity: input.count * policy.creditsPerImage });
    if (rErr || !ok) {
      await db.from("generation_jobs").delete().eq("id", job.id);
      await track("credits_exhausted", ctx, { requested: input.count });
      throw new ApiError(402, "Not enough credits for this shoot. Buy a pack or reduce the number of images.", "insufficient_credits");
    }
  }

  await track("generation_submitted", ctx, { mode: input.mode, style: input.style, output: input.output, count: input.count, category: product.category, source: opts.source ?? ctx.via, remake: !!opts.parentAssetId });
  kickWorker();
  return { jobId: job.id, duplicate: false };
}

/** Starts processing right away instead of waiting for the next cron tick. */
export function kickWorker() {
  if (!env.cronSecret) return;
  after(async () => {
    try {
      await fetch(`${env.appUrl}/api/worker/tick`, { method: "POST", headers: { authorization: `Bearer ${env.cronSecret}` }, signal: AbortSignal.timeout(5000) });
    } catch {
      // The scheduled tick will pick it up.
    }
  });
}

export async function remakeAsset(ctx: AuthContext, assetId: string, idempotencyKey: string) {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: asset } = await db
    .from("generated_assets")
    .select("id, product_id, remakes_used, delivered_at, job_id, generation_jobs(mode, style, output, custom_brief, project_id, settings)")
    .eq("id", assetId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!asset) throw new ApiError(404, "Image not found");
  const job = (asset as unknown as { generation_jobs: { mode: "preserve" | "creative"; style: string; output: string; custom_brief: string | null; project_id: string | null; settings: { brandKitId?: string } } }).generation_jobs;
  const policy = (await getSettings()).credit_policy;
  const free = isFreeRemake(asset.remakes_used, asset.delivered_at, policy);
  const res = await createJob(
    ctx,
    { productId: asset.product_id, projectId: job.project_id, mode: job.mode, style: job.style, output: job.output, count: 1, customBrief: job.custom_brief, brandKitId: job.settings?.brandKitId ?? null, idempotencyKey },
    { parentAssetId: asset.id, freeRemake: free },
  );
  if (!res.duplicate) await db.from("generated_assets").update({ remakes_used: asset.remakes_used + 1 }).eq("id", asset.id);
  return { ...res, free };
}

export async function cancelJob(ctx: AuthContext, jobId: string) {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: job } = await db.from("generation_jobs").select("id").eq("id", jobId).eq("organization_id", ctx.orgId).maybeSingle();
  if (!job) throw new ApiError(404, "Shoot not found");
  // Only items that haven't started can be cancelled; started ones finish and are charged only if delivered.
  const { data: items } = await db.from("generation_items").update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("job_id", jobId).eq("status", "queued").is("locked_by", null).select("id");
  for (const i of items ?? []) await db.rpc("settle_item", { p_item: i.id, p_capture: false });
  await refreshJobStatus(jobId);
  await audit(ctx, "job.cancel", { type: "job", id: jobId }, { cancelled: items?.length ?? 0 });
  return { cancelled: items?.length ?? 0 };
}

export async function refreshJobStatus(jobId: string) {
  const { rollupJobStatus } = await import("@packshot/core");
  const db = admin();
  const { data: items } = await db.from("generation_items").select("status, decision").eq("job_id", jobId);
  const status = rollupJobStatus((items ?? []) as never);
  const done = ["completed", "review_needed", "failed", "cancelled"].includes(status);
  await db.from("generation_jobs").update({ status, updated_at: new Date().toISOString(), ...(done ? { completed_at: new Date().toISOString() } : {}) }).eq("id", jobId);
  return status;
}

/** Everything the results screen needs for one job. */
export async function jobView(orgId: string, jobId: string) {
  const db = admin();
  const { data: job } = await db
    .from("generation_jobs")
    .select("*, products(id, name, category, sku)")
    .eq("id", jobId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!job) return null;
  const [{ data: items }, { data: assets }, { data: refs }] = await Promise.all([
    db.from("generation_items").select("id, idx, status, attempts, last_error, decision, delivered_asset_id, settled").eq("job_id", jobId).order("idx"),
    db.from("generated_assets").select("id, item_id, storage_key, thumb_key, width, height, quality_status, approval_status, watermarked, remakes_used, delivered_at, pushed_to_shopify_at, quality_checks(check_type, score, decision, details), refund_requests(status)").eq("job_id", jobId).neq("quality_status", "fail"),
    db.from("product_assets").select("id, storage_key, view_type").eq("product_id", job.product_id).order("created_at"),
  ]);
  return { job, items: items ?? [], assets: assets ?? [], refs: refs ?? [] };
}

export function describeLocks(locks: string[]): string[] {
  return locks.filter((l): l is LockId => l in LOCKS).map((l) => LOCKS[l].label);
}

export function categoryLabel(id: string) {
  return isCategoryId(id) ? CATEGORIES[id].label : id;
}
