import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DEMO, HISTORY } from "@/lib/prototype/demo";

/** Real launch packs from lib/public.ts, not invented prices. */
const PACKS = [{ credits: 15, price: "₹1,199" }, { credits: 40, price: "₹2,799" }, { credits: 100, price: "₹5,999" }];

export default async function PrototypeYou({ searchParams }: { searchParams: Promise<{ buy?: string }> }) {
  const { buy } = await searchParams;
  return (
    <main className="pt-page">
      <h1>You</h1>
      <section className="pt-card pt-stack-s">
        <b>{DEMO.user.name}</b>
        <span className="pt-small pt-muted pt-ellipsis">{DEMO.user.email}</span>
        <span className="pt-small pt-muted">Workspace: {DEMO.user.workspace}</span>
      </section>

      <section className="pt-card pt-stack" id="credits" aria-labelledby="bal">
        <div className="pt-between"><h2 id="bal">Credits</h2><b className="pt-num" style={{ fontSize: 22 }}>{DEMO.user.balance}</b></div>
        <p className="pt-small pt-muted">1 credit makes 1 photo. Photos we can&apos;t deliver are returned automatically.</p>
        {buy && <div className="pt-note info" role="status">Prototype only. Buying is not connected here.</div>}
        <div className="pt-grid2" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
          {PACKS.map((p) => (
            <button key={p.credits} type="button" className="pt-chip" style={{ display: "grid", justifyItems: "center", minHeight: 64, borderRadius: 12, padding: 8 }} aria-label={`${p.credits} credits for ${p.price}`}>
              <b className="pt-num">{p.credits}</b><span className="pt-xs pt-muted">{p.price}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="pt-stack" aria-labelledby="hist">
        <h2 id="hist">Credit history</h2>
        <div className="pt-list">
          {HISTORY.map((h, i) => (
            <div key={i} className="pt-li" style={{ gridTemplateColumns: "minmax(0,1fr) auto", minHeight: 56 }}>
              <span className="pt-stack-s" style={{ minWidth: 0 }}><span className="pt-small">{h.what}</span><span className="pt-xs pt-muted">{h.when}</span></span>
              <b className="pt-num pt-small" style={{ color: h.delta > 0 ? "var(--pt-good)" : undefined }}>{h.delta > 0 ? "+" : "−"}{Math.abs(h.delta)}</b>
            </div>
          ))}
        </div>
      </section>

      <nav className="pt-list" aria-label="More">
        {[["Help and contact", "/prototype/states"], ["Privacy and your photos", "/prototype/states"]].map(([t, h]) => (
          <Link key={t} href={h} style={{ gridTemplateColumns: "minmax(0,1fr) auto", minHeight: 56 }}><span className="pt-small">{t}</span><ChevronRight className="pt-chev" aria-hidden /></Link>
        ))}
      </nav>
      <button type="button" className="pt-btn line block">Sign out</button>
    </main>
  );
}
