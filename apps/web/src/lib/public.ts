import "server-only";
import { admin } from "./supabase";
import { signedUrls } from "./storage";

export interface PublicPack { id: string; code: string; name: string; credits: number; price_minor: number; currency: string; badge: string | null }

/** Launch prices from the spec, shown if the database can't be reached at build time. */
const FALLBACK: PublicPack[] = [
  { id: "starter", code: "starter", name: "Starter", credits: 5, price_minor: 49900, currency: "INR", badge: null },
  { id: "creator", code: "creator", name: "Creator", credits: 15, price_minor: 119900, currency: "INR", badge: null },
  { id: "brand", code: "brand", name: "Brand", credits: 40, price_minor: 279900, currency: "INR", badge: "Most picked" },
  { id: "business", code: "business", name: "Business", credits: 100, price_minor: 599900, currency: "INR", badge: null },
  { id: "agency", code: "agency", name: "Agency", credits: 250, price_minor: 1249900, currency: "INR", badge: "Lowest per image" },
];

export async function webPacks(): Promise<PublicPack[]> {
  try {
    const { data, error } = await admin().from("pricing_packs").select("id, code, name, credits, price_minor, currency, badge").eq("channel", "web").eq("active", true).order("sort");
    if (error || !data?.length) return FALLBACK;
    return data;
  } catch {
    return FALLBACK;
  }
}

export interface Showcase { assetId: string; caption: string; category: string; url?: string }

/** Real customer images an admin has chosen to show, with the customer's permission. */
export async function showcase(): Promise<Showcase[]> {
  try {
    const { data } = await admin().from("app_settings").select("value").eq("key", "showcase").maybeSingle();
    const items = ((data?.value as { items?: Showcase[] })?.items ?? []).slice(0, 24);
    if (!items.length) return [];
    const { data: assets } = await admin().from("generated_assets").select("id, storage_key").in("id", items.map((i) => i.assetId));
    const keys = new Map((assets ?? []).map((a) => [a.id, a.storage_key]));
    const urls = await signedUrls("outputs", [...keys.values()], 3600);
    return items.filter((i) => keys.has(i.assetId)).map((i) => ({ ...i, url: urls[keys.get(i.assetId)!] }));
  } catch {
    return [];
  }
}
