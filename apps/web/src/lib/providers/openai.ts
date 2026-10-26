import "server-only";
import OpenAI, { toFile } from "openai";
import { env } from "../env";
import { classifyHttpError, ProviderError, type EditRequest, type EditResult, type ImageProvider } from "./types";

let client: OpenAI | null = null;
function oa() {
  if (!env.openaiKey) throw new ProviderError("OPENAI_API_KEY is not set", "not_configured", false);
  client ??= new OpenAI({ apiKey: env.openaiKey, maxRetries: 0 });
  return client;
}

function sizeFor(w: number, h: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const r = w / h;
  if (r > 1.2) return "1536x1024";
  if (r < 0.83) return "1024x1536";
  return "1024x1024";
}

export function openaiProvider(quality: "low" | "medium" | "high" | "auto"): ImageProvider {
  return {
    id: "openai",
    supportsMask: true,
    async edit(req: EditRequest, model: string): Promise<EditResult> {
      const files = await Promise.all(req.images.map((b, i) => toFile(b, `input-${i}.png`, { type: "image/png" })));
      try {
        const res = await oa().images.edit(
          {
            model,
            prompt: req.prompt,
            image: files,
            ...(req.mask ? { mask: await toFile(req.mask, "mask.png", { type: "image/png" }) } : {}),
            size: sizeFor(req.width, req.height),
            quality,
            output_format: "png",
            n: 1,
          },
          { timeout: req.timeoutMs },
        );
        const b64 = res.data?.[0]?.b64_json;
        if (!b64) throw new ProviderError("OpenAI returned no image", "empty_response", true);
        const usage = (res as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
        return { image: Buffer.from(b64, "base64"), model, inputTokens: usage?.input_tokens, outputTokens: usage?.output_tokens };
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        const err = e as { status?: number; message?: string; request_id?: string };
        throw classifyHttpError(err.status, err.message ?? String(e));
      }
    },
  };
}
