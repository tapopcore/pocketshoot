import "server-only";
import { INDIAN_STATES } from "@packshot/core";
import { admin } from "@/lib/supabase";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { paymentMode, razorpay } from "@/lib/billing";
import { ApiError } from "@/lib/api";
import { track } from "@/lib/observe";
import type { AuthContext } from "@/lib/auth";

/**
 * Baby Shoot prices are what the parent pays, GST included. The pack's price is split back into taxable value and tax,
 * so the invoice adds up exactly to the price shown in the app.
 */
export function inclusiveGst(totalPaise: number, ratePercent: number, sellerStateCode: string, buyerStateCode: string | null) {
  const taxable = Math.round((totalPaise * 100) / (100 + ratePercent));
  const tax = totalPaise - taxable;
  const buyer = buyerStateCode ?? sellerStateCode;
  const pos = `${buyer}-${INDIAN_STATES[buyer] ?? "Unknown"}`;
  if (buyer === sellerStateCode) {
    const cgst = Math.floor(tax / 2);
    return { taxablePaise: taxable, cgstPaise: cgst, sgstPaise: tax - cgst, igstPaise: 0, totalTaxPaise: tax, totalPaise, placeOfSupply: pos, supplyType: "intra_state" as const };
  }
  return { taxablePaise: taxable, cgstPaise: 0, sgstPaise: 0, igstPaise: tax, totalTaxPaise: tax, totalPaise, placeOfSupply: pos, supplyType: "inter_state" as const };
}

export async function createBabyCheckout(ctx: AuthContext, packCode: string) {
  const mode = paymentMode();
  if (mode === "off") throw new ApiError(503, "Payments are being set up. Please try again in a little while.");
  const db = admin();
  const { data: pack } = await db.from("pricing_packs").select("*").eq("code", packCode).eq("channel", "baby").eq("active", true).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!pack) throw new ApiError(404, "That option isn't available");
  const seller = (await getSettings()).seller;
  const tax = inclusiveGst(pack.price_minor, seller.gstRatePercent, seller.stateCode, null);
  const { data: order, error } = await db.from("orders").insert({
    organization_id: ctx.orgId, pack_id: pack.id, pack_snapshot: pack, credits: pack.credits, bonus_credits: 0,
    channel: "baby", gateway: mode, currency: pack.currency, list_minor: tax.taxablePaise, discount_minor: 0,
    taxable_minor: tax.taxablePaise, tax, tax_minor: tax.totalTaxPaise, total_minor: pack.price_minor, status: "created",
    buyer_name: null, buyer_gstin: null, buyer_state_code: null, place_of_supply: tax.placeOfSupply, sac_code: seller.sacCode,
    coupon_id: null, created_by: ctx.userId,
  }).select("id").single();
  if (error) throw error;
  await track("checkout_started", ctx, { pack: pack.code, total: pack.price_minor, app: "baby" });
  if (mode === "sandbox") {
    await db.from("orders").update({ gateway_order_id: `sandbox_${order.id}` }).eq("id", order.id);
    return { mode, orderId: order.id, amount: pack.price_minor, currency: pack.currency };
  }
  const rz = await razorpay().orders.create({ amount: pack.price_minor, currency: pack.currency, receipt: order.id.slice(0, 40), notes: { order_id: order.id, organization_id: ctx.orgId, pack: pack.code, app: "baby" } });
  await db.from("orders").update({ gateway_order_id: rz.id, status: "pending" }).eq("id", order.id);
  return { mode, orderId: order.id, razorpayOrderId: rz.id, keyId: env.razorpayKeyId, amount: pack.price_minor, currency: pack.currency, name: "Baby Shoot", description: pack.name };
}
