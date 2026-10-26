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

function layout(body: string) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1a1a1a">
    <div style="font-weight:700;font-size:18px;margin-bottom:16px">${env.appName}</div>${body}
    <p style="color:#777;font-size:12px;margin-top:32px">You're getting this because you started a photoshoot on ${env.appName}.</p></div>`;
}

export async function notifyJobDone(jobId: string) {
  const db = admin();
  const { data: job } = await db.from("generation_jobs").select("id, status, source, requested_count, created_by, products(name), profiles:created_by(email)").eq("id", jobId).single();
  if (!job || job.source !== "web") return;
  const email = (job as unknown as { profiles: { email: string } | null }).profiles?.email;
  const name = (job as unknown as { products: { name: string } }).products?.name ?? "your product";
  if (!email) return;
  const { count } = await db.from("generated_assets").select("id", { count: "exact", head: true }).eq("job_id", jobId).neq("quality_status", "fail");
  const ok = (count ?? 0) > 0;
  await sendEmail(
    email,
    ok ? `Your ${name} photos are ready` : `We couldn't finish your ${name} shoot`,
    layout(ok
      ? `<p>${count} of ${job.requested_count} images for <b>${name}</b> are ready.</p><p>Check each one at full size before you use it. If a label or logo looks different from your product, report it and you'll get the credit back.</p><p><a href="${env.appUrl}/app/jobs/${jobId}" style="background:#1a1a1a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">See your photos</a></p>`
      : `<p>None of the images for <b>${name}</b> could be completed. No credits were used.</p><p>A clearer photo on a plain background usually fixes this. <a href="${env.appUrl}/app/jobs/${jobId}">Open the shoot</a></p>`),
  );
}
