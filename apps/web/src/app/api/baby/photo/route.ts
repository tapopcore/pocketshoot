import sharp from "sharp";
import { getApiContext } from "@/lib/auth";
import { getObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Serves one saved Baby Shoot photo to the workspace that made it. `w` returns a smaller WebP for grids. */
export async function GET(req: Request) {
  let ctx;
  try { ctx = await getApiContext(req); } catch { return new Response("Sign in to continue", { status: 401 }); }
  if (!ctx.platformRole) return new Response("Not found", { status: 404 });
  const u = new URL(req.url);
  const key = u.searchParams.get("key") ?? "";
  if (!key.startsWith(`baby/${ctx.orgId}/`) || !/^[\w/.-]+\.jpg$/.test(key) || key.includes("..")) return new Response("Not found", { status: 404 });
  let data: Buffer;
  try { data = await getObject("outputs", key); } catch { return new Response("Not found", { status: 404 }); }
  const w = Number(u.searchParams.get("w"));
  const small = w >= 200 && w <= 1200;
  const body = small ? await sharp(data).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer() : data;
  return new Response(new Uint8Array(body), { headers: { "content-type": small ? "image/webp" : "image/jpeg", "cache-control": "private, max-age=86400, immutable", "x-content-type-options": "nosniff" } });
}
