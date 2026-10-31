import "server-only";
import sharp from "sharp";
import {
  CREATIVE_VERSION, MAX_REFERENCE_PHOTOS, SUGGESTIONS_PROMPT, SUGGESTIONS_SCHEMA, photoSetPrompt, shotMatchesStyle, ANALYSIS_SCHEMA, DIRECTION_SCHEMA, STYLES, analysisPrompt, directionPrompt, fallbackDirections, packshotPrompt, parseAnalysis, parseDirections,
  sanitizeUserText, type DirectionInput, type ProductAnalysis, type ShotDirection,
} from "@packshot/core";
import { admin } from "./supabase";
import { getObject, putObject } from "./storage";
import { cutoutFromRgba, localCutout, type Cutout } from "./images";
import { blendModelCutout } from "./compose";
import { jsonCall } from "./llm";
import {aiScope,withAiScope} from "./ai-spend";
import { getProvider } from "./providers";
import { getSettings } from "./settings";
import { integrations } from "./env";
import { logError } from "./observe";

const SCENE_IDS = Object.keys(STYLES).filter((k) => k !== "custom");
// Upload needs identity, not a second creative brief. No image call is made here.
const SUMMARY_SCHEMA = {
  ...ANALYSIS_SCHEMA,
  properties: { ...ANALYSIS_SCHEMA.properties,
    ideas: { type: "array", maxItems: 0, items: ANALYSIS_SCHEMA.properties.ideas.items },
    suggested_scenes: { type: "array", maxItems: 0, items: { type: "string" } },
    suggestions: SUGGESTIONS_SCHEMA,
  },
  required: [...ANALYSIS_SCHEMA.required, "suggestions"],
};


export interface ProductAssetRow {
  id: string;
  storage_key: string;
  cutout_key: string | null;
  organization_id: string;
  product_id: string;
  metadata?: Record<string, unknown> | null;
}

const HERO_LOCK_MS = 4 * 60_000;

/**
 * The product, cleaned and cut out, used in every shot.
 * 1. GPT Image retouches the customer's photo into a studio packshot on a transparent background:
 *    hands, background, dust, fingerprints and glare removed, label kept.
 * 2. A vision check compares it with the original; if any text or design changed we retry more strictly,
 *    then fall back to the customer's own pixels (local background removal, or a model-assisted cut-out).
 * The result is cached on the product photo.
 */
export async function getCutout(asset: ProductAssetRow, opts: { allowModel?: boolean; wait?: boolean } = {}): Promise<Cutout | null> {
  const meta = (asset.metadata ?? {}) as Record<string, unknown>;
  if (asset.cutout_key && asset.cutout_key !== "none") return cutoutFromRgba(await getObject("originals", asset.cutout_key));
  if (asset.cutout_key === "none" && !opts.allowModel) return null;

  // Another request is already retouching this photo: wait for it instead of paying twice.
  const startedAt = typeof meta.heroStartedAt === "number" ? meta.heroStartedAt : 0;
  if (meta.heroStatus === "processing" && Date.now() - startedAt < HERO_LOCK_MS) {
    if (!opts.wait) return null;
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const { data } = await admin().from("product_assets").select("cutout_key, metadata").eq("id", asset.id).single();
      if (data?.cutout_key && data.cutout_key !== "none") return cutoutFromRgba(await getObject("originals", data.cutout_key));
      if ((data?.metadata as Record<string, unknown>)?.heroStatus !== "processing") break;
    }
  }
  await admin().from("product_assets").update({ metadata: { ...meta, heroStatus: "processing", heroStartedAt: Date.now() } }).eq("id", asset.id);

  const source = await getObject("originals", asset.storage_key);
  let cut: Cutout | null = null;
  let method: string | null = null;
  let fidelity: Record<string, unknown> | null = null;

  if (opts.allowModel !== false && integrations.openai) {
    const analysis = await analyzeProduct(asset.product_id);
    for (const strict of [false, true]) {
      try {
        const r = await retouch(asset, source, analysis, strict);
        if (!r) continue;
        fidelity = r.verdict;
        if (r.ok) { cut = r.cut; method = strict ? "retouch_strict" : "retouch"; break; }
      } catch (e) {
        await logError("prep.retouch", (e as Error).message, { asset: asset.id, strict });
      }
    }
  }
  if (!cut) {
    cut = await localCutout(source);
    if (cut) method = "local";
  }
  if (!cut && opts.allowModel !== false && integrations.openai) {
    try {
      const settings = await getSettings();
      const res = await getProvider("openai", settings.providers).edit({
        prompt: "Cut out the product: keep only the main product on a fully transparent background, exactly as it is in the photo (same position, size, angle, colours, label and printed letters). Remove hands, surfaces and other objects.",
        images: [await sharp(source).resize(1536, 1536, { fit: "inside" }).png().toBuffer()],
        width: 1024, height: 1024, transparent: true, quality: "medium", timeoutMs: 180_000,
      }, settings.providers.openai.model);
      const blended = await blendModelCutout(source, res.image);
      if (blended) { cut = await cutoutFromRgba(blended.png); method = "model_blend"; }
    } catch (e) {
      await logError("prep.cutout", (e as Error).message, { asset: asset.id });
    }
  }

  const key = `${asset.organization_id}/${asset.product_id}/${asset.id}-cutout.png`;
  const previewKey = `${asset.organization_id}/${asset.product_id}/${asset.id}-hero.jpg`;
  if (cut) {
    await putObject("originals", key, cut.png, "image/png");
    const preview = await sharp(cut.png).extract(cut.bbox).resize(1200, 1200, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    await putObject("originals", previewKey, preview, "image/jpeg");
  }
  await admin().from("product_assets").update({
    cutout_key: cut ? key : "none",
    metadata: { ...meta, heroStatus: cut ? "ready" : "failed", heroStartedAt: null, cutoutMethod: method, heroPreviewKey: cut ? previewKey : null, fidelity },
  }).eq("id", asset.id);
  asset.cutout_key = cut ? key : "none";
  return cut;
}

