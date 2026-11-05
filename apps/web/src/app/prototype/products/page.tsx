/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PRODUCTS } from "@/lib/prototype/demo";

export default async function PrototypeProducts({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return (
    <main className="pt-page">
      <div className="pt-between"><h1>Products</h1><Link href="/prototype/create" className="pt-btn line sm"><Plus />Add</Link></div>
      <p className="pt-small pt-muted">Products you&apos;ve photographed. Pick one to shoot again without uploading.</p>
      {state === "empty" ? (
        <div className="pt-empty">
          <h2>No products yet</h2>
          <p className="pt-small pt-muted">Every product you shoot is saved here with its photos.</p>
          <Link href="/prototype/create" className="pt-btn primary">Add a product</Link>
        </div>
      ) : (
        <div className="pt-list">
          {PRODUCTS.map((p) => (
            <Link key={p.id} href="/prototype/create?step=shoot&saved=1">
              <span className="pt-ph"><img src={p.img} alt="" loading="lazy" /></span>
              <span className="pt-stack-s" style={{ minWidth: 0 }}>
                <b className="pt-small pt-clamp2">{p.name}</b>
                <span className="pt-xs pt-muted">{p.photos} photo{p.photos === 1 ? "" : "s"} · {p.shoots} shoot{p.shoots === 1 ? "" : "s"}</span>
              </span>
              <ChevronRight className="pt-chev" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
