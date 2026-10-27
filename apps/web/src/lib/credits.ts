import "server-only";
import { admin } from "./supabase";
import { getSettings } from "./settings";
import { sha256 } from "./crypto";
import { track } from "./observe";
import type { AuthContext } from "./auth";
import { cache } from "react";

/** Request-scoped summary: navigation never loads the transaction lots. */
export const walletSummary = cache(async (orgId: string) => {
  const { data, error } = await admin().from("wallet_balances").select("available, reserved, consumed").eq("organization_id", orgId).single();
  if (error || !data) throw new Error("Wallet not found");
  return data as { available: number; reserved: number; consumed: number };
});

export interface WalletView {
  walletId: string;
  available: number;
  paidAvailable: number;
  promoAvailable: number;
  reserved: number;
  consumed: number;
  expired: number;
  lots: { id: string; kind: string; available: number; granted: number; expiresAt: string | null; source: string; createdAt: string }[];
}

export async function getWallet(orgId: string): Promise<WalletView> {
  const db = admin();
  const [{ data: w }, { data: lots }] = await Promise.all([
    db.from("wallet_balances").select("*").eq("organization_id", orgId).single(),
    db.from("lot_balances").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
  ]);
  if (!w) throw new Error("Wallet not found");
  return {
    walletId: w.wallet_id,
    available: w.available,
    paidAvailable: w.paid_available,
    promoAvailable: w.promo_available,
    reserved: w.reserved,
    consumed: w.consumed,
    expired: w.expired,
    lots: (lots ?? []).map((l) => ({
      id: l.lot_id, kind: l.kind, available: l.available, granted: l.granted, expiresAt: l.expires_at, source: l.source_type, createdAt: l.created_at,
    })),
  };
}

export function normalizeEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return email.toLowerCase();
  let l = local.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") l = l.replace(/\./g, "");
  return `${l}@${domain === "googlemail.com" ? "gmail.com" : domain}`;
}

const DISPOSABLE = ["mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com", "yopmail.com", "trashmail.com", "sharklasers.com", "getnada.com", "temp-mail.org", "dispostable.com"];

/**
 * Gives free trial credits once per real email address, with limits per network.
 * Returns the number granted (0 when not eligible).
 */
export async function grantTrialIfEligible(ctx: AuthContext, ip: string): Promise<number> {
  if (!ctx.email || !ctx.userId) return 0;
  const policy = (await getSettings()).credit_policy;
  if (policy.trialCredits <= 0) return 0;
  const email = normalizeEmail(ctx.email);
  if (DISPOSABLE.some((d) => email.endsWith("@" + d))) return 0;
  const db = admin();
  const ipHash = sha256(`trial:${ip}`);
  const { data: prior } = await db.from("trial_grants").select("id").eq("email_normalized", email).maybeSingle();
  if (prior) return 0;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { count } = await db.from("trial_grants").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= 3) {
    await track("trial_blocked", ctx, { reason: "ip_limit" });
    return 0;
  }
  const { error } = await db.from("trial_grants").insert({ email_normalized: email, user_id: ctx.userId, organization_id: ctx.orgId, ip_hash: ipHash, credits: policy.trialCredits });
  if (error) return 0; // already had a trial
  await db.rpc("grant_credits", {
    p_org: ctx.orgId, p_kind: "trial", p_entry_type: "trial", p_quantity: policy.trialCredits,
    p_expires_at: new Date(Date.now() + policy.promoExpiryDays * 86_400_000).toISOString(),
    p_source_type: "trial", p_source_ref: null, p_idempotency_key: `trial:${email}`,
  });
  await track("trial_issued", ctx, { credits: policy.trialCredits });
  return policy.trialCredits;
}

/** True when the org has never bought credits, so outputs follow trial rules. */
export async function isTrialOrg(orgId: string): Promise<boolean> {
  const { count } = await admin().from("credit_lots").select("id", { count: "exact", head: true }).eq("organization_id", orgId).in("kind", ["paid", "adjustment"]);
  return (count ?? 0) === 0;
}

export async function grantPaidCredits(opts: { orgId: string; orderId: string; credits: number; bonus: number; channel: string }) {
  const policy = (await getSettings()).credit_policy;
  const db = admin();
  const expires = new Date();
  expires.setMonth(expires.getMonth() + policy.paidExpiryMonths);
  const { error } = await db.rpc("grant_credits", {
    p_org: opts.orgId, p_kind: "paid", p_entry_type: "purchase", p_quantity: opts.credits, p_expires_at: expires.toISOString(),
    p_source_type: `order:${opts.channel}`, p_source_ref: opts.orderId, p_idempotency_key: `order:${opts.orderId}`, p_order_id: opts.orderId,
  });
  if (error) throw new Error(`grant failed: ${error.message}`);
  if (opts.bonus > 0) {
    await db.rpc("grant_credits", {
      p_org: opts.orgId, p_kind: "promo", p_entry_type: "promo", p_quantity: opts.bonus,
      p_expires_at: new Date(Date.now() + policy.promoExpiryDays * 86_400_000).toISOString(),
      p_source_type: "coupon_bonus", p_source_ref: opts.orderId, p_idempotency_key: `bonus:${opts.orderId}`, p_order_id: opts.orderId,
    });
  }
}
