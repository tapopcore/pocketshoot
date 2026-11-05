/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Camera, ChevronRight, ImageUp, RotateCcw } from "lucide-react";
import { DEMO, PRODUCTS, RECENT } from "@/lib/prototype/demo";

export default async function PrototypeHome({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  const first = state === "empty";
  return (
    <main className="pt-page">
      <section className="pt-stack">
        <p className="pt-muted pt-small">Good evening</p>
        <h1>{first ? <>Your first <span className="pt-it">shoot</span> takes a minute</> : <>What are we <span className="pt-it">shooting</span> today?</>}</h1>
      </section>

      <section className="pt-hero" aria-labelledby="start">
        <div className="pt-stack-s">
          <h2 id="start">Create a shoot</h2>
          <p className="pt-small">Take or upload a photo of one product. You choose the kind of photos before anything is made.</p>
        </div>
        <div className="pt-pair">
          <Link href="/prototype/create?via=camera" className="pt-btn line"><Camera />Take photo</Link>
          <Link href="/prototype/create?via=upload" className="pt-btn primary"><ImageUp />Upload photo</Link>
        </div>
      </section>

      {!first && (
        <Link href="/prototype/create?step=shoot&resume=1" className="pt-card pt-row" style={{ padding: 12 }}>
          <span className="pt-ph" style={{ width: 56, height: 56, flex: "none" }}><img src={DEMO.product.raw} alt="" /></span>
          <span style={{ minWidth: 0, flex: 1 }} className="pt-stack-s">
            <b className="pt-ellipsis">Continue your shoot</b>
            <span className="pt-xs pt-muted pt-ellipsis">{DEMO.product.name} · choosing the kind of shoot</span>
          </span>
          <RotateCcw size={18} aria-hidden />
        </Link>
      )}

      {first ? (
        <section className="pt-card pt-stack">
          <h2>What you&apos;ll get</h2>
          <ol className="pt-slots">
            <li><span>Add one clear photo. More angles help, but one is enough to start.</span></li>
            <li><span>Pick Studio photos, Model & everyday use, or a Creative campaign.</span></li>
            <li><span>See exactly which photos we&apos;ll make and the credits, before you confirm.</span></li>
          </ol>
          <p className="pt-small pt-muted">You have 2 free photos. Photos we can&apos;t deliver are never charged.</p>
        </section>
      ) : (
        <>
          <section className="pt-stack">
            <div className="pt-between"><h2>Recent shoots</h2><Link href="/prototype/shoots" className="pt-link pt-small">See all</Link></div>
            <div className="pt-hscroll">
              {RECENT.map((r, i) => (
                <Link key={i} href={`/prototype/shoots/${r.id}`} className="pt-stack-s">
                  <span className="pt-ph pt-ar-45"><img src={r.img} alt="" loading="lazy" /></span>
                  <b className="pt-small pt-clamp2">{r.name}</b>
                  <span className="pt-xs pt-muted">{r.kind} · {r.status}</span>
                </Link>
              ))}
            </div>
          </section>
          <section className="pt-stack">
            <div className="pt-between"><h2>Shoot a saved product</h2><Link href="/prototype/products" className="pt-link pt-small">All products</Link></div>
            <div className="pt-list">
              {PRODUCTS.map((p) => (
                <Link key={p.id} href="/prototype/create?step=shoot&saved=1">
                  <span className="pt-ph"><img src={p.img} alt="" loading="lazy" /></span>
                  <span className="pt-stack-s" style={{ minWidth: 0 }}><b className="pt-small pt-clamp2">{p.name}</b><span className="pt-xs pt-muted">{p.photos} photo{p.photos === 1 ? "" : "s"} · {p.shoots} shoot{p.shoots === 1 ? "" : "s"}</span></span>
                  <ChevronRight className="pt-chev" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
