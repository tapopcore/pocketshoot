import "server-only";
import sharp from "sharp";
import { maskedCorrelation, type ShotDirection } from "@packshot/core";
import type { Cutout } from "./images";
import { customSize } from "./providers/openai";

export interface Place {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the product goes in the final frame, following the shot direction. */
export function layoutProduct(cut: Cutout, W: number, H: number, shot: Pick<ShotDirection, "product_scale" | "offset_x" | "baseline">): Place {
  const { width: bw, height: bh } = cut.bbox;
  let s = (shot.product_scale * Math.min(W, H)) / Math.max(bw, bh);
  s = Math.min(s, (W * 0.9) / bw, (H * 0.88) / bh);
  const width = Math.max(1, Math.round(bw * s)), height = Math.max(1, Math.round(bh * s));
  const left = Math.round(Math.min(Math.max((W - width) / 2 + shot.offset_x * W, W * 0.04), W - width - W * 0.04));
  const top = Math.round(Math.min(Math.max(H * shot.baseline - height, H * 0.04), H - height - H * 0.02));
  return { left, top, width, height };
}

/** Product crop with cleaned edges (removes the thin halo of the old background). */
async function productLayer(cut: Cutout, w: number, h: number): Promise<Buffer> {
  const crop = await sharp(cut.png).extract(cut.bbox).resize(w, h, { fit: "fill", kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = crop.data;
  for (let i = 3; i < px.length; i += 4) {
    const a = px[i];
    px[i] = a <= 40 ? 0 : a >= 225 ? 255 : Math.round(((a - 40) / 185) * 255);
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/**
 * The canvas sent to the image model: the product placed on neutral grey at render size,
 * and a mask that lets the model paint everything except the product.
 */
export async function renderCanvas(cut: Cutout, place: Place, W: number, H: number, renderEdge: number) {
  const r = Math.min(1, renderEdge / Math.max(W, H));
  const { width: rw, height: rh } = customSize(Math.round(W * r), Math.round(H * r));
  const sx = rw / W, sy = rh / H;
  const rp: Place = { left: Math.round(place.left * sx), top: Math.round(place.top * sy), width: Math.max(1, Math.round(place.width * sx)), height: Math.max(1, Math.round(place.height * sy)) };
  const product = await productLayer(cut, rp.width, rp.height);
  const canvas = await sharp({ create: { width: rw, height: rh, channels: 3, background: "#d6d4d0" } })
    .composite([{ input: product, left: rp.left, top: rp.top }]).png().toBuffer();
  const layer = await sharp({ create: { width: rw, height: rh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: product, left: rp.left, top: rp.top }]).png().toBuffer();
  // Mask: alpha 0 = model may paint; opaque = keep. Hard edge so the model doesn't half-repaint the outline.
  const alpha = await sharp(layer).extractChannel(3).threshold(128).toColourspace("b-w").raw().toBuffer();
  const mask = await sharp(Buffer.alloc(rw * rh * 3), { raw: { width: rw, height: rh, channels: 3 } })
    .joinChannel(alpha, { raw: { width: rw, height: rh, channels: 1 } }).png().toBuffer();
  return { canvas, mask, renderWidth: rw, renderHeight: rh, renderPlace: rp };
}

interface Grey { data: Buffer; w: number; h: number }

async function greyOf(img: Buffer, w: number, h: number): Promise<Grey> {
  return { data: await sharp(img).resize(w, h, { fit: "fill" }).flatten({ background: "#808080" }).greyscale().raw().toBuffer(), w, h };
}

/** Masked correlation of a product patch against the scene at (x, y), all in the small search space. */
function scoreAt(scene: Grey, patch: Grey, alpha: Buffer, x: number, y: number): number {
  if (x < 0 || y < 0 || x + patch.w > scene.w || y + patch.h > scene.h) return 0;
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let j = 0; j < patch.h; j++) {
    const row = (y + j) * scene.w + x, prow = j * patch.w;
    for (let i = 0; i < patch.w; i++) {
      if (alpha[prow + i] < 200) continue;
      const va = scene.data[row + i], vb = patch.data[prow + i];
      n++; sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
    }
  }
  if (n < 20) return 0;
  const cov = sab / n - (sa / n) * (sb / n);
  const den = Math.sqrt(Math.max(1e-6, (saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2)));
  return Math.max(0, cov / den);
}

/**
 * Finds the product in the generated image near where it was placed. Image models
 * sometimes nudge or rescale the product slightly; we search small shifts and scales
 * so the real pixels can still go back exactly on top.
 */
async function register(scenePng: Buffer, layer: Buffer, p: Place, W: number, H: number): Promise<{ place: Place; score: number }> {
  const f = Math.min(1, 96 / Math.max(p.width, p.height));
  const scene = await greyOf(scenePng, Math.max(8, Math.round(W * f)), Math.max(8, Math.round(H * f)));
  let best = { place: p, score: 0 };
  for (const s of [1, 0.97, 1.03, 0.94, 1.06, 0.9, 1.1]) {
    const pw = Math.max(4, Math.round(p.width * f * s)), ph = Math.max(4, Math.round(p.height * f * s));
    const patch = await greyOf(layer, pw, ph);
    const alpha = await sharp(layer).resize(pw, ph, { fit: "fill" }).ensureAlpha().extractChannel(3).raw().toBuffer();
    const cx = (p.left + p.width / 2) * f, by = (p.top + p.height) * f;
    const R = Math.max(3, Math.round(Math.max(pw, ph) * 0.12));
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const x = Math.round(cx - pw / 2 + dx), y = Math.round(by - ph + dy);
        const score = scoreAt(scene, patch, alpha, x, y);
        if (score > best.score) best = { score, place: { left: Math.round(x / f), top: Math.round(y / f), width: Math.round(p.width * s), height: Math.round(p.height * s) } };
      }
    }
    if (s === 1 && best.score >= 0.93) break;
  }
  // Snap back to the exact intended placement when it is as good as the best found.
  const exact = scoreAt(scene, await greyOf(layer, Math.max(4, Math.round(p.width * f)), Math.max(4, Math.round(p.height * f))), await sharp(layer).resize(Math.max(4, Math.round(p.width * f)), Math.max(4, Math.round(p.height * f)), { fit: "fill" }).ensureAlpha().extractChannel(3).raw().toBuffer(), Math.round(p.left * f), Math.round(p.top * f));
  if (exact >= best.score - 0.02) best = { place: p, score: exact };
  best.place.left = Math.min(Math.max(0, best.place.left), W - best.place.width);
  best.place.top = Math.min(Math.max(0, best.place.top), H - best.place.height);
  return best;
}

/**
 * Upscales the model's scene to the final size and puts the real product pixels back,
 * at full resolution, exactly where the model left the product.
 * Returns recomposited=false when the model moved the product too far to restore safely.
 */
export async function finishComposite(generated: Buffer, cut: Cutout, place: Place, W: number, H: number, minScore: number) {
  const scene = await sharp(generated).removeAlpha().resize(W, H, { fit: "fill", kernel: "lanczos3" }).sharpen({ sigma: 0.6 }).png().toBuffer();
  const layer = await productLayer(cut, place.width, place.height);
  const reg = await register(scene, layer, place, W, H);
  if (reg.score < minScore) return { image: scene, alignment: reg.score, recomposited: false, place: reg.place };
  const finalLayer = reg.place.width === place.width ? layer : await productLayer(cut, reg.place.width, reg.place.height);
  const image = await sharp(scene).composite([{ input: finalLayer, left: reg.place.left, top: reg.place.top }]).png().toBuffer();
  return { image, alignment: reg.score, recomposited: true, place: reg.place };
}

/**
 * Builds a cut-out that uses the customer's real pixels with the alpha from a model's
 * transparent-background render. Where the model changed things (for example fingers
 * removed from in front of the product), the model's pixels are used instead.
 */
export async function blendModelCutout(source: Buffer, modelRgba: Buffer): Promise<{ png: Buffer; realShare: number; alignment: number } | null> {
  const meta = await sharp(source).metadata();
  const W = meta.width!, H = meta.height!;
  const [src, mod] = await Promise.all([
    sharp(source).removeAlpha().raw().toBuffer(),
    sharp(modelRgba).ensureAlpha().resize(W, H, { fit: "fill" }).raw().toBuffer(),
  ]);
  // Global alignment check on a small version.
  const N = 64;
  const [a, b, m] = await Promise.all([
    sharp(source).resize(N, N, { fit: "fill" }).greyscale().raw().toBuffer(),
    sharp(modelRgba).resize(N, N, { fit: "fill" }).flatten({ background: "#808080" }).greyscale().raw().toBuffer(),
    sharp(modelRgba).resize(N, N, { fit: "fill" }).ensureAlpha().extractChannel(3).raw().toBuffer(),
  ]);
  const alignment = Math.max(0, maskedCorrelation(a, b, m));
  const out = Buffer.alloc(W * H * 4);
  let inside = 0, real = 0;
  for (let i = 0; i < W * H; i++) {
    const al = mod[i * 4 + 3];
    out[i * 4 + 3] = al;
    if (al < 8) continue;
    inside++;
    const dr = src[i * 3] - mod[i * 4], dg = src[i * 3 + 1] - mod[i * 4 + 1], db = src[i * 3 + 2] - mod[i * 4 + 2];
    const diff = Math.sqrt(dr * dr + dg * dg + db * db);
    const useReal = alignment >= 0.75 && diff < 70;
    if (useReal) real++;
    out[i * 4] = useReal ? src[i * 3] : mod[i * 4];
    out[i * 4 + 1] = useReal ? src[i * 3 + 1] : mod[i * 4 + 1];
    out[i * 4 + 2] = useReal ? src[i * 3 + 2] : mod[i * 4 + 2];
  }
  if (inside < W * H * 0.01) return null;
  return { png: await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), realShare: real / inside, alignment };
}
