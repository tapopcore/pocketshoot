"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { PublicPack } from "@/lib/public";

const FOR: Record<string, [string, string[]]> = {
  starter: ["Try it on one product", ["All styles", "Free remakes"]],
  creator: ["A product launch", ["All styles", "Free remakes"]],
  brand: ["A full catalogue refresh", ["All styles", "Brand kit, bulk shoots"]],
  business: ["Weekly new products", ["Everything in Brand", "Team access"]],
  agency: ["Many brands, one account", ["Everything in Business", "Projects per client"]],
};
const fmt = (minor: number, cur: string) => cur === "INR" ? "₹" + Math.round(minor / 100).toLocaleString("en-IN") : "$" + (minor / 100).toLocaleString("en-US", { minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 });

export function PricingTable({ web, shopify }: { web: PublicPack[]; shopify: PublicPack[] }) {
  const [mode, setMode] = useState<"web" | "shopify">("web");
  const [want, setWant] = useState(40);
  const packs = mode === "web" || !shopify.length ? web : shopify;
  const best = useMemo(() => {
    const sorted = [...web].sort((a, b) => a.credits - b.credits);
    return sorted.find((p) => p.credits >= want) ?? sorted[sorted.length - 1];
  }, [want, web]);
  const starter = web.find((p) => p.code === "starter");
  const saving = best && starter && best.code !== "starter" ? Math.round((starter.price_minor / starter.credits) * best.credits - best.price_minor) : 0;
  return (
    <>
      {shopify.length > 0 && <div style={{ marginTop: "var(--s6)", textAlign: "center" }}><span className="seg" role="tablist">
        <button role="tab" aria-selected={mode === "web"} className={mode === "web" ? "on" : ""} onClick={() => setMode("web")}>Pay in INR</button>
        <button role="tab" aria-selected={mode === "shopify"} className={mode === "shopify" ? "on" : ""} onClick={() => setMode("shopify")}>Shopify billing</button>
      </span></div>}
      <div className="wrap" style={{ padding: "var(--s7) var(--gutter) 0", textAlign: "left" }}>
        <div className="pks">
          {packs.map((p) => {
            const hot = p.code === "brand";
            const [forWho, li] = FOR[p.code] ?? ["", []];
            return (
              <div key={p.id} className={`pk${hot ? " hot" : ""}`}>
                <div className="name">{p.name}{hot ? <span className="pill lime sm">Most popular</span> : p.code === "agency" ? <span className="pill good sm">Lowest price</span> : null}</div>
                <div className="amt num">{fmt(p.price_minor, p.currency)}</div>
                <div className="per">{p.credits} photos · {fmt(p.price_minor / p.credits, p.currency)} per photo</div>
                <p className="for">{forWho}</p>
                <ul>{[...li, "Valid for 12 months"].map((x) => <li key={x}><Check />{x}</li>)}</ul>
                <Link href={mode === "web" ? `/sign-in?next=${encodeURIComponent("/app/wallet?pack=" + p.code)}` : "/shopify-app"} className={`btn btn-block ${hot ? "btn-lime" : "btn-soft"}`}>{mode === "web" ? `Buy ${p.name}` : "Get the Shopify app"}</Link>
              </div>
            );
          })}
        </div>
        <p className="sm muted" style={{ textAlign: "center", marginTop: "var(--s5)" }}>{mode === "web" ? "Prices exclude 18% GST. Add your GSTIN at checkout to get a tax invoice." : "Billed in USD on your Shopify invoice."}</p>
        {best && <div className="calc">
          <div><h2 className="h3">Not sure which pack?</h2><p className="body muted" style={{ marginTop: 6 }}>Move the slider and we will suggest one.</p>
            <input type="range" className="rng-in" min={5} max={250} step={5} value={want} onChange={(e) => setWant(+e.target.value)} aria-label="Photos you need" style={{ ["--v" as string]: `${((want - 5) / 245) * 100}%` }} />
            <div className="rng-scale xs muted num" aria-hidden>{[5, 50, 100, 150, 200, 250].map((v) => <span key={v} style={{ left: `calc(${(v - 5) / 245} * (100% - 28px) + 14px)` }}>{v}</span>)}</div></div>
          <div className="res"><div className="between"><span className="sm muted">{want} photos</span><span className="pill lime sm">{best.name} pack</span></div><div className="amt num">{fmt(best.price_minor, "INR")}</div><p className="sm muted">{fmt(best.price_minor / best.credits, "INR")} per photo{saving > 0 ? `. Saves ${fmt(saving, "INR")} compared with Starter packs.` : "."}</p></div>
        </div>}
      </div>
    </>
  );
}
