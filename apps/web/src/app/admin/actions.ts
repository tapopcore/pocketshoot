"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatform } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { audit } from "@/lib/observe";
import { decideRefund } from "@/lib/assets";
import { saveSetting, type Settings } from "@/lib/settings";
import { randomToken } from "@/lib/crypto";
import type { ActionState } from "@/app/app/actions";

export async function adjustCreditsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("platform_admin");
  const orgId = String(form.get("orgId"));
  const qty = Number(form.get("quantity"));
  const note = String(form.get("note") ?? "").trim();
  if (!Number.isInteger(qty) || qty === 0 || Math.abs(qty) > 10000) return { error: "Enter a whole number (negative to remove)" };
  if (note.length < 5) return { error: "Add a reason (it's stored in the audit log)" };
  const { error } = await admin().rpc("adjust_credits", { p_org: orgId, p_quantity: qty, p_actor: ctx.userId, p_note: note, p_idempotency_key: `adj:${randomToken(10)}` });
  if (error) return { error: error.message };
  await audit(ctx, "admin.credits.adjust", { type: "org", id: orgId }, { quantity: qty, note });
  revalidatePath(`/admin/orgs/${orgId}`);
  return { ok: true, message: `${qty > 0 ? "Added" : "Removed"} ${Math.abs(qty)} credits` };
}

export async function suspendOrgAction(form: FormData) {
  const ctx = await requirePlatform("platform_admin");
  const orgId = String(form.get("orgId"));
  const suspend = String(form.get("suspend")) === "1";
  await admin().from("organizations").update({ status: suspend ? "suspended" : "active", suspended_reason: suspend ? String(form.get("reason") ?? "Admin action") : null }).eq("id", orgId);
  await audit(ctx, suspend ? "admin.org.suspend" : "admin.org.unsuspend", { type: "org", id: orgId });
  revalidatePath(`/admin/orgs/${orgId}`);
}

export async function decideRefundAction(form: FormData) {
  const ctx = await requirePlatform();
  await decideRefund(ctx, String(form.get("id")), String(form.get("approve")) === "1", String(form.get("resolution") ?? "").slice(0, 500) || (String(form.get("approve")) === "1" ? "Confirmed product change" : "The product matches the reference"));
  revalidatePath("/admin/refunds");
}

const packSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(1).max(60),
  credits: z.coerce.number().int().positive().max(100000),
  price: z.coerce.number().nonnegative(),
  currency: z.enum(["INR", "USD"]),
  channel: z.enum(["web", "shopify", "ios", "android"]),
  storeProductId: z.string().max(100).optional(),
  badge: z.string().max(30).optional(),
  sort: z.coerce.number().int().default(0),
});

/** Editing a pack creates a new version so old orders keep their snapshot. */
export async function savePackAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("platform_admin");
  const p = packSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues.map((i) => `${i.path}: ${i.message}`).join("; ") };
  const v = p.data;
  const db = admin();
  const { data: prev } = await db.from("pricing_packs").select("version").eq("code", v.code).eq("channel", v.channel).order("version", { ascending: false }).limit(1).maybeSingle();
  await db.from("pricing_packs").update({ active: false }).eq("code", v.code).eq("channel", v.channel);
  const { error } = await db.from("pricing_packs").insert({
    code: v.code, version: (prev?.version ?? 0) + 1, name: v.name, credits: v.credits, price_minor: Math.round(v.price * 100),
    currency: v.currency, channel: v.channel, store_product_id: v.storeProductId || null, badge: v.badge || null, sort: v.sort, active: true,
  });
  if (error) return { error: error.message };
  await audit(ctx, "admin.pack.save", { type: "pack", id: `${v.channel}:${v.code}` }, v);
  revalidatePath("/admin/pricing");
  return { ok: true, message: "Pack saved (new version live)" };
}

export async function togglePackAction(form: FormData) {
  const ctx = await requirePlatform("platform_admin");
  const id = String(form.get("id"));
  const active = String(form.get("active")) === "1";
  await admin().from("pricing_packs").update({ active }).eq("id", id);
  await audit(ctx, "admin.pack.toggle", { type: "pack", id }, { active });
  revalidatePath("/admin/pricing");
}

export async function saveCouponAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("platform_admin");
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return { error: "Code must be 3 to 30 letters or numbers" };
  const row = {
    code,
    percent_off: Number(form.get("percentOff") || 0),
    bonus_credits: Number(form.get("bonusCredits") || 0),
    max_redemptions: form.get("maxRedemptions") ? Number(form.get("maxRedemptions")) : null,
    per_org_limit: Number(form.get("perOrgLimit") || 1),
    valid_until: form.get("validUntil") ? new Date(String(form.get("validUntil"))).toISOString() : null,
    pack_codes: String(form.get("packCodes") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    active: true,
  };
  if (row.percent_off < 0 || row.percent_off > 100) return { error: "Discount must be 0 to 100%" };
  const { error } = await admin().from("coupons").upsert(row, { onConflict: "code" });
  if (error) return { error: error.message };
  await audit(ctx, "admin.coupon.save", { type: "coupon", id: code }, row);
  revalidatePath("/admin/pricing");
  return { ok: true, message: `Coupon ${code} saved` };
}

