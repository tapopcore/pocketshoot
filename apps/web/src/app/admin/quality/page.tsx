import { requirePlatform } from "@/lib/auth";
import { CATEGORIES, isCategoryId } from "@packshot/core";
import { admin } from "@/lib/supabase";
import { signedUrls } from "@/lib/storage";
import { Card, PageHeader, Stat } from "@/components/ui";
import { featureAssetAction, rateOutputAction } from "../actions";

/** Human QA: rate a random sample of outputs and see usable-rate by category against the launch gates. */
export default async function Quality() {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const db = admin();
  const month = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: items }, { data: ratings }, { data: sample }] = await Promise.all([
    db.from("generation_items").select("status, decision, generation_jobs(mode, style, settings)").gte("created_at", month).in("status", ["delivered", "failed"]).limit(50000),
    db.from("analytics_events").select("props").eq("name", "human_rating").limit(50000),
    db.from("generated_assets").select("id, storage_key, quality_status, generation_jobs!generated_assets_job_id_fkey(mode, style, settings), products(name)").neq("quality_status", "fail").order("created_at", { ascending: false }).limit(60),
  ]);
  const rated = new Set((ratings ?? []).map((r) => (r.props as { assetId: string }).assetId));
  const toRate = (sample ?? []).filter((s) => !rated.has(s.id)).sort(() => Math.random() - 0.5).slice(0, 12);
  const urls = await signedUrls("outputs", toRate.map((s) => s.storage_key), 900);

  type Row = { total: number; delivered: number; review: number; failed: number; rated: number; usable: number };
  const by = new Map<string, Row>();
  const row = (k: string) => by.get(k) ?? by.set(k, { total: 0, delivered: 0, review: 0, failed: 0, rated: 0, usable: 0 }).get(k)!;
  for (const i of items ?? []) {
    const j = (i as unknown as { generation_jobs: { settings: { category?: string } } }).generation_jobs;
    const r = row(j?.settings?.category ?? "other");
    r.total++; if (i.status === "delivered") r.delivered++; if (i.status === "failed") r.failed++; if (i.decision === "review") r.review++;
  }
  for (const rt of ratings ?? []) {
    const p = rt.props as { usable: boolean; category?: string };
    const r = row(p.category ?? "other");
    r.rated++; if (p.usable) r.usable++;
  }
  const totalRated = (ratings ?? []).length;
  const totalUsable = (ratings ?? []).filter((r) => (r.props as { usable: boolean }).usable).length;
  return (
    <div>
      <PageHeader eyebrow="Launch gate: 85% usable, under 5% severe identity failures" title="Quality">
        Rate outputs as a customer would. Spec asks for 100 to 300 rated generations before launch, then ongoing sampling.
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Human-rated" value={totalRated} sub="Target 100 to 300 before launch" />
        <Stat label="Rated usable" value={totalRated ? `${((totalUsable / totalRated) * 100).toFixed(0)}%` : "n/a"} accent={totalRated > 20 && totalUsable / totalRated < 0.85} />
      </div>
      <Card className="mt-8 overflow-x-auto p-5">
        <h2 className="display mb-3 text-2xl">By category (30 days)</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-mute"><th className="py-1">Category</th><th>Images</th><th>Delivered</th><th>Flagged review</th><th>Failed</th><th>Human usable</th></tr></thead>
          <tbody>{[...by.entries()].map(([k, r]) => (
            <tr key={k} className="border-t border-line"><td className="py-1.5">{isCategoryId(k) ? CATEGORIES[k].label : k}</td><td>{r.total}</td><td>{r.delivered}</td><td>{r.review}</td><td>{r.failed}</td><td>{r.rated ? `${((r.usable / r.rated) * 100).toFixed(0)}% of ${r.rated}` : "-"}</td></tr>
          ))}</tbody>
        </table>
      </Card>
      <h2 className="display mb-4 mt-10 text-2xl">Rate these</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {toRate.map((s) => {
          const j = (s as unknown as { generation_jobs: { style: string; mode: string; settings: { category?: string } }; products: { name: string } });
          return (
            <Card key={s.id} className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={urls[s.storage_key]} target="_blank"><img src={urls[s.storage_key]} alt="" className="aspect-square w-full object-cover" /></a>
              <div className="p-3 text-xs">
                <div className="truncate font-medium">{j.products?.name}</div>
                <div className="text-mute">{j.generation_jobs?.settings?.category} · {j.generation_jobs?.style} · {j.generation_jobs?.mode} · {s.quality_status}</div>
                <form action={rateOutputAction} className="mt-2 flex gap-1">
                  <input type="hidden" name="assetId" value={s.id} />
                  <button name="usable" value="1" className="flex-1 rounded-full bg-good px-2 py-1 text-white">Usable</button>
                  <button name="usable" value="0" className="flex-1 rounded-full border border-bad/40 px-2 py-1 text-bad">Not usable</button>
                </form>
                <form action={featureAssetAction} className="mt-2 flex gap-1">
                  <input type="hidden" name="assetId" value={s.id} />
                  <input type="hidden" name="category" value={j.generation_jobs?.settings?.category ?? "other"} />
                  <input name="caption" placeholder="Caption" className="min-w-0 flex-1 rounded-full border border-line px-2" />
                  <button className="rounded-full border border-line px-2" title="Only with the customer's written permission">Feature</button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
