"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Menu, X } from "lucide-react";
import { Go, shot } from "./bits";

const LINKS: [string, string][] = [["/how-it-works", "How it works"], ["/examples", "Examples"], ["/pricing", "Pricing"], ["/shopify-app", "Shopify app"]];

export function SiteNav({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState(false);
  useEffect(() => { const f = () => setLine(window.scrollY > 4); f(); window.addEventListener("scroll", f, { passive: true }); return () => window.removeEventListener("scroll", f); }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);
  const cta = signedIn ? { href: "/app", label: "Open the app" } : { href: "/sign-in", label: "Try 2 photos free" };
  return (
    <>
      <header className={`nav${line ? " line" : ""}`}>
        <div className="wrap in">
          <Link href="/" className="blogo" aria-label="PocketShoot home"><img src="/brand/logo-light.svg" alt="PocketShoot" /></Link>
          <nav className="links" aria-label="Main">{LINKS.map(([h, l]) => <Link key={h} href={h} className={path.startsWith(h) ? "on" : ""}>{l}</Link>)}</nav>
          <div className="acts">
            {!signedIn && <Link href="/sign-in" className="btn btn-sm btn-soft d-only">Log in</Link>}
            <Link href={cta.href} className="btn btn-sm btn-lime d-only">{cta.label}</Link>
            <button className="burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
          </div>
        </div>
      </header>
      {open && (
        <div className="menu" role="dialog" aria-label="Menu">
          <div className="menu-top"><Link href="/" className="blogo"><img src="/brand/logo-light.svg" alt="PocketShoot" /></Link><button className="burger" style={{ display: "grid" }} aria-label="Close menu" onClick={() => setOpen(false)}><X /></button></div>
          <div className="big">{[...LINKS, ["/faq", "Questions"] as [string, string]].map(([h, l]) => <Link key={h} href={h}>{l}<ChevronRight /></Link>)}</div>
          <div className="marquee" style={{ margin: "28px -20px 0" }}><div className="track">{[...Array(2)].flatMap((_, n) => ["skincare-1", "saree-2", "rings-3", "beverage-2", "bags-3", "fragrance-3"].map((s) => <div key={s + n} className="ph" style={{ width: 128, height: 160, flex: "none", borderRadius: 16 }}><img src={shot(s)} alt="" /></div>))}</div></div>
          <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
            <Link href={cta.href} className="btn btn-lg btn-lime btn-block">{cta.label} <Go /></Link>
            {!signedIn && <Link href="/sign-in" className="btn btn-lg btn-soft btn-block">Log in</Link>}
          </div>
        </div>
      )}
    </>
  );
}
