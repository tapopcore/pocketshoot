import { json, publicHandler } from "@/lib/api";
import { env } from "@/lib/env";
import { hmacBase64, safeEqual } from "@/lib/crypto";
import { markOrderPaid } from "@/lib/billing";
import { audit, logError } from "@/lib/observe";
import { admin } from "@/lib/supabase";
import { removePrefix } from "@/lib/retention";

/** One endpoint for all Shopify webhooks, including the three mandatory privacy topics. */
export const POST = publicHandler(async (req) => {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  if (!env.shopifyApiSecret || !safeEqual(hmacBase64(env.shopifyApiSecret, raw), hmac)) return json({ error: "unauthorized" }, 401);
  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shop = req.headers.get("x-shopify-shop-domain") ?? "";
  const eventId = req.headers.get("x-shopify-event-id") ?? req.headers.get("x-shopify-webhook-id") ?? `${topic}:${shop}:${raw.length}`;
  const db = admin();
  const { data: fresh } = await db.from("webhook_events").upsert({ provider: "shopify", event_id: eventId, event_type: topic, payload: { shop } }, { onConflict: "provider,event_id", ignoreDuplicates: true }).select("id");
  if (!fresh?.length) return { ok: true, duplicate: true };
  const payload = JSON.parse(raw || "{}");
  const { data: row } = await db.from("shopify_shops").select("organization_id").eq("shop_domain", shop).maybeSingle();

  try {
    switch (topic) {
      case "app/uninstalled":
        await db.from("shopify_shops").update({ uninstalled_at: new Date().toISOString(), access_token_enc: null, refresh_token_enc: null }).eq("shop_domain", shop);
        await audit({ orgId: row?.organization_id }, "shopify.uninstalled", { type: "shop", id: shop });
        break;
      case "customers/data_request":
      case "customers/redact":
        // We don't store the shop's customer data, only the shop's product photos.
        await audit({ orgId: row?.organization_id }, `shopify.${topic.replace("/", ".")}`, { type: "shop", id: shop }, { note: "No customer data held" });
        break;
      case "shop/redact":
        if (row) {
          await removePrefix("originals", row.organization_id);
          await removePrefix("outputs", row.organization_id);
          await db.from("products").delete().eq("organization_id", row.organization_id);
          await db.from("shopify_shops").update({ redacted_at: new Date().toISOString(), shop_email: null, shop_name: null }).eq("shop_domain", shop);
          await db.from("organizations").update({ name: "Redacted shop", status: "suspended", suspended_reason: "shop/redact" }).eq("id", row.organization_id);
          await audit({ orgId: row.organization_id }, "shopify.shop_redact", { type: "shop", id: shop });
        }
        break;
      case "app_purchases_one_time/update": {
        const p = payload.app_purchase_one_time as { admin_graphql_api_id: string; status: string };
        if (p?.status === "ACTIVE") {
          const { data: order } = await db.from("orders").select("id, total_minor").eq("gateway", "shopify").eq("gateway_order_id", p.admin_graphql_api_id).maybeSingle();
          if (order) await markOrderPaid(order.id, { gateway: "shopify", paymentId: p.admin_graphql_api_id, amountMinor: order.total_minor, method: "shopify_billing" });
        } else if (p && ["DECLINED", "EXPIRED"].includes(p.status)) {
          await db.from("orders").update({ status: "failed" }).eq("gateway", "shopify").eq("gateway_order_id", p.admin_graphql_api_id).neq("status", "paid");
        }
        break;
      }
    }
    await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider", "shopify").eq("event_id", eventId);
    return { ok: true };
  } catch (e) {
    await db.from("webhook_events").delete().eq("provider", "shopify").eq("event_id", eventId);
    await logError("webhook.shopify", (e as Error).message, { topic, shop });
    return json({ error: "processing failed" }, 500);
  }
});
