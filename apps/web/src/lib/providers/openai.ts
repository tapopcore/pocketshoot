import "server-only";
import { toFile } from "openai";
import { openai } from "../llm";
import { env } from "../env";
import {imageUsageCost,forecastImageInr,ECONOMY_QUALITY} from "../cost-policy";
import {reserveSpend,finishSpend,spendFx} from "../ai-spend";
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
          if (/budget|spend|cost scope/i.test((e as Error).message)) throw new ProviderError((e as Error).message,"cost_budget",false);
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
  if(model!=="gpt-image-2.5-sunburst" || req.images.length>2 || req.width*req.height>1_100_000) throw new ProviderError("This request exceeds the configured image budget profile", "cost_budget", false);
  const fx=await spendFx();
  const spend=await reserveSpend("image",model,forecastImageInr(req.prompt,req.images.length,fx),fx);
  const files = await Promise.all(req.images.map((b, i) => toFile(b, `input-${i}.png`, { type: "image/png" })));
  const size = is25(model) ? customSize(req.width, req.height) : null;
  const params: Record<string, unknown> = {
    model,
    prompt: req.prompt,
    image: files,
    size: size ? `${size.width}x${size.height}` : legacySize(req.width, req.height),
    quality: ECONOMY_QUALITY,
    output_format: "png",
    n: 1,
  };
  if (req.mask) params.mask = await toFile(req.mask, "mask.png", { type: "image/png" });
  if (req.transparent) params.background = "transparent";
  let response;
  try {response=await openai().images.edit(params as never, { timeout: req.timeoutMs, maxRetries: 0 }).withResponse();}
  catch(e){const err=e as {status?:number;request_id?:string};await finishSpend(spend,err.status&&[400,401,403,404,429].includes(err.status)?0:undefined,{error:(e as Error).message.slice(0,250)},err.request_id);throw e;}
  const {data:res,request_id:requestId}=response;
  const out = res as unknown as { data?: { b64_json?: string }[]; usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?:{text_tokens?:number;image_tokens?:number} } };
  const costUsd=out.usage?imageUsageCost(model,out.usage,cfg.prices):undefined;
  await finishSpend(spend,costUsd,out.usage,requestId??undefined);
  const b64 = out.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError("OpenAI returned no image", "empty_response", true);
  const input = out.usage?.input_tokens ?? 0, output = out.usage?.output_tokens ?? 0;
  return {
    image: Buffer.from(b64, "base64"),
    requestId: requestId ?? undefined,
    model,
    inputTokens: input,
    outputTokens: output,
    costUsd,
  };
}
