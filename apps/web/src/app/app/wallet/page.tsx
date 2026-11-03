import Link from "next/link";
import { INDIAN_STATES } from "@packshot/core";
import { requireWeb, hasRole } from "@/lib/auth";
import { getWallet } from "@/lib/credits";
import { paymentMode } from "@/lib/billing";
import { admin } from "@/lib/supabase";
import { PageHeader, formatDate, money } from "@/components/ui";
import { BuyPacks } from "./buy-packs";

export const metadata = { title: "Credits" };

const ENTRY: Record<string, string> = {
  purchase: "Credits bought", promo: "Bonus credits", trial: "Free welcome photos", adjustment_credit: "Added by support", reserve: "Held for a shoot",
  release: "Returned, photo not made", capture: "Photo made", refund: "Returned after review", expiry: "Expired", chargeback: "Removed, payment refunded", adjustment_debit: "Removed by support",
};
const PLUS = ["purchase", "promo", "trial", "adjustment_credit", "release", "refund"];
const BUCKETS = 10, DAYS = 30;

export default async function Wallet({ searchParams }: { searchParams: Promise<{ paid?: string; pack?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const db = admin();
  const since = new Date(Date.now() - DAYS * 86400000);
  const [wallet, { data: packs }, { data: entries }, { data: orders }, { data: org }, { data: used }] = await Promise.all([
    getWallet(ctx.orgId),
    db.from("pricing_packs").select("id, code, name, credits, price_minor, currency, badge").eq("channel", "web").eq("active", true).order("sort"),
    db.from("credit_ledger").select("id, entry_type, quantity, created_at, job_id").eq("organization_id", ctx.orgId).neq("entry_type", "reserve").order("created_at", { ascending: false }).limit(30),
    db.from("orders").select("id, credits, total_minor, currency, status, created_at, channel, invoice_id, invoices(number)").eq("organization_id", ctx.orgId).in("status", ["paid", "refunded"]).order("created_at", { ascending: false }).limit(30),
    db.from("organizations").select("billing_name, billing_gstin, billing_state_code").eq("id", ctx.orgId).single(),
    db.from("credit_ledger").select("quantity, created_at").eq("organization_id", ctx.orgId).eq("entry_type", "capture").gte("created_at", since.toISOString()).limit(5000),
  ]);
  const mode = paymentMode();
  // Photos made in the last 30 days, in ten 3-day bars.
  const bars = Array.from({ length: BUCKETS }, () => 0);
  for (const u of used ?? []) bars[Math.min(BUCKETS - 1, Math.floor((new Date(u.created_at).getTime() - since.getTime()) / (DAYS * 86400000 / BUCKETS)))] += u.quantity;
  const made = bars.reduce((a, b) => a + b, 0), top = Math.max(1, ...bars);
  const nextExpiry = wallet.lots.filter((l) => l.available > 0 && l.expiresAt).sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!))[0];
  const fmt = (d: Date) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);

  return (
    <div className="pg-credits">
      <PageHeader title="Credits">1 credit makes 1 photo. Failed photos are never charged. Paid credits last 12 months.</PageHeader>
      {sp.paid && <div className="note good" role="status">Payment received. Your new balance is below.</div>}
      <div className="cr">
        <div className="bal">
          <span className="sm" style={{ color: "var(--on-night-2)" }}>Credits left</span>
          <div className="row" style={{ alignItems: "baseline", gap: "var(--s3)", marginTop: "var(--s2)" }}><span className="v num">{wallet.available}</span><span style={{ color: "var(--on-night-2)" }}>{wallet.available === 1 ? "enough for 1 photo" : `enough for ${wallet.available} photos`}</span></div>
          <div className="use">
            <div className="between sm"><span style={{ color: "var(--on-night-2)" }}>Photos made in the last 30 days</span><b className="num">{made}</b></div>
            <div className="bars" role="img" aria-label={`${made} photos made in the last 30 days`}>{bars.map((b, i) => <i key={i} title={`${b} photo${b === 1 ? "" : "s"}`} className={i === BUCKETS - 1 ? "now" : ""} style={{ height: `${b ? Math.max(8, (b / top) * 100) : 4}%` }} />)}</div>
            <div className="between xs" style={{ color: "var(--on-night-2)", marginTop: 8 }}><span>{fmt(since)}</span><span>Today</span></div>
          </div>
          <div className="bd">
            <div><b className="num">{wallet.reserved ?? 0}</b><span>In use right now</span></div>
            <div><b className="num">{wallet.paidAvailable ?? 0}</b><span>{nextExpiry ? `Next expiry ${fmt(new Date(nextExpiry.expiresAt!))}` : "Paid credits"}</span></div>
            <div><b className="num">{wallet.promoAvailable ?? 0}</b><span>Free and bonus</span></div>
          </div>
        </div>
        {hasRole(ctx, "admin")
          ? <div className="buycol">
            {mode === "off" && <div className="note">Payments are being set up. Please check back soon or contact support.</div>}
            <BuyPacks packs={packs ?? []} mode={mode} initial={sp.pack} defaults={{ name: org?.billing_name ?? "", gstin: org?.billing_gstin ?? "", state: org?.billing_state_code ?? "" }} states={Object.entries(INDIAN_STATES)} email={ctx.email ?? ""} />
          </div>
          : <div className="buy card"><h2 className="h4">Need more credits?</h2><p className="sm muted" style={{ marginTop: 6 }}>Ask a workspace owner or admin to buy a pack. Everyone in the workspace shares the same credits.</p></div>}
      </div>
      {mode === "sandbox" && <p className="xs muted" style={{ marginTop: "var(--s3)" }}>Test mode: payments are simulated and no money moves.</p>}

      <div className="hist">
        <section>
          <h2 className="h3">History</h2>
          <div className="card" style={{ marginTop: "var(--s4)", overflowX: "auto" }}><table className="tbl"><thead><tr><th>Date</th><th>Details</th><th style={{ textAlign: "right" }}>Credits</th></tr></thead><tbody>
            {(entries ?? []).length === 0 && <tr><td colSpan={3} className="muted">No activity yet.</td></tr>}
            {(entries ?? []).map((e) => {
              const plus = PLUS.includes(e.entry_type), used = e.entry_type === "capture";
              return <tr key={e.id}><td className="muted">{formatDate(e.created_at)}</td><td>{e.job_id ? <Link href={`/app/jobs/${e.job_id}`}>{ENTRY[e.entry_type] ?? e.entry_type}</Link> : ENTRY[e.entry_type] ?? e.entry_type}</td><td className="num" style={{ textAlign: "right", fontWeight: 600, color: plus ? "var(--good)" : used ? "var(--ink)" : "var(--muted)" }}>{plus ? "+" : "−"}{e.quantity}</td></tr>;
            })}
          </tbody></table></div>
        </section>
        <section>
          <h2 className="h3">Invoices</h2>
          <div className="card" style={{ marginTop: "var(--s4)", overflowX: "auto" }}><table className="tbl"><thead><tr><th>Date</th><th>Pack</th><th style={{ textAlign: "right" }}>Invoice</th></tr></thead><tbody>
            {(orders ?? []).length === 0 && <tr><td colSpan={3} className="muted">No purchases yet.</td></tr>}
            {(orders ?? []).map((o) => {
              const inv = (o as unknown as { invoices: { number: string } | null }).invoices;
              return <tr key={o.id}><td className="muted">{formatDate(o.created_at)}</td><td>{o.credits} credits · {money(o.total_minor, o.currency)}</td><td style={{ textAlign: "right" }}>{o.status === "refunded" ? <span className="pill bad sm">Refunded</span> : inv ? <Link className="link sm" href={`/app/invoices/${o.invoice_id}`}>{inv.number}</Link> : <span className="xs muted">Billed by {o.channel === "shopify" ? "Shopify" : "app store"}</span>}</td></tr>;
            })}
          </tbody></table></div>
        </section>
      </div>
    </div>
  );
}
