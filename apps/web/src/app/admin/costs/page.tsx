import { contributionPerAcceptedImage } from "@packshot/core";
import { dailySpend, kpis } from "@/lib/metrics";
import { admin } from "@/lib/supabase";
import { Card, PageHeader, Stat } from "@/components/ui";

export default async function Costs() {
  const [days, k, { data: packs }] = await Promise.all([dailySpend(30), kpis(30), admin().from("pricing_packs").select("name, credits, price_minor, currency").eq("channel", "web").eq("active", true).order("sort")]);
  const totalAttempts = days.reduce((a, d) => a + d.attempts, 0);
  const acceptance = k.delivered && totalAttempts ? k.delivered / totalAttempts : 0.8;
  const perAttempt = totalAttempts ? k.spendInr / totalAttempts : 15;
  return (
    <div>
      <PageHeader eyebrow="Last 30 days" title="Provider costs">Real recorded costs per attempt, converted to INR with the exchange rate of the day. Use this to set prices, not the spec&apos;s guesses.</PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Spend" value={`₹${k.spendInr.toFixed(0)}`} />
        <Stat label="Attempts" value={totalAttempts} />
        <Stat label="Cost per attempt" value={`₹${perAttempt.toFixed(2)}`} />
        <Stat label="Cost per delivered image" value={k.costPerApproved ? `₹${k.costPerApproved.toFixed(2)}` : "n/a"} sub={`${(acceptance * 100).toFixed(0)}% of attempts delivered`} />
      </div>
      <Card className="mt-8 overflow-x-auto p-5">
        <h2 className="display mb-3 text-2xl">Contribution per pack (live numbers)</h2>
        <p className="mb-4 text-sm text-mute">Net price per image minus (cost per attempt ÷ acceptance) minus ₹3 for payments, storage and support. Spec section 10 formula.</p>
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
