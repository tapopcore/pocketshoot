import "server-only";
import { env } from "./env";
import { admin } from "./supabase";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!env.resendKey) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Branded email: white card, PocketShoot logo, one orange button.
 * Table layout and inline styles so it renders the same in Gmail, Outlook and Apple Mail.
 */
export function emailLayout({ preheader, title, body, cta, footer }: { preheader?: string; title: string; body: string; cta?: { label: string; href: string }; footer?: string }) {
  const font = "'Albert Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F6F6F4">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F6F4"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:24px;border:1px solid #E7E7E3">
<tr><td style="padding:32px 36px 0"><a href="${env.appUrl}" style="text-decoration:none"><img src="${env.appUrl}/brand/logo-email.png" width="176" height="36" alt="${esc(env.appName)}" style="display:block;border:0"></a></td></tr>
<tr><td style="padding:28px 36px 0;font-family:${font};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#0B0F11">${title}</td></tr>
<tr><td style="padding:14px 36px 0;font-family:${font};font-size:16px;line-height:1.6;color:#38383C">${body}</td></tr>
${cta ? `<tr><td style="padding:28px 36px 0"><a href="${cta.href}" style="display:inline-block;background:#FC4A12;color:#FFFFFF;font-family:${font};font-size:16px;font-weight:700;text-decoration:none;padding:15px 28px;border-radius:999px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding:32px 36px 32px;font-family:${font};font-size:13px;line-height:1.5;color:#6E6E73">${footer ?? `Sent by ${esc(env.appName)}. <a href="${env.appUrl}/app/settings#notify" style="color:#6E6E73">Change your email settings</a>.`}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Shoot finished. Respects the person's "Photos are ready" setting. */
export async function notifyJobDone(jobId: string) {
  const db = admin();
  const { data: job } = await db.from("generation_jobs").select("id, organization_id, status, source, requested_count, created_by, products(name), profiles:created_by(email, notify_ready)").eq("id", jobId).single();
  if (!job || job.source !== "web") return;
  const who = (job as unknown as { profiles: { email: string; notify_ready: boolean | null } | null }).profiles;
  const name = esc((job as unknown as { products: { name: string } }).products?.name ?? "your product");
  if (!who?.email || who.notify_ready === false) return;
  const { count } = await db.from("generated_assets").select("id", { count: "exact", head: true }).eq("job_id", jobId).neq("quality_status", "fail");
  const made = count ?? 0;
  const link = `${env.appUrl}/app/jobs/${jobId}`;
  await sendEmail(who.email, made ? `Your ${name} photos are ready` : `We couldn't finish your ${name} photos`, made
    ? emailLayout({
      preheader: `${made} of ${job.requested_count} photos are ready to download.`,
      title: `Your ${name} photos are ready`,
      body: `<p style="margin:0">${made} of ${job.requested_count} photos are ready. Check each one at full size before you use it.</p>${made < job.requested_count ? `<p style="margin:12px 0 0">${job.requested_count - made} did not work and were not charged. You can try them again from the shoot.</p>` : ""}<p style="margin:12px 0 0">If a label or logo looks different from your product, report it and you get the credit back.</p>`,
      cta: { label: "See your photos", href: link },
    })
    : emailLayout({
      preheader: "Nothing was charged.",
      title: "This shoot did not work",
      body: `<p style="margin:0">None of the photos for <b>${name}</b> could be finished, so nothing was charged.</p><p style="margin:12px 0 0">You can try each photo again from the shoot. A clear photo near a window, with the whole product in frame, usually fixes it.</p>`,
      cta: { label: "Open the shoot", href: link },
    }));
  await notifyLowCredits(job.organization_id);
}

const LOW = 5;

/** Low balance warning to owners and admins who want it, at most once every 3 days per workspace. */
export async function notifyLowCredits(orgId: string) {
  if (!env.resendKey) return;
  const db = admin();
  const { data: bal } = await db.from("wallet_balances").select("available").eq("organization_id", orgId).maybeSingle();
  const left = bal?.available ?? 0;
  if (left >= LOW) return;
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const { count } = await db.from("analytics_events").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("name", "low_credit_email").gte("created_at", since);
  if (count) return;
  const { data: people } = await db.from("memberships").select("role, profiles(email, notify_low_credits)").eq("organization_id", orgId).in("role", ["owner", "admin"]);
  const to = (people ?? []).map((p) => (p as unknown as { profiles: { email: string; notify_low_credits: boolean | null } | null }).profiles).filter((p) => p?.email && p.notify_low_credits !== false).map((p) => p!.email);
  if (!to.length) return;
  await db.from("analytics_events").insert({ organization_id: orgId, name: "low_credit_email", props: { left } });
  const html = emailLayout({
    preheader: `${left} credit${left === 1 ? "" : "s"} left in your workspace.`,
    title: left ? `${left} credit${left === 1 ? "" : "s"} left` : "You are out of credits",
    body: `<p style="margin:0">${left ? `Your workspace can make ${left} more photo${left === 1 ? "" : "s"}.` : "Your workspace has no credits left, so new shoots cannot start."} Packs start at 5 photos, and paid credits last 12 months.</p>`,
    cta: { label: "Buy credits", href: `${env.appUrl}/app/wallet` },
  });
  for (const email of to) await sendEmail(email, left ? `${left} PocketShoot credit${left === 1 ? "" : "s"} left` : "You are out of PocketShoot credits", html);
}
