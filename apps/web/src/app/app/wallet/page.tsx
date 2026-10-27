import Link from "next/link";
import { INDIAN_STATES } from "@packshot/core";
import { requireWeb, hasRole } from "@/lib/auth";
import { getWallet } from "@/lib/credits";
import { paymentMode } from "@/lib/billing";
import { admin } from "@/lib/supabase";
import { Badge, Card, Notice, PageHeader, Stat, formatDate, money } from "@/components/ui";
import { BuyPacks } from "./buy-packs";

export const metadata = { title: "Credits" };

const ENTRY: Record<string, string> = {
  purchase: "Bought", promo: "Bonus", trial: "Free trial", adjustment_credit: "Added by support", reserve: "Held for a shoot",
  release: "Returned (not used)", capture: "Used", refund: "Returned after review", expiry: "Expired", chargeback: "Removed (payment refunded)", adjustment_debit: "Removed by support",
};

export default async function Wallet({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const db = admin();
  const [wallet, { data: packs }, { data: entries }, { data: orders }, { data: org }] = await Promise.all([
    getWallet(ctx.orgId),
    db.from("pricing_packs").select("id, code, name, credits, price_minor, currency, badge").eq("channel", "web").eq("active", true).order("sort"),
    db.from("credit_ledger").select("id, entry_type, quantity, created_at, job_id").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(40),
    db.from("orders").select("id, credits, total_minor, currency, status, created_at, channel, invoice_id, invoices(number)").eq("organization_id", ctx.orgId).in("status", ["paid", "refunded"]).order("created_at", { ascending: false }).limit(30),
    db.from("organizations").select("billing_name, billing_gstin, billing_state_code").eq("id", ctx.orgId).single(),
  ]);
  const mode = paymentMode();
  const expiring = wallet.lots.filter((l) => l.available > 0 && l.expiresAt).sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!));

  return (
    <div>
      <PageHeader eyebrow="Pay as you go" title="Credits">One credit makes one delivered image. No subscription. Paid credits last 12 months.</PageHeader>
      {sp.paid && <Notice tone="good" className="mb-6">Check the balance and history below for your payment status.</Notice>}
      <Link href="/app/new" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Continue your saved shoot →</Link>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Available" value={wallet.available} accent />
        <Stat label="Paid" value={wallet.paidAvailable} sub={wallet.promoAvailable ? `+${wallet.promoAvailable} free/bonus` : undefined} />
        <Stat label="In progress" value={wallet.reserved} sub="Held for running shoots" />
        <Stat label="Used" value={wallet.consumed} sub={wallet.expired ? `${wallet.expired} expired` : undefined} />
      </div>

      <section className="mt-12">
        <h2 className="display mb-2 text-3xl">Buy credits</h2>
        <p className="mb-6 text-sm text-mute">Prices exclude 18% GST. You&apos;ll get a GST invoice. Add your GSTIN to claim input tax credit.</p>
        {mode === "off" && <Notice tone="warn" className="mb-4">Payments are being set up. Please check back soon or contact support.</Notice>}
        {mode === "sandbox" && <Notice tone="warn" className="mb-4">Sandbox mode: payments are simulated and no money moves. Add Razorpay keys to take real payments.</Notice>}
        {hasRole(ctx, "admin") ? (
          <BuyPacks packs={packs ?? []} mode={mode} defaults={{ name: org?.billing_name ?? "", gstin: org?.billing_gstin ?? "", state: org?.billing_state_code ?? "" }} states={Object.entries(INDIAN_STATES)} email={ctx.email ?? ""} />
        ) : <Notice>Ask a workspace owner or admin to buy credits.</Notice>}
      </section>

      {expiring.length > 0 && (
        <section className="mt-12">
          <h2 className="display mb-4 text-3xl">Expiry</h2>
          <Card className="divide-y divide-line">
            {expiring.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span><b>{l.available}</b> {l.kind === "paid" ? "paid" : l.kind} credits</span>
                <span className="text-mute">expire {formatDate(l.expiresAt!)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="display mb-4 text-3xl">History</h2>
          <Card className="divide-y divide-line">
            {(entries ?? []).length === 0 && <div className="p-4 text-sm text-mute">No activity yet.</div>}
            {(entries ?? []).map((e) => {
              const plus = ["purchase", "promo", "trial", "adjustment_credit", "release", "refund"].includes(e.entry_type);
              const neutral = e.entry_type === "capture";
              return (
                <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <div>{ENTRY[e.entry_type] ?? e.entry_type}</div>
                    <div className="frame-no">{formatDate(e.created_at, true)}{e.job_id && <> · <Link className="underline" href={`/app/jobs/${e.job_id}`}>shoot</Link></>}</div>
                  </div>
                  <span className={plus ? "text-good" : neutral ? "text-mute" : "text-ink"}>{neutral ? "" : plus ? "+" : "−"}{e.quantity}</span>
                </div>
              );
            })}
          </Card>
          <p className="mt-2 text-xs text-mute">&quot;Held&quot; credits move to &quot;Used&quot; when an image is delivered, or come back if it fails.</p>
        </section>
        <section>
          <h2 className="display mb-4 text-3xl">Invoices</h2>
          <Card className="divide-y divide-line">
            {(orders ?? []).length === 0 && <div className="p-4 text-sm text-mute">No purchases yet.</div>}
            {(orders ?? []).map((o) => {
              const inv = (o as unknown as { invoices: { number: string } | null }).invoices;
              return (
                <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <div>
                    <div>{o.credits} credits · {money(o.total_minor, o.currency)}</div>
                    <div className="frame-no">{formatDate(o.created_at)} · {o.channel}</div>
                  </div>
                  {o.status === "refunded" ? <Badge tone="bad">Refunded</Badge> : inv ? <Link className="text-sm underline" href={`/app/invoices/${o.invoice_id}`}>{inv.number}</Link> : <span className="text-xs text-mute">Billed by {o.channel === "shopify" ? "Shopify" : "app store"}</span>}
                </div>
              );
            })}
          </Card>
        </section>
      </div>
    </div>
  );
}