const FIDELITY_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["same_product", "text_changed", "logo_changed", "shape_changed", "colour_changed", "notes"],
  properties: {
    same_product: { type: "boolean" }, text_changed: { type: "boolean" }, logo_changed: { type: "boolean" },
    shape_changed: { type: "boolean" }, colour_changed: { type: "boolean" }, notes: { type: "string" },
  },
};

/** One retouch attempt plus its accuracy check. */
async function retouch(asset: ProductAssetRow, source: Buffer, analysis: ProductAnalysis | null, strict: boolean) {
  const settings = await getSettings();
  const input = await sharp(source).resize(1536, 1536, { fit: "inside" }).png().toBuffer();
  const res = await getProvider("openai", settings.providers).edit({
    prompt: packshotPrompt(analysis, strict),
    images: [input],
    width: 1024, height: 1024,
    transparent: true,
    quality: "high",
    timeoutMs: 180_000,
  }, settings.providers.openai.model);
  await recordCost(asset.organization_id, "retouch", res.model, res.costUsd ?? 0.06);
  const cut = await cutoutFromRgba(res.image);
  if (!cut) return null;
  const flat = await sharp(res.image).flatten({ background: "#ffffff" }).png().toBuffer();
  const check = await jsonCall({
    models: settings.providers.llm.models,
    prompt: `Image 1 is a customer's phone photo of a product. Image 2 is a retouched packshot of it. Ignore background, hands, lighting, dust, glare, angle straightening and cleanup: those are wanted.
Check only whether the product itself changed: any printed word, letter or number different, missing or added; logo different; shape or proportions different; product colour different; a different product.${analysis?.visible_text.length ? ` The real printed text is: ${analysis.visible_text.map((t) => `"${t}"`).join(", ")}.` : ""}
Answer with JSON. Be strict about text and logo.`,
    images: [source, flat], detail: "high", schemaName: "fidelity", schema: FIDELITY_SCHEMA, timeoutMs: 60_000,
  });
  const v = check.data as { same_product: boolean; text_changed: boolean; logo_changed: boolean; shape_changed: boolean; colour_changed: boolean; notes: string };
  const ok = v.same_product && !v.text_changed && !v.logo_changed && !v.shape_changed && !v.colour_changed;
  return { cut, ok, verdict: { ...v, strict } };
}

