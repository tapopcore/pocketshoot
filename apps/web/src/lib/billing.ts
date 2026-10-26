import "server-only";
import Razorpay from "razorpay";
import { computeGst, financialYear, formatInvoiceNumber, isValidGstin, rupeesInWords, INDIAN_STATES } from "@packshot/core";
import { admin } from "./supabase";
import { env, integrations } from "./env";
import { getSettings } from "./settings";
import { grantPaidCredits } from "./credits";
import { ApiError } from "./api";
import { assertRole, type AuthContext } from "./auth";
import { audit, track } from "./observe";
import { hmacHex, safeEqual } from "./crypto";

let rzp: Razorpay | null = null;
export function razorpay(): Razorpay {
  if (!integrations.razorpay) throw new ApiError(503, "Payments are not set up yet");
  rzp ??= new Razorpay({ key_id: env.razorpayKeyId!, key_secret: env.razorpayKeySecret! });
  return rzp;
}

export function paymentMode(): "razorpay" | "sandbox" | "off" {
  if (integrations.razorpay) return "razorpay";
  if (env.allowSandboxPayments && !env.isProd) return "sandbox";
  return "off";
}

export interface Quote {
  packId: string;
  credits: number;
  bonusCredits: number;
  listMinor: number;
  discountMinor: number;
  taxableMinor: number;
  tax: ReturnType<typeof computeGst>;
  couponId: string | null;
  couponMessage?: string;
  currency: string;
}

export async function quote(ctx: AuthContext, packId: string, opts: { couponCode?: string | null; buyerStateCode?: string | null; buyerGstin?: string | null; channel?: "web" | "shopify" }): Promise<Quote> {
  const db = admin();
  const { data: pack } = await db.from("pricing_packs").select("*").eq("id", packId).eq("active", true).maybeSingle();
  if (!pack || pack.channel !== (opts.channel ?? "web")) throw new ApiError(404, "That pack isn't available");
  let discount = 0, bonus = 0, couponId: string | null = null, couponMessage: string | undefined;
  if (opts.couponCode) {
    const code = opts.couponCode.trim().toUpperCase();
    const { data: c } = await db.from("coupons").select("*").eq("code", code).eq("active", true).maybeSingle();
    const valid = c && (!c.valid_until || new Date(c.valid_until) > new Date()) && (c.max_redemptions == null || c.redeemed_count < c.max_redemptions) && (!c.pack_codes?.length || c.pack_codes.includes(pack.code));
    if (valid) {
      const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).eq("coupon_id", c.id).eq("status", "paid");
      if ((count ?? 0) < c.per_org_limit) {
        discount = Math.round((pack.price_minor * (c.percent_off ?? 0)) / 100);
        bonus = c.bonus_credits ?? 0;
        couponId = c.id;
      } else couponMessage = "You've already used this code";
    } else couponMessage = "This code isn't valid";
  }
  const seller = (await getSettings()).seller;
  let buyerState = opts.buyerStateCode ?? null;
  if (opts.buyerGstin) {
    if (!isValidGstin(opts.buyerGstin)) throw new ApiError(400, "That GSTIN doesn't look right. Check it and try again.");
    buyerState = opts.buyerGstin.slice(0, 2);
  }
  if (buyerState && !(buyerState in INDIAN_STATES)) buyerState = null;
  const taxable = pack.price_minor - discount;
  const tax = pack.currency === "INR"
    ? computeGst({ taxablePaise: taxable, sellerStateCode: seller.stateCode, buyerStateCode: buyerState ?? seller.stateCode, ratePercent: seller.gstRatePercent })
    : computeGst({ taxablePaise: taxable, sellerStateCode: seller.stateCode, buyerStateCode: null, ratePercent: 0 });
  return { packId: pack.id, credits: pack.credits, bonusCredits: bonus, listMinor: pack.price_minor, discountMinor: discount, taxableMinor: taxable, tax, couponId, couponMessage, currency: pack.currency };
}

