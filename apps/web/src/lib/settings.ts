import "server-only";
import { DEFAULT_POLICY, DEFAULT_THRESHOLDS, type CreditPolicy, type QualityThresholds } from "@packshot/core";
import { admin } from "./supabase";

export interface ProviderSettings {
  generation: "auto" | "gemini" | "openai" | "fal" | "mock";
  fallback: "gemini" | "openai" | "fal" | "mock" | "none";
  gemini: { model: string; judgeModel: string };
  openai: {
    model: string;
    /** Fallback order if a model isn't available on the account. */
    models: string[];
    quality: "low" | "medium" | "high" | "xhigh" | "max" | "auto";
    legacyQuality: "low" | "medium" | "high";
    /** USD per 1M tokens, for cost tracking. */
    prices: Record<string, { input: number; output: number }>;
  };
  /** Small text/vision model for product analysis, art direction and accuracy checks. */
  llm: { models: string[] };
  /** Long edge the model renders at. Final images are upscaled with the real product composited at full resolution. */
  render: { trialEdge: number; paidEdge: number; cutoutQuality: "low" | "medium" | "high" };
  fal: { model: string; segmentModel: string };
  costUsdPerImage: Record<string, number>;
  concurrency: number;
  timeoutMs: number;
}

export interface SellerSettings {
  legalName: string;
  tradeName: string;
  gstin: string;
  stateCode: string;
  address: string;
  email: string;
  phone: string;
  sacCode: string;
  gstRatePercent: number;
  invoicePrefix: string;
  exportUnderLut: boolean;
  note?: string;
}

export interface Settings {
  credit_policy: CreditPolicy;
  providers: ProviderSettings;
  quality: QualityThresholds & { useJudge: boolean };
  seller: SellerSettings;
  shopify_billing: { test: boolean };
  fx_fallback: { USDINR: number };
  retention: { originalsDays: number; outputsDays: number; failedDays: number };
}

const DEFAULTS: Settings = {
  credit_policy: DEFAULT_POLICY,
  providers: {
    generation: "openai",
    fallback: "mock",
    gemini: { model: "gemini-2.5-flash-image", judgeModel: "gemini-2.5-flash" },
    openai: {
      model: "gpt-image-2.5-sunburst",
      models: ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"],
      quality: "high",
      legacyQuality: "medium",
      prices: {
        "gpt-image-2.5-sunburst": { input: 8, output: 30 },
        "gpt-image-2.5-flare": { input: 8, output: 30 },
        "gpt-image-2": { input: 10, output: 30 },
        default: { input: 10, output: 40 },
      },
    },
    llm: { models: ["gpt-5-mini", "gpt-4.1-mini"] },
    render: { trialEdge: 1024, paidEdge: 1536, cutoutQuality: "medium" },
    fal: { model: "fal-ai/flux-pro/kontext", segmentModel: "fal-ai/birefnet" },
    costUsdPerImage: { gemini: 0.039, openai: 0.06, fal: 0.04, mock: 0 },
    concurrency: 2,
    timeoutMs: 120_000,
  },
  quality: { ...DEFAULT_THRESHOLDS, useJudge: true },
  seller: {
    legalName: "", tradeName: "PocketShoot", gstin: "", stateCode: "07", address: "", email: "", phone: "",
    sacCode: "998399", gstRatePercent: 18, invoicePrefix: "PS", exportUnderLut: false,
  },
  shopify_billing: { test: true },
  fx_fallback: { USDINR: 88 },
  retention: { originalsDays: 365, outputsDays: 365, failedDays: 30 },
};

let cache: { at: number; value: Settings } | null = null;

export async function getSettings(fresh = false): Promise<Settings> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.value;
  const { data } = await admin().from("app_settings").select("key, value");
  const merged = structuredClone(DEFAULTS) as unknown as Record<string, unknown>;
  for (const row of data ?? []) {
    const base = merged[row.key];
    merged[row.key] = base && typeof base === "object" ? deepMerge(base as Record<string, unknown>, row.value as Record<string, unknown>) : row.value;
  }
  // Production guardrails apply even to persisted admin settings from older releases.
  // Do not silently fall back to a different image model family that may have different costs.
  const safe = merged as unknown as Settings;
  safe.providers.concurrency = Math.max(1, Math.min(2, Number(safe.providers.concurrency) || 1));
  const allowed = /^gpt-image-2\\.5-(sunburst|flare)(-\\d{4}-\\d{2}-\\d{2})?$/;
  if (!allowed.test(safe.providers.openai.model)) safe.providers.openai.model = "gpt-image-2.5-sunburst";
  safe.providers.openai.models = [...new Set([safe.providers.openai.model, ...safe.providers.openai.models.filter((m) => allowed.test(m))])];
  cache = { at: Date.now(), value: safe };
  return cache.value;
}

export async function saveSetting<K extends keyof Settings>(key: K, value: Settings[K], actor: string | null) {
  await admin().from("app_settings").upsert({ key, value, updated_by: actor, updated_at: new Date().toISOString() });
  cache = null;
}

export async function getFlag(key: string, orgId?: string): Promise<boolean> {
  const { data } = await admin().from("feature_flags").select("scope, value").eq("key", key).in("scope", orgId ? ["global", orgId] : ["global"]);
  const org = data?.find((r) => r.scope === orgId);
  const global = data?.find((r) => r.scope === "global");
  return Boolean((org ?? global)?.value ?? false);
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    const cur = out[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur) ? deepMerge(cur as Record<string, unknown>, v as Record<string, unknown>) : v;
  }
  return out;
}
