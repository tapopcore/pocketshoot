import { z } from "zod";
import { ApiError, body, handler } from "@/lib/api";
import { markOrderPaid, razorpay, verifyCheckoutSignature } from "@/lib/billing";
import { admin } from "@/lib/supabase";

/** Called by the browser after Razorpay Checkout succeeds. The webhook is the backup. */
export const POST = handler(async (req, ctx) => {
  const p = await body(req, z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }));
  if (!verifyCheckoutSignature(p.razorpay_order_id, p.razorpay_payment_id, p.razorpay_signature)) throw new ApiError(400, "Payment couldn't be verified");
  const { data: order } = await admin().from("orders").select("id, organization_id").eq("gateway", "razorpay").eq("gateway_order_id", p.razorpay_order_id).maybeSingle();
  if (!order || order.organization_id !== ctx.orgId) throw new ApiError(404, "Order not found");
  const payment = await razorpay().payments.fetch(p.razorpay_payment_id);
  if (payment.status !== "captured" && payment.status !== "authorized") throw new ApiError(400, `Payment is ${payment.status}`);
  const r = await markOrderPaid(order.id, { gateway: "razorpay", paymentId: payment.id, amountMinor: Number(payment.amount), method: payment.method, raw: { status: payment.status } });
  return { ok: true, orderId: order.id, ...r };
});
