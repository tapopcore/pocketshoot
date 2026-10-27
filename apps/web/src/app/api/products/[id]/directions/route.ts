import { after } from "next/server";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { CREATIVE_VERSION, type ProductAnalysis } from "@packshot/core";
import { ApiError, handler } from "@/lib/api";
import { assertRole } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { integrations } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { getProvider } from "@/lib/providers";
import { getObject, putObject, signedUrls } from "@/lib/storage";
import { logError } from "@/lib/observe";

export const maxDuration = 300;
interface Preview { fingerprint: string; state: "pending" | "ready" | "failed"; startedAt: number; keys?: string[] }
async function context(id: string, orgId: string) {
  const { data } = await admin().from("products").select("id, attributes").eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!data) throw new ApiError(404, "Product not found");
  const attrs = (data.attributes ?? {}) as Record<string, unknown>;
  const analysis = attrs.analysis as ProductAnalysis | undefined;
  const { data: refs } = await admin().from("product_assets").select("storage_key").eq("product_id", id).eq("organization_id", orgId).order("created_at").limit(1);
  const key = refs?.[0]?.storage_key;
  const fingerprint = createHash("sha256").update(JSON.stringify([CREATIVE_VERSION, key, analysis?.ideas])).digest("hex").slice(0, 20);
  const cached = attrs.creative_preview as Preview | undefined;
  return { attrs, analysis, key, fingerprint, cached: cached?.fingerprint === fingerprint ? cached : undefined };
}
async function response(preview?: Preview) {
  if (!preview) return { state: "idle", urls: [] };
  if (preview.state === "pending" && Date.now() - preview.startedAt > 240_000) return { state: "failed", urls: [] };
  const urls = preview.state === "ready" ? await signedUrls("originals", preview.keys ?? [], 900) : {};
  return { state: preview.state, urls: (preview.keys ?? []).map(key => urls[key] ?? null) };
}
export const GET = handler<{ id: string }>(async (_req, ctx, { id }) => response((await context(id, ctx.orgId)).cached));
export const POST = handler<{ id: string }>(async (_req, ctx, { id }) => {
  assertRole(ctx, "editor");
  const c = await context(id, ctx.orgId);
  if (c.cached?.state === "ready" || (c.cached?.state === "pending" && Date.now() - c.cached.startedAt < 240_000)) return response(c.cached);
  if (!integrations.openai || !c.key || !c.analysis?.ideas.length) return { state: "unavailable", urls: [] };
  const db = admin();
  // Complimentary previews fail closed if their rate limiter is unavailable.
  for (const [key, limit, seconds] of [["direction-product:" + id, 1, 300], ["direction-org:" + ctx.orgId, 12, 3600]] as const) {
    const { data, error } = await db.rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: seconds });
    if (error || data !== true) throw new ApiError(429, "Concept previews are busy. Try again in a few minutes.");
  }
  const pending: Preview = { fingerprint: c.fingerprint, state: "pending", startedAt: Date.now() };
  const { error: saveError } = await db.from("products").update({ attributes: { ...c.attrs, creative_preview: pending } }).eq("id", id).eq("organization_id", ctx.orgId);
  if (saveError) throw saveError;
  after(async () => {
    let completed: Preview = { ...pending, state: "failed" };
    try {
      const source = await sharp(await getObject("originals", c.key!)).rotate().resize(1280, 1280, { fit: "inside" }).png().toBuffer();
      const settings = await getSettings();
      const ideas = c.analysis!.ideas.slice(0, 3);
      const prompt = [
        "Create a photographic concept contact sheet for the exact product in the reference image.",
        "Landscape 3:2 canvas split into THREE EXACTLY EQUAL vertical panels, edge to edge, no gutters or text. Each third is a complete separate photograph. Do not let objects cross panel boundaries.",
        "Preserve the product design, shape, proportions, colours, logo and label. Remove the old surroundings. Each panel must show the uploaded product clearly.",
        "Product: " + c.analysis!.description + ". Use: " + (c.analysis!.use_case || "unconfirmed; do not invent usage") + ". Printed text: " + JSON.stringify(c.analysis!.visible_text),
        ...ideas.map((idea, i) => "Panel " + (i + 1) + ", " + ["left", "middle", "right"][i] + " third: " + idea.description + ". Human presence: " + (idea.human_presence ?? "none") + ". Purpose: " + (idea.why || idea.title)),
        "Premium commercial photographic realism: motivated light, material texture, believable scale, gravity and shadows. Adult models only where requested, natural pores, anatomically correct fingers and authentic gestures. No invented ingredients, functional changes, claims, endorsements, text overlays or watermarks.",
        "These are small concept studies; their composition must read immediately."
      ].join("\n");
      const result = await getProvider("openai", settings.providers).edit({ prompt, images: [source], width: 1536, height: 1024, quality: "low", timeoutMs: 180_000 }, settings.providers.openai.model);
      const sheet = await sharp(result.image).resize(1536, 1024, { fit: "fill" }).png().toBuffer();
      const keys = await Promise.all(ideas.map(async (_idea, i) => {
        const key = ctx.orgId + "/" + id + "/directions/" + c.fingerprint + "-" + i + ".webp";
        const image = await sharp(sheet).extract({ left: i * 512, top: 0, width: 512, height: 1024 }).webp({ quality: 85 }).toBuffer();
        await putObject("originals", key, image, "image/webp");
        return key;
      }));
      completed = { ...pending, state: "ready", keys };
      await db.from("analytics_events").insert({ organization_id: ctx.orgId, user_id: ctx.userId, name: "ai_cost", props: { kind: "concept_previews", model: result.model, usd: result.costUsd ?? null } });
    } catch (e) { await logError("creative.preview", (e as Error).message, { product: id }); }
    const { data: fresh } = await db.from("products").select("attributes").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
    const attrs = (fresh?.attributes ?? {}) as Record<string, unknown>;
    if ((attrs.creative_preview as Preview | undefined)?.fingerprint === pending.fingerprint) await db.from("products").update({ attributes: { ...attrs, creative_preview: completed } }).eq("id", id).eq("organization_id", ctx.orgId);
  });
  return response(pending);
});
