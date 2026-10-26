import sharp from "sharp";
import { json, publicHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual, sha256 } from "@/lib/crypto";
import { admin } from "@/lib/supabase";
import { getObject } from "@/lib/storage";

/**
 * Operator quality review: returns a small preview of one generated image.
 * Authorised by sha256(CRON_SECRET + ":" + assetId), so the secret itself never appears in a URL.
 */
export const GET = publicHandler(async (req) => {
  const u = new URL(req.url);
  const asset = u.searchParams.get("asset") ?? "";
  const token = u.searchParams.get("token") ?? "";
  if (!env.cronSecret || !/^[0-9a-f-]{36}$/.test(asset) || !safeEqual(token, sha256(`${env.cronSecret}:${asset}`))) return json({ error: "unauthorized" }, 401);
  const { data } = await admin().from("generated_assets").select("storage_key").eq("id", asset).maybeSingle();
  if (!data) return json({ error: "not found" }, 404);
  const w = Math.min(1024, Math.max(128, Number(u.searchParams.get("w") ?? 512)));
  const img = await sharp(await getObject("outputs", data.storage_key)).resize(w, w, { fit: "inside" }).webp({ quality: 72 }).toBuffer();
  return { b64: img.toString("base64") };
});
