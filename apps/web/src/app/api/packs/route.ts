import { json, publicHandler } from "@/lib/api";
import { admin } from "@/lib/supabase";

export const GET = publicHandler(async (req) => {
  const channel = new URL(req.url).searchParams.get("channel") ?? "web";
  if (!["web", "shopify", "ios", "android"].includes(channel)) return json({ error: "Unknown channel" }, 400);
  const { data } = await admin().from("pricing_packs").select("id, code, name, credits, price_minor, currency, store_product_id, badge, sort").eq("channel", channel).eq("active", true).order("sort");
  return { packs: data ?? [] };
});
