import { requirePlatform } from "@/lib/auth";
import { kpis, funnel } from "@/lib/metrics";
import { integrationStatus } from "@/lib/env";
import { admin } from "@/lib/supabase";
import { Badge, Card, PageHeader, Stat, formatDate, money } from "@/components/ui";
import { resolveAlertAction } from "./actions";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const days = Math.min(365, Math.max(1, Number((await searchParams).days ?? 30)));
  const [k, f, { data: alerts }] = await Promise.all([kpis(days), funnel(days), admin().from("alerts").select("*").is("resolved_at", null).order("created_at", { ascending: false }).limit(20)]);
  const status = integrationStatus();
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const top = Math.max(1, ...f.map((x) => x.orgs));
  return (
    <div>
      <PageHeader eyebrow={`Last ${days} days`} title="Overview" actions={[7, 30, 90].map((d) => <a key={d} href={`/admin?days=${d}`} className={`rounded-full px-3 py-1 text-sm ${d === days ? "bg-ink text-paper" : "border border-line"}`}>{d}d</a>)} />
      {(alerts ?? []).length > 0 && (
        <div className="mb-8 space-y-2">
          {(alerts ?? []).map((a) => (
            <div key={a.id} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${a.severity === "critical" ? "border-bad/40 bg-bad/5" : a.severity === "warning" ? "border-warn/40 bg-warn/5" : "border-line"}`}>
              <span><Badge tone={a.severity === "critical" ? "bad" : a.severity === "warning" ? "warn" : "neutral"}>{a.kind}</Badge> <span className="ml-2">{a.message}</span> <span className="frame-no ml-2">{formatDate(a.created_at, true)}</span></span>
              <form action={resolveAlertAction}><input type="hidden" name="id" value={a.id} /><button className="text-xs underline">Resolve</button></form>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Signups" value={k.signups} sub={`${k.trials} trials issued`} />
        <Stat label="Activated workspaces" value={k.activated} sub="Got at least one image" />
        <Stat label="Paying workspaces" value={k.paying} sub={`${k.repeat} bought again`} />
        <Stat label="Net revenue" value={money(k.revenueInr)} sub={k.revenueUsd ? `+ ${money(k.revenueUsd, "USD")} via Shopify` : "Before GST"} />
        <Stat label="Images delivered" value={k.delivered} sub={`${k.downloads} downloads`} />
        <Stat label="AI spend" value={money(Math.round(k.spendInr * 100))} sub={k.costPerApproved ? `${money(Math.round(k.costPerApproved * 100))} per delivered image` : "No images yet"} />
        <Stat label="Failure rate" value={pct(k.failureRate)} sub={`${pct(k.reviewRate)} flagged for review`} accent={k.failureRate > 0.15} />
        <Stat label="Refund rate" value={pct(k.refundRate)} sub={`${k.refunds} reports · p95 ${k.p95Ms ? `${(k.p95Ms / 1000).toFixed(0)}s` : "n/a"}`} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Credits sold" value={k.creditsSold} />
        <Stat label="Unused paid credits" value={k.outstandingPaid} sub="Deferred obligation" />
        <Stat label="Unused free credits" value={k.outstandingPromo} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="display mb-4 text-2xl">Funnel (unique workspaces)</h2>
          <div className="space-y-2">
            {f.map((s) => (
              <div key={s.name} className="grid grid-cols-[160px_1fr_40px] items-center gap-3 text-sm">
                <span className="truncate text-mute">{s.name.replaceAll("_", " ")}</span>
                <div className="h-2.5 rounded-full bg-paper-2"><div className="h-full rounded-full bg-ink" style={{ width: `${(s.orgs / top) * 100}%` }} /></div>
                <span className="text-right tabular-nums">{s.orgs}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="display mb-4 text-2xl">Integrations</h2>
          <ul className="space-y-2 text-sm">
            {status.map((s) => (
              <li key={s.name} className="flex items-start justify-between gap-3">
                <span>{s.name}{!s.ok && <span className="block font-mono text-[11px] text-mute">needs {s.need}</span>}</span>
                <Badge tone={s.ok ? "good" : "warn"}>{s.ok ? "Connected" : "Not set"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
