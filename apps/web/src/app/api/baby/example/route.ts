import { NextResponse } from "next/server";
import sharp from "sharp";
import { getApiContext } from "@/lib/auth";
import { BABY_EXAMPLE_FOLDER, BABY_EXAMPLE_OUT, BABY_PHONE_TEST_PROMPT, BABY_SIZES, babyExamplePrompt, babyTheme, type BabyShape } from "@/lib/baby/themes";
import { env } from "@/lib/env";
import { openai } from "@/lib/llm";
import { classifyHttpError } from "@/lib/providers";
import { publicUrl, putObject } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Makes the example photo shown on one theme card and stores it in the public bucket.
 * Platform accounts only. The baby in it is invented by the model from text; no customer photo is involved.
 */
export async function POST(req: Request) {
  let ctx;
  try { ctx = await getApiContext(req); } catch { return NextResponse.json({ ok: false, message: "Sign in to continue." }, { status: 401 }); }
  if (!ctx.platformRole) return new NextResponse(null, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.kind === "phone-test") {
    // An invented baby as a phone snapshot, for team tests. Returned to the caller and not stored.
    if (!env.openaiKey) return NextResponse.json({ ok: false, message: "No image model is connected here." }, { status: 503 });
    try {
      const res = (await openai().images.generate({ model: "gpt-image-2.5-sunburst", prompt: BABY_PHONE_TEST_PROMPT, size: "1024x1280", quality: "medium", output_format: "png", n: 1 } as never, { timeout: 240_000, maxRetries: 0 })) as unknown as { data?: { b64_json?: string }[] };
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) return NextResponse.json({ ok: false, message: "The image model returned no photo." }, { status: 502 });
      const jpeg = await sharp(Buffer.from(b64, "base64")).jpeg({ quality: 88 }).toBuffer();
      return NextResponse.json({ ok: true, image: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
    } catch (e) { return NextResponse.json({ ok: false, message: "The test photo could not be made.", detail: ((e as Error).message ?? "").slice(0, 300) }, { status: 502 }); }
  }
  const theme = babyTheme(String(body.theme ?? ""));
  if (!theme) return NextResponse.json({ ok: false, message: "Unknown theme." }, { status: 400 });
  if (!env.openaiKey) return NextResponse.json({ ok: false, message: "No image model is connected here." }, { status: 503 });
  const shape: BabyShape = body.shape === "1:1" || body.shape === "9:16" ? body.shape : "4:5";
  const size = BABY_SIZES[shape];
  const out = BABY_EXAMPLE_OUT[shape];
  try {
    const params = { model: "gpt-image-2.5-sunburst", prompt: babyExamplePrompt(theme, shape), size: `${size.width}x${size.height}`, quality: "medium", output_format: "png", n: 1 };
    const res = (await openai().images.generate(params as never, { timeout: 240_000, maxRetries: 0 })) as unknown as { data?: { b64_json?: string }[] };
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ ok: false, message: "The image model returned no photo.", retryable: true }, { status: 502 });
    const webp = await sharp(Buffer.from(b64, "base64")).resize(out.width, out.height, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
    const key = `${BABY_EXAMPLE_FOLDER}/${out.sub}${theme.id}.webp`;
    await putObject("public", key, webp, "image/webp");
    return NextResponse.json({ ok: true, theme: theme.id, shape, url: `${publicUrl(key)}?v=${Date.now()}` });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const c = classifyHttpError(err.status, err.message ?? String(e));
    return NextResponse.json({ ok: false, code: c.code, retryable: c.retryable, message: c.code === "content_refused" ? "The image model declined this theme." : "This example could not be made.", detail: (err.message ?? "").slice(0, 300) }, { status: 502 });
  }
}
