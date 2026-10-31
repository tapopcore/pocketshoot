"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import Link from "next/link";
import { BeforeAfter } from "./before-after";
import { shot } from "./bits";
import { SHOT_LABELS } from "./shots";

/** The strongest photo of each category, shown first. */
const BEST: Record<string, number> = { skincare: 4, saree: 2, rings: 1, footwear: 4, beverage: 2, electronics: 2, bags: 2, fragrance: 2, necklace: 1, "prepared-food": 1, decor: 1, lehenga: 1, makeup: 1, cookware: 2, "mens-ethnic": 1, "packaged-food": 4 };
const CATS: [string, string, string][] = [
  ["skincare", "Skincare", "Body lotion"], ["saree", "Sarees", "Silk saree"], ["rings", "Jewellery", "Solitaire ring"], ["footwear", "Shoes", "Trail shoes"],
  ["beverage", "Drinks", "Peach iced tea"], ["electronics", "Headphones", "Wireless headphones"], ["bags", "Bags", "Leather tote"], ["necklace", "Necklaces", "Emerald pendant"],
  ["prepared-food", "Food", "Chocolate loaf"], ["decor", "Home decor", "Boucle armchair"], ["lehenga", "Lehenga", "Embroidered lehenga"], ["mens-ethnic", "Menswear", "Sherwani set"],
  ["packaged-food", "Packaged food", "Granola pack"], ["fragrance", "Perfume", "Eau de parfum"], ["makeup", "Makeup", "Lipstick"], ["cookware", "Kitchen", "Cast iron pot"],
];

/** One compare slider driven by category pills; every tile below opens its product in the slider. */
export function ExamplesGallery({initialCategory="skincare"}:{initialCategory?:string}) {
  const initial=CATS.some(c=>c[0]===initialCategory)?initialCategory:"skincare";
  const [cat, setCat] = useState(initial);
  const [n, setN] = useState(BEST[initial]??1);
  const top = useRef<HTMLDivElement>(null);
  const [, label, product] = CATS.find((c) => c[0] === cat)!;
  const open = (k: string, i = BEST[k] ?? 1, scroll = true) => {
    setCat(k); setN(i);
    const c = top.current?.querySelector<HTMLElement>(".cpills"), b = c?.querySelector<HTMLElement>(`[data-k="${k}"]`);
    if (c && b && c.scrollWidth > c.clientWidth) c.scrollTo({ left: b.offsetLeft - c.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" });
    if (!scroll || !top.current) return;
    const r = top.current.getBoundingClientRect();
    if (r.top < 70 || r.top > window.innerHeight * 0.4) window.scrollTo({ top: window.scrollY + r.top - 88, behavior: "smooth" });
  };
  return (
    <>
      <div className="exx" ref={top}>
        <div className="exba">
          <BeforeAfter key={cat + n} before={shot(`${cat}-before`)} after={shot(`${cat}-${n}`)} alt={`${product} product photo, ${SHOT_LABELS[cat][n].toLowerCase()}`} labels={["Source example", "Styled example"]} style={{ aspectRatio: "1" }} />
        </div>
        <div className="exside">
          <span className="pill sm">{label}</span>
          <h2 className="h3">{product}</h2>
          <p className="body muted">Explore six illustrative directions using the same demo product. Drag the handle to compare framing and styling.</p>
          <div className="exthumbs" role="list">
            {SHOT_LABELS[cat].map((s, i) => (
              <button key={cat + i} type="button" className={`exth${i === n ? " on" : ""}`} onClick={() => setN(i)} aria-pressed={i === n}>
                <span className="ph r11"><img src={shot(`${cat}-${i}`)} alt="" /></span><span className="xs">{s}</span>
              </button>
            ))}
          </div>
          <Link href="/sign-in" className="btn btn-lime">Try it with your product</Link>
        </div>
        <div className="cpills" role="tablist" aria-label="Product category">
          {CATS.map(([k, l]) => <button key={k} role="tab" aria-selected={cat === k} className={`cpill${cat === k ? " on" : ""}`} data-k={k} onClick={() => open(k)}><img src={shot(`${k}-0`)} alt="" />{l}</button>)}
        </div>
      </div>
      <div className="sec-head exhead"><h2 className="h3">Every category</h2><p className="body muted">Tap a product to compare it above.</p></div>
      <div className="exg">
        {CATS.map(([k, l, p]) => (
          <button type="button" className={`ex${cat === k ? " on" : ""}`} key={k} onClick={() => open(k)}>
            <span className="ph r11 zoom"><img src={shot(`${k}-${BEST[k] ?? 1}`)} alt={`${p} product photo`} loading="lazy" /><span className="src"><span className="ph r11"><img src={shot(`${k}-before`)} alt="" /></span></span></span>
            <span className="cap"><span className="h5">{l}</span><span className="sm muted">{p}</span></span>
          </button>
        ))}
      </div>
    </>
  );
}
