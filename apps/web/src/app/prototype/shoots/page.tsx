/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { RECENT } from "@/lib/prototype/demo";

export default async function PrototypeShoots({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state } = await searchParams;
  return (
    <main className="pt-page">
      <h1>Shoots</h1>
      {state === "empty" ? (
        <div className="pt-empty">
          <h2>No shoots yet</h2>
          <p className="pt-small pt-muted">Your finished photos will be kept here.</p>
          <Link href="/prototype/create" className="pt-btn primary">Create a shoot</Link>
        </div>
      ) : state === "loading" ? (
        <div className="pt-list" aria-busy="true" aria-label="Loading shoots">
          {[0, 1, 2].map((i) => <div key={i} className="pt-li"><span className="pt-skel" style={{ width: 56, height: 56 }} /><span className="pt-stack-s"><span className="pt-skel" style={{ height: 14, width: "80%" }} /><span className="pt-skel" style={{ height: 12, width: "50%" }} /></span><span /></div>)}
        </div>
      ) : (
        <div className="pt-list">
          {RECENT.map((r, i) => (
            <Link key={i} href={`/prototype/shoots/${r.id}`}>
              <span className="pt-ph"><img src={r.img} alt="" loading="lazy" /></span>
              <span className="pt-stack-s" style={{ minWidth: 0 }}>
                <b className="pt-small pt-clamp2">{r.name}</b>
                <span className="pt-xs pt-muted">{r.kind} · {r.when} · {r.status}</span>
              </span>
              <ChevronRight className="pt-chev" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
