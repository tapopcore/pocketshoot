import { z } from "zod";
import { ApiError, body, handler } from "@/lib/api";
import { quote } from "@/lib/billing";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { createOneTimeCharge } from "@/lib/shopify/admin";
import { admin } from "@/lib/supabase";
import { track } from "@/lib/observe";

/** Buys a credit pack through Shopify Billing (required for Shopify App Store apps). */
export const POST = handler(async (req, ctx) => {
  if (!ctx.shop) throw new ApiError(400, "Open this from the Shopify app");
  const { packId } = await body(req, z.object({ packId: z.string().uuid() }));
  const q = await quote(ctx, packId, { channel: "shopify" });
  const db = admin();
  const { data: pack } = await db.from("pricing_packs").select("*").eq("id", packId).single();
  const { data: order, error } = await db.from("orders").insert({
    organization_id: ctx.orgId, pack_id: pack.id, pack_snapshot: pack, credits: pack.credits, channel: "shopify", gateway: "shopify",
    currency: pack.currency, list_minor: pack.price_minor, taxable_minor: pack.price_minor, total_minor: pack.price_minor, status: "created",
  }).select("id").single();
  if (error) throw error;
  const settings = await getSettings();
  const charge = await createOneTimeCharge(ctx.shop, {
    name: `${env.appName} ${pack.name}: ${pack.credits} image credits`,
    amount: pack.price_minor / 100,
    currency: pack.currency,
    returnUrl: `${env.appUrl}/api/shopify/billing/confirm?order=${order.id}&shop=${encodeURIComponent(ctx.shop.domain)}`,
    test: settings.shopify_billing.test,
  });
  await db.from("orders").update({ gateway_order_id: charge.chargeId, status: "pending" }).eq("id", order.id);
  await track("checkout_started", ctx, { pack: pack.code, channel: "shopify" });
  return { confirmationUrl: charge.confirmationUrl, orderId: order.id, quote: q };
});
