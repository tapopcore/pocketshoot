import { requirePlatform } from "@/lib/auth";
import Link from "next/link";
import { admin } from "@/lib/supabase";
import { signedUrls } from "@/lib/storage";
import { REFUND_REASONS } from "@/lib/assets";
import { Badge, Card, Empty, Input, PageHeader, formatDate } from "@/components/ui";
import { decideRefundAction } from "../actions";

export default async function Refunds({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePlatform(); // pages do their own check: layouts are skipped on client-side navigation

  const status = (await searchParams).status ?? "open";
  const { data } = await admin().from("refund_requests")
    .select("id, reason, details, status, resolution, evidence, created_at, organization_id, organizations(name), generated_assets(id, storage_key, job_id, product_id, quality_status)")
    .eq("status", status).order("created_at", { ascending: status === "open" }).limit(40);
  const rows = (data ?? []) as unknown as { id: string; reason: keyof typeof REFUND_REASONS; details: string | null; status: string; resolution: string | null; evidence: Record<string, unknown>; created_at: string; organization_id: string; organizations: { name: string }; generated_assets: { id: string; storage_key: string; job_id: string; product_id: string; quality_status: string } }[];
  const productIds = [...new Set(rows.map((r) => r.generated_assets.product_id))];
  const { data: refs } = productIds.length ? await admin().from("product_assets").select("product_id, storage_key").in("product_id", productIds).order("created_at") : { data: [] };
  const refByProduct = new Map<string, string>();
  for (const r of refs ?? []) if (!refByProduct.has(r.product_id)) refByProduct.set(r.product_id, r.storage_key);
  const [outUrls, refUrls] = await Promise.all([signedUrls("outputs", rows.map((r) => r.generated_assets.storage_key), 900), signedUrls("originals", [...refByProduct.values()], 900)]);
  return (
    <div>
      <PageHeader eyebrow="Product integrity" title="Refund requests">Approve when the product itself changed (logo, text, shape, colour, wrong or missing item). Reject for taste. Approving restores one credit.</PageHeader>
      <div className="mb-6 flex gap-2">{["open", "approved", "auto_approved", "rejected"].map((s) => <Link key={s} href={`/admin/refunds?status=${s}`} className={`rounded-full px-3 py-1 text-sm ${s === status ? "bg-ink text-paper" : "border border-line"}`}>{s.replace("_", " ")}</Link>)}</div>
      {rows.length === 0 ? <Empty title="Nothing here" /> : (
        <div className="space-y-6">
          {rows.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <Badge tone="warn">{REFUND_REASONS[r.reason]}</Badge>
                <Link href={`/admin/orgs/${r.organization_id}`} className="font-medium hover:underline">{r.organizations.name}</Link>
                <span className="frame-no">{formatDate(r.created_at, true)}</span>
                <Link className="underline" href={`/admin/jobs/${r.generated_assets.job_id}`}>Job timeline</Link>
                {r.evidence?.abuseHold ? <Badge tone="bad">High report rate</Badge> : null}
              </div>
              {r.details && <p className="mb-4 rounded-lg bg-paper-2 p-3 text-sm">&ldquo;{r.details}&rdquo;</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <figure><figcaption className="eyebrow mb-1">Customer&apos;s photo</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={refUrls[refByProduct.get(r.generated_assets.product_id) ?? ""]} alt="" className="max-h-96 w-full rounded-lg border border-line object-contain" />
                </figure>
                <figure><figcaption className="eyebrow mb-1">Result ({r.generated_assets.quality_status})</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <a href={outUrls[r.generated_assets.storage_key]} target="_blank"><img src={outUrls[r.generated_assets.storage_key]} alt="" className="max-h-96 w-full rounded-lg border border-line object-contain" /></a>
                </figure>
              </div>
              <details className="mt-3 text-xs"><summary className="cursor-pointer text-mute">Automated evidence</summary><pre className="mt-2 overflow-auto rounded bg-paper-2 p-2">{JSON.stringify(r.evidence, null, 2)}</pre></details>
              {r.status === "open" ? (
                <form action={decideRefundAction} className="mt-4 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Input name="resolution" placeholder="Note shown to the customer" className="!h-10 max-w-md flex-1" />
                  <button name="approve" value="1" className="h-10 rounded-full bg-good px-5 text-sm text-white">Approve, restore credit</button>
                  <button name="approve" value="0" className="h-10 rounded-full border border-line px-5 text-sm">Reject</button>
                </form>
              ) : <p className="mt-3 text-sm text-mute">{r.resolution}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
