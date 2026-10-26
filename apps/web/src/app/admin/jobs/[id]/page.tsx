import Link from "next/link";
import { notFound } from "next/navigation";
import { admin } from "@/lib/supabase";
import { signedUrls } from "@/lib/storage";
import { audit } from "@/lib/observe";
import { requirePlatform } from "@/lib/auth";
import { Badge, Card, PageHeader, formatDate } from "@/components/ui";

/** Full job timeline for support: every attempt, provider error, check and ledger entry. */
export default async function AdminJob({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePlatform();
  const { id } = await params;
  const db = admin();
  const { data: job } = await db.from("generation_jobs").select("*, organizations(id, name), products(id, name, category, locks, must_not_change)").eq("id", id).maybeSingle();
  if (!job) notFound();
  await audit(ctx, "admin.job.view", { type: "job", id }, { org: job.organization_id });
  const [{ data: items }, { data: attempts }, { data: assets }, { data: ledger }, { data: refs }] = await Promise.all([
    db.from("generation_items").select("*").eq("job_id", id).order("idx"),
    db.from("generation_attempts").select("*").eq("job_id", id).order("created_at"),
    db.from("generated_assets").select("*, quality_checks(*)").eq("job_id", id).order("created_at"),
    db.from("credit_ledger").select("*").eq("job_id", id).order("created_at"),
    db.from("product_assets").select("storage_key, cutout_key, view_type").eq("product_id", job.product_id),
  ]);
  const outUrls = await signedUrls("outputs", (assets ?? []).map((a) => a.storage_key), 900);
  const refUrls = await signedUrls("originals", (refs ?? []).flatMap((r) => [r.storage_key, r.cutout_key && r.cutout_key !== "none" ? r.cutout_key : ""]).filter(Boolean), 900);
  const org = job.organizations as { id: string; name: string };
  const product = job.products as { name: string; category: string; locks: string[]; must_not_change: string | null };
  return (
    <div>
      <PageHeader eyebrow={<><Link className="underline" href={`/admin/orgs/${org.id}`}>{org.name}</Link> · {formatDate(job.created_at, true)}</>} title={product.name}>
        <div className="flex flex-wrap gap-2 text-sm"><Badge>{job.status}</Badge><Badge>{job.mode}</Badge><Badge>{job.style}</Badge><Badge>{job.output}</Badge><Badge>{job.source}</Badge>{job.is_trial && <Badge tone="warn">trial</Badge>}{job.is_free_remake && <Badge tone="good">free remake</Badge>}<span className="text-mute">prompt {job.prompt_version}</span></div>
        <div className="mt-2 text-sm text-mute">Locks: {product.locks.join(", ") || "none"}{product.must_not_change ? ` · "${product.must_not_change}"` : ""}</div>
      </PageHeader>
      <h2 className="display mb-3 text-2xl">References</h2>
      <div className="mb-8 flex flex-wrap gap-3">
        {(refs ?? []).map((r) => (
          <div key={r.storage_key} className="flex gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={refUrls[r.storage_key]} alt="" className="h-36 rounded border border-line" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.cutout_key && refUrls[r.cutout_key] && <img src={refUrls[r.cutout_key]} alt="" className="checker h-36 rounded border border-line" />}
          </div>
        ))}
      </div>
      <h2 className="display mb-3 text-2xl">Outputs</h2>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(assets ?? []).map((a) => (
          <Card key={a.id} className="overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={outUrls[a.storage_key]} target="_blank"><img src={outUrls[a.storage_key]} alt="" className="w-full" /></a>
            <div className="p-3 text-xs">
              <div className="mb-2 flex gap-1"><Badge tone={a.quality_status === "pass" ? "good" : a.quality_status === "review" ? "warn" : "bad"}>{a.quality_status}</Badge><Badge>{a.approval_status}</Badge></div>
              {(a.quality_checks as { check_type: string; decision: string; score: number | null; details: unknown }[]).map((c) => (
                <div key={c.check_type} className="border-t border-line py-1"><b>{c.check_type}</b> {c.decision} {c.score ?? ""} <span className="text-mute">{JSON.stringify(c.details).slice(0, 160)}</span></div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto p-4">
          <h2 className="display mb-3 text-2xl">Items</h2>
          <table className="w-full text-xs"><tbody>{(items ?? []).map((i) => <tr key={i.id} className="border-t border-line"><td className="py-1.5">#{i.idx}</td><td>{i.status}</td><td>{i.decision}</td><td>{i.attempts}/{i.max_attempts}</td><td>{i.settled}</td><td className="text-mute">{i.last_error}</td></tr>)}</tbody></table>
        </Card>
        <Card className="overflow-x-auto p-4">
          <h2 className="display mb-3 text-2xl">Ledger</h2>
          <table className="w-full text-xs"><tbody>{(ledger ?? []).map((e) => <tr key={e.id} className="border-t border-line"><td className="py-1.5">{e.entry_type}</td><td>{e.quantity}</td><td className="text-mute">{formatDate(e.created_at, true)}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <Card className="mt-6 overflow-x-auto p-4">
        <h2 className="display mb-3 text-2xl">Provider attempts</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-mute"><th>When</th><th>Provider / model</th><th>Status</th><th>Tokens</th><th>Cost</th><th>Latency</th><th>Error</th></tr></thead>
          <tbody>{(attempts ?? []).map((a) => (
            <tr key={a.id} className="border-t border-line align-top">
              <td className="py-1.5">{formatDate(a.created_at, true)}</td><td>{a.provider} / {a.model}</td><td>{a.status}</td><td>{a.input_tokens ?? "-"}/{a.output_tokens ?? "-"}</td>
              <td>${a.cost_usd ?? 0} · ₹{a.cost_inr ?? 0} @ {a.fx_rate}</td><td>{a.latency_ms ? `${(a.latency_ms / 1000).toFixed(1)}s` : "-"}</td><td className="text-bad">{a.error_code} {a.error_message}</td>
            </tr>
          ))}</tbody>
        </table>
        {attempts?.[0]?.prompt_text && <details className="mt-3 text-xs"><summary className="cursor-pointer">Prompt sent</summary><pre className="mt-2 whitespace-pre-wrap rounded bg-paper-2 p-3">{attempts[0].prompt_text}</pre></details>}
      </Card>
    </div>
  );
}