export async function createCheckout(ctx: AuthContext, input: { packId: string; couponCode?: string | null; buyerName?: string | null; buyerGstin?: string | null; buyerStateCode?: string | null }) {
  assertRole(ctx, "admin");
  const mode = paymentMode();
  if (mode === "off") throw new ApiError(503, "Payments are being set up. Please try again soon.");
  const q = await quote(ctx, input.packId, { ...input, channel: "web" });
  const db = admin();
  const { data: pack } = await db.from("pricing_packs").select("*").eq("id", q.packId).single();
  const seller = (await getSettings()).seller;
  const { data: order, error } = await db.from("orders").insert({
    organization_id: ctx.orgId, pack_id: pack.id, pack_snapshot: pack, credits: pack.credits, bonus_credits: q.bonusCredits,
    channel: "web", gateway: mode, currency: pack.currency, list_minor: q.listMinor, discount_minor: q.discountMinor,
    taxable_minor: q.taxableMinor, tax: q.tax, tax_minor: q.tax.totalTaxPaise, total_minor: q.tax.totalPaise, status: "created",
    buyer_name: input.buyerName ?? null, buyer_gstin: input.buyerGstin?.toUpperCase() ?? null,
    buyer_state_code: input.buyerGstin ? input.buyerGstin.slice(0, 2) : input.buyerStateCode ?? null,
    place_of_supply: q.tax.placeOfSupply, sac_code: seller.sacCode, coupon_id: q.couponId, created_by: ctx.userId,
  }).select("id").single();
  if (error) throw error;
  await track("checkout_started", ctx, { pack: pack.code, total: q.tax.totalPaise });

  if (mode === "sandbox") {
    await db.from("orders").update({ gateway_order_id: `sandbox_${order.id}` }).eq("id", order.id);
    return { mode, orderId: order.id, amount: q.tax.totalPaise, currency: pack.currency };
  }
  const rz = await razorpay().orders.create({
    amount: q.tax.totalPaise,
    currency: pack.currency,
    receipt: order.id.slice(0, 40),
    notes: { order_id: order.id, organization_id: ctx.orgId, pack: pack.code },
  });
  await db.from("orders").update({ gateway_order_id: rz.id, status: "pending" }).eq("id", order.id);
  return { mode, orderId: order.id, razorpayOrderId: rz.id, keyId: env.razorpayKeyId, amount: q.tax.totalPaise, currency: pack.currency, name: env.appName, description: `${pack.name} pack, ${pack.credits} credits` };
}

/** Client-side confirmation after Checkout. The webhook does the same thing, whichever arrives first wins. */
export function verifyCheckoutSignature(razorpayOrderId: string, paymentId: string, signature: string): boolean {
  if (!env.razorpayKeySecret) return false;
  return safeEqual(hmacHex(env.razorpayKeySecret, `${razorpayOrderId}|${paymentId}`), signature);
}

export function verifyWebhookSignature(raw: string, signature: string | null): boolean {
  if (!env.razorpayWebhookSecret || !signature) return false;
  return safeEqual(hmacHex(env.razorpayWebhookSecret, raw), signature);
}

/**
 * Marks an order paid and grants credits exactly once, no matter how many
 * times the webhook or client confirmation arrives (AC-07).
 */