/** Vision analysis of the product photos. Cached on the product. */
const analyses=new Map<string,Promise<ProductAnalysis|null>>();
export async function analyzeProduct(productId:string,force=false):Promise<ProductAnalysis|null>{
 const pending=analyses.get(productId);if(pending&&!force)return pending;
 const task=analyzeProductOnce(productId,force);analyses.set(productId,task);
 try{return await task;}finally{if(analyses.get(productId)===task)analyses.delete(productId);}
}
async function analyzeProductOnce(productId: string, force = false): Promise<ProductAnalysis | null> {
  const db = admin();
  const { data: product } = await db.from("products").select("id, organization_id, attributes").eq("id", productId).single();
  if (!product) return null;
  const attrs = (product.attributes ?? {}) as { analysis?: ProductAnalysis };
  const { data: refs } = await db.from("product_assets").select("storage_key, view_type").eq("product_id", productId).order("created_at").limit(MAX_REFERENCE_PHOTOS);
  if (!refs?.length) return null;
  // Re-run when the product gains or loses a photo, or when the analysis comes from an older version.
  if (attrs.analysis && !force && attrs.analysis.viewpoint && attrs.analysis.creative_version === CREATIVE_VERSION && (attrs.analysis.photo_count ?? 1) === refs.length) return attrs.analysis;
  if (!integrations.openai) return attrs.analysis ?? null;
  try {
    const settings = await getSettings();
    const ordered = [...refs].sort((a, b) => Number(b.view_type === "front") - Number(a.view_type === "front"));
    const images = await Promise.all(ordered.map((r) => getObject("originals", r.storage_key)));
    const prompt = analysisPrompt(SCENE_IDS).split("EXACTLY THREE DIRECTIONS")[0] + photoSetPrompt(ordered.map((r) => r.view_type)) + "\nReturn concise product facts. ideas and suggested_scenes must be empty arrays. Give a concise buyer context and one product-specific visual_strategy grounded in visible materials, form or utility. Preserve the observed source form (worn, loose, packaged or assembled); flag uncertainty instead of guessing a different product. Do not generate an image. Report uncertainties in photo_issues; do not invent hidden details." + SUGGESTIONS_PROMPT;
    const scope=aiScope();
    const res = await withAiScope({organizationId:product.organization_id,productId,...(scope?.jobId?{jobId:scope.jobId}:{})},()=>jsonCall({ models: settings.providers.llm.models, prompt, images, detail: "high", schemaName: "product_summary", schema: SUMMARY_SCHEMA as unknown as Record<string, unknown>, timeoutMs: 45_000 }));
    const analysis = parseAnalysis(res.data, SCENE_IDS);
    if (!analysis) return null;
    analysis.photo_count = refs.length;
    await db.from("products").update({ attributes: { ...attrs, analysis, analysisModel: res.model, analysedAt: new Date().toISOString() } }).eq("id", productId);
    await recordCost(product.organization_id, "analysis", res.model, (res.inputTokens * 0.25 + res.outputTokens * 2) / 1_000_000);
    return analysis;
  } catch (e) {
    await logError("prep.analysis", (e as Error).message, { product: productId });
    return attrs.analysis ?? null;
  }
}

/** Shot briefs for every image in a job, written by the art-director model. */
export async function directShots(input:DirectionInput):Promise<{shots:ShotDirection[];source:"ai"|"rules"}>{
 const scope=aiScope();return scope?withAiScope({...scope,itemId:undefined},()=>directShotsOnce(input)):directShotsOnce(input);
}
async function directShotsOnce(input: DirectionInput): Promise<{ shots: ShotDirection[]; source: "ai" | "rules" }> {
  const fallback = () => ({ shots: fallbackDirections(input), source: "rules" as const });
  if (!integrations.openai) return fallback();
  try {
    const settings = await getSettings();
    const prompt = directionPrompt({ ...input, brief: sanitizeUserText(input.brief) || undefined });
    // Repair text planning once before any image request. One bad slot cannot silently poison a pack.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await jsonCall({ models: settings.providers.llm.models, prompt: prompt + (attempt ? "\nThe previous plan was invalid. Return exactly one distinct shot per assignment, in order. Respect each assignment's environment, human action and framing independently. For outdoor slots use an explicitly exterior location with no indoor/window staging. Keep camera directions complete and concise." : ""), schemaName: "shot_briefs", schema: DIRECTION_SCHEMA as unknown as Record<string, unknown>, timeoutMs: 35_000 });
      const shots = parseDirections(res.data, input.count);
      if (!shots) continue;
      const directed = shots.map((shot, index) => ({ ...shot, framing: input.assignments?.[index]?.framing ?? input.framing ?? "full", human_presence: input.assignments?.[index]?.humanPresence ?? input.humanPresence ?? "none" }));
      if (directed.every((shot, index) => { const selected = input.assignments?.[index]?.shootStyle ?? input.shootStyle; return !selected || shotMatchesStyle(selected, shot); })) return { shots: directed, source: "ai" };
    }
    await logError("prep.direction", "Shot plan failed count, distinctness or selected-style validation", { count: input.count });
    return fallback();
  } catch (e) {
    await logError("prep.direction", (e as Error).message, {});
    return fallback();
  }
}

async function recordCost(orgId: string, kind: string, model: string, usd: number) {
  await admin().from("analytics_events").insert({ organization_id: orgId, name: "ai_cost", props: { kind, model, usd: Math.round(usd * 100000) / 100000 } }).then(() => undefined, () => undefined);
}
