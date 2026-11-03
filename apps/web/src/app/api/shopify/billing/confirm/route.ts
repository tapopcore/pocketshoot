import { NextResponse } from "next/server";
import { publicHandler } from "@/lib/api";
import { markOrderPaid } from "@/lib/billing";
import { decrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { getOneTimeCharge } from "@/lib/shopify/admin";
import { admin } from "@/lib/supabase";

/** Shopify sends the merchant here after they approve or decline the charge. */
export const GET = publicHandler(async (req) => {
  const u = new URL(req.url);
  const orderId = u.searchParams.get("order") ?? "";
  const shopParam = u.searchParams.get("shop") ?? "";
  // Only ever redirect back to a real Shopify admin, never to a domain taken from the URL.
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shopParam)) return NextResponse.redirect(env.appUrl);
  const shopDomain = shopParam.toLowerCase();
  const db = admin();
  const { data: order } = await db.from("orders").select("id, organization_id, gateway_order_id, total_minor, status").eq("id", orderId).eq("gateway", "shopify").maybeSingle();
  const { data: shop } = await db.from("shopify_shops").select("organization_id, access_token_enc").eq("shop_domain", shopDomain).maybeSingle();
  const back = `https://${shopDomain}/admin/apps/${env.shopifyApiKey}/shopify/credits`;
  if (!order || !shop || shop.organization_id !== order.organization_id || !shop.access_token_enc || !order.gateway_order_id) {
    return NextResponse.redirect(`${back}?purchase=unknown`);
  }
  const charge = await getOneTimeCharge({ domain: shopDomain, accessToken: decrypt(shop.access_token_enc) }, order.gateway_order_id);
  if (charge?.status === "ACTIVE") {
    await markOrderPaid(order.id, { gateway: "shopify", paymentId: charge.id, amountMinor: Math.round(Number(charge.price.amount) * 100), method: charge.test ? "shopify_test" : "shopify_billing" });
    return NextResponse.redirect(`${back}?purchase=ok`);
  }
  await db.from("orders").update({ status: "failed" }).eq("id", order.id).neq("status", "paid");
  return NextResponse.redirect(`${back}?purchase=declined`);
});
