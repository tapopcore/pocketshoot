import { requirePlatform } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { integrationStatus } from "@/lib/env";
import { Badge, Card, PageHeader, Stat, formatDate } from "@/components/ui";

export default async function Health() {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const db = admin();
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const [{ count: queued }, { count: running }, { count: stuck }, { data: logs }, { data: hooks }, { data: lastTick }, { data: attempts }] = await Promise.all([
    db.from("generation_items").select("id", { count: "exact", head: true }).eq("status", "queued"),
    db.from("generation_items").select("id", { count: "exact", head: true }).in("status", ["preparing", "generating", "checking"]),
    db.from("generation_items").select("id", { count: "exact", head: true }).in("status", ["queued", "preparing", "generating", "checking"]).lt("created_at", new Date(Date.now() - 30 * 60_000).toISOString()),
    db.from("app_logs").select("*").eq("level", "error").order("id", { ascending: false }).limit(30),
    db.from("webhook_events").select("provider, event_type, error, received_at").not("error", "is", null).order("received_at", { ascending: false }).limit(15),
    db.from("app_logs").select("created_at, message").eq("source", "cron.daily").order("id", { ascending: false }).limit(1),
    db.from("generation_attempts").select("provider, status").gte("created_at", hourAgo),
  ]);
  const byProvider = new Map<string, { ok: number; fail: number }>();
  for (const a of attempts ?? []) {
    const r = byProvider.get(a.provider) ?? { ok: 0, fail: 0 };
    if (a.status === "succeeded") r.ok++; else if (a.status === "failed") r.fail++;
    byProvider.set(a.provider, r);
  }
  return (
    <div>
      <PageHeader title="System health" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Queued images" value={queued ?? 0} />
        <Stat label="Running" value={running ?? 0} />
        <Stat label="Waiting > 30 min" value={stuck ?? 0} accent={(stuck ?? 0) > 0} sub="Check the worker cron if this grows" />
        <Stat label="Daily checks" value={lastTick?.[0] ? formatDate(lastTick[0].created_at, true) : "never"} sub="pg_cron → /api/cron/daily" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="display mb-3 text-2xl">Providers (last hour)</h2>
          {byProvider.size === 0 ? <p className="text-sm text-mute">No calls in the last hour.</p> : (
            <ul className="space-y-1 text-sm">{[...byProvider.entries()].map(([p, r]) => <li key={p} className="flex justify-between"><span>{p}</span><span>{r.ok} ok · <span className={r.fail ? "text-bad" : ""}>{r.fail} failed</span></span></li>)}</ul>
          )}
          <h2 className="display mb-3 mt-6 text-2xl">Integrations</h2>
          <ul className="space-y-1 text-sm">{integrationStatus().map((s) => <li key={s.name} className="flex justify-between"><span>{s.name}</span><Badge tone={s.ok ? "good" : "warn"}>{s.ok ? "ok" : "missing"}</Badge></li>)}</ul>
        </Card>
        <Card className="p-5">
          <h2 className="display mb-3 text-2xl">Failed webhooks</h2>
          {(hooks ?? []).length === 0 ? <p className="text-sm text-mute">None.</p> : (
            <ul className="space-y-1 text-xs">{(hooks ?? []).map((h, i) => <li key={i} className="border-t border-line py-1"><b>{h.provider}</b> {h.event_type} <span className="text-bad">{h.error}</span> <span className="text-mute">{formatDate(h.received_at, true)}</span></li>)}</ul>
          )}
        </Card>
      </div>
      <Card className="mt-6 overflow-x-auto p-5">
        <h2 className="display mb-3 text-2xl">Recent errors</h2>
        <table className="w-full text-xs"><tbody>
          {(logs ?? []).map((l) => <tr key={l.id} className="border-t border-line align-top"><td className="py-1.5 whitespace-nowrap">{formatDate(l.created_at, true)}</td><td className="font-mono">{l.source}</td><td>{l.message}</td><td className="max-w-xs truncate font-mono text-mute">{JSON.stringify(l.data)}</td></tr>)}
        </tbody></table>
      </Card>
    </div>
  );
}
