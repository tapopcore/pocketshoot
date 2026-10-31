import { requirePlatform } from "@/lib/auth";
import Link from "next/link";
import { admin } from "@/lib/supabase";
import { Card, PageHeader, formatDate } from "@/components/ui";

export default async function Ledger({ searchParams }: { searchParams: Promise<{ type?: string; before?: string }> }) {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const sp = await searchParams;
  let q = admin().from("credit_ledger").select("id, entry_type, quantity, created_at, note, job_id, order_id, organization_id, organizations(name), credit_lots(kind)").order("id", { ascending: false }).limit(100);
  if (sp.type) q = q.eq("entry_type", sp.type);
  if (sp.before) q = q.lt("id", Number(sp.before));
  const { data } = await q;
  const types = ["purchase", "promo", "trial", "reserve", "capture", "release", "refund", "expiry", "chargeback", "adjustment_credit", "adjustment_debit"];
  const last = data?.[data.length - 1]?.id;
  return (
    <div>
      <PageHeader eyebrow="Append-only" title="Credit ledger">Every credit movement across all workspaces. Balances are always derived from these rows.</PageHeader>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/ledger" className={`rounded-full px-3 py-1 text-sm ${!sp.type ? "bg-ink text-paper" : "border border-line"}`}>all</Link>
        {types.map((t) => <Link key={t} href={`/admin/ledger?type=${t}`} className={`rounded-full px-3 py-1 text-sm ${sp.type === t ? "bg-ink text-paper" : "border border-line"}`}>{t}</Link>)}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-mute"><th className="p-3">#</th><th>When</th><th>Workspace</th><th>Type</th><th>Lot</th><th>Qty</th><th>Ref</th><th>Note</th></tr></thead>
          <tbody>{(data ?? []).map((e) => {
            const r = e as unknown as { id: number; entry_type: string; quantity: number; created_at: string; note: string | null; job_id: string | null; order_id: string | null; organization_id: string; organizations: { name: string }; credit_lots: { kind: string } };
            return (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="p-3 font-mono text-xs">{r.id}</td><td>{formatDate(r.created_at, true)}</td>
                <td><Link className="hover:underline" href={`/admin/orgs/${r.organization_id}`}>{r.organizations?.name}</Link></td>
                <td>{r.entry_type}</td><td className="text-mute">{r.credit_lots?.kind}</td><td className="tabular-nums">{r.quantity}</td>
                <td>{r.job_id ? <Link className="underline" href={`/admin/jobs/${r.job_id}`}>job</Link> : r.order_id ? "order" : ""}</td>
                <td className="text-mute">{r.note}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </Card>
      {last && (data?.length ?? 0) === 100 && <Link className="mt-4 inline-block text-sm underline" href={`/admin/ledger?${sp.type ? `type=${sp.type}&` : ""}before=${last}`}>Older</Link>}
    </div>
  );
}
