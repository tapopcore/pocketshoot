import { verifyMedia } from "@/lib/media";
import { admin } from "@/lib/supabase";

export const maxDuration = 30;

/** Serves a resized WebP of a private photo behind a stable signed link (see lib/media.ts). */
export async function GET(req: Request, { params }: { params: Promise<{ bucket: string; key: string[] }> }) {
  const { bucket, key: parts } = await params;
  const key = parts.map((x) => { try { return decodeURIComponent(x); } catch { return x; } }).join("/");
  const u = new URL(req.url);
  const w = Number(u.searchParams.get("w")), e = Number(u.searchParams.get("e")), s = u.searchParams.get("s") ?? "";
  if (!verifyMedia(bucket, key, w, e, s)) return new Response("Not found", { status: 404 });
  const { data, error } = await admin().storage.from(bucket).download(key);
  if (error || !data) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const input = Buffer.from(await data.arrayBuffer());
  let body: Buffer, type = "image/webp";
  try {
    const sharp = (await import("sharp")).default;
    body = await sharp(input, { failOn: "none" }).rotate().resize({ width: w, height: w, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 3 }).toBuffer();
  } catch {
    body = input; type = data.type || "application/octet-stream";
  }
  const age = Math.max(60, Math.floor(e - Date.now() / 1000));
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": type,
      "cache-control": `public, max-age=${age}, s-maxage=${age}, immutable`,
      "x-content-type-options": "nosniff",
    },
  });
}
