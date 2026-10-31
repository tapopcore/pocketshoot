import { requirePlatform } from "@/lib/auth";
import Link from "next/link";
import { admin } from "@/lib/supabase";
import { Card, PageHeader, formatDate } from "@/components/ui";

export default async function Abuse() {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const db = admin();
  const month = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: trials }, { data: reports }, { data: delivered }, { data: limits }, { data: blocked }] = await Promise.all([
    db.from("trial_grants").select("ip_hash, email_normalized, created_at, organization_id").gte("created_at", month),
    db.from("refund_requests").select("organization_id, status, organizations(name)").gte("created_at", month),
    db.from("generated_assets").select("organization_id").neq("quality_status", "fail").gte("created_at", month).limit(100000),
    db.from("rate_limits").select("key, hits, window_start").gte("window_start", new Date(Date.now() - 86_400_000).toISOString()).order("hits", { ascending: false }).limit(20),
    db.from("analytics_events").select("props, created_at").eq("name", "trial_blocked").gte("created_at", month).limit(200),
  ]);
  const byIp = new Map<string, { n: number; emails: string[] }>();
  for (const t of trials ?? []) {
    const r = byIp.get(t.ip_hash ?? "?") ?? { n: 0, emails: [] };
    r.n++; r.emails.push(t.email_normalized);
    byIp.set(t.ip_hash ?? "?", r);
  }
  const deliveredBy = new Map<string, number>();
  for (const d of delivered ?? []) deliveredBy.set(d.organization_id, (deliveredBy.get(d.organization_id) ?? 0) + 1);
  const reportBy = new Map<string, { name: string; n: number; approved: number }>();
  for (const r of reports ?? []) {
    const x = reportBy.get(r.organization_id) ?? { name: (r as unknown as { organizations: { name: string } }).organizations?.name, n: 0, approved: 0 };
    x.n++; if (r.status !== "rejected" && r.status !== "open") x.approved++;
    reportBy.set(r.organization_id, x);
  }
  return (
    <div>
      <PageHeader eyebrow="Last 30 days" title="Abuse signals" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="display mb-3 text-2xl">Networks with several trials</h2>
          <p className="mb-2 text-xs text-mute">IP addresses are stored only as salted hashes. Max 3 trials per network per 30 days. {blocked?.length ?? 0} trials blocked.</p>
          <table className="w-full text-sm"><tbody>
            {[...byIp.entries()].filter(([, v]) => v.n > 1).sort((a, b) => b[1].n - a[1].n).slice(0, 20).map(([ip, v]) => (
              <tr key={ip} className="border-t border-line"><td className="py-1.5 font-mono text-xs">{ip.slice(0, 10)}</td><td>{v.n} trials</td><td className="text-xs text-mute">{v.emails.slice(0, 3).join(", ")}</td></tr>
            ))}
          </tbody></table>
        </Card>
        <Card className="p-4">
          <h2 className="display mb-3 text-2xl">Report rate by workspace</h2>
          <table className="w-full text-sm"><tbody>
            {[...reportBy.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20).map(([org, v]) => {
              const rate = v.n / Math.max(1, deliveredBy.get(org) ?? 0);
              return <tr key={org} className="border-t border-line"><td className="py-1.5"><Link className="hover:underline" href={`/admin/orgs/${org}`}>{v.name}</Link></td><td>{v.n} reports</td><td>{v.approved} approved</td><td className={rate > 0.35 ? "text-bad" : ""}>{(rate * 100).toFixed(0)}% of images</td></tr>;
            })}
          </tbody></table>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <h2 className="display mb-3 text-2xl">Busiest rate-limit keys (24h)</h2>
          <table className="w-full text-sm"><tbody>
            {(limits ?? []).map((l) => <tr key={l.key + l.window_start} className="border-t border-line"><td className="py-1.5 font-mono text-xs">{l.key}</td><td>{l.hits} hits</td><td className="text-mute">{formatDate(l.window_start, true)}</td></tr>)}
          </tbody></table>
        </Card>
      </div>
    </div>
  );
}
