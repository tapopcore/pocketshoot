import Link from "next/link";
import { CATEGORIES, isCategoryId } from "@packshot/core";
import { requireWeb } from "@/lib/auth";
import { productList } from "@/lib/views";
import { Badge, Empty, Input, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Products" };

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; archived?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const { products, total } = await productList(ctx.orgId, { q: sp.q, limit: 24, offset: (page - 1) * 24, includeArchived: sp.archived === "1" });
  return (
    <div>
      <PageHeader eyebrow={`${total} products`} title="Products" actions={<LinkButton href="/app/new">Add a product</LinkButton>}>
        Each product keeps its reference photos and what must not change, so you can shoot it again in any style.
      </PageHeader>
      <form className="mb-6 flex gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Search by name or SKU" className="max-w-sm" />
        <LinkButton href={sp.archived === "1" ? "/app/products" : "/app/products?archived=1"} variant="ghost">{sp.archived === "1" ? "Hide archived" : "Show archived"}</LinkButton>
      </form>
      {products.length === 0 ? (
        <Empty title={sp.q ? "No matches" : "No products yet"} action={<LinkButton href="/app/new">Upload your first product</LinkButton>}>Products are created when you start a shoot, import from Shopify, or upload a CSV in Batch.</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <Link key={p.id} href={`/app/products/${p.id}`} className="group animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
              <div className="cropmarks aspect-square overflow-hidden rounded-lg bg-paper-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />}
              </div>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.name}</div>
                  <div className="frame-no">{isCategoryId(p.category) ? CATEGORIES[p.category].label : p.category}{p.sku ? ` · ${p.sku}` : ""}</div>
                </div>
                {p.archived ? <Badge>Archived</Badge> : p.source === "shopify" ? <Badge tone="good">Shopify</Badge> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
      {total > 24 && (
        <div className="mt-10 flex justify-center gap-2">
          {page > 1 && <LinkButton variant="ghost" href={`/app/products?page=${page - 1}${sp.q ? `&q=${sp.q}` : ""}`}>Previous</LinkButton>}
          {page * 24 < total && <LinkButton variant="ghost" href={`/app/products?page=${page + 1}${sp.q ? `&q=${sp.q}` : ""}`}>Next</LinkButton>}
        </div>
      )}
    </div>
  );
}
