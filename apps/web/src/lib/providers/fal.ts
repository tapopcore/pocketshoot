import "server-only";
import { createFalClient } from "@fal-ai/client";
import { nearestRatio } from "@packshot/core";
import { env } from "../env";
import { classifyHttpError, ProviderError, type EditRequest, type EditResult, type ImageProvider } from "./types";

let client: ReturnType<typeof createFalClient> | null = null;
function falClient() {
  if (!env.falKey) throw new ProviderError("FAL_KEY is not set", "not_configured", false);
  client ??= createFalClient({ credentials: env.falKey });
  return client;
}

async function upload(buf: Buffer, name: string): Promise<string> {
  return falClient().storage.upload(new Blob([new Uint8Array(buf)], { type: "image/png" }), { lifecycle: { expiresIn: "1h" } } as never);
}

async function fetchImage(url: string): Promise<Buffer> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new ProviderError(`Could not download result (${r.status})`, "download_failed", true);
  return Buffer.from(await r.arrayBuffer());
}

export const fal: ImageProvider = {
  id: "fal",
  supportsMask: false,
  async edit(req: EditRequest, model: string): Promise<EditResult> {
    try {
      const urls = await Promise.all(req.images.slice(0, 3).map((b, i) => upload(b, `in-${i}.png`)));
      const input: Record<string, unknown> = {
        prompt: req.prompt,
        aspect_ratio: nearestRatio(req.width, req.height, ["21:9", "16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "4:5", "9:16"]),
        output_format: "png",
        num_images: 1,
        safety_tolerance: "2",
      };
      // Single-reference models take image_url; multi-reference models take image_urls.
      if (/multi|flux-2|kontext\/max\/multi/.test(model)) input.image_urls = urls;
      else input.image_url = urls[0];
      const result = (await Promise.race([
        falClient().subscribe(model, { input }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), req.timeoutMs)),
      ])) as { data: { images?: { url: string }[]; has_nsfw_concepts?: boolean[] }; requestId: string };
      const url = result.data.images?.[0]?.url;
      if (!url) throw new ProviderError("fal returned no image", "empty_response", true);
      if (result.data.has_nsfw_concepts?.[0]) throw new ProviderError("Result was blocked by the safety filter", "content_refused", false, true);
      return { image: await fetchImage(url), model, requestId: result.requestId };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      const err = e as { status?: number; message?: string };
      throw classifyHttpError(err.status, err.message ?? String(e));
    }
  },
};

/** Background removal through a segmentation model. Returns an RGBA PNG. */
export async function falSegment(model: string, image: Buffer): Promise<Buffer> {
  const url = await upload(image, "segment.png");
  const result = (await falClient().subscribe(model, { input: { image_url: url, output_format: "png" } })) as { data: { image?: { url: string } } };
  if (!result.data.image?.url) throw new ProviderError("Segmentation returned no image", "empty_response", true);
  return fetchImage(result.data.image.url);
}
