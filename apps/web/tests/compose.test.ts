import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { localCutout, normalizeUpload } from "@/lib/images";
import { blendModelCutout, finishComposite, layoutProduct, renderCanvas } from "@/lib/compose";
import { customSize } from "@/lib/providers/openai";

async function productPhoto(w = 1200, h = 1600) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="#e4e2de"/>
    <rect x="${w * 0.3}" y="${h * 0.2}" width="${w * 0.4}" height="${h * 0.62}" rx="40" fill="#1d3b2a"/>
    <rect x="${w * 0.3}" y="${h * 0.38}" width="${w * 0.4}" height="${h * 0.22}" fill="#c0392b"/>
    <rect x="${w * 0.36}" y="${h * 0.43}" width="${w * 0.28}" height="${h * 0.03}" fill="#fff"/>
  </svg>`;
  return (await normalizeUpload(await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer())).buffer;
}

describe("GPT Image sizes", () => {
  it("snaps to multiples of 16 within the pixel limits", () => {
    for (const [w, h] of [[2048, 2048], [1632, 2048], [576, 1024], [2560, 1088], [1536, 864]]) {
      const s = customSize(w, h);
      expect(s.width % 16).toBe(0);
      expect(s.height % 16).toBe(0);
      expect(s.width * s.height).toBeGreaterThanOrEqual(655_360);
      expect(s.width * s.height).toBeLessThanOrEqual(8_294_400);
      expect(Math.abs(s.width / s.height - w / h)).toBeLessThan(0.05);
    }
  });
});

describe("composite with real pixels", () => {
  it("finds the product even when the model nudged it, and restores exact pixels", async () => {
    const cut = (await localCutout(await productPhoto()))!;
    const W = 2048, H = 2048;
    const place = layoutProduct(cut, W, H, { product_scale: 0.6, offset_x: 0.05, baseline: 0.85 });
    const rc = await renderCanvas(cut, place, W, H, 1024);
    expect(rc.renderWidth % 16).toBe(0);
    // Simulate a model that painted a new scene and shifted the product by a few pixels.
    const productOnly = await sharp(rc.canvas).composite([{ input: await sharp(rc.mask).negate({ alpha: false }).png().toBuffer(), blend: "dest-in" }]).png().toBuffer();
    const scene = await sharp({ create: { width: rc.renderWidth, height: rc.renderHeight, channels: 3, background: "#f3e9dc" } })
      .composite([{ input: productOnly, left: 6, top: -4 }]).png().toBuffer();
    const out = await finishComposite(scene, cut, place, W, H, 0.6);
    expect(out.recomposited).toBe(true);
    expect(out.alignment).toBeGreaterThan(0.8);
    expect(Math.abs(out.place.left - place.left)).toBeLessThan(40);
    const meta = await sharp(out.image).metadata();
    expect([meta.width, meta.height]).toEqual([W, H]);
  });

  it("refuses to restore when the product is gone", async () => {
    const cut = (await localCutout(await productPhoto()))!;
    const place = layoutProduct(cut, 1024, 1024, { product_scale: 0.6, offset_x: 0, baseline: 0.85 });
    const empty = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#808080" } }).png().toBuffer();
    const noisy = await sharp(empty).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><circle cx="200" cy="200" r="150" fill="#123"/></svg>`) }]).png().toBuffer();
    const out = await finishComposite(noisy, cut, place, 1024, 1024, 0.6);
    expect(out.recomposited).toBe(false);
  });

  it("blends a model cut-out with the real pixels", async () => {
    const photo = await productPhoto();
    const cut = (await localCutout(photo))!;
    // A "model" render: the same product with a transparent background, slightly different colours.
    const modelRgba = await sharp(cut.png).modulate({ brightness: 1.03 }).png().toBuffer();
    const b = await blendModelCutout(photo, modelRgba);
    expect(b).not.toBeNull();
    expect(b!.alignment).toBeGreaterThan(0.75);
    expect(b!.realShare).toBeGreaterThan(0.9);
  });
});
