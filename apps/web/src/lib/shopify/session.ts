import "server-only";
import { jwtVerify } from "jose";
import { env } from "../env";
import { admin } from "../supabase";
import { decrypt, encrypt } from "../crypto";
import type { AuthContext } from "../auth";

class ShopifyAuthError extends Error {
  status = 401 as const;
}

export interface ShopifyIdToken {
  iss: string;
  dest: string;
  aud: string;
  sub?: string;
  exp: number;
  nbf: number;
  sid?: string;
}

export function shopFromDest(dest: string): string {
  const host = new URL(dest).hostname;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) throw new ShopifyAuthError("Invalid shop domain");
  return host;
}

export async function verifyIdToken(token: string): Promise<ShopifyIdToken> {
  if (!env.shopifyApiSecret || !env.shopifyApiKey) throw new ShopifyAuthError("Shopify app is not configured");
  const { payload } = await jwtVerify(token, new TextEncoder().encode(env.shopifyApiSecret), {
    algorithms: ["HS256"],
    audience: env.shopifyApiKey,
    clockTolerance: 10,
  });
  const p = payload as unknown as ShopifyIdToken;
  if (new URL(p.iss).hostname !== new URL(p.dest).hostname) throw new ShopifyAuthError("Token issuer mismatch");
  return p;
}

interface TokenExchangeResult {
  access_token: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
}

/** Exchanges the App Bridge session token for an offline Admin API token. */
async function exchangeToken(shop: string, idToken: string): Promise<TokenExchangeResult> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.shopifyApiKey,
      client_secret: env.shopifyApiSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    }),
  });
  if (!res.ok) throw new ShopifyAuthError(`Token exchange failed (${res.status})`);
  return res.json();
}

async function refreshToken(shop: string, refresh: string): Promise<TokenExchangeResult> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: env.shopifyApiKey, client_secret: env.shopifyApiSecret, grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!res.ok) throw new ShopifyAuthError(`Token refresh failed (${res.status})`);
  return res.json();
}

/** Creates the workspace and wallet for a newly installed shop. */
async function ensureShopOrg(shop: string): Promise<string> {
  const db = admin();
  const { data: existing } = await db.from("shopify_shops").select("organization_id").eq("shop_domain", shop).maybeSingle();
  if (existing) return existing.organization_id;
  const { data: org, error } = await db
    .from("organizations")
    .insert({ name: shop.replace(".myshopify.com", ""), source: "shopify" })
    .select("id")
    .single();
  if (error) throw error;
  await db.from("wallets").insert({ organization_id: org.id });
  const { error: shopErr } = await db.from("shopify_shops").insert({ shop_domain: shop, organization_id: org.id });
  if (shopErr) {
    // Another request created it first; use theirs.
    const { data: again } = await db.from("shopify_shops").select("organization_id").eq("shop_domain", shop).single();
    await db.from("organizations").delete().eq("id", org.id);
    return again!.organization_id;
  }
  return org.id;
}

export async function shopifyContextFromToken(idToken: string): Promise<AuthContext> {
  const claims = await verifyIdToken(idToken);
  const shop = shopFromDest(claims.dest);
  const orgId = await ensureShopOrg(shop);
  const db = admin();
  const { data: row } = await db
    .from("shopify_shops")
    .select("id, access_token_enc, refresh_token_enc, access_token_expires_at, uninstalled_at, organizations(name,status)")
    .eq("shop_domain", shop)
    .single();
  const org = (row as unknown as { organizations: { name: string; status: string } }).organizations;
  if (org.status !== "active") throw new ShopifyAuthError("This workspace is suspended");

  let accessToken: string | null = row?.access_token_enc ? decrypt(row.access_token_enc) : null;
  const expired = row?.access_token_expires_at && new Date(row.access_token_expires_at).getTime() < Date.now() + 60_000;
  if (!accessToken || row?.uninstalled_at || expired) {
    let t: TokenExchangeResult;
    if (expired && row?.refresh_token_enc && !row.uninstalled_at) {
      t = await refreshToken(shop, decrypt(row.refresh_token_enc)).catch(() => exchangeToken(shop, idToken));
    } else {
      t = await exchangeToken(shop, idToken);
    }
    accessToken = t.access_token;
    await db
      .from("shopify_shops")
      .update({
        access_token_enc: encrypt(t.access_token),
        refresh_token_enc: t.refresh_token ? encrypt(t.refresh_token) : null,
        access_token_expires_at: t.expires_in ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
        scopes: t.scope,
        uninstalled_at: null,
        installed_at: row?.uninstalled_at ? new Date().toISOString() : undefined,
      })
      .eq("shop_domain", shop);
  }

  return {
    via: "shopify",
    userId: null,
    email: null,
    orgId,
    orgName: org.name,
    role: "owner",
    locale: "en",
    platformRole: null,
    shop: { domain: shop, accessToken: accessToken! },
  };
}
