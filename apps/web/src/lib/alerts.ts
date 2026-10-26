import "server-only";
import { admin } from "./supabase";
import { env } from "./env";
import { sendEmail } from "./email";
import { getSettings } from "./settings";
import { applyRetention } from "./retention";
import { logError, logInfo } from "./observe";

type Alert = { kind: string; severity: "info" | "warning" | "critical"; message: string; data?: Record<string, unknown> };

async function updateFx() {
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { date: string; rates: { INR: number } };
    await admin().from("fx_rates").upsert({ rate_date: j.date, base: "USD", quote: "INR", rate: j.rates.INR, source: "frankfurter.app (ECB)" });
    return j.rates.INR;
  } catch (e) {
    await logError("cron.fx", (e as Error).message);
    return null;
  }
}

export async function runDailyChecks() {
  const db = admin();
  const now = Date.now();
  const day = new Date(now - 86_400_000).toISOString();
  const week = new Date(now - 8 * 86_400_000).toISOString();
  const month = new Date(now - 30 * 86_400_000).toISOString();
  const alerts: Alert[] = [];

  const { data: expired } = await db.rpc("expire_credit_lots");
  const settings = await getSettings(true);
  const retention = await applyRetention(settings.retention.failedDays);
  const fx = await updateFx();

  // Provider spend spike
  const { data: spend } = await db.from("generation_attempts").select("cost_inr, created_at").gte("created_at", week);
  const today = (spend ?? []).filter((s) => s.created_at >= day).reduce((a, s) => a + Number(s.cost_inr ?? 0), 0);
  const prior = (spend ?? []).filter((s) => s.created_at < day).reduce((a, s) => a + Number(s.cost_inr ?? 0), 0) / 7;
  if (today > 500 && prior > 0 && today > prior * 2.5) alerts.push({ kind: "cost_spike", severity: "warning", message: `AI spend in the last 24h is ₹${today.toFixed(0)}, ${(today / prior).toFixed(1)}× the daily average.`, data: { today, prior } });

  // Error rate
  const { data: items } = await db.from("generation_items").select("status, last_error").gte("updated_at", day).in("status", ["delivered", "failed"]);
  const failed = (items ?? []).filter((i) => i.status === "failed");
  if ((items?.length ?? 0) >= 10 && failed.length / items!.length > 0.2) {
    const codes: Record<string, number> = {};
    for (const f of failed) { const c = f.last_error?.split(":")[0] ?? "unknown"; codes[c] = (codes[c] ?? 0) + 1; }
    alerts.push({ kind: "error_rate", severity: "critical", message: `${failed.length} of ${items!.length} images failed in the last 24h.`, data: codes });
  }

  // Provider outage: no successful attempts but many failures in the last hour
  const hour = new Date(now - 3_600_000).toISOString();
  const { data: recent } = await db.from("generation_attempts").select("provider, status").gte("created_at", hour);
  for (const p of ["gemini", "openai", "fal"]) {
    const rows = (recent ?? []).filter((r) => r.provider === p);
    if (rows.length >= 5 && rows.every((r) => r.status === "failed")) alerts.push({ kind: "provider_outage", severity: "critical", message: `Every ${p} request failed in the last hour.` });
  }

  // Refund abuse
  const { data: reports } = await db.from("refund_requests").select("organization_id").gte("created_at", month);
  const byOrg = new Map<string, number>();
  for (const r of reports ?? []) byOrg.set(r.organization_id, (byOrg.get(r.organization_id) ?? 0) + 1);
  for (const [org, n] of byOrg) if (n >= 8) alerts.push({ kind: "refund_abuse", severity: "warning", message: `A workspace filed ${n} reports in 30 days.`, data: { org } });

  // Payment reconciliation
  const twoHours = new Date(now - 2 * 3_600_000).toISOString();
  const { count: stuckOrders } = await db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending").lt("created_at", twoHours).gte("created_at", week);
  const { count: badHooks } = await db.from("webhook_events").select("id", { count: "exact", head: true }).not("error", "is", null).is("processed_at", null);
  if ((stuckOrders ?? 0) > 0 || (badHooks ?? 0) > 0) alerts.push({ kind: "payment_reconciliation", severity: "warning", message: `${stuckOrders ?? 0} orders pending for over 2 hours, ${badHooks ?? 0} webhooks failed to process.` });

  // Stuck queue
  const thirty = new Date(now - 30 * 60_000).toISOString();
  const { count: stuck } = await db.from("generation_items").select("id", { count: "exact", head: true }).in("status", ["queued", "preparing", "generating", "checking"]).lt("created_at", thirty);
  if ((stuck ?? 0) > 0) alerts.push({ kind: "queue_stuck", severity: "warning", message: `${stuck} images have been waiting more than 30 minutes. Check the worker cron.` });

  // Outstanding liability (unused paid credits)
  const { data: liab } = await db.from("wallet_balances").select("paid_available");
  const outstanding = (liab ?? []).reduce((a, r) => a + r.paid_available, 0);
  if (outstanding > 20_000) alerts.push({ kind: "credit_liability", severity: "info", message: `${outstanding.toLocaleString("en-IN")} paid credits are unused across all workspaces.` });

  if (alerts.length) {
    await db.from("alerts").insert(alerts.map((a) => ({ ...a, data: a.data ?? {} })));
    if (env.alertEmail) {
      await sendEmail(env.alertEmail, `${env.appName}: ${alerts.length} alert(s)`, alerts.map((a) => `<p><b>${a.severity.toUpperCase()}</b> ${a.message}</p>`).join(""));
    }
  }
  const summary = { expiredLots: expired, retention, fx, alerts: alerts.length };
  await logInfo("cron.daily", "Daily checks finished", summary);
  return summary;
}
