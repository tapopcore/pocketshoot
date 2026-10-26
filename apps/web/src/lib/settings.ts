import "server-only";
import { DEFAULT_POLICY, DEFAULT_THRESHOLDS, type CreditPolicy, type QualityThresholds } from "@packshot/core";
import { admin } from "./supabase";

export interface ProviderSettings {
  generation: "auto" | "gemini" | "openai" | "fal" | "mock";
  fallback: "gemini" | "openai" | "fal" | "mock" | "none";
  gemini: { model: string; judgeModel: string };
  openai: { model: string; quality: "low" | "medium" | "high" | "auto" };
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
    generation: "auto",
    fallback: "mock",
    gemini: { model: "gemini-2.5-flash-image", judgeModel: "gemini-2.5-flash" },
    openai: { model: "gpt-image-2", quality: "high" },
    fal: { model: "fal-ai/flux-pro/kontext", segmentModel: "fal-ai/birefnet" },
    costUsdPerImage: { gemini: 0.039, openai: 0.17, fal: 0.04, mock: 0 },
    concurrency: 4,
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
    merged[row.key] = base && typeof base === "object" ? { ...(base as object), ...(row.value as object) } : row.value;
  }
  cache = { at: Date.now(), value: merged as unknown as Settings };
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
