import "server-only";
import { GoogleGenAI } from "@google/genai";
import { nearestRatio } from "@packshot/core";
import { env } from "../env";
import { classifyHttpError, ProviderError, type EditRequest, type EditResult, type ImageProvider } from "./types";

const RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

let client: GoogleGenAI | null = null;
function ai() {
  if (!env.geminiKey) throw new ProviderError("GEMINI_API_KEY is not set", "not_configured", false);
  client ??= new GoogleGenAI({ apiKey: env.geminiKey });
  return client;
}

export const gemini: ImageProvider = {
  id: "gemini",
  supportsMask: false,
  async edit(req: EditRequest, model: string): Promise<EditResult> {
    const parts = [
      ...req.images.map((b) => ({ inlineData: { mimeType: "image/png", data: b.toString("base64") } })),
      { text: req.prompt },
    ];
    const imageConfig: Record<string, string> = { aspectRatio: nearestRatio(req.width, req.height, RATIOS) };
    // Larger output sizes are only offered on the newer image models.
    if (/gemini-3/.test(model)) imageConfig.imageSize = Math.max(req.width, req.height) > 1400 ? "2K" : "1K";
    let res;
    try {
      res = await ai().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["IMAGE"],
          imageConfig,
          abortSignal: AbortSignal.timeout(req.timeoutMs),
        },
      });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      throw classifyHttpError(err.status, err.message ?? String(e));
    }
    const candidate = res.candidates?.[0];
    const img = candidate?.content?.parts?.find((p) => p.inlineData?.data);
    if (!img?.inlineData?.data) {
      const reason = candidate?.finishReason ?? res.promptFeedback?.blockReason ?? "no image returned";
      const refused = /SAFETY|PROHIBITED|BLOCK|IMAGE_SAFETY|RECITATION/i.test(String(reason));
      throw new ProviderError(`Gemini returned no image (${reason})`, refused ? "content_refused" : "empty_response", !refused, refused);
    }
    return {
      image: Buffer.from(img.inlineData.data, "base64"),
      model,
      requestId: res.responseId,
      inputTokens: res.usageMetadata?.promptTokenCount,
      outputTokens: res.usageMetadata?.candidatesTokenCount,
    };
  },
};

/** Vision check comparing original and result. Returns raw model text. */
export async function geminiJudge(model: string, prompt: string, original: Buffer, result: Buffer): Promise<string> {
  const res = await ai().models.generateContent({
    model,
    contents: [{
      role: "user",
      parts: [
        { text: prompt },
        { inlineData: { mimeType: "image/png", data: original.toString("base64") } },
        { inlineData: { mimeType: "image/png", data: result.toString("base64") } },
      ],
    }],
    config: { responseMimeType: "application/json", temperature: 0, abortSignal: AbortSignal.timeout(45_000) },
  });
  return res.text ?? "";
}
