import { notFound } from "next/navigation";
import { categoryLabel } from "@/lib/jobs";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { recentJobs, withRefUrls } from "@/lib/views";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui";
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
    <div className="pg-product">
      <Link href="/app/products" className="link sm" style={{ color: "var(--muted)", marginBottom: "var(--s4)" }}><ArrowLeft size={18} />Products</Link>
      <PageHeader eyebrow={categoryLabel(String(product.category))} title={product.name}
        actions={ctx.role !== "viewer" && <Link href={`/app/new?product=${id}`} className="btn btn-lime"><Plus />New shoot</Link>} />
      <ProductEditor
        product={{ id, name: product.name, category: product.category, sku: product.sku, locks: product.locks, mustNotChange: product.must_not_change, archived: !!product.archived_at }}
        photos={(await withRefUrls(photos ?? [])).map((p) => ({ id: p.id, url: p.url, view: p.view_type, size: `${p.width}×${p.height}`, cutout: (p.metadata as { cutoutMethod?: string })?.cutoutMethod ?? null }))}
      />
      <h2 className="h3" style={{ margin: "var(--s8) 0 var(--s4)" }}>{jobs.length ? `${jobs.length} shoot${jobs.length === 1 ? "" : "s"} of this product` : "Shoots"}</h2>
      {jobs.length === 0 ? <p className="muted">No shoots yet. Start one and it shows up here.</p> : (
        <div className="gx c4" style={{ gap: "var(--s5) var(--s4)" }}>{jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}</div>
      )}
    </div>
  );
}
