import { requirePlatform } from "@/lib/auth";
import Link from "next/link";
import { admin } from "@/lib/supabase";
import { Badge, Card, Input, PageHeader, formatDate } from "@/components/ui";

export default async function Orgs({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  let q = admin().from("organizations").select("id, name, source, status, created_at, billing_gstin, wallet_balances(available, consumed), memberships(profiles(email))", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  if (sp.q) q = q.ilike("name", `%${sp.q.replace(/[%,]/g, "")}%`);
  const { data, count } = await q;
  return (
    <div>
      <PageHeader eyebrow={`${count ?? 0} total`} title="Workspaces" />
      <form className="mb-4 max-w-sm"><Input name="q" defaultValue={sp.q} placeholder="Search by name" /></form>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-mute"><th className="p-3">Workspace</th><th>Owner</th><th>Source</th><th>Credits left</th><th>Used</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {(data ?? []).map((o) => {
              const row = o as unknown as { id: string; name: string; source: string; status: string; created_at: string; wallet_balances: { available: number; consumed: number }[]; memberships: { profiles: { email: string } }[] };
              return (
                <tr key={row.id} className="border-b border-line last:border-0 hover:bg-paper-2/50">
                  <td className="p-3"><Link href={`/admin/orgs/${row.id}`} className="font-medium hover:underline">{row.name}</Link></td>
                  <td className="text-mute">{row.memberships[0]?.profiles?.email ?? "Shopify"}</td>
                  <td><Badge>{row.source}</Badge></td>
                  <td className="tabular-nums">{row.wallet_balances[0]?.available ?? 0}</td>
                  <td className="tabular-nums">{row.wallet_balances[0]?.consumed ?? 0}</td>
                  <td className="text-mute">{formatDate(row.created_at)}</td>
                  <td>{row.status !== "active" && <Badge tone="bad">{row.status}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mt-6 flex gap-3 text-sm">
        {page > 1 && <Link className="underline" href={`/admin/orgs?page=${page - 1}&q=${sp.q ?? ""}`}>Previous</Link>}
        {page * 50 < (count ?? 0) && <Link className="underline" href={`/admin/orgs?page=${page + 1}&q=${sp.q ?? ""}`}>Next</Link>}
      </div>
    </div>
  );
}
