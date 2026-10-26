import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { admin, userClient } from "./supabase";
import { env } from "./env";
import { shopifyContextFromToken } from "./shopify/session";

export type Role = "owner" | "admin" | "editor" | "viewer";
const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export interface AuthContext {
  via: "web" | "mobile" | "shopify";
  userId: string | null;
  email: string | null;
  orgId: string;
  orgName: string;
  role: Role;
  locale: "en" | "hi";
  platformRole: "platform_support" | "platform_admin" | null;
  shop?: { domain: string; accessToken: string };
  orgs?: { id: string; name: string }[];
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export const ORG_COOKIE = "ps_org";

async function contextForUser(userId: string, email: string | null, via: "web" | "mobile", wantedOrg?: string | null): Promise<AuthContext> {
  const db = admin();
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    db.from("profiles").select("id,email,locale,status,platform_role").eq("id", userId).maybeSingle(),
    db.from("memberships").select("organization_id, role, organizations(name,status)").eq("user_id", userId).order("created_at"),
  ]);
  if (!profile) throw new AuthError(401, "Profile not found");
  if (profile.status !== "active") throw new AuthError(403, "This account is suspended. Contact support.");
  const list = (memberships ?? []) as unknown as { organization_id: string; role: Role; organizations: { name: string; status: string } }[];
  if (list.length === 0) throw new AuthError(403, "You are not a member of any workspace");
  const m = list.find((x) => x.organization_id === wantedOrg) ?? list[0];
  if (m.organizations.status !== "active") throw new AuthError(403, "This workspace is suspended. Contact support.");
  const envAdmin = email && env.platformAdminEmails.includes(email.toLowerCase());
  return {
    via,
    userId,
    email: profile.email ?? email,
    orgId: m.organization_id,
    orgName: m.organizations.name,
    role: m.role,
    locale: profile.locale === "hi" ? "hi" : "en",
    platformRole: envAdmin ? "platform_admin" : profile.platform_role,
    orgs: list.map((x) => ({ id: x.organization_id, name: x.organizations.name })),
  };
}

/** Auth for server components and server actions (cookie session). */
// cache(): the layout and the page share one lookup per request.
// getClaims() verifies the session JWT locally (signing keys), so no call to the auth server on every click.
export const getWebContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await userClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const store = await cookies();
  try {
    return await contextForUser(claims.sub, (claims.email as string | undefined) ?? null, "web", store.get(ORG_COOKIE)?.value);
  } catch (e) {
    if (e instanceof AuthError) return null;
    throw e;
  }
});

export async function requireWeb(minRole: Role = "viewer"): Promise<AuthContext> {
  const ctx = await getWebContext();
  if (!ctx) redirect("/sign-in");
  if (RANK[ctx.role] < RANK[minRole]) redirect("/app?denied=1");
  return ctx;
}

export async function requirePlatform(level: "platform_support" | "platform_admin" = "platform_support"): Promise<AuthContext> {
  const ctx = await getWebContext();
  if (!ctx) redirect("/sign-in");
  if (!ctx.platformRole || (level === "platform_admin" && ctx.platformRole !== "platform_admin")) redirect("/app");
  return ctx;
}

/**
 * Auth for API routes. Accepts, in order:
 *  - Shopify session token (X-Client: shopify, Authorization: Bearer <id token>)
 *  - Supabase access token from the mobile app (Authorization: Bearer <jwt>)
 *  - Web cookie session
 */
export async function getApiContext(req: Request): Promise<AuthContext> {
  const authz = req.headers.get("authorization");
  const client = req.headers.get("x-client");
  const bearer = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (bearer && client === "shopify") {
    return shopifyContextFromToken(bearer);
  }
  if (bearer) {
    const { data, error } = await admin().auth.getUser(bearer);
    if (error || !data.user) throw new AuthError(401, "Session expired. Sign in again.");
    return contextForUser(data.user.id, data.user.email ?? null, "mobile", req.headers.get("x-org-id"));
  }
  const ctx = await getWebContext();
  if (!ctx) throw new AuthError(401, "Sign in to continue");
  return ctx;
}

export function hasRole(ctx: AuthContext, minRole: Role) {
  return RANK[ctx.role] >= RANK[minRole];
}

export function assertRole(ctx: AuthContext, minRole: Role) {
  if (!hasRole(ctx, minRole)) throw new AuthError(403, `This needs the ${minRole} role or higher`);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
}
