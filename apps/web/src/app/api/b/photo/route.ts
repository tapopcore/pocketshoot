import sharp from "sharp";
import { getApiContext } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** One finished photo, for its owner only. `w` gives a smaller WebP for grids; `dl=1` downloads the full JPEG. */
export async function GET(req: Request) {
  let ctx; try { ctx = await getApiContext(req); } catch { return new Response("Sign in to continue", { status: 401 }); }
  const u = new URL(req.url);
  const { data: p } = await admin().from("baby_photos").select("storage_key, first_key, kept, theme_id, idx").eq("id", u.searchParams.get("id") ?? "").eq("organization_id", ctx.orgId).maybeSingle();
  const key = p ? (u.searchParams.get("take") === "first" ? p.first_key : u.searchParams.get("take") === "new" ? p.storage_key : (p.kept === "first" && p.first_key) || p.storage_key) : null;
  if (!key) return new Response("Not found", { status: 404 });
  let data: Buffer; try { data = await getObject("outputs", key); } catch { return new Response("Not found", { status: 404 }); }
  const w = Number(u.searchParams.get("w"));
  const small = w >= 200 && w <= 1400;
  const out = small ? await sharp(data).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer() : data;
  const headers: Record<string, string> = { "content-type": small ? "image/webp" : "image/jpeg", "cache-control": "private, max-age=86400", "x-content-type-options": "nosniff" };
  if (u.searchParams.get("dl") === "1") headers["content-disposition"] = `attachment; filename="baby-shoot-${p!.theme_id}-${p!.idx + 1}.jpg"`;
  return new Response(new Uint8Array(out), { headers });
}
