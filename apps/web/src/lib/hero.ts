import "server-only";
import { admin } from "./supabase";
import { signedUrls } from "./storage";

export interface HeroState {
  status: "pending" | "processing" | "ready" | "failed";
  /** Retouched product on white. */
  previewUrl: string | null;
  /** Transparent cut-out. */
  cutoutUrl: string | null;
  originalUrl: string | null;
  method: string | null;
}

export async function heroState(assetId: string): Promise<HeroState> {
  const { data } = await admin().from("product_assets").select("storage_key, cutout_key, metadata").eq("id", assetId).single();
  const meta = (data?.metadata ?? {}) as { heroStatus?: string; heroPreviewKey?: string; cutoutMethod?: string; heroStartedAt?: number };
  const hasCut = !!data?.cutout_key && data.cutout_key !== "none";
  const urls = await signedUrls("originals", [data?.storage_key ?? "", meta.heroPreviewKey ?? "", hasCut ? data!.cutout_key! : ""], 3600);
  const status: HeroState["status"] = hasCut ? "ready" : meta.heroStatus === "processing" ? "processing" : data?.cutout_key === "none" ? "failed" : "pending";
  return {
    status,
    previewUrl: meta.heroPreviewKey ? urls[meta.heroPreviewKey] ?? null : null,
    cutoutUrl: hasCut ? urls[data!.cutout_key!] ?? null : null,
    originalUrl: data?.storage_key ? urls[data.storage_key] ?? null : null,
    method: meta.cutoutMethod ?? null,
  };
}
