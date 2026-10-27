import { contributionPerAcceptedImage } from "@packshot/core";
import { dailySpend, kpis } from "@/lib/metrics";
import { admin } from "@/lib/supabase";
import { Card, PageHeader, Stat } from "@/components/ui";

export default async function Costs() {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [days, k, { data: packs }, { data: extra }, { data: operations }] = await Promise.all([
    dailySpend(30), kpis(30),
    admin().from("pricing_packs").select("name, credits, price_minor, currency").eq("channel", "web").eq("active", true).order("sort"),
    admin().from("analytics_events").select("props").eq("name", "ai_cost").gte("created_at", since).limit(10000),
    admin().from("analytics_events").select("props").eq("name", "ai_operation").gte("created_at", since).limit(10000),
  ]);
  const supplemental = (extra ?? []).reduce((sum, x) => sum + Number((x.props as { usd?: number })?.usd ?? 0), 0);
  const tasks = new Map<string, number>();
  for (const op of operations ?? []) {
    const p = op.props as { task?: string } | null;
    const name = p?.task ?? "other";
    tasks.set(name, (tasks.get(name) ?? 0) + 1);
  }
  const totalAttempts = days.reduce((a, d) => a + d.attempts, 0);
  const acceptance = k.delivered && totalAttempts ? k.delivered / totalAttempts : 0.8;
  const perAttempt = totalAttempts ? k.spendInr / totalAttempts : 15;
  return (
    <div>
      <PageHeader eyebrow="Last 30 days" title="Provider costs">Estimated costs from recorded API activity. These are not the full OpenAI invoice. Failed, retried, preparation and small-model calls need separate reconciliation.</PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Image API estimate" value={`₹${k.spendInr.toFixed(0)}`} />
        <Stat label="Attempts" value={totalAttempts} />
        <Stat label="Cost per attempt" value={`₹${perAttempt.toFixed(2)}`} />
        <Stat label="Image API / delivered" value={k.costPerApproved ? `₹${k.costPerApproved.toFixed(2)}` : "n/a"} sub={`${(acceptance * 100).toFixed(0)}% of attempts delivered`} />
      </div>
      <Card className="mt-8 p-5">\n        <h2 className="mb-2 text-lg font-semibold">Supporting AI operations</h2>\n        <p className="text-sm text-mute">Additional preparation events: approximately USD {supplemental.toFixed(4)} (not included in image-attempt totals). Tracked planning and vision calls: {(operations ?? []).length}. Unpriced calls must be reconciled with the provider account before setting margins.</p>\n        <div className="mt-3 flex flex-wrap gap-2">{[...tasks].map(([task, count]) => <span key={task} className="rounded-full border border-line px-3 py-1 text-xs">{task}: {count}</span>)}</div>\n      </Card>\n      <Card className="mt-8 overflow-x-auto p-5">
        <h2 className="display mb-3 text-2xl">Contribution per pack (image-call scenario only)</h2>
        <p className="mb-4 text-sm text-mute">Illustration using recorded image attempts only. Real contribution is lower once preparation, planning, quality checks, retries, processing and support costs are included.</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-mute"><th className="py-2">Pack</th><th>Price / image</th><th>Effective cost</th><th>Contribution</th><th>Margin</th></tr></thead>
          <tbody>{(packs ?? []).map((p) => {
            const per = p.price_minor / 100 / p.credits;
            const c = contributionPerAcceptedImage({ netPricePerImage: per, providerCostPerAttempt: perAttempt, acceptanceRate: acceptance, otherVariableCost: 3 });
            return <tr key={p.name} className="border-t border-line"><td className="py-2">{p.name}</td><td>₹{per.toFixed(2)}</td><td>₹{c.effectiveCost}</td><td>₹{c.contribution}</td><td className={c.margin < 60 ? "text-warn" : "text-good"}>{c.margin}%</td></tr>;
          })}</tbody>
        </table>
        <p className="mt-3 text-xs text-mute">The spec&apos;s launch rule: don&apos;t finalise packs until 300 to 500 real generations show these numbers holding.</p>
      </Card>
      <Card className="mt-8 overflow-x-auto p-5">
        <h2 className="display mb-3 text-2xl">By day</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-mute"><th className="py-2">Day</th><th>Spend</th><th>Attempts</th><th>Failed</th><th>Delivered</th><th>By provider</th></tr></thead>
          <tbody>{days.map((d) => (
            <tr key={d.day} className="border-t border-line"><td className="py-2">{d.day}</td><td>₹{d.spend.toFixed(2)}</td><td>{d.attempts}</td><td>{d.failed}</td><td>{d.delivered}</td><td className="text-mute">{Object.entries(d.byProvider).map(([p, v]) => `${p} ₹${v.toFixed(0)}`).join(" · ")}</td></tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}
