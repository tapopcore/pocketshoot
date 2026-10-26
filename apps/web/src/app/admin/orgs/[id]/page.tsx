import Link from "next/link";
import { notFound } from "next/navigation";
import { admin } from "@/lib/supabase";
import { getWallet } from "@/lib/credits";
import { recentJobs } from "@/lib/views";
import { Badge, Card, Field, Input, PageHeader, Stat, formatDate, money } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { JobCard } from "@/components/job-card";
import { adjustCreditsAction, suspendOrgAction } from "../../actions";

export default async function OrgDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();
  const { data: org } = await db.from("organizations").select("*").eq("id", id).maybeSingle();
  if (!org) notFound();
  const [wallet, jobs, { data: members }, { data: orders }, { data: shop }, { data: ledger }, { data: refunds }] = await Promise.all([
    getWallet(id), recentJobs(id, 8),
    db.from("memberships").select("role, profiles(email, name)").eq("organization_id", id),
    db.from("orders").select("id, status, credits, total_minor, currency, channel, gateway, created_at, invoice_id").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("shopify_shops").select("shop_domain, installed_at, uninstalled_at, plan_name").eq("organization_id", id).maybeSingle(),
    db.from("credit_ledger").select("id, entry_type, quantity, created_at, note, job_id").eq("organization_id", id).order("created_at", { ascending: false }).limit(30),
    db.from("refund_requests").select("id, reason, status, created_at").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  return (
    <div>
      <PageHeader eyebrow={`${org.source} · created ${formatDate(org.created_at)}`} title={org.name}
        actions={
          <form action={suspendOrgAction} className="flex gap-2">
            <input type="hidden" name="orgId" value={id} />
            <input type="hidden" name="suspend" value={org.status === "active" ? "1" : "0"} />
            {org.status === "active" && <Input name="reason" placeholder="Reason" className="!h-9 !w-44 text-sm" />}
            <button className={`rounded-full px-4 text-sm ${org.status === "active" ? "border border-bad/40 text-bad" : "bg-ink text-paper"}`}>{org.status === "active" ? "Suspend" : "Unsuspend"}</button>
          </form>
        }>
        {org.status !== "active" && <Badge tone="bad">Suspended: {org.suspended_reason}</Badge>}
        {shop && <span className="text-sm">Shopify: {shop.shop_domain} {shop.uninstalled_at ? "(uninstalled)" : ""}</span>}
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Available" value={wallet.available} sub={`${wallet.paidAvailable} paid`} />
        <Stat label="Reserved" value={wallet.reserved} />
        <Stat label="Used" value={wallet.consumed} />
        <Stat label="Expired" value={wallet.expired} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="display text-2xl">Adjust credits</h2>
          <ActionForm action={adjustCreditsAction} submit="Apply" resetOnSuccess className="mt-3 space-y-3">
            <input type="hidden" name="orgId" value={id} />
            <Field label="Quantity" hint="Negative to remove"><Input name="quantity" type="number" required /></Field>
            <Field label="Reason (audit log)"><Input name="note" required minLength={5} /></Field>
          </ActionForm>
        </Card>
        <Card className="p-5">
          <h2 className="display mb-3 text-2xl">Members</h2>
          <ul className="space-y-1 text-sm">{(members ?? []).map((m, i) => { const p = (m as unknown as { profiles: { email: string } }).profiles; return <li key={i} className="flex justify-between"><span>{p.email}</span><Badge>{m.role}</Badge></li>; })}</ul>
          <div className="mt-4 text-sm text-mute">GSTIN: {org.billing_gstin ?? "none"}</div>
        </Card>
        <Card className="p-5">
          <h2 className="display mb-3 text-2xl">Reports</h2>
          <ul className="space-y-1 text-sm">{(refunds ?? []).map((r) => <li key={r.id} className="flex justify-between"><span>{r.reason.replaceAll("_", " ")}</span><Badge tone={r.status === "open" ? "warn" : r.status === "rejected" ? "neutral" : "good"}>{r.status}</Badge></li>)}</ul>
        </Card>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="divide-y divide-line">
          <h2 className="display p-4 text-2xl">Orders</h2>
          {(orders ?? []).map((o) => (
            <div key={o.id} className="flex justify-between px-4 py-2 text-sm">
              <span>{o.credits} credits · {money(o.total_minor, o.currency)} · {o.gateway}</span>
              <span className="flex items-center gap-2"><Badge tone={o.status === "paid" ? "good" : o.status === "failed" ? "bad" : "neutral"}>{o.status}</Badge>{o.invoice_id && <Link className="underline" href={`/app/invoices/${o.invoice_id}`}>Invoice</Link>}</span>
            </div>
          ))}
        </Card>
        <Card className="divide-y divide-line">
          <h2 className="display p-4 text-2xl">Ledger</h2>
          {(ledger ?? []).map((e) => (
            <div key={e.id} className="flex justify-between px-4 py-2 text-sm">
              <span>{e.entry_type} {e.note && <span className="text-mute">· {e.note}</span>}</span>
              <span className="tabular-nums">{e.quantity} <span className="frame-no">{formatDate(e.created_at, true)}</span></span>
            </div>
          ))}
        </Card>
      </div>
      <h2 className="display mb-4 mt-10 text-2xl">Recent shoots</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} hrefBase="/admin/jobs" />)}</div>
    </div>
  );
}
