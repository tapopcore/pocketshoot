import "server-only";
import {
  FIDELITY_JUDGE_PROMPT, OUTPUTS, STYLES, TRIAL_MAX_EDGE, aggregate, alignmentDecision, backoffMs, buildEditPrompt, buildPrompt,
  judgeDecision, parseJudgeJson, isCategoryId, type CheckResult, type Decision, type LockId, type OutputId, type ProductAnalysis,
  type ShotDirection, type StyleId,
} from "@packshot/core";
import sharp from "sharp";
import { admin } from "./supabase";
import { getSettings } from "./settings";
import { getObject, putObject } from "./storage";
import { dimensions, isBlank, thumbnail, watermark, type Cutout } from "./images";
import { finishComposite, layoutProduct, renderCanvas, type Place } from "./compose";
import { analyzeProduct, directShots, getCutout } from "./prep";
import { jsonCall } from "./llm";
import { customSize } from "./providers/openai";
import { getProvider, isConfigured, modelFor, providerChain, ProviderError, type ProviderId } from "./providers";
import { refreshJobStatus } from "./jobs";
import { logError, track } from "./observe";
import { integrations, env } from "./env";
import { notifyJobDone } from "./email";

interface ItemRow {
  id: string;
  job_id: string;
  organization_id: string;
  idx: number;
  attempts: number;
  max_attempts: number;
}

interface JobRow {
  id: string;
  organization_id: string;
  product_id: string;
  mode: "preserve" | "creative";
  style: StyleId;
  output: OutputId;
  custom_brief: string | null;
  settings: { palette?: string[]; category?: string; styles?: string[]; edit?: { assetId: string; instruction: string } };
  is_trial: boolean;
  status: string;
  created_by: string | null;
  parent_asset_id: string | null;
}

interface ItemParams {
  /** A campaign idea chosen in the studio (its description acts as the brief). */
  brief?: string;
  ideaTitle?: string;
  shot?: ShotDirection;
  shotSource?: "ai" | "rules";
  place?: Place;
  cutoutAssetId?: string;
}

async function usdToInr(): Promise<{ rate: number; date: string }> {
  const { data } = await admin().from("fx_rates").select("rate, rate_date").eq("base", "USD").eq("quote", "INR").order("rate_date", { ascending: false }).limit(1).maybeSingle();
  if (data) return { rate: Number(data.rate), date: data.rate_date };
  const s = await getSettings();
  return { rate: s.fx_fallback.USDINR, date: new Date().toISOString().slice(0, 10) };
}

