import "server-only";
import { createHmac } from "node:crypto";
import { env } from "./env";
import { safeEqual } from "./crypto";

/**
 * Stable, cacheable links for private photos.
 *
 * Signed storage links change on every page load, so browsers and the CDN could never cache a
 * photo and every visit downloaded every image again. These links stay the same for a week:
 * the browser keeps the photo, the CDN serves it, and nothing is downloaded twice.
 * A link only works with its signature and expires after its window, like a signed URL.
 */
export const MEDIA_WIDTHS = [256, 384, 640, 828, 1080, 1600] as const;
export type MediaWidth = (typeof MEDIA_WIDTHS)[number];
export const MEDIA_BUCKETS = ["outputs", "originals", "brand"] as const;
export type MediaBucket = (typeof MEDIA_BUCKETS)[number];

const WEEK = 7 * 86400;

function secret() {
  const base = env.supabaseServiceKey || env.cronSecret || "";
  if (!base) throw new Error("Media signing is not configured");
  return createHmac("sha256", base).update("pocketshoot-media-v1").digest();
}

function sign(bucket: string, key: string, w: number, e: number) {
  return createHmac("sha256", secret()).update(`${bucket}\n${key}\n${w}\n${e}`).digest("base64url").slice(0, 32);
}

/** Expiry aligned to the week, so the same photo keeps the same link for at least a week. */
function expiry(now = Date.now()) {
  return (Math.floor(now / 1000 / WEEK) + 2) * WEEK;
}

export function mediaWidth(w: number): MediaWidth {
  return MEDIA_WIDTHS.find((x) => x >= w) ?? 1600;
}

export function mediaUrl(bucket: MediaBucket, key: string, width: number): string {
  const w = mediaWidth(width), e = expiry();
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `/media/${bucket}/${path}?w=${w}&e=${e}&s=${sign(bucket, key, w, e)}`;
}

export function verifyMedia(bucket: string, key: string, w: number, e: number, s: string): boolean {
  if (!(MEDIA_BUCKETS as readonly string[]).includes(bucket)) return false;
  if (!(MEDIA_WIDTHS as readonly number[]).includes(w)) return false;
  if (!Number.isFinite(e) || e * 1000 < Date.now()) return false;
  return safeEqual(sign(bucket, key, w, e), s);
}
