import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { supabaseServiceKey: "test-key", cronSecret: "" } }));
import { mediaUrl, verifyMedia } from "@/lib/media";

const parse = (u: string) => {
  const url = new URL(u, "http://x");
  const [, , bucket, ...rest] = url.pathname.split("/");
  return { bucket, key: rest.map(decodeURIComponent).join("/"), w: Number(url.searchParams.get("w")), e: Number(url.searchParams.get("e")), s: url.searchParams.get("s")! };
};

describe("stable photo links", () => {
  it("are the same on every page load, so browsers can cache them", () => {
    expect(mediaUrl("outputs", "org/a/b.png", 640)).toBe(mediaUrl("outputs", "org/a/b.png", 640));
  });
  it("verify only with the right signature, size and bucket", () => {
    const p = parse(mediaUrl("outputs", "org/a/b.png", 600));
    expect(p.w).toBe(640);
    expect(verifyMedia(p.bucket, p.key, p.w, p.e, p.s)).toBe(true);
    expect(verifyMedia(p.bucket, "org/other/b.png", p.w, p.e, p.s)).toBe(false);
    expect(verifyMedia("originals", p.key, p.w, p.e, p.s)).toBe(false);
    expect(verifyMedia(p.bucket, p.key, 1600, p.e, p.s)).toBe(false);
    expect(verifyMedia("uploads", p.key, p.w, p.e, p.s)).toBe(false);
  });
  it("expire", () => {
    const p = parse(mediaUrl("outputs", "k.png", 640));
    expect(verifyMedia(p.bucket, p.key, p.w, Math.floor(Date.now() / 1000) - 10, p.s)).toBe(false);
  });
});