async function setItem(id: string, patch: Record<string, unknown>) {
  await admin().from("generation_items").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

/** Writes shot briefs for every image of the job that doesn't have one yet (one AI call per scene). */
async function ensureShots(job: JobRow, analysis: ProductAnalysis | null, productName: string): Promise<void> {
  const db = admin();
  const { data: items } = await db.from("generation_items").select("id, idx, style, params").eq("job_id", job.id).order("idx");
  const missing = (items ?? []).filter((i) => !(i.params as ItemParams)?.shot);
  if (!missing.length) return;
  const output = OUTPUTS[job.output];
  const byStyle = new Map<string, typeof missing>();
  for (const it of missing) {
    const sid = output.forceStyle ?? (it.style && it.style in STYLES ? it.style : job.style);
    const key = `${sid}|${(it.params as ItemParams)?.brief ?? ""}`;
    byStyle.set(key, [...(byStyle.get(key) ?? []), it]);
  }
  // Previous shots of this product, so new ones don't repeat them.
  const { data: prev } = await db.from("generation_items").select("params, generation_jobs!inner(product_id)").eq("generation_jobs.product_id", job.product_id).neq("job_id", job.id).order("created_at", { ascending: false }).limit(6);
  const avoid = (prev ?? []).map((p) => (p.params as ItemParams)?.shot?.scene).filter(Boolean) as string[];
  await Promise.all([...byStyle.entries()].map(async ([key, list]) => {
    const [sid, ideaBrief] = key.split("|");
    const { shots, source } = await directShots({
      style: STYLES[sid as StyleId], output, count: list.length, analysis, productName, orgId: job.organization_id,
      brief: [ideaBrief, job.custom_brief].filter(Boolean).join(". ") || undefined, palette: job.settings?.palette, avoid,
    });
    await Promise.all(list.map((it, k) => db.from("generation_items").update({ params: { ...((it.params as object) ?? {}), shot: shots[k], shotSource: source } }).eq("id", it.id)));
  }));
}

export async function processItem(item: ItemRow): Promise<void> {
  const db = admin();
  const settings = await getSettings();
  const { data: job } = await db.from("generation_jobs").select("*").eq("id", item.job_id).single<JobRow>();
  if (!job || job.status === "cancelled") {
    await setItem(item.id, { status: "cancelled", locked_by: null });
    await db.rpc("settle_item", { p_item: item.id, p_capture: false });
    return;
  }
  const { data: product } = await db.from("products").select("id, name, category, locks, must_not_change, attributes").eq("id", job.product_id).single();
  const { data: refs } = await db.from("product_assets").select("id, storage_key, cutout_key, view_type, organization_id, product_id, metadata").eq("product_id", job.product_id).order("created_at");
  if (!product || !refs?.length) return failItem(item, job, "missing_reference", "The product photos are missing. Upload them again.");

  const attemptNo = item.attempts + 1;
  await setItem(item.id, { status: "preparing", attempts: attemptNo });
  const output = OUTPUTS[job.output];
  const primary = refs.find((r) => r.view_type === "front") ?? refs[0];
  const refImages = await Promise.all(refs.slice(0, 3).map(async (r) => sharp(await getObject("originals", r.storage_key)).resize(1536, 1536, { fit: "inside" }).png().toBuffer()));

  // Final size: full preset for paid images, capped for trials.
  const cap = job.is_trial ? TRIAL_MAX_EDGE : Math.max(output.width, output.height);
  const k = Math.min(1, cap / Math.max(output.width, output.height));
  const W = Math.round(output.width * k), H = Math.round(output.height * k);
  const renderEdge = job.is_trial ? settings.providers.render.trialEdge : settings.providers.render.paidEdge;

  // ---- understand the product, then direct the shot
  const analysis = await analyzeProduct(product.id);
  const edit = job.settings?.edit;
  if (!edit) await ensureShots(job, analysis, product.name);
  const { data: itemRow } = await db.from("generation_items").select("style, params").eq("id", item.id).single();
  const params = (itemRow?.params ?? {}) as ItemParams;
  const styleId = (output.forceStyle ?? (itemRow?.style && itemRow.style in STYLES ? itemRow.style : job.style)) as StyleId;

  // ---- build the model input
  let cut: Cutout | null = null;
  let place: Place | null = null;
  let images: Buffer[] = refImages;
  let mask: Buffer | undefined;
  let renderW = W, renderH = H;
  let promptText: string;
  let promptVersion: string;

  if (edit) {
    // Edit an existing image: the finished picture is the canvas, the product region stays locked.
    const parent = await loadParent(edit.assetId);
    if (!parent) return failItem(item, job, "missing_parent", "The original image is no longer available.");
    cut = parent.cut;
    place = parent.place ? scalePlace(parent.place, parent.width, parent.height, W, H) : null;
    const base = await sharp(parent.image).resize(W, H, { fit: "fill" }).png().toBuffer();
    const r = Math.min(1, renderEdge / Math.max(W, H));
    const size = customSize(Math.round(W * r), Math.round(H * r));
    renderW = size.width; renderH = size.height;
    images = [await sharp(base).resize(renderW, renderH, { fit: "fill" }).png().toBuffer()];
    if (cut && place) {
      const rc = await renderCanvas(cut, place, W, H, renderEdge);
      mask = rc.mask;
    }
    const p = buildEditPrompt(edit.instruction, product.name, analysis);
    promptText = p.text; promptVersion = p.version;
  } else {
    if (job.mode === "preserve") {
      cut = await getCutout(primary, { allowModel: true, wait: true });
      if (cut) {
        place = layoutProduct(cut, W, H, params.shot ?? { product_scale: output.productScale, offset_x: 0, baseline: output.baseline });
        const rc = await renderCanvas(cut, place, W, H, renderEdge);
        images = [rc.canvas];
        // No mask: the model may relight the product so it sits naturally; detail is restored afterwards.
        mask = undefined;
        renderW = rc.renderWidth; renderH = rc.renderHeight;
      }
    }
    if (!cut) {
      const r = Math.min(1, renderEdge / Math.max(W, H));
      const size = customSize(Math.round(W * r), Math.round(H * r));
      renderW = size.width; renderH = size.height;
    }
    const p = buildPrompt({
      mode: job.mode,
      category: isCategoryId(product.category) ? product.category : "other",
      productName: product.name,
      locks: (product.locks ?? []) as LockId[],
      style: styleId,
      output: job.output,
      customBrief: job.custom_brief ?? undefined,
      mustNotChange: product.must_not_change ?? undefined,
      palette: job.settings?.palette,
      variant: item.idx + item.attempts,
      productPlaced: !!cut,
      analysis,
      direction: params.shot ?? null,
    });
    promptText = p.text; promptVersion = p.version;
  }
  await db.from("generation_jobs").update({ prompt_version: promptVersion }).eq("id", job.id);

  // ---- generation, trying providers in order
  await setItem(item.id, { status: "generating" });
  const chain = providerChain(settings.providers);
  let result: { image: Buffer; provider: ProviderId; attemptId: string } | null = null;
  let lastError: ProviderError | null = null;
  const fx = await usdToInr();
  for (const pid of chain) {
    const provider = getProvider(pid, settings.providers);
    const model = modelFor(pid, settings.providers);
    const { data: attempt } = await db.from("generation_attempts").insert({
      item_id: item.id, job_id: job.id, organization_id: job.organization_id, attempt_no: attemptNo, provider: pid, model,
      status: "started", prompt_text: promptText, prompt_version: promptVersion,
    }).select("id").single();
    const started = Date.now();
    try {
      const res = await provider.edit({
        prompt: promptText,
        images,
        mask: provider.supportsMask ? mask : undefined,
        width: renderW,
        height: renderH,
        quality: job.is_trial ? "medium" : undefined,
        swatch: STYLES[styleId]?.swatch,
        timeoutMs: settings.providers.timeoutMs,
      }, model);
      const costUsd = res.costUsd ?? settings.providers.costUsdPerImage[pid] ?? 0;
      await db.from("generation_attempts").update({
        status: "succeeded", model: res.model, request_id: res.requestId ?? null, input_tokens: res.inputTokens ?? null, output_tokens: res.outputTokens ?? null,
        cost_usd: costUsd, fx_rate: fx.rate, fx_date: fx.date, cost_inr: Math.round(costUsd * fx.rate * 1000) / 1000, latency_ms: Date.now() - started,
      }).eq("id", attempt!.id);
      result = { image: res.image, provider: pid, attemptId: attempt!.id };
      break;
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError((e as Error).message, "unknown", true);
      lastError = err;
      await db.from("generation_attempts").update({
        status: "failed", error_code: err.code, error_message: err.message.slice(0, 500), latency_ms: Date.now() - started,
        cost_usd: 0, fx_rate: fx.rate, fx_date: fx.date, cost_inr: 0,
      }).eq("id", attempt!.id);
      if (err.userFacing) break;
      if (err.retryable) break; // retry this provider later with backoff rather than switching immediately
    }
  }

  if (!result) {
    const err = lastError!;
    if (err.userFacing) return failItem(item, job, err.code, "The AI service declined this image. Try a different scene or photo.");
    if (err.retryable && attemptNo < Math.min(2, item.max_attempts)) return retryLater(item, attemptNo, err.code);
    return failItem(item, job, err.code, "We couldn't create this image. No credit was used.");
  }

  // ---- put the real product back, at full resolution
  await setItem(item.id, { status: "checking" });
  const checks: CheckResult[] = [];
  let finalImage: Buffer;
  let finalPlace: Place | null = null;
  if (cut && place) {
    const fc = await finishComposite(result.image, cut, place, W, H, settings.quality.alignmentFail, { relight: !edit });
    finalImage = fc.image;
    finalPlace = fc.place;
    checks.push({
      type: "product_alignment",
      score: round(fc.alignment),
      decision: fc.recomposited ? "pass" : alignmentDecision(fc.alignment, settings.quality),
      details: fc.recomposited ? { note: "Label and logo detail restored from your product photo", lightShift: (fc as { lightShift?: number }).lightShift ?? null } : { note: "The AI moved the product, so it was re-created. Check the label closely." },
    });
  } else {
    finalImage = await sharp(result.image).removeAlpha().resize(W, H, { fit: "cover", kernel: "lanczos3" }).png().toBuffer();
    if (job.mode === "preserve") {
      checks.push({ type: "product_alignment", score: null, decision: "review", details: { note: "We couldn't cut the product out of this photo, so the AI re-created it. Check the label closely, or upload a photo on a plain background." } });
    }
  }

  const blank = await isBlank(finalImage);
  checks.push({ type: "blank_output", score: blank ? 0 : 1, decision: blank ? "fail" : "pass", details: {} });
  const dims = await dimensions(finalImage);
  const dimsOk = dims.width === W && dims.height === H;
  checks.push({ type: "dimensions", score: dimsOk ? 1 : 0, decision: dimsOk ? "pass" : "fail", details: { expected: [W, H], got: [dims.width, dims.height] } });

  // ---- AI accuracy review when the product wasn't restored from the real photo
  // A real product can be geometrically preserved yet still look commercially unusable.
  // Judge lighting, presentation and cleanup independently from product registration.
  const judgeNeeded = settings.quality.useJudge && result.provider !== "mock";
  if (judgeNeeded && integrations.openai) {
    try {
      const res = await jsonCall({
        models: settings.providers.llm.models, task: "scene_quality", orgId: job.organization_id, prompt: FIDELITY_JUDGE_PROMPT + (analysis?.visible_text.length ? `\nThe printed text on the real product is: ${analysis.visible_text.map((t) => `"${t}"`).join(", ")}.` : ""),
        images: [refImages[0], finalImage], detail: "high", schemaName: "fidelity", schema: JUDGE_SCHEMA, timeoutMs: 60_000,
      });
      const verdict = parseJudgeJson(JSON.stringify(res.data));
      if (verdict) checks.push({ type: "vlm_judge", score: verdict.same_product ? 1 : 0, decision: judgeDecision(verdict, job.mode), details: verdict as unknown as Record<string, unknown> });
      else checks.push({ type: "vlm_judge", score: null, decision: "review", details: { note: "Accuracy check gave an unreadable answer" } });
    } catch (e) {
      checks.push({ type: "vlm_judge", score: null, decision: "review", details: { note: "Accuracy check unavailable", error: (e as Error).message.slice(0, 200) } });
    }
  }

  const decision: Decision = aggregate(checks);
  if (decision === "fail" && attemptNo < Math.min(2, item.max_attempts)) {
    await saveFailedOutput(job, item, result.attemptId, finalImage, checks);
    return retryLater(item, attemptNo, "quality_fail", 0);
  }
  if (decision === "fail") {
    await saveFailedOutput(job, item, result.attemptId, finalImage, checks);
    return failItem(item, job, "quality_fail", "This image didn't pass our accuracy check after several tries. No credit was used.");
  }

  // ---- delivery
  const delivered = job.is_trial ? await watermark(finalImage, `${env.appName} trial`) : finalImage;
  const base = `${job.organization_id}/${job.id}/${item.idx}-${attemptNo}`;
  const thumb = await thumbnail(delivered);
  await Promise.all([putObject("outputs", `${base}.png`, delivered, "image/png"), putObject("outputs", `${base}-thumb.webp`, thumb, "image/webp")]);
  const { data: asset, error: aErr } = await db.from("generated_assets").insert({
    job_id: job.id, item_id: item.id, attempt_id: result.attemptId, organization_id: job.organization_id, product_id: job.product_id,
    storage_key: `${base}.png`, thumb_key: `${base}-thumb.webp`, width: W, height: H, quality_status: decision, watermarked: job.is_trial,
  }).select("id").single();
  if (aErr) throw aErr;
  await db.from("quality_checks").insert(checks.map((c) => ({ generated_asset_id: asset.id, check_type: c.type, score: c.score, decision: c.decision, details: c.details })));
  await setItem(item.id, {
    status: "delivered", decision, delivered_asset_id: asset.id, locked_by: null, locked_until: null, last_error: null,
    params: { ...params, place: finalPlace ?? undefined, cutoutAssetId: cut ? (edit ? params.cutoutAssetId ?? (await parentCutoutId(edit.assetId)) : primary.id) : undefined, size: [W, H] },
  });
  await db.rpc("settle_item", { p_item: item.id, p_capture: true });
  await track("generation_completed", { orgId: job.organization_id, userId: job.created_by }, { provider: result.provider, decision, mode: job.mode, style: styleId, attempt: attemptNo, edit: !!edit });
  await finishIfDone(job);
}

function scalePlace(p: Place, fromW: number, fromH: number, W: number, H: number): Place {
  const sx = W / fromW, sy = H / fromH;
  return { left: Math.round(p.left * sx), top: Math.round(p.top * sy), width: Math.round(p.width * sx), height: Math.round(p.height * sy) };
}

async function parentCutoutId(assetId: string): Promise<string | undefined> {
  const { data } = await admin().from("generated_assets").select("generation_items!generated_assets_item_id_fkey(params)").eq("id", assetId).maybeSingle();
  return ((data as unknown as { generation_items: { params: ItemParams } | null })?.generation_items?.params?.cutoutAssetId);
}

/** The finished image an edit starts from, with the product cut-out and its position. */
async function loadParent(assetId: string) {
  const db = admin();
  const { data } = await db.from("generated_assets").select("storage_key, width, height, watermarked, generation_items!generated_assets_item_id_fkey(params)").eq("id", assetId).maybeSingle();
  if (!data) return null;
  const params = ((data as unknown as { generation_items: { params: ItemParams } | null }).generation_items?.params ?? {}) as ItemParams;
  let cut: Cutout | null = null;
  if (params.cutoutAssetId) {
    const { data: ref } = await db.from("product_assets").select("id, storage_key, cutout_key, organization_id, product_id, metadata").eq("id", params.cutoutAssetId).maybeSingle();
    if (ref) cut = await getCutout(ref, { allowModel: false });
  }
  // Watermarked trial images: the product is restored from the cut-out, the watermark over the scene is repainted by the edit.
  const image = await getObject("outputs", data.storage_key);
  return { image, width: data.width as number, height: data.height as number, cut, place: params.place ?? null };
}

async function saveFailedOutput(job: JobRow, item: ItemRow, attemptId: string, image: Buffer, checks: CheckResult[]) {
  const db = admin();
  const key = `${job.organization_id}/${job.id}/failed-${item.idx}-${item.attempts + 1}.png`;
  await putObject("outputs", key, image, "image/png");
  const { data: asset } = await db.from("generated_assets").insert({
    job_id: job.id, item_id: item.id, attempt_id: attemptId, organization_id: job.organization_id, product_id: job.product_id,
    storage_key: key, quality_status: "fail", approval_status: "rejected",
  }).select("id").single();
  if (asset) await db.from("quality_checks").insert(checks.map((c) => ({ generated_asset_id: asset.id, check_type: c.type, score: c.score, decision: c.decision, details: c.details })));
}

async function retryLater(item: ItemRow, attemptNo: number, code: string, baseMs = 4000) {
  await setItem(item.id, {
    status: "queued", locked_by: null, locked_until: null, last_error: code,
    next_attempt_at: new Date(Date.now() + (baseMs ? backoffMs(attemptNo, baseMs) : 500)).toISOString(),
  });
}

async function failItem(item: ItemRow, job: JobRow, code: string, message: string) {
  const db = admin();
  await setItem(item.id, { status: "failed", last_error: `${code}: ${message}`, locked_by: null, locked_until: null });
  await db.rpc("settle_item", { p_item: item.id, p_capture: false });
  await track("generation_failed", { orgId: job.organization_id, userId: job.created_by }, { code, mode: job.mode });
  await finishIfDone(job);
}

async function finishIfDone(job: JobRow) {
  const status = await refreshJobStatus(job.id);
  if (["completed", "review_needed", "failed"].includes(status)) {
    // Release anything left reserved (for example, items that were cancelled mid-way).
    const { data: open } = await admin().from("generation_items").select("id").eq("job_id", job.id).is("settled", null).in("status", ["failed", "cancelled"]);
    for (const i of open ?? []) await admin().rpc("settle_item", { p_item: i.id, p_capture: false });
    await notifyJobDone(job.id).catch(() => undefined);
  }
}

const JUDGE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["same_product", "text_changed", "logo_changed", "colour_changed", "shape_changed", "extra_or_missing_items", "artefacts", "notes"],
  properties: {
    same_product: { type: "boolean" }, text_changed: { type: "boolean" }, logo_changed: { type: "boolean" }, colour_changed: { type: "boolean" },
    shape_changed: { type: "boolean" }, extra_or_missing_items: { type: "boolean" }, artefacts: { type: "boolean" },
    commercially_usable: { type: "boolean" }, lighting_consistent: { type: "boolean" },
    shadow_plausible: { type: "boolean" }, product_clean: { type: "boolean" }, notes: { type: "string" },
  },
};

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

/** One queue tick: claim up to `concurrency` items and process them within a time budget. */
export async function runTick(workerId: string, budgetMs = 240_000) {
  const settings = await getSettings(true);
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs - 90_000) {
    const { data: claimed, error } = await admin().rpc("claim_generation_items", { p_worker: workerId, p_limit: settings.providers.concurrency, p_lease_seconds: 300 });
    if (error) throw error;
    const items = (claimed ?? []) as ItemRow[];
    if (items.length === 0) break;
    await Promise.all(items.map(async (it) => {
      try {
        await processItem(it);
      } catch (e) {
        await logError("pipeline.item", (e as Error).message, { item: it.id, stack: (e as Error).stack?.slice(0, 1500) });
        if (it.attempts + 1 < Math.min(2, it.max_attempts)) await retryLater(it, it.attempts + 1, "internal_error");
        else {
          const { data: job } = await admin().from("generation_jobs").select("*").eq("id", it.job_id).single<JobRow>();
          if (job) await failItem(it, job, "internal_error", "Something went wrong on our side. No credit was used.");
        }
      }
    }));
    processed += items.length;
  }
  return { processed, providers: (["openai", "gemini", "fal"] as ProviderId[]).filter(isConfigured) };
}