export async function markOrderPaid(orderId: string, payment: { gateway: string; paymentId: string; amountMinor: number; method?: string | null; raw?: unknown }) {
  const db = admin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).single();
  if (!order) throw new Error(`Order ${orderId} not found`);
  if (payment.amountMinor !== order.total_minor) {
    await audit({ orgId: order.organization_id }, "order.amount_mismatch", { type: "order", id: orderId }, { expected: order.total_minor, got: payment.amountMinor });
    throw new ApiError(400, "Payment amount doesn't match the order");
  }
  await db.from("payments").upsert(
    { order_id: orderId, gateway: payment.gateway, gateway_payment_id: payment.paymentId, status: "captured", amount_minor: payment.amountMinor, method: payment.method ?? null, raw: payment.raw ?? null },
    { onConflict: "gateway,gateway_payment_id", ignoreDuplicates: true },
  );
  const { data: updated } = await db.from("orders").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", orderId).neq("status", "paid").select("id");
  if (!updated?.length) return { alreadyPaid: true };

  await grantPaidCredits({ orgId: order.organization_id, orderId, credits: order.credits, bonus: order.bonus_credits, channel: order.channel });
  if (order.coupon_id) {
    const { data: c } = await db.from("coupons").select("redeemed_count").eq("id", order.coupon_id).single();
    if (c) await db.from("coupons").update({ redeemed_count: c.redeemed_count + 1 }).eq("id", order.coupon_id);
  }
  if (order.gateway === "razorpay" || order.gateway === "sandbox") await createInvoice(orderId);
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("organization_id", order.organization_id).eq("status", "paid");
  await track((count ?? 0) > 1 ? "repeat_purchase" : "purchase_completed", { orgId: order.organization_id, userId: order.created_by }, { channel: order.channel, credits: order.credits, total: order.total_minor, currency: order.currency });
  return { alreadyPaid: false };
}

export async function markOrderRefunded(orderId: string, reason: string) {
  const db = admin();
  const { data: updated } = await db.from("orders").update({ status: "refunded" }).eq("id", orderId).eq("status", "paid").select("organization_id");
  if (!updated?.length) return;
  const { data: removed } = await db.rpc("chargeback_order", { p_order: orderId, p_reason: reason });
  await audit({ orgId: updated[0].organization_id }, "order.refunded", { type: "order", id: orderId }, { reason, creditsRemoved: removed });
}

export async function createInvoice(orderId: string) {
  const db = admin();
  const { data: existing } = await db.from("invoices").select("id").eq("order_id", orderId).maybeSingle();
  if (existing) return existing.id;
  const { data: order } = await db.from("orders").select("*, organizations(name, billing_name, billing_address)").eq("id", orderId).single();
  const seller = (await getSettings()).seller;
  const issued = new Date();
  const fy = financialYear(issued);
  const { data: seq } = await db.rpc("next_invoice_seq", { p_fy: fy });
  const number = formatInvoiceNumber(seller.invoicePrefix, fy, seq as number);
  const org = (order as unknown as { organizations: { name: string; billing_name: string | null; billing_address: string | null } }).organizations;
  const pack = order.pack_snapshot as { name: string; credits: number };
  const { data: inv, error } = await db.from("invoices").insert({
    organization_id: order.organization_id, order_id: orderId, number, fy, seq,
    seller: { legalName: seller.legalName, tradeName: seller.tradeName, gstin: seller.gstin, address: seller.address, stateCode: seller.stateCode, email: seller.email, phone: seller.phone },
    buyer: { name: order.buyer_name || org.billing_name || org.name, gstin: order.buyer_gstin, address: org.billing_address, stateCode: order.buyer_state_code, placeOfSupply: order.place_of_supply },
    lines: [{ description: `${pack.name} credit pack: ${order.credits} AI product image credits${order.bonus_credits ? ` (+${order.bonus_credits} bonus)` : ""}`, sac: order.sac_code, quantity: 1, rateMinor: order.list_minor, discountMinor: order.discount_minor, taxableMinor: order.taxable_minor }],
    tax: { ...order.tax, ratePercent: seller.gstRatePercent, inWords: rupeesInWords(order.total_minor) },
    total_minor: order.total_minor, currency: order.currency, issued_at: issued.toISOString(),
  }).select("id").single();
  if (error) throw error;
  await db.from("orders").update({ invoice_id: inv.id }).eq("id", orderId);
  return inv.id;
}