export async function toggleCouponAction(form: FormData) {
  const ctx = await requirePlatform("platform_admin");
  await admin().from("coupons").update({ active: String(form.get("active")) === "1" }).eq("id", String(form.get("id")));
  await audit(ctx, "admin.coupon.toggle", { type: "coupon", id: String(form.get("id")) });
  revalidatePath("/admin/pricing");
}

/** Saves one settings group from a JSON textarea, validated against the existing shape. */
export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("platform_admin");
  const key = String(form.get("key")) as keyof Settings;
  const allowed: (keyof Settings)[] = ["credit_policy", "providers", "quality", "seller", "shopify_billing", "fx_fallback", "retention"];
  if (!allowed.includes(key)) return { error: "Unknown setting" };
  let value: unknown;
  try { value = JSON.parse(String(form.get("value"))); } catch { return { error: "That isn't valid JSON" }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Settings must be a JSON object" };
  await saveSetting(key, value as never, ctx.userId);
  await audit(ctx, "admin.settings.save", { type: "setting", id: key }, value as Record<string, unknown>);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Saved. Takes effect within 30 seconds." };
}

export async function saveFlagAction(form: FormData) {
  const ctx = await requirePlatform("platform_admin");
  const key = String(form.get("key")).trim();
  const scope = String(form.get("scope") || "global").trim();
  const value = String(form.get("value")) === "true";
  if (!/^[a-z0-9_]+$/.test(key)) return;
  await admin().from("feature_flags").upsert({ key, scope, value, updated_at: new Date().toISOString() }, { onConflict: "key,scope" });
  await audit(ctx, "admin.flag", { type: "flag", id: `${key}@${scope}` }, { value });
  revalidatePath("/admin/settings");
}

export async function staffReplyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requirePlatform();
  const ticketId = String(form.get("ticketId"));
  const body = String(form.get("body") ?? "").trim();
  const status = String(form.get("status") ?? "pending");
  const db = admin();
  if (body) await db.from("support_messages").insert({ ticket_id: ticketId, author_id: ctx.userId, is_staff: true, body: body.slice(0, 4000) });
  await db.from("support_tickets").update({ status, assignee_id: ctx.userId, updated_at: new Date().toISOString() }).eq("id", ticketId);
  revalidatePath(`/admin/support`);
  return { ok: true, message: "Sent" };
}

export async function resolveAlertAction(form: FormData) {
  await requirePlatform();
  await admin().from("alerts").update({ resolved_at: new Date().toISOString() }).eq("id", String(form.get("id")));
  revalidatePath("/admin");
}

export async function rateOutputAction(form: FormData) {
  const ctx = await requirePlatform();
  const assetId = String(form.get("assetId"));
  const usable = String(form.get("usable")) === "1";
  const { data: a } = await admin().from("generated_assets").select("organization_id, generation_jobs!generated_assets_job_id_fkey(style, mode, settings)").eq("id", assetId).single();
  const job = (a as unknown as { generation_jobs: { style: string; mode: string; settings: { category?: string } } } | null)?.generation_jobs;
  await admin().from("analytics_events").insert({ name: "human_rating", user_id: ctx.userId, organization_id: a?.organization_id, props: { assetId, usable, style: job?.style, mode: job?.mode, category: job?.settings?.category } });
  revalidatePath("/admin/quality");
}

export async function setPlatformRoleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requirePlatform("platform_admin");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "");
  const { data: p } = await admin().from("profiles").select("id").eq("email", email).maybeSingle();
  if (!p) return { error: "No user with that email has signed in yet" };
  await admin().from("profiles").update({ platform_role: role || null }).eq("id", p.id);
  await audit(ctx, "admin.platform_role", { type: "user", id: p.id }, { role: role || null });
  return { ok: true, message: role ? `${email} is now ${role}` : `Removed staff access for ${email}` };
}

/** Adds or removes a real customer image on the public Examples page. Only with the customer's permission. */
export async function featureAssetAction(form: FormData) {
  const ctx = await requirePlatform("platform_admin");
  const assetId = String(form.get("assetId"));
  const remove = String(form.get("remove")) === "1";
  const db = admin();
  const { data } = await db.from("app_settings").select("value").eq("key", "showcase").maybeSingle();
  const items = ((data?.value as { items?: { assetId: string; caption: string; category: string }[] })?.items ?? []).filter((i) => i.assetId !== assetId);
  if (!remove) items.unshift({ assetId, caption: String(form.get("caption") ?? "").slice(0, 120), category: String(form.get("category") ?? "other") });
  await db.from("app_settings").upsert({ key: "showcase", value: { items: items.slice(0, 24) }, updated_by: ctx.userId, updated_at: new Date().toISOString() });
  await audit(ctx, remove ? "admin.showcase.remove" : "admin.showcase.add", { type: "asset", id: assetId });
  revalidatePath("/admin/quality");
  revalidatePath("/examples");
}
