import "server-only";
import { unstable_cache } from "next/cache";
import { admin } from "./supabase";

export type Bucket = "uploads" | "originals" | "outputs" | "brand" | "public";

export function publicUrl(key: string) {
  return admin().storage.from("public").getPublicUrl(key).data.publicUrl;
}

export async function putObject(bucket: Bucket, key: string, data: Buffer, contentType: string) {
  const { error } = await admin().storage.from(bucket).upload(key, data, { contentType, upsert: true, cacheControl: "3600" });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function getObject(bucket: Bucket, key: string): Promise<Buffer> {
  const { data, error } = await admin().storage.from(bucket).download(key);
  if (error || !data) throw new Error(`Storage download failed for ${bucket}/${key}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function removeObjects(bucket: Bucket, keys: string[]) {
  if (keys.length === 0) return;
  await admin().storage.from(bucket).remove(keys);
}

/** Short-lived signed URL for viewing or downloading a private object. */
export async function signedUrl(bucket: Bucket, key: string, seconds = 600, download?: string): Promise<string> {
  const { data, error } = await admin().storage.from(bucket).createSignedUrl(key, seconds, download ? { download } : undefined);
  if (error || !data) throw new Error(`Could not sign URL: ${error?.message}`);
  return data.signedUrl;
}

/**
 * Signed view URLs that stay the same for about 50 minutes, so the browser and the image
 * optimiser can cache each photo instead of downloading it again on every page load.
 */
const VIEW_TTL = 7200, REUSE = 3000;
const signOne = unstable_cache(
  async (bucket: Bucket, key: string) => {
    const { data, error } = await admin().storage.from(bucket).createSignedUrl(key, VIEW_TTL);
    if (error || !data?.signedUrl) throw new Error("sign failed"); // never cache a failure
    return data.signedUrl;
  },
  ["signed-view-v1"],
  { revalidate: REUSE },
);

/** Turns a storage URL into a resized WebP served from the Vercel image cache. */
export function sized(url: string, width: 256 | 384 | 640 | 828 | 1080 | 1200 | 1920 | 2048) {
  if (!url || url.startsWith("/") || process.env.NODE_ENV !== "production") return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=78`;
}

export async function signedUrls(bucket: Bucket, keys: string[], seconds = 600, width?: Parameters<typeof sized>[1]): Promise<Record<string, string>> {
  const unique = [...new Set(keys.filter(Boolean))].sort();
  if (unique.length === 0) return {};
  let out: Record<string, string>;
  if (seconds > VIEW_TTL - REUSE) {
    const direct = async (k: string) => (await admin().storage.from(bucket).createSignedUrl(k, VIEW_TTL)).data?.signedUrl ?? null;
    const urls = await Promise.all(unique.map((k) => signOne(bucket, k).catch(() => direct(k)).catch(() => null)));
    out = {};
    unique.forEach((k, i) => { if (urls[i]) out[k] = urls[i]!; });
  }
  else {
    const { data } = await admin().storage.from(bucket).createSignedUrls(unique, seconds);
    out = {};
    for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  if (!width) return out;
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, sized(v, width)]));
}

/** Signed upload URL so browsers and phones upload straight to private storage. */
export async function signedUpload(bucket: Bucket, key: string) {
  const { data, error } = await admin().storage.from(bucket).createSignedUploadUrl(key);
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
  return { url: data.signedUrl, token: data.token, path: data.path };
}
