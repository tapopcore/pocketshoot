import "server-only";
import { toFile } from "openai";
import { openai } from "../llm";
import { env } from "../env";
import { classifyHttpError, ProviderError, type EditRequest, type EditResult, type ImageProvider } from "./types";

export type OpenAIQuality = "low" | "medium" | "high" | "xhigh" | "max" | "auto";

/** GPT Image 2.5 takes any size that is a multiple of 16, up to 3840px, ratio ≤ 3:1, 0.66 to 8.3 MP. */
export function customSize(w: number, h: number): { width: number; height: number } {
  const MIN = 655_360, MAX = 8_294_400, EDGE = 3840;
  let s = 1;
  if (w * h < MIN) s = Math.sqrt(MIN / (w * h));
  if (w * h * s * s > MAX) s = Math.sqrt(MAX / (w * h));
  if (Math.max(w, h) * s > EDGE) s = EDGE / Math.max(w, h);
  let W = Math.round((w * s) / 16) * 16, H = Math.round((h * s) / 16) * 16;
  if (W * H < MIN) { W += 16; H += 16; }
  return { width: W, height: H };
}

function legacySize(w: number, h: number): "1024x1024" | "1536x1024" | "1024x1536" {
  const r = w / h;
  if (r > 1.2) return "1536x1024";
  if (r < 0.83) return "1024x1536";
  return "1024x1024";
}

const is25 = (model: string) => /gpt-image-2\.5/.test(model);

function isModelMissing(e: unknown) {
  const err = e as { status?: number; code?: string; message?: string };
  return err.status === 404 || err.code === "model_not_found" || /model.*(does not exist|not found|not have access|must be one of|invalid model)/i.test(err.message ?? "");
}

/** Approximate cost from token usage (image output is the bulk). Prices per 1M tokens, editable in admin. */
function estimateCost(model: string, input = 0, output = 0, prices: Record<string, { input: number; output: number }>) {
  const p = prices[model] ?? prices[model.replace(/-\d{4}-\d{2}-\d{2}$/, "")] ?? prices.default;
  return (input * p.input + output * p.output) / 1_000_000;
}

export interface OpenAIImageSettings {
  /** Models to try in order. */
  models: string[];
  quality: OpenAIQuality;
  /** Quality used when falling back to gpt-image-2 (it has no xhigh/max and is slower). */
  legacyQuality: "low" | "medium" | "high";
  prices: Record<string, { input: number; output: number }>;
}

export function openaiProvider(cfg: OpenAIImageSettings): ImageProvider {
  return {
    id: "openai",
    supportsMask: true,
    async edit(req: EditRequest, firstModel: string): Promise<EditResult> {
      if (!env.openaiKey) throw new ProviderError("OPENAI_API_KEY is not set", "not_configured", false);
      const models = [...new Set([firstModel, ...cfg.models])];
      let lastError: unknown = null;
      for (const model of models) {
        try {
          return await callEdit(req, model, cfg);
        } catch (e) {
          lastError = e;
          if (e instanceof ProviderError) throw e;
          if (!isModelMissing(e)) {
            const err = e as { status?: number; message?: string; request_id?: string };
            const failure = classifyHttpError(err.status, err.message ?? String(e));
            failure.requestId = err.request_id;
            throw failure;
          }
        }
      }
      const err = lastError as { status?: number; message?: string };
      throw classifyHttpError(err?.status, err?.message ?? "No image model available on this OpenAI account");
    },
  };
}

async function callEdit(req: EditRequest, model: string, cfg: OpenAIImageSettings): Promise<EditResult> {
  const files = await Promise.all(req.images.map((b, i) => toFile(b, `input-${i}.png`, { type: "image/png" })));
  const size = is25(model) ? customSize(req.width, req.height) : null;
  const params: Record<string, unknown> = {
    model,
    prompt: req.prompt,
    image: files,
    size: size ? `${size.width}x${size.height}` : legacySize(req.width, req.height),
    quality: is25(model) ? (req.quality ?? cfg.quality) : req.quality && ["low", "medium", "high"].includes(req.quality) ? req.quality : cfg.legacyQuality,
    output_format: "png",
    n: 1,
  };
  if (req.mask) params.mask = await toFile(req.mask, "mask.png", { type: "image/png" });
  if (req.transparent) params.background = "transparent";
  const { data: res, request_id: requestId } = await openai().images.edit(params as never, { timeout: req.timeoutMs, maxRetries: 0 }).withResponse();
  const out = res as unknown as { data?: { b64_json?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const b64 = out.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError("OpenAI returned no image", "empty_response", true);
  const input = out.usage?.input_tokens ?? 0, output = out.usage?.output_tokens ?? 0;
  return {
    image: Buffer.from(b64, "base64"),
    requestId: requestId ?? undefined,
    model,
    inputTokens: input,
    outputTokens: output,
    costUsd: output ? estimateCost(model, input, output, cfg.prices) : undefined,
  };
}
