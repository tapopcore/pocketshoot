import sharp from "sharp";
import { getApiContext } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const dl = u.searchParams.get("dl") === "1";
  // Saved and shared photos go out at twice the size (about 2048 x 2560), so WhatsApp and printing treat them as HD.
  const out = small ? await sharp(data).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    : dl ? await hd(data) : data;
  const headers: Record<string, string> = { "content-type": small ? "image/webp" : "image/jpeg", "cache-control": dl || !u.searchParams.get("take") ? "private, no-store" : "private, max-age=86400", "x-content-type-options": "nosniff" };
  if (dl) headers["content-disposition"] = `attachment; filename="baby-shoot-${p!.theme_id}-${p!.idx + 1}.jpg"`;
  return new Response(new Uint8Array(out), { headers });
}

async function hd(src: Buffer) {
  const img = sharp(src);
  const m = await img.metadata();
  const long = Math.max(m.width ?? 0, m.height ?? 0);
  if (long >= 2400) return src;
  const scale = 2560 / Math.max(1, long);
  return img.resize({ width: Math.round((m.width ?? 1024) * scale), kernel: "lanczos3" })
    .sharpen({ sigma: 0.7, m1: 0.6, m2: 1.2 })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .withMetadata({ density: 300 })
    .toBuffer();
}
