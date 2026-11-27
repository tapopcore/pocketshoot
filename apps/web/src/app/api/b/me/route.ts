import { z } from "zod";
import { body, handler } from "@/lib/api";
import { admin } from "@/lib/supabase";
import { babyBalance, babyPacks, ensureBabyAccount, shootView } from "@/lib/baby/service";
import { paymentMode } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the app needs on load: the baby, the wallet, prices, shoots and the photos already added. */
export const GET = handler(async (req, ctx) => {
  const profile = await ensureBabyAccount(ctx);
  const db = admin();
  const [balance, packs, shoots, refs, orders] = await Promise.all([
    babyBalance(ctx.orgId), babyPacks(), shootView(ctx.orgId),
    db.from("baby_refs").select("id,created_at").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(5),
    db.from("orders").select("id,total_minor,credits,paid_at,invoice_id,pack_snapshot").eq("organization_id", ctx.orgId).eq("channel", "baby").eq("status", "paid").order("paid_at", { ascending: false }).limit(50),
  ]);
  return {
    email: ctx.email, profile, balance, packs, shoots, payments: paymentMode(),
    refs: (refs.data ?? []).map((r) => r.id),
    orders: (orders.data ?? []).map((o) => ({ id: o.id, total: o.total_minor, credits: o.credits, paidAt: o.paid_at, invoiceId: o.invoice_id, name: (o.pack_snapshot as { name?: string })?.name ?? "" })),
  };
});

const Profile = z.object({
  babyName: z.string().trim().max(40).optional(),
  ageBand: z.enum(["u2", "2-4", "1-2", "2+"]).optional(),
  sex: z.enum(["boy", "girl", "none"]).optional(),
  prefs: z.object({ shape: z.enum(["4:5", "1:1", "9:16"]).optional(), theme: z.enum(["light", "dark", "auto"]).optional(), notify: z.boolean().optional(), keep: z.boolean().optional() }).optional(),
  consent: z.literal(true).optional(),
});

export const POST = handler(async (req, ctx) => {
  const p = await body(req, Profile);
  await ensureBabyAccount(ctx);
  const db = admin();
  const { data: cur } = await db.from("baby_profiles").select("prefs").eq("organization_id", ctx.orgId).single();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.babyName !== undefined) patch.baby_name = p.babyName || null;
  if (p.ageBand) patch.age_band = p.ageBand;
  if (p.sex) patch.sex = p.sex === "none" ? null : p.sex;
  if (p.prefs) patch.prefs = { ...(cur?.prefs as object), ...p.prefs };
  if (p.consent) patch.consent_at = new Date().toISOString();
  await db.from("baby_profiles").update(patch).eq("organization_id", ctx.orgId);
  return { ok: true };
});
