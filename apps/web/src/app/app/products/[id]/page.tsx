import { notFound } from "next/navigation";
import { categoryLabel } from "@/lib/jobs";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { recentJobs, withRefUrls } from "@/lib/views";
import { LinkButton, PageHeader } from "@/components/ui";
import { JobCard } from "@/components/job-card";
import { ProductEditor } from "./product-editor";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeb();
  const { id } = await params;
  const { data: product } = await admin().from("products").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!product) notFound();
  const [{ data: photos }, jobs] = await Promise.all([
    admin().from("product_assets").select("id, storage_key, view_type, width, height, metadata").eq("product_id", id).order("created_at"),
    recentJobs(ctx.orgId, 24, 0, { productId: id }),
  ]);
  return (
    <div>
      <PageHeader eyebrow={categoryLabel(String(product.category))} title={product.name}
        actions={<LinkButton href={`/app/new?product=${id}`} variant="accent">New shoot of this product</LinkButton>} />
      <ProductEditor
        product={{ id, name: product.name, category: product.category, sku: product.sku, locks: product.locks, mustNotChange: product.must_not_change, archived: !!product.archived_at }}
        photos={(await withRefUrls(photos ?? [])).map((p) => ({ id: p.id, url: p.url, view: p.view_type, size: `${p.width}×${p.height}`, cutout: (p.metadata as { cutoutMethod?: string })?.cutoutMethod ?? null }))}
      />
      <h2 className="display mb-5 mt-14 text-3xl">Shoots</h2>
      {jobs.length === 0 ? <p className="text-mute">No shoots yet.</p> : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">{jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}</div>
      )}
    </div>
  );
}
