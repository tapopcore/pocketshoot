import "server-only";
import { z } from "zod";
import { after } from "next/server";
import { CATEGORIES, LOCKS, OUTPUTS, STYLES, SHOOT_STYLE_IDS, shootRecipe, isFreeRemake, isCategoryId, COLLECTION_IDS, RECIPE_VERSION, categoryLook, collectionById, lookEligibility, type ShootProfile, type LockId, type ShootStyleId } from "@packshot/core";
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
  /** Several scenes in one shoot: images cycle through them. */
  styles: z.array(z.string().refine((s) => s in STYLES, "Unknown style")).min(1).max(8).nullish(),
  /** AI campaign ideas picked in the studio: each becomes its own shot. */
  ideas: z.array(z.object({ title: z.string().max(60), description: z.string().max(300), human_presence: z.enum(["none", "hands", "model"]).default("none"), base_scene: z.string().refine((s) => s in STYLES) })).max(4).nullish(),
  shootStyle: z.enum(SHOOT_STYLE_IDS).nullish(),
  recipeId: z.string().max(80).nullish(),
  recipeVersion: z.string().max(80).nullish(),
  quotedCredits: z.number().int().positive().nullish(),
  output: z.string().refine((s) => s in OUTPUTS, "Unknown output size"),
  count: z.number().int().min(1).max(20),
  customBrief: z.string().max(600).nullish(),
  /** Written shoot ideas the customer ticked, applied to every photo in the shoot. */
  suggestions: z.array(z.string().trim().min(3).max(180)).max(4).nullish(),
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
  shootProfile: z.object({ type: z.enum(COLLECTION_IDS), construction: z.enum(["stitched", "unstitched", "semi_stitched", "not_applicable", "unknown"]), referenceForm: z.enum(["worn", "flat", "object", "unknown"]), contentsConfirmed: z.boolean().optional() }).optional(),
});

export interface JobOptions {
  source?: AuthContext["via"] | "api";
  parentAssetId?: string;
  freeRemake?: boolean;
  /** Edit an existing image with a text instruction. */
  edit?: { assetId: string; instruction: string };
  /** A fresh attempt at a photo that failed in another shoot. */
  retryOf?: { jobId: string; itemId: string };
  /** Platform-internal jobs (scene previews): no credits, no watermark, no limits. */
  internal?: boolean;
}

