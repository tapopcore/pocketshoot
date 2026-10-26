import "server-only";
import sharp from "sharp";
import {
  ANALYSIS_SCHEMA, DIRECTION_SCHEMA, STYLES, analysisPrompt, directionPrompt, fallbackDirections, parseAnalysis, parseDirections,
  sanitizeUserText, type DirectionInput, type ProductAnalysis, type ShotDirection,
} from "@packshot/core";
import { admin } from "./supabase";
import { getObject, putObject } from "./storage";
import { cutoutFromRgba, localCutout, type Cutout } from "./images";
import { blendModelCutout } from "./compose";
import { jsonCall } from "./llm";
import { getProvider } from "./providers";
import { getSettings } from "./settings";
import { integrations } from "./env";
import { logError } from "./observe";

const SCENE_IDS = Object.keys(STYLES).filter((k) => k !== "custom");

export interface ProductAssetRow {
  id: string;
  storage_key: string;
  cutout_key: string | null;
  organization_id: string;
  product_id: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Product cut-out with the customer's real pixels.
 * 1. Local background removal (free, instant) for plain backgrounds.
 * 2. Otherwise GPT Image renders a transparent version, and we keep the real pixels
 *    wherever they match it (so labels stay exact) and the model's pixels where it removed hands or clutter.
 */
export async function getCutout(asset: ProductAssetRow, opts: { allowModel?: boolean } = {}): Promise<Cutout | null> {
  if (asset.cutout_key && asset.cutout_key !== "none") return cutoutFromRgba(await getObject("originals", asset.cutout_key));
  if (asset.cutout_key === "none" && !opts.allowModel) return null;
  const source = await getObject("originals", asset.storage_key);
  let cut: Cutout | null = await localCutout(source);
  let method = cut ? "local" : null;
  let realShare = cut ? 1 : 0;
  if (!cut && opts.allowModel !== false && integrations.openai) {
    try {
      const settings = await getSettings();
      const meta = await sharp(source).metadata();
      const edge = 1536;
      const s = Math.min(1, edge / Math.max(meta.width!, meta.height!));
      const input = await sharp(source).resize(Math.round(meta.width! * s), Math.round(meta.height! * s)).png().toBuffer();
      const res = await getProvider("openai", settings.providers).edit({
        prompt: "Cut out the product: keep only the main product on a fully transparent background. Keep the product exactly as it is in the photo: same position, size, angle, shape, colours, label, logo and every printed letter. Remove everything else, including hands, fingers, surfaces, shadows and other objects. Where a finger covered part of the product, restore only that hidden part of the product faithfully.",
        images: [input],
        width: Math.round(meta.width! * s),
        height: Math.round(meta.height! * s),
        transparent: true,
        quality: settings.providers.render.cutoutQuality,
        timeoutMs: 180_000,
      }, settings.providers.openai.model);
      const blended = await blendModelCutout(source, res.image);
      if (blended) {
        cut = await cutoutFromRgba(blended.png);
        if (cut) cut.method = "provider";
        method = blended.realShare > 0.6 ? "model_blend" : "model";
        realShare = blended.realShare;
        await recordCost(asset.organization_id, "cutout", res.model, res.costUsd ?? 0);
      }
    } catch (e) {
      await logError("prep.cutout", (e as Error).message, { asset: asset.id });
    }
  }
  const key = `${asset.organization_id}/${asset.product_id}/${asset.id}-cutout.png`;
  if (cut) await putObject("originals", key, cut.png, "image/png");
  await admin().from("product_assets").update({
    cutout_key: cut ? key : "none",
    metadata: { ...(asset.metadata ?? {}), cutoutMethod: method, realPixelShare: Math.round(realShare * 100) / 100 },
  }).eq("id", asset.id);
  asset.cutout_key = cut ? key : "none";
  return cut;
}

/** Vision analysis of the product photos. Cached on the product. */
export async function analyzeProduct(productId: string, force = false): Promise<ProductAnalysis | null> {
  const db = admin();
  const { data: product } = await db.from("products").select("id, organization_id, attributes").eq("id", productId).single();
  if (!product) return null;
  const attrs = (product.attributes ?? {}) as { analysis?: ProductAnalysis };
  if (attrs.analysis && !force) return attrs.analysis;
  if (!integrations.openai) return null;
  const { data: refs } = await db.from("product_assets").select("storage_key, view_type").eq("product_id", productId).order("created_at").limit(3);
  if (!refs?.length) return null;
  try {
    const settings = await getSettings();
    const images = await Promise.all(refs.map((r) => getObject("originals", r.storage_key)));
    const res = await jsonCall({ models: settings.providers.llm.models, prompt: analysisPrompt(SCENE_IDS), images, detail: "high", schemaName: "product_analysis", schema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>, timeoutMs: 60_000 });
    const analysis = parseAnalysis(res.data, SCENE_IDS);
    if (!analysis) return null;
    await db.from("products").update({ attributes: { ...attrs, analysis, analysisModel: res.model, analysedAt: new Date().toISOString() } }).eq("id", productId);
    await recordCost(product.organization_id, "analysis", res.model, (res.inputTokens * 0.25 + res.outputTokens * 2) / 1_000_000);
    return analysis;
  } catch (e) {
    await logError("prep.analysis", (e as Error).message, { product: productId });
    return null;
  }
}

/** Shot briefs for every image in a job, written by the art-director model. */
export async function directShots(input: DirectionInput): Promise<{ shots: ShotDirection[]; source: "ai" | "rules" }> {
  const fallback = () => ({ shots: fallbackDirections(input), source: "rules" as const });
  if (!integrations.openai) return fallback();
  try {
    const settings = await getSettings();
    const res = await jsonCall({
      models: settings.providers.llm.models,
      prompt: directionPrompt({ ...input, brief: sanitizeUserText(input.brief) || undefined }),
      schemaName: "shot_briefs",
      schema: DIRECTION_SCHEMA as unknown as Record<string, unknown>,
      timeoutMs: 45_000,
    });
    const shots = parseDirections(res.data, input.count);
    return shots ? { shots, source: "ai" } : fallback();
  } catch (e) {
    await logError("prep.direction", (e as Error).message, {});
    return fallback();
  }
}

async function recordCost(orgId: string, kind: string, model: string, usd: number) {
  await admin().from("analytics_events").insert({ organization_id: orgId, name: "ai_cost", props: { kind, model, usd: Math.round(usd * 100000) / 100000 } }).then(() => undefined, () => undefined);
}
