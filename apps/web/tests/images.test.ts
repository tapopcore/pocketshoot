/**
 * Exercises the real image pipeline (no network): validation, background
 * removal, placement, sandbox generation and pixel re-composite.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { OUTPUTS } from "@packshot/core";
import { ImageRejected, encodeFor, localCutout, normalizeUpload, placeOnCanvas, recomposite, isBlank } from "@/lib/images";
import { mock } from "@/lib/providers";

/** A fake product photo: a dark bottle with a red label and white "text" bars on a light grey table. */
async function productPhoto(w = 1200, h = 1600) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="#e4e2de"/>
    <rect x="${w * 0.35}" y="${h * 0.12}" width="${w * 0.3}" height="${h * 0.08}" rx="12" fill="#222"/>
    <rect x="${w * 0.3}" y="${h * 0.2}" width="${w * 0.4}" height="${h * 0.62}" rx="40" fill="#1d3b2a"/>
    <rect x="${w * 0.3}" y="${h * 0.38}" width="${w * 0.4}" height="${h * 0.22}" fill="#c0392b"/>
    <rect x="${w * 0.36}" y="${h * 0.43}" width="${w * 0.28}" height="${h * 0.03}" fill="#fff"/>
    <rect x="${w * 0.38}" y="${h * 0.5}" width="${w * 0.24}" height="${h * 0.02}" fill="#fff"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

describe("upload validation", () => {
  it("accepts a real photo and strips metadata", async () => {
    const withExif = await sharp(await productPhoto()).withMetadata({ exif: { IFD0: { Copyright: "secret" } } }).jpeg().toBuffer();
    const out = await normalizeUpload(withExif);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(out.width).toBe(1200);
    expect(out.checksum).toHaveLength(64);
  });
  it("rejects non-images, tiny and blank images", async () => {
    await expect(normalizeUpload(Buffer.from("not an image at all"))).rejects.toBeInstanceOf(ImageRejected);
    const tiny = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#ff0000" } }).png().toBuffer();
    await expect(normalizeUpload(tiny)).rejects.toThrow(/too small/);
    const blank = await sharp({ create: { width: 900, height: 900, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await expect(normalizeUpload(blank)).rejects.toThrow(/blank/);
  });
});

describe("preserve pipeline", () => {
  it("cuts out the product, places it, and keeps its pixels exact after generation", async () => {
    const photo = (await normalizeUpload(await productPhoto())).buffer;
    const cut = await localCutout(photo);
    expect(cut).not.toBeNull();
    // bottle spans x 30%..70%, y 12%..82%
    expect(cut!.bbox.left).toBeGreaterThan(1200 * 0.25);
    expect(cut!.bbox.left + cut!.bbox.width).toBeLessThan(1200 * 0.75);
    expect(cut!.bbox.top).toBeLessThan(1600 * 0.16);

    const out = OUTPUTS.square;
    const placed = await placeOnCanvas(cut!, out, 0, 1024);
    expect(placed.placement.canvasWidth).toBe(1024);
    const gen = await mock.edit({ prompt: "x", images: [placed.canvas], mask: placed.editMask, width: 1024, height: 1024, swatch: ["#ffffff", "#dddddd"], timeoutMs: 5000 }, "sandbox");
    const rc = await recomposite(gen.image, placed.layer, placed.placement, 0.6);
    expect(rc.recomposited).toBe(true);
    expect(rc.alignment).toBeGreaterThan(0.9);
    const { width, height } = await sharp(rc.image).metadata();
    expect([width, height]).toEqual([1024, 1024]);

    // The red label pixel in the middle of the product is unchanged.
    const p = placed.placement;
    const px = async (img: Buffer) => {
      const { data } = await sharp(img).extract({ left: p.left + Math.round(p.width / 2), top: p.top + Math.round(p.height * 0.33), width: 1, height: 1 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      return [...data];
    };
    const layerPx = await px(await sharp(placed.layer).flatten({ background: "#000" }).png().toBuffer());
    expect(await px(rc.image)).toEqual(layerPx);
  });

  it("refuses to re-composite when the model moved the product", async () => {
    const photo = (await normalizeUpload(await productPhoto())).buffer;
    const cut = (await localCutout(photo))!;
    const placed = await placeOnCanvas(cut, OUTPUTS.square, 0, 768);
    const moved = await sharp({ create: { width: 768, height: 768, channels: 3, background: "#f5f0e8" } })
      .composite([{ input: await sharp(placed.layer).resize(300, 300, { fit: "inside" }).png().toBuffer(), left: 10, top: 10 }]).png().toBuffer();
    const rc = await recomposite(moved, placed.layer, placed.placement, 0.6);
    expect(rc.recomposited).toBe(false);
  });

  it("returns null for busy backgrounds instead of a bad cutout", async () => {
    const noise = await sharp(Buffer.from(Array.from({ length: 800 * 800 * 3 }, () => Math.floor(Math.random() * 255))), { raw: { width: 800, height: 800, channels: 3 } }).png().toBuffer();
    expect(await localCutout(noise)).toBeNull();
  });
});

describe("delivery helpers", () => {
  it("detects blanks and encodes formats", async () => {
    const img = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#336699" } }).png().toBuffer();
    expect(await isBlank(img)).toBe(true);
    const jpg = await encodeFor(img, "jpg", 300);
    expect(jpg.type).toBe("image/jpeg");
    expect((await sharp(jpg.data).metadata()).width).toBe(300);
  });
});
