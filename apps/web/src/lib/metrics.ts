import "server-only";
import { admin } from "./supabase";

const DAY = 86_400_000;

/** KPI snapshot for the admin overview. Simple queries; move to materialised views when volume grows. */
export async function kpis(days = 30) {
  const db = admin();
  const since = new Date(Date.now() - days * DAY).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = async (table: string, f: (q: any) => any) => {
    const { count } = (await f(db.from(table).select("id", { count: "exact", head: true }))) as { count: number | null };
    return count ?? 0;
  };
  const [signups, events, orders, attempts, items, refunds, wallets, assets] = await Promise.all([
    count("profiles", (q) => q.gte("created_at", since)),
    db.from("analytics_events").select("name, organization_id, created_at").gte("created_at", since).in("name", ["generation_completed", "purchase_completed", "repeat_purchase", "image_downloaded", "trial_issued"]).limit(50000),
    db.from("orders").select("organization_id, total_minor, taxable_minor, currency, credits, channel, created_at").eq("status", "paid").gte("paid_at", since),
    db.from("generation_attempts").select("provider, status, cost_inr, latency_ms, created_at").gte("created_at", since).limit(50000),
    db.from("generation_items").select("status, decision").gte("created_at", since).in("status", ["delivered", "failed"]).limit(50000),
    count("refund_requests", (q) => q.gte("created_at", since)),
    db.from("wallet_balances").select("paid_available, promo_available, consumed"),
    count("generated_assets", (q) => q.gte("created_at", since).neq("quality_status", "fail")),
  ]);
  const ev = events.data ?? [];
  const activated = new Set(ev.filter((e) => e.name === "generation_completed").map((e) => e.organization_id)).size;
  const paying = new Set((orders.data ?? []).map((o) => o.organization_id));
  const repeat = new Set(ev.filter((e) => e.name === "repeat_purchase").map((e) => e.organization_id)).size;
  const revenueInr = (orders.data ?? []).filter((o) => o.currency === "INR").reduce((a, o) => a + o.taxable_minor, 0);
  const revenueUsd = (orders.data ?? []).filter((o) => o.currency === "USD").reduce((a, o) => a + o.taxable_minor, 0);
  const creditsSold = (orders.data ?? []).reduce((a, o) => a + o.credits, 0);
  const spend = (attempts.data ?? []).reduce((a, x) => a + Number(x.cost_inr ?? 0), 0);
  const latencies = (attempts.data ?? []).filter((a) => a.status === "succeeded" && a.latency_ms).map((a) => a.latency_ms as number).sort((a, b) => a - b);
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : null;
  const delivered = (items.data ?? []).filter((i) => i.status === "delivered").length;
  const failed = (items.data ?? []).filter((i) => i.status === "failed").length;
  const review = (items.data ?? []).filter((i) => i.decision === "review").length;
  const outstandingPaid = (wallets.data ?? []).reduce((a, w) => a + w.paid_available, 0);
  const outstandingPromo = (wallets.data ?? []).reduce((a, w) => a + w.promo_available, 0);
  return {
    days, signups, activated, paying: paying.size, repeat, revenueInr, revenueUsd, creditsSold, spendInr: spend,
    costPerApproved: delivered ? spend / delivered : null, p95Ms: p95, delivered, failed,
    failureRate: delivered + failed ? failed / (delivered + failed) : 0, reviewRate: delivered ? review / delivered : 0,
    refundRate: assets ? refunds / assets : 0, refunds, outstandingPaid, outstandingPromo,
    trials: ev.filter((e) => e.name === "trial_issued").length,
    downloads: ev.filter((e) => e.name === "image_downloaded").length,
  };
}

export async function funnel(days = 30) {
  const since = new Date(Date.now() - days * DAY).toISOString();
  const names = ["signup_completed", "trial_issued", "upload_completed", "generation_submitted", "generation_completed", "image_downloaded", "checkout_started", "purchase_completed", "repeat_purchase"];
  const { data } = await admin().from("analytics_events").select("name, organization_id, user_id").gte("created_at", since).in("name", names).limit(100000);
  return names.map((n) => ({ name: n, orgs: new Set((data ?? []).filter((e) => e.name === n).map((e) => e.organization_id ?? e.user_id)).size }));
}

export async function dailySpend(days = 30) {
  const since = new Date(Date.now() - days * DAY).toISOString();
  const [{ data: attempts }, { data: items }] = await Promise.all([
    admin().from("generation_attempts").select("provider, status, cost_inr, created_at").gte("created_at", since).limit(100000),
    admin().from("generation_items").select("status, updated_at").eq("status", "delivered").gte("updated_at", since).limit(100000),
  ]);
  const byDay = new Map<string, { day: string; spend: number; attempts: number; failed: number; delivered: number; byProvider: Record<string, number> }>();
  const key = (d: string) => d.slice(0, 10);
  for (const a of attempts ?? []) {
    const k = key(a.created_at);
    const row = byDay.get(k) ?? { day: k, spend: 0, attempts: 0, failed: 0, delivered: 0, byProvider: {} };
    row.spend += Number(a.cost_inr ?? 0);
    row.attempts++;
    if (a.status === "failed") row.failed++;
    row.byProvider[a.provider] = (row.byProvider[a.provider] ?? 0) + Number(a.cost_inr ?? 0);
    byDay.set(k, row);
  }
  for (const i of items ?? []) {
    const k = key(i.updated_at);
    const row = byDay.get(k) ?? { day: k, spend: 0, attempts: 0, failed: 0, delivered: 0, byProvider: {} };
    row.delivered++;
    byDay.set(k, row);
  }
  return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
}
