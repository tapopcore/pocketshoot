import "server-only";
import OpenAI from "openai";
import sharp from "sharp";
import { env } from "./env";
import {reserveSpend,finishSpend,spendFx} from "./ai-spend";
import {textUsageCost} from "./cost-policy";

let client: OpenAI | null = null;
export function openai() {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY is not set");
  client ??= new OpenAI({ apiKey: env.openaiKey, maxRetries: 0 });
  return client;
}

export interface JsonCall {
  /** Ordered list of models to try; the next one is used if a model isn't available on the account. */
  models: string[];
  prompt: string;
  images?: Buffer[];
  imageLabels?: string[];
  /** "high" reads small label text; "low" is cheaper for rough checks. */
  detail?: "low" | "high" | "auto";
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
  maxOutputTokens?: number;
}

export interface JsonResult {
  data: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Downscales an image for vision input; keeps label text readable while saving tokens. */
async function visionUrl(buf: Buffer, edge = 1280) {
  const jpg = await sharp(buf).rotate().flatten({ background: "#ffffff" }).resize(edge, edge, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

function isModelMissing(e: unknown) {
  const err = e as { status?: number; code?: string; message?: string };
  return err.status === 404 || err.code === "model_not_found" || /model.*(does not exist|not found|not have access)/i.test(err.message ?? "");
}

/** One structured-output call to a small OpenAI model, with vision when images are given. */
export async function jsonCall(call: JsonCall): Promise<JsonResult> {
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{ type: "text", text: call.prompt }];
  for (const [index, img] of (call.images ?? []).entries()) {
    if (call.imageLabels?.[index]) content.push({ type: "text", text: call.imageLabels[index] });
    content.push({ type: "image_url", image_url: { url: await visionUrl(img), detail: call.detail ?? "high" } });
  }
  let lastError: unknown = null;
  for (const model of call.models) {
    if(textUsageCost(model,1,1)===undefined) continue;
    const fx=await spendFx();
    const maxOutput=call.maxOutputTokens??(call.schemaName==="shot_briefs"?4096:2048);
    const estimate=textUsageCost(model,Buffer.byteLength(call.prompt,"utf8")+(call.images?.length??0)*4096,maxOutput)!*fx;
    const spend=await reserveSpend(call.schemaName,model,estimate,fx);
    try {
      const reasoning = /^(gpt-5|o\d)/.test(model) ? { reasoning_effort: "low" as const } : { temperature: 0.4 };
      const res = await openai().chat.completions.create(
        {
          model,
          max_completion_tokens:maxOutput,
          messages: [{ role: "user", content }],
          response_format: { type: "json_schema", json_schema: { name: call.schemaName, schema: call.schema, strict: true } },
          ...reasoning,
        },
        { timeout: call.timeoutMs ?? 60_000 },
      );
      await finishSpend(spend,res.usage?textUsageCost(model,res.usage.prompt_tokens,res.usage.completion_tokens,res.usage.prompt_tokens_details?.cached_tokens??0):undefined,res.usage,res.id);
      const text = res.choices[0]?.message?.content ?? "";
      return { data: JSON.parse(text), model, inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 };
    } catch (e) {
      lastError = e;
      const err=e as {status?:number};
      // Do not overwrite recorded usage when parsing a paid response fails.
      if(!(e instanceof SyntaxError)) await finishSpend(spend,err.status&&[400,401,403,404,429].includes(err.status)?0:undefined,{error:(e as Error).message.slice(0,250)});
      if (!isModelMissing(e)) throw e;
    }
  }
  throw lastError ?? new Error("No text model available");
}