export async function createJob(ctx: AuthContext, input: CreateJobInput, opts: JobOptions = {}) {
  assertRole(ctx, "editor");
  const db = admin();
  const settings = await getSettings();
  const policy = settings.credit_policy;

  if (!opts.internal && !input.batchId && !(await rateLimit(`gen:${ctx.orgId}`, 60, 3600))) throw new ApiError(429, "You've started a lot of shoots this hour. Please wait a few minutes.");
  if (!opts.internal && input.count > policy.maxImagesPerJob) throw new ApiError(400, `Up to ${policy.maxImagesPerJob} images per shoot`);
  if (input.mode === "creative" && !(await getFlag("creative_mode", ctx.orgId))) throw new ApiError(400, "Creative mode is turned off right now");

  // Same idempotency key: return the existing job instead of charging again.
  const { data: existing } = await db.from("generation_jobs").select("id,status").eq("organization_id", ctx.orgId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing) return { jobId: existing.id, duplicate: true };

  const { data: product } = await db.from("products").select("id, name, category, locks, must_not_change, archived_at, attributes").eq("id", input.productId).eq("organization_id", ctx.orgId).maybeSingle();
  if (!product || product.archived_at) throw new ApiError(404, "Product not found");
  const { count: assetCount } = await db.from("product_assets").select("id", { count: "exact", head: true }).eq("product_id", product.id);
  if (!assetCount) throw new ApiError(400, "Add at least one photo of the product first");

  const recipe = input.recipeId ? categoryLook(input.recipeId) : null;
  if (input.recipeId) {
    if (!recipe || input.recipeVersion !== RECIPE_VERSION) throw new ApiError(409, "The shoot collection has changed. Please choose your look again.", "recipe_changed");
    const profile = (product.attributes as { shootProfile?: ShootProfile } | null)?.shootProfile;
    if (!profile || collectionById(profile.type)?.category !== product.category) throw new ApiError(400, "Confirm the product type before choosing a look.");
    const { data: views } = await db.from("product_assets").select("view_type").eq("product_id", product.id);
    const issue = lookEligibility(recipe, profile, views ?? []);
    if (issue) throw new ApiError(400, issue, "reference_required");
    if (input.quotedCredits !== input.count * policy.creditsPerImage) throw new ApiError(409, "The price changed. Review the new total before creating.", "quote_changed");
  }

  const chosenLook = recipe ? { ...recipe, brief: recipe.brief + " Product details that must not change: " + collectionById(recipe.collection)!.preserve } : input.shootStyle ? shootRecipe(input.shootStyle, isCategoryId(product.category) ? product.category : "other") : null;
  let palette: string[] = [];
  let brand: { moods: string[]; rules: string | null } | null = null;
  if (input.brandKitId) {
    const { data: kit } = await db.from("brand_kits").select("palette, moods, style_rules").eq("id", input.brandKitId).eq("organization_id", ctx.orgId).maybeSingle();
    palette = kit?.palette ?? [];
    if (kit && ((kit.moods ?? []).length || kit.style_rules)) brand = { moods: kit.moods ?? [], rules: kit.style_rules ?? null };
  }

  const isTrial = !opts.internal && (await isTrialOrg(ctx.orgId));
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
      style: chosenLook?.scene ?? input.styles?.[0] ?? input.style,
      output: input.output,
      requested_count: input.count,
      custom_brief: input.customBrief ?? null,
      settings: { palette, ...(brand ? { brand } : {}), shootStyle: input.shootStyle ?? null, recipeId: recipe?.id ?? null, recipeVersion: recipe ? RECIPE_VERSION : null, recipe: recipe ? chosenLook : null, creditsPerImage: policy.creditsPerImage, brandKitId: input.brandKitId ?? null, category: product.category, styles: chosenLook ? [chosenLook.scene] : input.styles ?? [input.style], suggestions: input.suggestions ?? [], ...(opts.retryOf ? { retryOf: opts.retryOf } : {}), ...(opts.edit ? { edit: opts.edit } : {}) },
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

  // Each image gets a slot: a scene, or an AI idea (scene + brief). Images cycle through the slots.
  const slots: { style: string; params: Record<string, string> }[] = chosenLook ? [{ style: chosenLook.scene, params: { brief: chosenLook.brief, ideaTitle: chosenLook.title, humanPresence: chosenLook.human, framing: chosenLook.framing } }] : [
    ...(input.styles?.length ? input.styles : input.ideas?.length ? [] : [input.style]).map((s) => ({ style: s, params: {} })),
    ...(input.ideas ?? []).map((i) => ({ style: i.base_scene, params: { brief: i.description, ideaTitle: i.title, humanPresence: i.human_presence } })),
  ];
  await db.from("generation_items").insert(Array.from({ length: input.count }, (_, idx) => {
    const slot = slots[idx % slots.length];
    return { job_id: job.id, organization_id: ctx.orgId, idx, style: slot.style, params: slot.params, ...(recipe ? { max_attempts: 1 } : {}) };
  }));

  if (!opts.freeRemake && !opts.internal) {
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
    .select("id, product_id, remakes_used, delivered_at, job_id, generation_items!generated_assets_item_id_fkey(style), generation_jobs!generated_assets_job_id_fkey(mode, style, output, custom_brief, project_id, settings)")
    .eq("id", assetId)
    .eq("organization_id", ctx.orgId)
    .maybeSingle();
  if (!asset) throw new ApiError(404, "Image not found");
  const job = (asset as unknown as { generation_jobs: ParentJob }).generation_jobs;
  const itemStyle = (asset as unknown as { generation_items: { style: string | null } | null }).generation_items?.style ?? job.style;
  const policy = (await getSettings()).credit_policy;
  const free = isFreeRemake(asset.remakes_used, asset.delivered_at, policy);
  const res = await createJob(
    ctx,
    { productId: asset.product_id, projectId: job.project_id, mode: job.mode, style: itemStyle, output: job.output, count: 1, customBrief: job.custom_brief, brandKitId: job.settings?.brandKitId ?? null, shootStyle: job.settings?.shootStyle ?? null, ...(await inheritedRecipe(job)), idempotencyKey },
    { parentAssetId: asset.id, freeRemake: free },
  );
  if (!res.duplicate) await db.from("generated_assets").update({ remakes_used: asset.remakes_used + 1 }).eq("id", asset.id);
  return { ...res, free };
}

/**
 * Tries a failed photo again as a new one-photo shoot with the same look, ideas and product.
 * Failed photos were never charged, and the retry is charged only if it is delivered.
 */
export async function retryItem(ctx: AuthContext, jobId: string, itemId: string, idempotencyKey: string) {
  assertRole(ctx, "editor");
  const db = admin();
  const { data: item } = await db.from("generation_items")
    .select("id, status, style, params, job_id, generation_jobs!inner(id, product_id, mode, style, output, custom_brief, project_id, parent_asset_id, settings)")
    .eq("id", itemId).eq("job_id", jobId).eq("organization_id", ctx.orgId).maybeSingle();
  if (!item) throw new ApiError(404, "Photo not found");
  const params = (item.params ?? {}) as { brief?: string; ideaTitle?: string; humanPresence?: "none" | "hands" | "model"; retryJobId?: string };
  if (params.retryJobId) return { jobId: params.retryJobId, duplicate: true };
  if (item.status !== "failed") throw new ApiError(400, "Only photos that failed can be tried again.");
  const job = (item as unknown as { generation_jobs: ParentJob & { product_id: string; parent_asset_id: string | null; settings: ParentJob["settings"] & { suggestions?: string[]; edit?: { assetId: string; instruction: string } } } }).generation_jobs;
  const idea = !job.settings?.recipeId && params.brief && params.ideaTitle && item.style && item.style in STYLES
    ? { ideas: [{ title: params.ideaTitle.slice(0, 60), description: params.brief.slice(0, 300), human_presence: params.humanPresence ?? "none", base_scene: item.style }] } : {};
  const res = await createJob(
    ctx,
    { productId: job.product_id, projectId: job.project_id, mode: job.mode, style: item.style && item.style in STYLES ? item.style : job.style, output: job.output, count: 1, customBrief: job.custom_brief, brandKitId: job.settings?.brandKitId ?? null, shootStyle: job.settings?.shootStyle ?? null, suggestions: job.settings?.suggestions ?? null, ...idea, ...(await inheritedRecipe(job)), idempotencyKey },
    { retryOf: { jobId, itemId }, parentAssetId: job.parent_asset_id ?? undefined, edit: job.settings?.edit },
  );
  await db.from("generation_items").update({ params: { ...params, retryJobId: res.jobId } }).eq("id", itemId);
  await audit(ctx, "job.retry_item", { type: "job", id: jobId }, { item: itemId, retryJob: res.jobId });
  return res;
}

interface ParentJob { mode: "preserve" | "creative"; style: string; output: string; custom_brief: string | null; project_id: string | null; settings: { brandKitId?: string; shootStyle?: ShootStyleId; recipeId?:string; recipeVersion?:string } }
async function inheritedRecipe(job: ParentJob) {
  return job.settings?.recipeId ? { recipeId:job.settings.recipeId, recipeVersion:job.settings.recipeVersion, quotedCredits:(await getSettings()).credit_policy.creditsPerImage } : {};
}

async function parentOf(ctx: AuthContext, assetId: string) {
  const { data: asset } = await admin()
    .from("generated_assets")
    .select("id, product_id, job_id, watermarked, generation_items!generated_assets_item_id_fkey(style), generation_jobs!generated_assets_job_id_fkey(mode, style, output, custom_brief, project_id, settings)")
    .eq("id", assetId).eq("organization_id", ctx.orgId).neq("quality_status", "fail").maybeSingle();
  if (!asset) throw new ApiError(404, "Image not found");
  const job = (asset as unknown as { generation_jobs: ParentJob }).generation_jobs;
  const style = (asset as unknown as { generation_items: { style: string | null } | null }).generation_items?.style ?? job.style;
  return { asset, job, style };
}

/** Changes a finished image with a plain-language instruction, keeping the product exact. 1 credit. */
export async function editAsset(ctx: AuthContext, assetId: string, instruction: string, idempotencyKey: string) {
  const { asset, job, style } = await parentOf(ctx, assetId);
  if (asset.watermarked) throw new ApiError(400, "This older image contains a watermark. Start a new shoot from your original product photo to get a clean image. No credit was used.");
  const text = instruction.trim();
  if (text.length < 3) throw new ApiError(400, "Describe the change you want");
  return createJob(
    ctx,
    { productId: asset.product_id, projectId: job.project_id, mode: job.mode, style, output: job.output, count: 1, customBrief: text.slice(0, 500), brandKitId: job.settings?.brandKitId ?? null, shootStyle: job.settings?.shootStyle ?? null, ...(await inheritedRecipe(job)), idempotencyKey },
    { parentAssetId: asset.id, edit: { assetId: asset.id, instruction: text.slice(0, 500) } },
  );
}

/** Same scene in another format (for example square to story). 1 credit. */
export async function resizeAsset(ctx: AuthContext, assetId: string, output: string, idempotencyKey: string) {
  const { asset, job, style } = await parentOf(ctx, assetId);
  if (!(output in OUTPUTS)) throw new ApiError(400, "Unknown size");
  return createJob(
    ctx,
    { productId: asset.product_id, projectId: job.project_id, mode: job.mode, style, output, count: 1, customBrief: job.custom_brief, brandKitId: job.settings?.brandKitId ?? null, shootStyle: job.settings?.shootStyle ?? null, ...(await inheritedRecipe(job)), idempotencyKey },
    { parentAssetId: asset.id },
  );
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

type ItemRow = { id: string; job_id: string; idx: number; status: string; attempts: number; last_error: string | null; decision: string | null; delivered_asset_id: string | null; settled: string | null; style: string | null; updated_at: string; params: Record<string, unknown> | null };
const ITEM_COLS = "id, job_id, idx, status, attempts, last_error, decision, delivered_asset_id, settled, style, updated_at, params";
const ASSET_COLS = "id, item_id, job_id, storage_key, thumb_key, width, height, quality_status, approval_status, watermarked, remakes_used, delivered_at, pushed_to_shopify_at, quality_checks(check_type, score, decision, details), refund_requests(status)";

/** Everything the results screen needs for one job. A failed photo that was tried again shows its latest attempt in its place. */
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
    db.from("generation_items").select(ITEM_COLS).eq("job_id", jobId).order("idx"),
    db.from("generated_assets").select(ASSET_COLS).eq("job_id", jobId).neq("quality_status", "fail"),
    db.from("product_assets").select("id, storage_key, view_type").eq("product_id", job.product_id).order("created_at"),
  ]);
  const allAssets = [...(assets ?? [])];
  let shown = ((items ?? []) as ItemRow[]).map((i) => ({ ...i, retryOf: null as string | null, tries: 1 }));
  // Follow retry chains a few levels deep: original failed photo -> retry -> retry of the retry.
  for (let depth = 0; depth < 4; depth++) {
    const pending = shown.filter((i) => i.status === "failed" && typeof i.params?.retryJobId === "string");
    if (!pending.length) break;
    const ids = pending.map((i) => i.params!.retryJobId as string);
    const [{ data: next }, { data: nextAssets }] = await Promise.all([
      db.from("generation_items").select(ITEM_COLS).in("job_id", ids).eq("organization_id", orgId),
      db.from("generated_assets").select(ASSET_COLS).in("job_id", ids).eq("organization_id", orgId).neq("quality_status", "fail"),
    ]);
    allAssets.push(...(nextAssets ?? []));
    const byJob = new Map(((next ?? []) as ItemRow[]).map((n) => [n.job_id, n]));
    shown = shown.map((i) => {
      const child = i.status === "failed" && typeof i.params?.retryJobId === "string" ? byJob.get(i.params.retryJobId as string) : undefined;
      return child ? { ...child, idx: i.idx, params: { ...(i.params ?? {}), ...(child.params ?? {}), retryJobId: child.params?.retryJobId }, retryOf: i.retryOf ?? i.id, tries: i.tries + 1 } : i;
    });
  }
  return { job, items: shown, assets: allAssets, refs: refs ?? [] };
}

export function describeLocks(locks: string[]): string[] {
  return locks.filter((l): l is LockId => l in LOCKS).map((l) => LOCKS[l].label);
}

export function categoryLabel(id: string) {
  return isCategoryId(id) ? CATEGORIES[id].label : id;
}
