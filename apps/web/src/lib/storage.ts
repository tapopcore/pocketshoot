import "server-only";
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

export async function signedUrls(bucket: Bucket, keys: string[], seconds = 600): Promise<Record<string, string>> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await admin().storage.from(bucket).createSignedUrls(unique, seconds);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}

/** Signed upload URL so browsers and phones upload straight to private storage. */
export async function signedUpload(bucket: Bucket, key: string) {
  const { data, error } = await admin().storage.from(bucket).createSignedUploadUrl(key);
  if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
  return { url: data.signedUrl, token: data.token, path: data.path };
}
