"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isValidGstin, INDIAN_STATES } from "@packshot/core";
import { ORG_COOKIE, requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { audit } from "@/lib/observe";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { emailLayout, sendEmail } from "@/lib/email";
import { putObject } from "@/lib/storage";
import sharp from "sharp";
import { BRAND_MOODS } from "@/lib/brand-moods";

export type ActionState = { ok?: boolean; error?: string; message?: string; link?: string } | null;


export async function switchOrg(form: FormData) {
  const ctx = await requireWeb();
  const orgId = String(form.get("orgId"));
  const { data } = await admin().from("memberships").select("id").eq("user_id", ctx.userId!).eq("organization_id", orgId).maybeSingle();
  if (data) (await cookies()).set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  businessType: z.string().max(60).optional(),
  preferredLanguage: z.enum(["en", "hi"]),
  billingName: z.string().max(160).optional(),
  billingGstin: z.string().max(15).optional(),
  billingAddress: z.string().max(400).optional(),
  billingStateCode: z.string().max(2).optional(),
});

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb("admin");
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the highlighted details" };
  const v = parsed.data;
  const gstin = v.billingGstin?.trim().toUpperCase() || null;
  if (gstin && !isValidGstin(gstin)) return { error: "That GSTIN doesn't look right" };
  const state = gstin ? gstin.slice(0, 2) : v.billingStateCode || null;
  if (state && !(state in INDIAN_STATES)) return { error: "Choose a valid state" };
  await admin().from("organizations").update({
    name: v.name, business_type: v.businessType || null, preferred_language: v.preferredLanguage,
    billing_name: v.billingName || null, billing_gstin: gstin, billing_address: v.billingAddress || null, billing_state_code: state,
  }).eq("id", ctx.orgId);
  await admin().from("profiles").update({ locale: v.preferredLanguage }).eq("id", ctx.userId!);
  await audit(ctx, "org.settings", { type: "org", id: ctx.orgId });
  revalidatePath("/app", "layout");
  return { ok: true, message: "Saved" };
}

// ---------------------------------------------------------------- team

