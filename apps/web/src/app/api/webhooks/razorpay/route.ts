import { json, publicHandler } from "@/lib/api";
import { markOrderPaid, markOrderRefunded, verifyWebhookSignature } from "@/lib/billing";
import { logError } from "@/lib/observe";
import { admin } from "@/lib/supabase";
import { sha256 } from "@/lib/crypto";

interface RzEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; status: string; method?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number } };
    dispute?: { entity: { id: string; payment_id: string } };
  };
}

export const POST = publicHandler(async (req) => {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) return json({ error: "bad signature" }, 400);
  const evt = JSON.parse(raw) as RzEvent;
  const eventId = req.headers.get("x-razorpay-event-id") ?? sha256(raw);
  const db = admin();
  const { data: inserted } = await db.from("webhook_events").upsert({ provider: "razorpay", event_id: eventId, event_type: evt.event, payload: evt }, { onConflict: "provider,event_id", ignoreDuplicates: true }).select("id");
  if (!inserted?.length) {
    const { data: prev } = await db.from("webhook_events").select("processed_at").eq("provider", "razorpay").eq("event_id", eventId).single();
    if (prev?.processed_at) return { ok: true, duplicate: true };
  }
  try {
    const pay = evt.payload.payment?.entity;
    if ((evt.event === "payment.captured" || evt.event === "order.paid") && pay) {
      const { data: order } = await db.from("orders").select("id").eq("gateway", "razorpay").eq("gateway_order_id", pay.order_id).maybeSingle();
      if (order) await markOrderPaid(order.id, { gateway: "razorpay", paymentId: pay.id, amountMinor: pay.amount, method: pay.method, raw: { event: evt.event } });
    } else if (evt.event === "payment.failed" && pay) {
      await db.from("orders").update({ status: "failed" }).eq("gateway", "razorpay").eq("gateway_order_id", pay.order_id).in("status", ["created", "pending"]);
    } else if (evt.event === "refund.processed" || evt.event === "payment.dispute.lost") {
      const paymentId = evt.payload.refund?.entity.payment_id ?? evt.payload.dispute?.entity.payment_id;
      const { data: p } = await db.from("payments").select("order_id").eq("gateway", "razorpay").eq("gateway_payment_id", paymentId ?? "").maybeSingle();
      if (p) await markOrderRefunded(p.order_id, evt.event);
    }
    await db.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider", "razorpay").eq("event_id", eventId);
    return { ok: true };
  } catch (e) {
    await db.from("webhook_events").update({ error: (e as Error).message.slice(0, 500) }).eq("provider", "razorpay").eq("event_id", eventId);
    await logError("webhook.razorpay", (e as Error).message, { eventId });
    return json({ error: "processing failed" }, 500);
  }
});
