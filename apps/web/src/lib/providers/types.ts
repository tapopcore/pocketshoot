export type ProviderId = "gemini" | "openai" | "fal" | "mock";

export interface EditRequest {
  prompt: string;
  /** First image is the primary input (canvas in Preserve mode, best reference otherwise). */
  images: Buffer[];
  /** PNG, alpha 0 where editing is allowed. Only providers with mask support use it. */
  mask?: Buffer;
  width: number;
  height: number;
  /** Swatch colours, used by the sandbox provider only. */
  swatch?: [string, string];
  timeoutMs: number;
}

export interface EditResult {
  image: Buffer;
  model: string;
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Provider cost if the response reports it, otherwise estimated from settings. */
  costUsd?: number;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    /** Retrying might succeed (timeouts, rate limits, 5xx). */
    public retryable: boolean,
    /** The request itself was refused (safety filter, bad input); the user should change something. */
    public userFacing = false,
  ) {
    super(message);
  }
}

export interface ImageProvider {
  id: ProviderId;
  supportsMask: boolean;
  edit(req: EditRequest, model: string): Promise<EditResult>;
}

export function classifyHttpError(status: number | undefined, message: string): ProviderError {
  if (status === 429) return new ProviderError(message, "rate_limited", true);
  if (status && status >= 500) return new ProviderError(message, "provider_unavailable", true);
  if (status === 408 || /timeout|timed out|ETIMEDOUT|ECONNRESET|aborted/i.test(message)) return new ProviderError(message, "timeout", true);
  if (/safety|policy|blocked|moderation|prohibited/i.test(message)) return new ProviderError(message, "content_refused", false, true);
  if (status === 401 || status === 403) return new ProviderError(message, "auth_failed", false);
  if (status === 400) return new ProviderError(message, "bad_request", false);
  return new ProviderError(message, "unknown", true);
}
