import "server-only";
import {
  FIDELITY_JUDGE_PROMPT, OUTPUTS, STYLES, TRIAL_MAX_EDGE, aggregate, alignmentDecision, backoffMs, buildPrompt,
  colourDecision, judgeDecision, parseJudgeJson, isCategoryId, type CheckResult, type Decision, type LockId, type OutputId, type StyleId,
} from "@packshot/core";
import sharp from "sharp";
import { admin } from "./supabase";
import { getSettings, type Settings } from "./settings";
import { getObject, putObject } from "./storage";
import {
  cutoutFromRgba, dimensions, fitTo, isBlank, localCutout, placeOnCanvas, recomposite, thumbnail, watermark, type Cutout,
} from "./images";
import { getProvider, isConfigured, modelFor, providerChain, ProviderError, type ProviderId } from "./providers";
import { falSegment } from "./providers/fal";
import { geminiJudge } from "./providers/gemini";
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
  settings: { palette?: string[]; category?: string };
  is_trial: boolean;
  status: string;
  created_by: string | null;
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

/** Loads (or computes and caches) the product cutout for the primary reference photo. */
async function getCutout(asset: { id: string; storage_key: string; cutout_key: string | null; organization_id: string; product_id: string }, settings: Settings): Promise<Cutout | null> {
  const db = admin();
  if (asset.cutout_key === "none") return null;
  if (asset.cutout_key) {
    const png = await getObject("originals", asset.cutout_key);
    return cutoutFromRgba(png);
  }
  const source = await getObject("originals", asset.storage_key);
  let cut: Cutout | null = null;
  if (integrations.fal) {
    try {
      cut = await cutoutFromRgba(await falSegment(settings.providers.fal.segmentModel, source));
    } catch (e) {
      await logError("pipeline.segment", (e as Error).message, { asset: asset.id });
    }
  }
  if (!cut) cut = await localCutout(source);
  const key = `${asset.organization_id}/${asset.product_id}/${asset.id}-cutout.png`;
  if (cut) await putObject("originals", key, cut.png, "image/png");
  await db.from("product_assets").update({ cutout_key: cut ? key : "none", metadata: { cutoutMethod: cut?.method ?? null, cutoutConfidence: cut?.confidence ?? null } }).eq("id", asset.id);
  return cut;
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
  const { data: product } = await db.from("products").select("id, name, category, locks, must_not_change").eq("id", job.product_id).single();
  const { data: refs } = await db.from("product_assets").select("id, storage_key, cutout_key, view_type, organization_id, product_id").eq("product_id", job.product_id).order("created_at");
  if (!product || !refs?.length) return failItem(item, job, "missing_reference", "The product photos are missing. Upload them again.");

  const attemptNo = item.attempts + 1;
  await setItem(item.id, { status: "preparing", attempts: attemptNo });
  const output = OUTPUTS[job.output];
  const maxEdge = job.is_trial ? TRIAL_MAX_EDGE : undefined;
  const primary = refs.find((r) => r.view_type === "front") ?? refs[0];

  // ---- preparation
  let canvas: Awaited<ReturnType<typeof placeOnCanvas>> | null = null;
  if (job.mode === "preserve") {
    const cut = await getCutout(primary, settings);
    if (cut) canvas = await placeOnCanvas(cut, output, item.idx, maxEdge);
  }
  const W = canvas?.placement.canvasWidth ?? (maxEdge ? Math.round(output.width * Math.min(1, maxEdge / Math.max(output.width, output.height))) : output.width);
  const H = canvas?.placement.canvasHeight ?? (maxEdge ? Math.round(output.height * Math.min(1, maxEdge / Math.max(output.width, output.height))) : output.height);

  const refImages = await Promise.all(refs.slice(0, 3).map(async (r) => sharp(await getObject("originals", r.storage_key)).resize(1536, 1536, { fit: "inside" }).png().toBuffer()));
  const prompt = buildPrompt({
    mode: job.mode,
    category: isCategoryId(product.category) ? product.category : "other",
    productName: product.name,
    locks: (product.locks ?? []) as LockId[],
    style: job.style,
    output: job.output,
    customBrief: job.custom_brief ?? undefined,
    mustNotChange: product.must_not_change ?? undefined,
    palette: job.settings?.palette,
    variant: item.idx + item.attempts,
    productPlaced: !!canvas,
  });
  await db.from("generation_jobs").update({ prompt_version: prompt.version }).eq("id", job.id);

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
      status: "started", prompt_text: prompt.text, prompt_version: prompt.version,
    }).select("id").single();
    const started = Date.now();
    try {
      const images = canvas ? [canvas.canvas] : refImages;
      const res = await provider.edit({
        prompt: prompt.text,
        images,
        mask: canvas && provider.supportsMask ? canvas.editMask : undefined,
        width: W,
        height: H,
        swatch: STYLES[output.forceStyle ?? job.style]?.swatch,
        timeoutMs: settings.providers.timeoutMs,
      }, model);
      const costUsd = res.costUsd ?? settings.providers.costUsdPerImage[pid] ?? 0;
      await db.from("generation_attempts").update({
        status: "succeeded", request_id: res.requestId ?? null, input_tokens: res.inputTokens ?? null, output_tokens: res.outputTokens ?? null,
        cost_usd: costUsd, fx_rate: fx.rate, fx_date: fx.date, cost_inr: Math.round(costUsd * fx.rate * 1000) / 1000, latency_ms: Date.now() - started,
      }).eq("id", attempt!.id);
      result = { image: res.image, provider: pid, attemptId: attempt!.id };
      break;
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError((e as Error).message, "unknown", true);
      lastError = err;
      // Failed calls can still be billed by some providers; record the estimate only when a request reached them.
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
    if (err.userFacing) return failItem(item, job, err.code, "The AI service declined this image. Try a different style or photo.");
    if (err.retryable && attemptNo < item.max_attempts) return retryLater(item, attemptNo, err.code);
    return failItem(item, job, err.code, "We couldn't create this image. No credit was used.");
  }

  // ---- post-processing and screening
  await setItem(item.id, { status: "checking" });
  const checks: CheckResult[] = [];
  let finalImage: Buffer;
  let reference = refImages[0];
  if (canvas) {
    const rc = await recomposite(result.image, canvas.layer, canvas.placement, settings.quality.alignmentFail);
    finalImage = rc.image;
    checks.push({ type: "product_alignment", score: round(rc.alignment), decision: rc.recomposited ? "pass" : alignmentDecision(rc.alignment, settings.quality), details: { recomposited: rc.recomposited } });
    checks.push({ type: "colour_delta", score: round(1 - Math.min(rc.colourDelta, 50) / 50), decision: rc.recomposited ? "pass" : colourDecision(rc.colourDelta, settings.quality), details: { deltaE: round(rc.colourDelta), note: rc.recomposited ? "Original product pixels restored" : "Model output used as-is" } });
    reference = canvas.canvas;
  } else {
    finalImage = await fitTo(result.image, W, H);
    if (job.mode === "preserve") {
      checks.push({ type: "product_alignment", score: null, decision: "review", details: { note: "Couldn't separate the product from its background, so the product was re-created by the AI. Check labels closely." } });
    }
  }

  const blank = await isBlank(finalImage);
  checks.push({ type: "blank_output", score: blank ? 0 : 1, decision: blank ? "fail" : "pass", details: {} });
  const dims = await dimensions(finalImage);
  const dimsOk = dims.width === W && dims.height === H;
  checks.push({ type: "dimensions", score: dimsOk ? 1 : 0, decision: dimsOk ? "pass" : "fail", details: { expected: [W, H], got: [dims.width, dims.height] } });

  const judgeNeeded = settings.quality.useJudge && result.provider !== "mock" && (job.mode === "creative" || !canvas);
  if (judgeNeeded && integrations.gemini) {
    try {
      const small = async (b: Buffer) => sharp(b).resize(1024, 1024, { fit: "inside" }).png().toBuffer();
      const raw = await geminiJudge(settings.providers.gemini.judgeModel, FIDELITY_JUDGE_PROMPT, await small(refImages[0]), await small(finalImage));
      const verdict = parseJudgeJson(raw);
      if (verdict) checks.push({ type: "vlm_judge", score: verdict.same_product ? 1 : 0, decision: judgeDecision(verdict, job.mode), details: verdict as unknown as Record<string, unknown> });
      else checks.push({ type: "vlm_judge", score: null, decision: "review", details: { note: "Accuracy check gave an unreadable answer" } });
    } catch (e) {
      checks.push({ type: "vlm_judge", score: null, decision: "review", details: { note: "Accuracy check unavailable", error: (e as Error).message.slice(0, 200) } });
    }
  } else if (judgeNeeded) {
    checks.push({ type: "vlm_judge", score: null, decision: "review", details: { note: "Automatic accuracy check not configured" } });
  }

  const decision: Decision = aggregate(checks);
  if (decision === "fail" && attemptNo < item.max_attempts) {
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
  await setItem(item.id, { status: "delivered", decision, delivered_asset_id: asset.id, locked_by: null, locked_until: null, last_error: null });
  await db.rpc("settle_item", { p_item: item.id, p_capture: true });
  await track("generation_completed", { orgId: job.organization_id, userId: job.created_by }, { provider: result.provider, decision, mode: job.mode, style: job.style, attempt: attemptNo });
  await finishIfDone(job);
  void reference;
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
        if (it.attempts + 1 < it.max_attempts) await retryLater(it, it.attempts + 1, "internal_error");
        else {
          const { data: job } = await admin().from("generation_jobs").select("*").eq("id", it.job_id).single<JobRow>();
          if (job) await failItem(it, job, "internal_error", "Something went wrong on our side. No credit was used.");
        }
      }
    }));
    processed += items.length;
  }
  return { processed, providers: (["gemini", "openai", "fal"] as ProviderId[]).filter(isConfigured) };
}
