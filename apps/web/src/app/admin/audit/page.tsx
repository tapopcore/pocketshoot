import Link from "next/link";
import { admin } from "@/lib/supabase";
import { Card, Input, PageHeader, formatDate } from "@/components/ui";

export default async function Audit({ searchParams }: { searchParams: Promise<{ action?: string; before?: string }> }) {
  const sp = await searchParams;
  let q = admin().from("audit_logs").select("*").order("id", { ascending: false }).limit(100);
  if (sp.action) q = q.ilike("action", `${sp.action.replace(/[%,]/g, "")}%`);
  if (sp.before) q = q.lt("id", Number(sp.before));
  const { data } = await q;
  const actorIds = [...new Set((data ?? []).map((d) => d.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length ? await admin().from("profiles").select("id, email").in("id", actorIds) : { data: [] };
  const emails = new Map((actors ?? []).map((a) => [a.id, a.email]));
  return (
    <div>
      <PageHeader eyebrow="Append-only" title="Audit log" />
      <form className="mb-4 max-w-xs"><Input name="action" defaultValue={sp.action} placeholder="Filter, e.g. admin. or refund" /></form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-mute"><th className="p-3">When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>{(data ?? []).map((a) => (
            <tr key={a.id} className="border-b border-line align-top last:border-0">
              <td className="p-3 whitespace-nowrap">{formatDate(a.created_at, true)}</td>
              <td className="text-xs">{a.actor_id ? emails.get(a.actor_id) ?? a.actor_id.slice(0, 8) : "system"}</td>
              <td className="font-mono text-xs">{a.action}</td>
              <td className="text-xs">{a.target_type} {a.target_id?.slice(0, 18)}{a.organization_id && <> · <Link className="underline" href={`/admin/orgs/${a.organization_id}`}>org</Link></>}</td>
              <td className="max-w-md truncate font-mono text-[11px] text-mute">{JSON.stringify(a.metadata)}</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
      {(data?.length ?? 0) === 100 && <Link className="mt-4 inline-block text-sm underline" href={`/admin/audit?${sp.action ? `action=${sp.action}&` : ""}before=${data![99].id}`}>Older</Link>}
    </div>
  );
}
