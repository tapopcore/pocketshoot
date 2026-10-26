import { z } from "zod";
import { ApiError, body, handler } from "@/lib/api";
import { markOrderPaid, paymentMode } from "@/lib/billing";
import { admin } from "@/lib/supabase";

/** Completes a sandbox order. Only works when real payments are not configured and sandbox is enabled outside production. */
export const POST = handler(async (req, ctx) => {
  if (paymentMode() !== "sandbox") throw new ApiError(403, "Sandbox payments are off");
  const { orderId } = await body(req, z.object({ orderId: z.string().uuid() }));
  const { data: order } = await admin().from("orders").select("id, total_minor, gateway").eq("id", orderId).eq("organization_id", ctx.orgId).maybeSingle();
  if (!order || order.gateway !== "sandbox") throw new ApiError(404, "Order not found");
  return markOrderPaid(order.id, { gateway: "sandbox", paymentId: `sandbox_pay_${order.id}`, amountMinor: order.total_minor, method: "sandbox" });
});
