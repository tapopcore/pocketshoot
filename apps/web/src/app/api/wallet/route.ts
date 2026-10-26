import { handler } from "@/lib/api";
import { getWallet } from "@/lib/credits";
import { admin } from "@/lib/supabase";

export const GET = handler(async (req, ctx) => {
  const limit = Math.min(100, Number(new URL(req.url).searchParams.get("limit") ?? 30));
  const [wallet, { data: entries }] = await Promise.all([
    getWallet(ctx.orgId),
    admin().from("credit_ledger").select("id, entry_type, quantity, created_at, job_id, order_id, note, credit_lots(kind)").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(limit),
  ]);
  return { wallet, entries: entries ?? [] };
});
