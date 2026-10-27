import "server-only";
import sharp, { type Metadata } from "sharp";
import { maskedCorrelation, rgbToLab, deltaE76, type OutputPreset } from "@packshot/core";
import { sha256 } from "./crypto";

sharp.cache(false);
sharp.concurrency(2);

export const MIN_SHORT_EDGE = 500;
export const MAX_INPUT_PIXELS = 50_000_000;
const MAX_STORED_EDGE = 3072;

export class ImageRejected extends Error {}

/**
 * Validates an uploaded file by fully decoding it, fixes orientation, strips
 * all metadata (EXIF, GPS) and re-encodes. Anything that isn't a real image fails here.
 */
export async function normalizeUpload(input: Buffer) {
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new ImageRejected("This file isn't a readable image. Use JPG, PNG or WebP.");
  }
  if (meta.format === "heif") throw new ImageRejected("HEIC photos aren't supported yet. On iPhone, set Camera > Formats to 'Most Compatible', or export as JPG.");
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new ImageRejected("Use a JPG, PNG or WebP image.");
  const rotated = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
  const { data, info } = await rotated
    .resize({ width: MAX_STORED_EDGE, height: MAX_STORED_EDGE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 93, chromaSubsampling: "4:4:4" })
    .toBuffer({ resolveWithObject: true })
    .catch(() => {
      throw new ImageRejected("This image is damaged or incomplete. Try exporting it again.");
    });
  if (Math.min(info.width, info.height) < MIN_SHORT_EDGE) {
    throw new ImageRejected(`This photo is too small (${info.width}×${info.height}). Use at least ${MIN_SHORT_EDGE}px on the shorter side.`);
  }
  const stats = await sharp(data).stats();
  const spread = stats.channels.slice(0, 3).reduce((a, c) => a + c.stdev, 0) / 3;
  if (spread < 4) throw new ImageRejected("This photo looks blank. Make sure the product is visible.");
  return { buffer: data, width: info.width, height: info.height, checksum: sha256(data) };
}

export interface Cutout {
  /** RGBA PNG of the product with a soft alpha edge, same size as the source. */
  png: Buffer;
  /** Single-channel mask (0..255), same size as the source. */
  mask: Buffer;
  width: number;
  height: number;
  bbox: { left: number; top: number; width: number; height: number };
  confidence: number;
  method: "provider" | "local";
}

/**
 * Local background removal for product photos on fairly plain backgrounds.
 * Estimates the background from the border and keeps pixels that differ from it.
 * Returns null when the photo isn't suitable, so the pipeline can ask for a better one
 * or use a provider segmentation model instead.
 */
export async function localCutout(source: Buffer): Promise<Cutout | null> {
  const img = sharp(source).removeAlpha();
  const meta = await img.metadata();
  const W = meta.width!, H = meta.height!;
  const S = 384;
  const scale = S / Math.max(W, H);
  const w = Math.max(16, Math.round(W * scale)), h = Math.max(16, Math.round(H * scale));
  const small = await sharp(source).removeAlpha().resize(w, h, { fit: "fill" }).blur(1.2).raw().toBuffer();

  const border: [number, number, number][] = [];
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < band || y < band || x >= w - band || y >= h - band) {
        const i = (y * w + x) * 3;
        border.push([small[i], small[i + 1], small[i + 2]]);
      }
    }
  }
  const labs = border.map(([r, g, b]) => rgbToLab(r, g, b));
  const median = (k: 0 | 1 | 2) => labs.map((l) => l[k]).sort((a, b) => a - b)[Math.floor(labs.length / 2)];
  const bg: [number, number, number] = [median(0), median(1), median(2)];
  const borderDist = labs.map((l) => deltaE76(l, bg)).sort((a, b) => a - b);
  const p90 = borderDist[Math.floor(borderDist.length * 0.9)];
  if (p90 > 22) return null; // busy background: not suitable for local removal
  const threshold = Math.max(10, p90 * 1.8);

  const mask = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const lab = rgbToLab(small[i * 3], small[i * 3 + 1], small[i * 3 + 2]);
    mask[i] = deltaE76(lab, bg) > threshold ? 255 : 0;
  }
  // Keep the connected region touching the centre-most foreground pixels; fill holes.
  const keep = largestComponent(mask, w, h);
  const filled = fillHoles(keep, w, h);
  let area = 0, minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (filled[y * w + x]) { area++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const frac = area / (w * h);
  if (frac < 0.02 || frac > 0.92) return null;
  const touchesAll = minX <= 1 && minY <= 1 && maxX >= w - 2 && maxY >= h - 2;
  if (touchesAll) return null;

  const fullMask = await sharp(filled, { raw: { width: w, height: h, channels: 1 } })
    .resize(W, H, { fit: "fill", kernel: "cubic" })
    .blur(Math.max(0.8, Math.min(W, H) / 900))
    .threshold(150)
    .blur(Math.max(0.6, Math.min(W, H) / 1400))
    .extractChannel(0)
    .toColourspace("b-w")
    .raw()
    .toBuffer();
  const rgb = await sharp(source).removeAlpha().raw().toBuffer();
  const png = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } }).joinChannel(fullMask, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  const inv = 1 / scale;
  const confidence = Math.max(0, Math.min(1, 1 - p90 / 30));
  return {
    png, mask: fullMask, width: W, height: H, confidence, method: "local",
    bbox: {
      left: Math.max(0, Math.floor(minX * inv) - 4), top: Math.max(0, Math.floor(minY * inv) - 4),
      width: Math.min(W, Math.ceil((maxX - minX + 1) * inv) + 8), height: Math.min(H, Math.ceil((maxY - minY + 1) * inv) + 8),
    },
  };
}

