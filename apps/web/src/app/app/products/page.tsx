/* eslint-disable @next/next/no-img-element -- Signed storage URLs. */
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, Search, Store } from "lucide-react";
import { CATEGORIES, isCategoryId } from "@packshot/core";
import { requireWeb } from "@/lib/auth";
import { productList } from "@/lib/views";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Products" };
const PER = 24;

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; archived?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const archived = sp.archived === "1";
  const { products, total } = await productList(ctx.orgId, { q: sp.q, limit: PER, offset: (page - 1) * PER, includeArchived: archived });
  const qs = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries({ q: sp.q, archived: archived ? "1" : undefined, ...o })) if (v) p.set(k, String(v)); const t = p.toString(); return "/app/products" + (t ? "?" + t : ""); };
  return <div className="pg-products">
    <PageHeader title="Products" actions={<>
      {ctx.role !== "viewer" && <Link href="/app/batch" className="btn btn-line d-only"><Store />Import or bulk add</Link>}
      {ctx.role !== "viewer" && <Link href="/app/new" className="btn btn-lime"><Plus />Add product</Link>}
    </>}>Add a product once, with all its angles, then shoot it again any time.</PageHeader>
    {(total > 0 || sp.q || archived) && <div className="tb">
      <form className="srch" action="/app/products"><Search /><input name="q" defaultValue={sp.q} placeholder="Search by name or SKU" aria-label="Search products" />{archived && <input type="hidden" name="archived" value="1" />}</form>
      <Link href={qs({ archived: archived ? undefined : "1", page: undefined })} className="pill">{archived ? "Hide archived" : "Show archived"}</Link>
      <span className="sm muted d-only" style={{ marginLeft: "auto" }}>{total} product{total === 1 ? "" : "s"}</span>
    </div>}
    {products.length === 0
      ? (sp.q ? <div className="note" style={{ marginTop: "var(--s6)" }}>No products match “{sp.q}”. <Link className="link" href="/app/products">Clear search</Link></div>
        : <Empty title="No products yet" action={<Link href="/app/new" className="btn btn-lg btn-lime">Add your first product</Link>}>Products are saved when you start a shoot, import from Shopify or use Bulk shoots.</Empty>)
      : <div className="gx c4 grid-top" style={{ gap: "var(--s5) var(--s4)" }}>{products.map((p, i) => (
        <Link key={p.id} href={`/app/products/${p.id}`} className="pd lift animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
          <div className="pim"><div className="ph r11">{p.coverUrl && <img src={p.coverUrl} alt="" />}</div></div>
          <div className="meta">
            <div style={{ minWidth: 0 }}><b>{p.name}</b><span>{isCategoryId(p.category) ? CATEGORIES[p.category].label : p.category}{p.sku ? ` · ${p.sku}` : ""}</span></div>
            {p.archived ? <span className="pill sm">Archived</span> : p.photoCount === 0 ? <span className="pill warn sm">No photo</span> : <span className="pill sm">{p.photoCount} {p.photoCount === 1 ? "angle" : "angles"}</span>}
          </div>
        </Link>
      ))}</div>}
    {total > PER && <nav className="row" style={{ marginTop: "var(--s7)", justifyContent: "center" }}>
      {page > 1 && <Link className="btn btn-soft" href={qs({ page: page - 1 })}><ArrowLeft />Previous</Link>}
      {page * PER < total && <Link className="btn btn-soft" href={qs({ page: page + 1 })}>Next<ArrowRight /></Link>}
    </nav>}
  </div>;
}
