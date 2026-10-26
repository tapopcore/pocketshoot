import "server-only";
import OpenAI from "openai";
import sharp from "sharp";
import { env } from "./env";

let client: OpenAI | null = null;
export function openai() {
  if (!env.openaiKey) throw new Error("OPENAI_API_KEY is not set");
  client ??= new OpenAI({ apiKey: env.openaiKey, maxRetries: 1 });
  return client;
}

export interface JsonCall {
  /** Ordered list of models to try; the next one is used if a model isn't available on the account. */
  models: string[];
  prompt: string;
  images?: Buffer[];
  /** "high" reads small label text; "low" is cheaper for rough checks. */
  detail?: "low" | "high" | "auto";
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
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
  for (const img of call.images ?? []) content.push({ type: "image_url", image_url: { url: await visionUrl(img), detail: call.detail ?? "high" } });
  let lastError: unknown = null;
  for (const model of call.models) {
    try {
      const reasoning = /^(gpt-5|o\d)/.test(model) ? { reasoning_effort: "low" as const } : { temperature: 0.4 };
      const res = await openai().chat.completions.create(
        {
          model,
          messages: [{ role: "user", content }],
          response_format: { type: "json_schema", json_schema: { name: call.schemaName, schema: call.schema, strict: true } },
          ...reasoning,
        },
        { timeout: call.timeoutMs ?? 60_000 },
      );
      const text = res.choices[0]?.message?.content ?? "";
      return { data: JSON.parse(text), model, inputTokens: res.usage?.prompt_tokens ?? 0, outputTokens: res.usage?.completion_tokens ?? 0 };
    } catch (e) {
      lastError = e;
      if (!isModelMissing(e)) throw e;
    }
  }
  throw lastError ?? new Error("No text model available");
}
