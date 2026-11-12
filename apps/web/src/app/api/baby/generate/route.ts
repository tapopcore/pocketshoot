import { NextResponse } from "next/server";
import sharp from "sharp";
import { toFile } from "openai";
import { labCodeOk, labEnabled } from "@/lib/baby/gate";
import { BABY_SIZES, babyPrompt, babyTheme, type BabyShape, type BabyState } from "@/lib/baby/themes";
import { env } from "@/lib/env";
import { openai } from "@/lib/llm";
import { classifyHttpError, mock } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MODEL = "gpt-image-2.5-sunburst";
const MAX_UPLOAD = 4 * 1024 * 1024;

const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, code, message, ...extra }, { status });

/**
 * One photo per request. Nothing is written to the database or storage:
 * the reference photos are held in memory for this request and the result goes straight back to the browser.
 */
export async function POST(req: Request) {
  if (!labEnabled()) return new NextResponse(null, { status: 404 });
  if (!labCodeOk(req.headers.get("x-baby-code"))) return fail(401, "code", "Access code is missing or wrong.");
  let form: FormData;
  try { form = await req.formData(); } catch { return fail(400, "bad_request", "The upload could not be read."); }
  const theme = babyTheme(String(form.get("theme") ?? ""));
  const shape = String(form.get("shape") ?? "4:5") as BabyShape;
  const state: BabyState = form.get("state") === "awake" ? "awake" : "asleep";
  const quality = form.get("quality") === "best" ? "high" : "medium";
  const size = BABY_SIZES[shape];
  if (!theme || !size) return fail(400, "bad_request", "Unknown theme or photo shape.");
  const files = form.getAll("photo").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 2);
  if (!files.length) return fail(400, "bad_request", "Add at least one photo of the baby.");
  if (files.some((f) => f.size > MAX_UPLOAD)) return fail(413, "too_large", "That photo is too large. Please try a smaller one.");

  let images: Buffer[];
  try {
    images = await Promise.all(files.map(async (f) => sharp(Buffer.from(await f.arrayBuffer())).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer()));
  } catch { return fail(400, "bad_image", "That file does not look like a photo we can read."); }

  const prompt = babyPrompt(theme, state, images.length);
  const started = Date.now();
  try {
    let png: Buffer, model = MODEL, usage: unknown = null, requestId: string | null = null, sandbox = false;
    if (!env.openaiKey) {
      sandbox = true; model = "sandbox";
      png = (await mock.edit({ prompt, images, width: size.width, height: size.height, swatch: theme.swatch, timeoutMs: 10_000 }, "sandbox")).image;
    } else {
      const input = await Promise.all(images.map((b, i) => toFile(b, `baby-${i}.png`, { type: "image/png" })));
      const params = { model: MODEL, prompt, image: input, size: `${size.width}x${size.height}`, quality, output_format: "png", n: 1 };
      const { data, request_id } = await openai().images.edit(params as never, { timeout: 240_000, maxRetries: 0 }).withResponse();
      const res = data as unknown as { data?: { b64_json?: string }[]; usage?: unknown };
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) return fail(502, "empty_response", "The image model returned no photo. Please try again.", { retryable: true });
      png = Buffer.from(b64, "base64"); usage = res.usage ?? null; requestId = request_id ?? null;
    }
    const jpeg = await sharp(png).jpeg({ quality: 93, chromaSubsampling: "4:4:4" }).toBuffer();
    const meta = await sharp(jpeg).metadata();
    return NextResponse.json({ ok: true, image: `data:image/jpeg;base64,${jpeg.toString("base64")}`, width: meta.width, height: meta.height, model, quality, sandbox, usage, requestId, ms: Date.now() - started, theme: theme.id });
  } catch (e) {
    const err = e as { status?: number; message?: string; request_id?: string };
    const c = classifyHttpError(err.status, err.message ?? String(e));
    const message =
      c.code === "content_refused" ? "The image model declined this request. This is its own safety filter, and it is useful to know for the test."
      : c.code === "provider_billing" ? "The OpenAI account has no budget left for this request."
      : c.code === "rate_limited" ? "The image model is busy. Please try again in a minute."
      : c.code === "timeout" ? "The photo took too long to make. Please try again."
      : c.code === "auth_failed" ? "The OpenAI key was not accepted."
      : "This photo could not be made.";
    // The provider's own wording is returned so a refusal can be studied; it never contains the key.
    return fail(c.code === "content_refused" ? 422 : 502, c.code, message, { retryable: c.retryable, detail: (err.message ?? "").slice(0, 400), requestId: err.request_id ?? null, ms: Date.now() - started, theme: theme.id });
  }
}
