import Link from "next/link";
import { JOB_STATUS_LABEL, type JobStatus } from "@packshot/core";
import { admin } from "@/lib/supabase";
import { Badge, Card, PageHeader, formatDate } from "@/components/ui";

const STATUSES = ["all", "queued", "generating", "completed", "review_needed", "failed"];

export default async function AdminJobs({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "all";
  const page = Math.max(1, Number(sp.page ?? 1));
  let q = admin().from("generation_jobs").select("id, status, mode, style, output, requested_count, source, is_trial, created_at, organizations(name), products(name), generation_attempts(provider, cost_inr, status)", { count: "exact" })
    .order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  if (status !== "all") q = q.eq("status", status);
  const { data, count } = await q;
  return (
    <div>
      <PageHeader eyebrow={`${count ?? 0} jobs`} title="Generation jobs" />
      <div className="mb-4 flex flex-wrap gap-2">{STATUSES.map((s) => <Link key={s} href={`/admin/jobs?status=${s}`} className={`rounded-full px-3 py-1 text-sm ${s === status ? "bg-ink text-paper" : "border border-line"}`}>{s.replace("_", " ")}</Link>)}</div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-line text-left text-xs text-mute"><th className="p-3">When</th><th>Workspace</th><th>Product</th><th>Style</th><th>Images</th><th>Attempts</th><th>Cost</th><th>Status</th></tr></thead>
          <tbody>
            {(data ?? []).map((j) => {
              const r = j as unknown as { id: string; status: string; style: string; mode: string; requested_count: number; source: string; is_trial: boolean; created_at: string; organizations: { name: string }; products: { name: string }; generation_attempts: { provider: string; cost_inr: number | null; status: string }[] };
              const cost = r.generation_attempts.reduce((a, x) => a + Number(x.cost_inr ?? 0), 0);
              const s = JOB_STATUS_LABEL[r.status as JobStatus];
              return (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper-2/50">
                  <td className="p-3"><Link className="underline" href={`/admin/jobs/${r.id}`}>{formatDate(r.created_at, true)}</Link></td>
                  <td>{r.organizations?.name}</td>
                  <td>{r.products?.name}</td>
                  <td>{r.style} · {r.mode}{r.is_trial && " · trial"}</td>
                  <td className="tabular-nums">{r.requested_count}</td>
                  <td className="tabular-nums">{r.generation_attempts.length} ({r.generation_attempts.filter((a) => a.status === "failed").length} failed)</td>
                  <td className="tabular-nums">₹{cost.toFixed(2)}</td>
                  <td><Badge tone={s?.tone ?? "neutral"}>{r.status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="mt-6 flex gap-3 text-sm">
        {page > 1 && <Link className="underline" href={`/admin/jobs?status=${status}&page=${page - 1}`}>Previous</Link>}
        {page * 50 < (count ?? 0) && <Link className="underline" href={`/admin/jobs?status=${status}&page=${page + 1}`}>Next</Link>}
      </div>
    </div>
  );
}
