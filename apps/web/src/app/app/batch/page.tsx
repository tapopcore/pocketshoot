import { requireWeb } from "@/lib/auth";
import { getWallet } from "@/lib/credits";
import { getFlag } from "@/lib/settings";
import { admin } from "@/lib/supabase";
import { productList } from "@/lib/views";
import { Badge, Card, Notice, PageHeader, formatDate } from "@/components/ui";
import { BatchBuilder } from "./batch-builder";
import Link from "next/link";

export const metadata = { title: "Batch jobs" };

export default async function Batch() {
  const ctx = await requireWeb("editor");
  const [enabled, wallet, list, creative, { data: kits }, { data: batches }] = await Promise.all([
    getFlag("batch_jobs", ctx.orgId),
    getWallet(ctx.orgId),
    productList(ctx.orgId, { limit: 200 }),
    getFlag("creative_mode", ctx.orgId),
    admin().from("brand_kits").select("id, name, palette").eq("organization_id", ctx.orgId),
    admin().from("batches").select("id, name, created_at, generation_jobs(id, status, requested_count)").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }).limit(10),
  ]);
  return (
    <div>
      <PageHeader title="Bulk shoots">
        Pick products (or import a CSV with photos), choose one style, and shoot them all. Good for catalogues and marketplace listings.
      </PageHeader>
      {!enabled ? <Notice>Batch jobs are turned off for this workspace.</Notice> : (
        <BatchBuilder products={list.products.filter((p) => p.photoCount > 0)} balance={wallet.available} creativeEnabled={creative} brandKits={kits ?? []} />
      )}
      {(batches ?? []).length > 0 && (
        <section className="mt-14">
          <h2 className="display mb-4 text-3xl">Past batches</h2>
          <div className="grid gap-3">
            {(batches ?? []).map((b) => {
              const jobs = (b as unknown as { generation_jobs: { id: string; status: string; requested_count: number }[] }).generation_jobs;
              const done = jobs.filter((j) => ["completed", "review_needed", "failed", "cancelled"].includes(j.status)).length;
              return (
                <Card key={b.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{b.name}</div>
                    <div className="frame-no">{formatDate(b.created_at, true)} · {jobs.length} products · {jobs.reduce((a, j) => a + j.requested_count, 0)} images</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={done === jobs.length ? "good" : "busy"}>{done}/{jobs.length} done</Badge>
                    <Link className="text-sm underline" href={`/app/library`}>Images</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
