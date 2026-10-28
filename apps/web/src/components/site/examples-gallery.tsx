"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { shot } from "./bits";
import { SHOT_LABELS } from "./shots";

/** The strongest photo of each category for the "All" view. */
const BEST: Record<string, number> = { skincare: 1, saree: 2, rings: 1, footwear: 4, beverage: 2, electronics: 2, bags: 2, fragrance: 2, necklace: 1, "prepared-food": 1, decor: 1, lehenga: 1, makeup: 1, cookware: 2, "mens-ethnic": 1, "packaged-food": 4 };
const CATS: [string, string][] = [["skincare", "Skincare"], ["saree", "Sarees"], ["rings", "Jewellery"], ["footwear", "Shoes"], ["beverage", "Drinks"], ["electronics", "Headphones"], ["bags", "Bags"], ["fragrance", "Perfume"], ["necklace", "Necklaces"], ["prepared-food", "Food"], ["decor", "Home decor"], ["lehenga", "Lehenga"], ["makeup", "Makeup"], ["cookware", "Kitchen"], ["mens-ethnic", "Menswear"], ["packaged-food", "Packaged food"]];

export function ExamplesGallery() {
  const [cat, setCat] = useState<string | null>(null);
  const cards = cat ? [0, 1, 2, 3, 4, 5].map((n) => ({ k: cat, n, label: CATS.find((c) => c[0] === cat)![1], style: SHOT_LABELS[cat][n] }))
    : CATS.map(([k, label]) => ({ k, n: BEST[k] ?? 1, label, style: SHOT_LABELS[k][BEST[k] ?? 1] }));
  return (
    <>
      <div className="between filt"><div className="pills" role="tablist" aria-label="Filter by category">
        <button role="tab" aria-selected={!cat} className={`pill${!cat ? " on" : ""}`} onClick={() => setCat(null)}>All</button>
        {CATS.map(([k, l]) => <button key={k} role="tab" aria-selected={cat === k} className={`pill${cat === k ? " on" : ""}`} onClick={() => setCat(k)}>{l}</button>)}
      </div></div>
      <div className="exg">
        {cards.map((c) => (
          <figure className="ex" key={c.k + c.n}>
            <div className="ph r11 zoom"><img src={shot(`${c.k}-${c.n}`)} alt={`${c.label} product photo`} loading="lazy" /><div className="src"><div className="ph r11"><img src={shot(`${c.k}-before`)} alt="" /></div></div></div>
            <figcaption className="between"><span className="h5">{cat ? c.style : c.label}</span><span className="sm muted nowrap">{cat ? `Photo ${c.n + 1}` : c.style}</span></figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