export async function inviteMember(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb("admin");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = String(form.get("role") ?? "editor");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email" };
  if (!["admin", "editor", "viewer"].includes(role)) return { error: "Choose a role" };
  const token = randomToken();
  await admin().from("invitations").insert({ organization_id: ctx.orgId, email, role, token_hash: sha256(token), invited_by: ctx.userId });
  const link = `${env.appUrl}/invite/${token}`;
  const org = ctx.orgName.replace(/[&<>"]/g, "");
  const sent = await sendEmail(email, `${org} invited you to ${env.appName}`, emailLayout({
    preheader: `Join ${org} on ${env.appName}.`,
    title: `Join ${org} on ${env.appName}`,
    body: `<p style="margin:0">${ctx.email ? ctx.email.replace(/[<>]/g, "") + " invited you" : "You are invited"} to the <b>${org}</b> workspace as ${role === "viewer" ? "a viewer, so you can see and download photos" : role === "admin" ? "an admin" : "an editor, so you can create shoots"}.</p><p style="margin:12px 0 0">The invitation works for 7 days.</p>`,
    cta: { label: "Accept the invitation", href: link },
    footer: `If you were not expecting this, you can ignore this email.`,
  }));
  await audit(ctx, "team.invite", { type: "invitation", id: email }, { role });
  revalidatePath("/app/team");
  return { ok: true, message: sent ? `Invitation sent to ${email}` : "Invitation created. Email isn't set up, so share this link:", link: sent ? undefined : link };
}

export async function changeRole(form: FormData) {
  const ctx = await requireWeb("admin");
  const memberId = String(form.get("memberId"));
  const role = String(form.get("role"));
  if (!["admin", "editor", "viewer"].includes(role)) return;
  const db = admin();
  const { data: m } = await db.from("memberships").select("id, role, user_id").eq("id", memberId).eq("organization_id", ctx.orgId).single();
  if (!m || m.role === "owner") return;
  await db.from("memberships").update({ role }).eq("id", memberId);
  await audit(ctx, "team.role", { type: "membership", id: memberId }, { from: m.role, to: role });
  revalidatePath("/app/team");
}

export async function removeMember(form: FormData) {
  const ctx = await requireWeb("admin");
  const memberId = String(form.get("memberId"));
  const db = admin();
  const { data: m } = await db.from("memberships").select("id, role, user_id").eq("id", memberId).eq("organization_id", ctx.orgId).single();
  if (!m || m.role === "owner" || m.user_id === ctx.userId) return;
  await db.from("memberships").delete().eq("id", memberId);
  await audit(ctx, "team.remove", { type: "membership", id: memberId });
  revalidatePath("/app/team");
}

export async function revokeInvite(form: FormData) {
  const ctx = await requireWeb("admin");
  await admin().from("invitations").delete().eq("id", String(form.get("id"))).eq("organization_id", ctx.orgId);
  revalidatePath("/app/team");
}

// ---------------------------------------------------------------- brand kits & projects

export async function saveBrandKit(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb("editor");
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Give the kit a name" };
  const palette = [...new Set(form.getAll("palette").flatMap((v) => String(v).split(/[\s,]+/)).map((c) => c.trim().toUpperCase()).filter((c) => /^#[0-9A-F]{6}$/.test(c)))].slice(0, 6);
  const row: Record<string, unknown> = {
    organization_id: ctx.orgId, name, palette,
    style_rules: String(form.get("styleRules") ?? "").slice(0, 600) || null,
    default_style: String(form.get("defaultStyle") ?? "") || null,
    default_output: String(form.get("defaultOutput") ?? "") || null,
    moods: form.getAll("moods").map(String).filter((m) => BRAND_MOODS.includes(m as (typeof BRAND_MOODS)[number])).slice(0, 4),
  };
  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 5 * 1024 * 1024) return { error: "Logo must be under 5 MB" };
    const png = await sharp(Buffer.from(await logo.arrayBuffer())).resize(800, 800, { fit: "inside" }).png().toBuffer().catch(() => null);
    if (!png) return { error: "The logo must be a PNG, JPG or WebP image" };
    const key = `${ctx.orgId}/${randomToken(8)}.png`;
    await putObject("brand", key, png, "image/png");
    row.logo_key = key;
  }
  const db = admin();
  if (id) await db.from("brand_kits").update(row).eq("id", id).eq("organization_id", ctx.orgId);
  else await db.from("brand_kits").insert(row);
  revalidatePath("/app/brand");
  return { ok: true, message: "Brand kit saved" };
}

export async function deleteBrandKit(form: FormData) {
  const ctx = await requireWeb("editor");
  await admin().from("brand_kits").delete().eq("id", String(form.get("id"))).eq("organization_id", ctx.orgId);
  revalidatePath("/app/brand");
}

export async function createProject(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb("editor");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Give the project a name" };
  await admin().from("projects").insert({ organization_id: ctx.orgId, name: name.slice(0, 120), brand_kit_id: String(form.get("brandKitId") ?? "") || null });
  revalidatePath("/app/projects");
  return { ok: true };
}

export async function archiveProject(form: FormData) {
  const ctx = await requireWeb("editor");
  await admin().from("projects").update({ status: String(form.get("status")) === "active" ? "active" : "archived" }).eq("id", String(form.get("id"))).eq("organization_id", ctx.orgId);
  revalidatePath("/app/projects");
}

// ---------------------------------------------------------------- support

export async function createTicket(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb();
  const subject = String(form.get("subject") ?? "").trim().slice(0, 160);
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  if (!subject || !body) return { error: "Add a subject and a message" };
  const db = admin();
  const { data: t } = await db.from("support_tickets").insert({ organization_id: ctx.orgId, created_by: ctx.userId, subject, related_job_id: String(form.get("jobId") ?? "") || null }).select("id").single();
  await db.from("support_messages").insert({ ticket_id: t!.id, author_id: ctx.userId, body });
  if (env.alertEmail) await sendEmail(env.alertEmail, `Support: ${subject}`, `<p>${ctx.orgName} (${ctx.email})</p><p>${body.replace(/</g, "&lt;")}</p>`);
  redirect(`/app/support/${t!.id}`);
}

export async function replyTicket(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb();
  const ticketId = String(form.get("ticketId"));
  const body = String(form.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return { error: "Write a message" };
  const db = admin();
  const { data: t } = await db.from("support_tickets").select("id").eq("id", ticketId).eq("organization_id", ctx.orgId).single();
  if (!t) return { error: "Ticket not found" };
  await db.from("support_messages").insert({ ticket_id: ticketId, author_id: ctx.userId, body });
  await db.from("support_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", ticketId);
  revalidatePath(`/app/support/${ticketId}`);
  return { ok: true };
}

export async function requestDeletion(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb("owner");
  if (String(form.get("confirm")) !== "DELETE") return { error: "Type DELETE to confirm" };
  const db = admin();
  const { data: t } = await db.from("support_tickets").insert({ organization_id: ctx.orgId, created_by: ctx.userId, subject: "Account and data deletion request", priority: "high" }).select("id").single();
  await db.from("support_messages").insert({ ticket_id: t!.id, author_id: ctx.userId, body: "Please delete this workspace, its product photos and generated images. (Invoices are kept as required by tax law.)" });
  await audit(ctx, "org.deletion_requested", { type: "org", id: ctx.orgId });
  return { ok: true, message: "We've received your request and will confirm by email within 7 days." };
}

/** Email preferences for the signed-in person, not the whole workspace. */
export async function saveNotifications(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireWeb();
  if (!ctx.userId) return { error: "Sign in again to change notifications" };
  const on = (k: string) => form.get(k) === "on";
  const { error } = await admin().from("profiles").update({ notify_ready: on("ready"), notify_low_credits: on("low"), notify_news: on("news") }).eq("id", ctx.userId);
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/app/settings");
  return { ok: true, message: "Notifications saved" };
}