function largestComponent(mask: Buffer, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0, current = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i] !== -1) continue;
    let size = 0;
    stack.push(i);
    label[i] = current;
    while (stack.length) {
      const p = stack.pop()!;
      size++;
      const x = p % w, y = (p / w) | 0;
      const n = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of n) if (q >= 0 && mask[q] && label[q] === -1) { label[q] = current; stack.push(q); }
    }
    if (size > bestSize) { bestSize = size; best = current; }
    current++;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (label[i] === best) out[i] = 255;
  return out;
}

function fillHoles(mask: Uint8Array, w: number, h: number): Uint8Array {
  // Flood the background from the border; anything not reached is foreground.
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => { if (!mask[p] && !outside[p]) { outside[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w);
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = outside[i] ? 0 : 255;
  return out;
}

/** Builds a cutout from an RGBA image returned by a segmentation provider. */
export async function cutoutFromRgba(rgbaPng: Buffer): Promise<Cutout | null> {
  const { data, info } = await sharp(rgbaPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const mask = Buffer.alloc(W * H);
  let area = 0, minX = W, minY = H, maxX = 0, maxY = 0;
  for (let i = 0; i < W * H; i++) {
    const a = data[i * 4 + 3];
    mask[i] = a;
    if (a > 127) {
      area++;
      const x = i % W, y = (i / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const frac = area / (W * H);
  if (frac < 0.01 || frac > 0.97) return null;
  return {
    png: await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(),
    mask, width: W, height: H, confidence: 0.9, method: "provider",
    bbox: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

export interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}

const HORIZONTAL_OFFSETS = [0, -0.08, 0, 0.1, 0, -0.1];

/**
 * Places the product cutout on a neutral canvas at the output size.
 * Returns the canvas (sent to the model), a product-only RGBA layer (used to put the
 * real pixels back) and an edit mask (transparent where the model may paint).
 */
export async function placeOnCanvas(cut: Cutout, output: Pick<OutputPreset, "width" | "height" | "productScale" | "baseline">, variant = 0, maxEdge?: number) {
  let W = output.width, H = output.height;
  if (maxEdge && Math.max(W, H) > maxEdge) {
    const s = maxEdge / Math.max(W, H);
    W = Math.round(W * s); H = Math.round(H * s);
  }
  const crop = await sharp(cut.png).extract(cut.bbox).png().toBuffer();
  const target = output.productScale * Math.min(W, H);
  const s = Math.min(target / Math.max(cut.bbox.width, cut.bbox.height), (W * 0.9) / cut.bbox.width, (H * 0.9) / cut.bbox.height);
  const pw = Math.max(1, Math.round(cut.bbox.width * s)), ph = Math.max(1, Math.round(cut.bbox.height * s));
  const offset = HORIZONTAL_OFFSETS[variant % HORIZONTAL_OFFSETS.length] * W;
  const left = Math.round(Math.min(Math.max((W - pw) / 2 + offset, W * 0.04), W - pw - W * 0.04));
  const top = Math.round(Math.min(Math.max(H * output.baseline - ph, H * 0.04), H - ph - H * 0.02));
  const product = await sharp(crop).resize(pw, ph, { fit: "fill" }).png().toBuffer();

  const layer = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: product, left, top }]).png().toBuffer();
  const canvas = await sharp({ create: { width: W, height: H, channels: 3, background: "#e7e5e1" } })
    .composite([{ input: product, left, top }]).png().toBuffer();
  // OpenAI-style mask: alpha 0 = area to edit (background), opaque = keep (product).
  const alpha = await sharp(layer).ensureAlpha().extractChannel(3).toColourspace("b-w").raw().toBuffer();
  const editMask = await sharp(Buffer.alloc(W * H * 3), { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
  return { canvas, layer, editMask, placement: { left, top, width: pw, height: ph, canvasWidth: W, canvasHeight: H } as Placement };
}

/** Resizes a provider image to exactly W×H (cover crop). */
export async function fitTo(buf: Buffer, W: number, H: number): Promise<Buffer> {
  return sharp(buf).removeAlpha().resize(W, H, { fit: "cover", position: "centre" }).png().toBuffer();
}

/**
 * Measures whether the model left the product where we put it, then puts the
 * original product pixels back on top. If the model moved the product,
 * re-compositing would create a double product, so we return the model image as-is.
 */
export async function recomposite(generated: Buffer, layer: Buffer, p: Placement, alignmentFail: number) {
  const fitted = await fitTo(generated, p.canvasWidth, p.canvasHeight);
  const region = { left: p.left, top: p.top, width: p.width, height: p.height };
  const N = 64;
  const [a, b, m] = await Promise.all([
    sharp(fitted).extract(region).resize(N, N, { fit: "fill" }).greyscale().raw().toBuffer(),
    sharp(layer).extract(region).flatten({ background: "#808080" }).resize(N, N, { fit: "fill" }).greyscale().raw().toBuffer(),
    sharp(layer).extract(region).extractChannel(3).resize(N, N, { fit: "fill" }).raw().toBuffer(),
  ]);
  const alignment = Math.max(0, maskedCorrelation(a, b, m));
  const colour = await meanLabDelta(fitted, layer, region);
  if (alignment < alignmentFail) {
    return { image: fitted, alignment, colourDelta: colour, recomposited: false };
  }
  const image = await sharp(fitted).composite([{ input: layer, left: 0, top: 0 }]).png().toBuffer();
  return { image, alignment, colourDelta: colour, recomposited: true };
}

async function meanLabDelta(img: Buffer, layer: Buffer, region: { left: number; top: number; width: number; height: number }) {
  const N = 48;
  const [x, y] = await Promise.all([
    sharp(img).extract(region).resize(N, N, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(layer).extract(region).resize(N, N, { fit: "fill" }).ensureAlpha().raw().toBuffer(),
  ]);
  let sum = 0, n = 0;
  for (let i = 0; i < N * N; i++) {
    if (y[i * 4 + 3] < 200) continue;
    sum += deltaE76(rgbToLab(x[i * 3], x[i * 3 + 1], x[i * 3 + 2]), rgbToLab(y[i * 4], y[i * 4 + 1], y[i * 4 + 2]));
    n++;
  }
  return n ? sum / n : 0;
}

export async function isBlank(buf: Buffer): Promise<boolean> {
  const s = await sharp(buf).stats();
  return s.channels.slice(0, 3).every((c) => c.stdev < 3);
}

export async function dimensions(buf: Buffer) {
  const m = await sharp(buf).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0 };
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}

export async function thumbnail(buf: Buffer): Promise<Buffer> {
  return sharp(buf).resize(640, 640, { fit: "inside" }).webp({ quality: 80 }).toBuffer();
}

export type DownloadFormat = "png" | "jpg" | "webp";

export async function encodeFor(buf: Buffer, format: DownloadFormat, maxEdge?: number): Promise<{ data: Buffer; type: string }> {
  let img = sharp(buf);
  if (maxEdge) img = img.resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true });
  if (format === "jpg") return { data: await img.flatten({ background: "#ffffff" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer(), type: "image/jpeg" };
  if (format === "webp") return { data: await img.webp({ quality: 90 }).toBuffer(), type: "image/webp" };
  return { data: await img.png({ compressionLevel: 8 }).toBuffer(), type: "image/png" };
}

/** Synthetic studio scene used by the sandbox provider so the full flow works without API keys. */
export async function sandboxScene(W: number, H: number, swatch: [string, string], label: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <radialGradient id="g" cx="50%" cy="38%" r="75%"><stop offset="0%" stop-color="${swatch[0]}"/><stop offset="100%" stop-color="${swatch[1]}"/></radialGradient>
      <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.12"/></linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect y="${Math.round(H * 0.7)}" width="100%" height="${Math.round(H * 0.3)}" fill="url(#f)"/>
    <text x="${Math.round(W * 0.03)}" y="${Math.round(H * 0.06)}" font-family="Helvetica, Arial" font-size="${Math.round(Math.min(W, H) / 40)}" fill="#000" fill-opacity="0.45">${escapeXml(label)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Soft contact shadow under the product for sandbox output. */
export async function contactShadow(p: Placement): Promise<Buffer> {
  const rx = Math.round(p.width * 0.45), ry = Math.max(4, Math.round(p.height * 0.035));
  const cx = p.left + Math.round(p.width / 2), cy = p.top + p.height - Math.round(ry * 0.4);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${p.canvasWidth}" height="${p.canvasHeight}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" fill-opacity="0.28"/></svg>`;
  return sharp(Buffer.from(svg)).blur(Math.max(2, ry)).png().toBuffer();
}
