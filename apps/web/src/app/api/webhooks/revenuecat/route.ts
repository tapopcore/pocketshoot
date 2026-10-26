import { json, publicHandler } from "@/lib/api";
import { markOrderPaid, markOrderRefunded } from "@/lib/billing";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { logError } from "@/lib/observe";
import { admin } from "@/lib/supabase";

/**
 * In-app purchases from the iOS and Android apps, delivered by RevenueCat.
 * The mobile app identifies purchasers as "org:<organization id>".
 */
interface RcEvent {
  event: {
    id: string;
    type: string;
    app_user_id: string;
    original_app_user_id?: string;
    product_id: string;
    transaction_id: string;
    store: "APP_STORE" | "PLAY_STORE" | string;
    environment: "SANDBOX" | "PRODUCTION";
    price_in_purchased_currency?: number;
    currency?: string;
    cancel_reason?: string;
  };
}

export const POST = publicHandler(async (req) => {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.revenuecatWebhookAuth || !safeEqual(auth, `Bearer ${env.revenuecatWebhookAuth}`)) return json({ error: "unauthorized" }, 401);
  const { event } = (await req.json()) as RcEvent;
  const db = admin();
  const { data: inserted } = await db.from("webhook_events").upsert({ provider: "revenuecat", event_id: event.id, event_type: event.type, payload: event }, { onConflict: "provider,event_id", ignoreDuplicates: true }).select("id");
  if (!inserted?.length) return { ok: true, duplicate: true };

  try {
    const orgId = [event.app_user_id, event.original_app_user_id].find((u) => u?.startsWith("org:"))?.slice(4);
    const channel = event.store === "APP_STORE" ? "ios" : "android";
    if (event.type === "NON_RENEWING_PURCHASE" && orgId) {
      const { data: pack } = await db.from("pricing_packs").select("*").eq("channel", channel).eq("store_product_id", event.product_id).eq("active", true).order("version", { ascending: false }).limit(1).maybeSingle();
      if (!pack) throw new Error(`No pack for ${channel} product ${event.product_id}`);
      const totalMinor = Math.round((event.price_in_purchased_currency ?? pack.price_minor / 100) * 100);
      const { data: order, error } = await db.from("orders").upsert({
        organization_id: orgId, pack_id: pack.id, pack_snapshot: { ...pack, environment: event.environment }, credits: pack.credits, channel,
        gateway: "revenuecat", gateway_order_id: event.transaction_id, currency: event.currency ?? pack.currency,
        list_minor: totalMinor, taxable_minor: totalMinor, total_minor: totalMinor, status: "pending",
      }, { onConflict: "gateway,gateway_order_id", ignoreDuplicates: false }).select("id, total_minor").single();
      if (error) throw error;
      await markOrderPaid(order.id, { gateway: "revenuecat", paymentId: event.transaction_id, amountMinor: order.total_minor, method: event.store, raw: { environment: event.environment } });
    } else if (event.type === "CANCELLATION" && event.cancel_reason === "CUSTOMER_SUPPORT") {
      const { data: order } = await db.from("orders").select("id").eq("gateway", "revenuecat").eq("gateway_order_id", event.transaction_id).maybeSingle();
      if (order) await markOrderRefunded(order.id, "store_refund");
    }
    await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider", "revenuecat").eq("event_id", event.id);
    return { ok: true };
  } catch (e) {
    await db.from("webhook_events").update({ error: (e as Error).message.slice(0, 500) }).eq("provider", "revenuecat").eq("event_id", event.id);
    // Let RevenueCat retry: remove the dedupe row so the retry is processed.
    await db.from("webhook_events").delete().eq("provider", "revenuecat").eq("event_id", event.id).is("processed_at", null);
    await logError("webhook.revenuecat", (e as Error).message, { eventId: event.id });
    return json({ error: "processing failed" }, 500);
  }
});
