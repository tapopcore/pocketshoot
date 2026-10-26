import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { errors as joseErrors } from "jose";
import { AuthError, getApiContext, type AuthContext } from "./auth";
import { logError } from "./observe";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

/** Wraps an API handler with auth, consistent errors and logging. */
export function handler<P = Record<string, string>>(
  fn: (req: Request, ctx: AuthContext, params: P) => Promise<Response | unknown>,
) {
  return async (req: Request, route: { params: Promise<P> }) => {
    try {
      const ctx = await getApiContext(req);
      const params = (await route?.params) ?? ({} as P);
      const out = await fn(req, ctx, params);
      return out instanceof Response ? out : json(out);
    } catch (e) {
      return errorResponse(e, req);
    }
  };
}

/** For webhooks and cron: no user auth. */
export function publicHandler<P = Record<string, string>>(fn: (req: Request, params: P) => Promise<Response | unknown>) {
  return async (req: Request, route: { params: Promise<P> }) => {
    try {
      const params = (await route?.params) ?? ({} as P);
      const out = await fn(req, params);
      return out instanceof Response ? out : json(out);
    } catch (e) {
      return errorResponse(e, req);
    }
  };
}

export function errorResponse(e: unknown, req?: Request) {
  if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
  if (e instanceof AuthError) return json({ error: e.message }, e.status);
  if (e && typeof e === "object" && "status" in e && (e as { status: number }).status === 401) {
    return json({ error: String((e as unknown as Error).message) }, 401);
  }
  if (e instanceof ZodError) return json({ error: "Some details are missing or invalid", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  if (e instanceof joseErrors.JOSEError) return json({ error: "Session expired. Reload the page." }, 401);
  const msg = e instanceof Error ? e.message : String(e);
  void logError("api", msg, { url: req?.url, stack: e instanceof Error ? e.stack?.slice(0, 1500) : undefined });
  return json({ error: "Something went wrong on our side. Please try again." }, 500);
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be JSON");
  }
  return schema.parse(raw);
}
