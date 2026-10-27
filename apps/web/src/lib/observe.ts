import "server-only";
import { admin } from "./supabase";
import type { AuthContext } from "./auth";

/** Funnel and product events. Never put product photos or free text in props. */
export async function track(name: string, ctx: Partial<Pick<AuthContext, "orgId" | "userId">> | null, props: Record<string, unknown> = {}) {
  try {
    await admin().from("analytics_events").insert({ name, organization_id: ctx?.orgId ?? null, user_id: ctx?.userId ?? null, props });
  } catch (e) {
    console.error("track failed", name, e);
  }
}

export async function audit(
  ctx: Partial<Pick<AuthContext, "orgId" | "userId">> | null,
  action: string,
  target?: { type: string; id: string },
  metadata: Record<string, unknown> = {},
) {
  try {
    await admin().from("audit_logs").insert({
      actor_id: ctx?.userId ?? null,
      organization_id: ctx?.orgId ?? null,
      action,
      target_type: target?.type ?? null,
      target_id: target?.id ?? null,
      metadata,
    });
  } catch (e) {
    console.error("audit failed", action, e);
  }
}

export async function logError(source: string, message: string, data: Record<string, unknown> = {}) {
  console.error(`[${source}] ${message}`, data);
  try {
    await admin().from("app_logs").insert({ level: "error", source, message: message.slice(0, 2000), data });
  } catch {
    // logging must never throw
  }
}

export async function logInfo(source: string, message: string, data: Record<string, unknown> = {}) {
  try {
    await admin().from("app_logs").insert({ level: "info", source, message: message.slice(0, 2000), data });
  } catch {
    // ignore
  }
}

/** Fixed-window rate limit backed by Postgres. Returns true when allowed. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin().rpc("hit_rate_limit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error("rate limit check failed", error);
    // Fail CLOSED for paid/abuse-sensitive operations when the limiter cannot decide.
    return false;
  }
  return data === true;
}
