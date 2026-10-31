import Link from "next/link";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { withAssetUrls } from "@/lib/views";
import { Empty, LinkButton, PageHeader } from "@/components/ui";
import { LibraryGrid } from "./library-grid";

export const metadata = { title: "Image library" };

const FILTERS = { all: "All", approved: "Approved", review: "Check closely", shopify: "In Shopify" } as const;

export default async function Library({ searchParams }: { searchParams: Promise<{ f?: keyof typeof FILTERS; page?: string; project?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const f = sp.f && sp.f in FILTERS ? sp.f : "all";
  const page = Math.max(1, Number(sp.page ?? 1));
  let q = admin().from("generated_assets")
    .select("id, storage_key, thumb_key, width, height, quality_status, approval_status, watermarked, pushed_to_shopify_at, created_at, job_id, products(name), generation_jobs!generated_assets_job_id_fkey!inner(project_id, style, output)", { count: "exact" })
    .eq("organization_id", ctx.orgId).neq("quality_status", "fail").order("created_at", { ascending: false }).range((page - 1) * 48, page * 48 - 1);
  if (f === "approved") q = q.eq("approval_status", "approved");
  if (f === "review") q = q.eq("quality_status", "review");
  if (f === "shopify") q = q.not("pushed_to_shopify_at", "is", null);
  if (sp.project) q = q.eq("generation_jobs.project_id", sp.project);
  const { data, count } = await q;
  const assets = await withAssetUrls((data ?? []) as unknown as { id: string; storage_key: string; thumb_key: string | null; width: number; height: number; quality_status: string; approval_status: string; watermarked: boolean; job_id: string; products: { name: string } }[]);
  return (
    <div>
      <PageHeader title="All photos">{count ? `${count} photo${count === 1 ? "" : "s"} so far. ` : ""}Select several to download them together.</PageHeader>
      <div className="lfilt">
        {Object.entries(FILTERS).map(([k, label]) => (
          <Link key={k} href={`/app/library?f=${k}`} className={`pill${f === k ? " on" : ""}`} aria-current={f === k ? "page" : undefined}>{label}</Link>
        ))}
      </div>
      {assets.length === 0 ? <Empty title="Nothing here yet" action={<LinkButton href="/app/new">Start a shoot</LinkButton>} /> : (
        <LibraryGrid assets={assets.map((a) => ({ id: a.id, thumb: a.thumbUrl, name: a.products?.name ?? "", jobId: a.job_id, approved: a.approval_status === "approved", review: a.quality_status === "review", ratio: `${a.width}/${a.height}` }))} />
      )}
      {(count ?? 0) > 48 && (
        <div className="mt-10 flex justify-center gap-2">
          {page > 1 && <LinkButton variant="ghost" href={`/app/library?f=${f}&page=${page - 1}`}>Previous</LinkButton>}
          {page * 48 < (count ?? 0) && <LinkButton variant="ghost" href={`/app/library?f=${f}&page=${page + 1}`}>Next</LinkButton>}
        </div>
      )}
    </div>
  );
}
