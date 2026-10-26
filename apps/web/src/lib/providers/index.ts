import "server-only";
import sharp, { type OverlayOptions } from "sharp";
import { integrations } from "../env";
import { contactShadow, sandboxScene } from "../images";
import type { ProviderSettings } from "../settings";
import { gemini } from "./gemini";
import { openaiProvider } from "./openai";
import { fal } from "./fal";
import { ProviderError, type EditRequest, type EditResult, type ImageProvider, type ProviderId } from "./types";

export * from "./types";

/**
 * Sandbox provider. Builds a plain studio gradient around the canvas so the
 * whole flow (credits, gallery, downloads) can be tested without paid keys.
 * Every image it makes is labelled SANDBOX and it never claims to be real AI output.
 */
export const mock: ImageProvider = {
  id: "mock",
  supportsMask: true,
  async edit(req: EditRequest): Promise<EditResult> {
    await new Promise((r) => setTimeout(r, 800));
    const scene = await sandboxScene(req.width, req.height, req.swatch ?? ["#f1efeb", "#cfcac2"], "SANDBOX PREVIEW: add an AI provider key for real images");
    const primary = await sharp(req.images[0]).resize(req.width, req.height, { fit: "cover" }).png().toBuffer();
    let image = scene;
    if (req.mask) {
      // Keep only the product from the canvas and drop a soft shadow under it.
      const raw1 = { raw: { width: req.width, height: req.height, channels: 1 as const } };
      const alpha = await sharp(req.mask).resize(req.width, req.height, { fit: "fill" }).ensureAlpha().extractChannel(3).toColourspace("b-w").raw().toBuffer();
      const rgb = await sharp(primary).removeAlpha().raw().toBuffer();
      const product = await sharp(rgb, { raw: { width: req.width, height: req.height, channels: 3 } }).joinChannel(alpha, raw1).png().toBuffer();
      const meta = await sharp(alpha, raw1).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true }).catch(() => null);
      const composites: OverlayOptions[] = [];
      if (meta) {
        const { trimOffsetLeft = 0, trimOffsetTop = 0, width, height } = meta.info as { trimOffsetLeft?: number; trimOffsetTop?: number; width: number; height: number };
        composites.push({ input: await contactShadow({ left: -trimOffsetLeft, top: -trimOffsetTop, width, height, canvasWidth: req.width, canvasHeight: req.height }) });
      }
      composites.push({ input: product });
      image = await sharp(scene).composite(composites).png().toBuffer();
    } else {
      const inset = await sharp(primary).resize(Math.round(req.width * 0.7), Math.round(req.height * 0.7), { fit: "inside" }).png().toBuffer();
      image = await sharp(scene).composite([{ input: inset, gravity: "centre" }]).png().toBuffer();
    }
    return { image, model: "sandbox", costUsd: 0 };
  },
};

export function getProvider(id: ProviderId, settings: ProviderSettings): ImageProvider {
  switch (id) {
    case "gemini": return gemini;
    case "openai": return openaiProvider({ models: settings.openai.models, quality: settings.openai.quality, legacyQuality: settings.openai.legacyQuality, prices: settings.openai.prices });
    case "fal": return fal;
    default: return mock;
  }
}

export function modelFor(id: ProviderId, settings: ProviderSettings): string {
  switch (id) {
    case "gemini": return settings.gemini.model;
    case "openai": return settings.openai.model;
    case "fal": return settings.fal.model;
    default: return "sandbox";
  }
}

export function isConfigured(id: ProviderId): boolean {
  return id === "mock" || integrations[id];
}

/** Ordered list of providers to try for a generation. */
export function providerChain(settings: ProviderSettings): ProviderId[] {
  // OpenAI first by default. Admin can pin another provider in settings.
  const configured = (["openai", "gemini", "fal"] as ProviderId[]).filter(isConfigured);
  const primary =
    settings.generation !== "auto" && isConfigured(settings.generation)
      ? [settings.generation, ...configured.filter((p) => p !== settings.generation)]
      : configured;
  const chain = [...new Set(primary)];
  if (settings.fallback !== "none" && isConfigured(settings.fallback) && !chain.includes(settings.fallback)) {
    // The sandbox is only a fallback when no real provider is configured at all.
    if (settings.fallback !== "mock" || chain.length === 0) chain.push(settings.fallback);
  }
  if (chain.length === 0) chain.push("mock");
  return chain;
}

export { ProviderError };
