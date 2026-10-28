"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { shot } from "./bits";

const CATS: [string, string][] = [["skincare", "Skincare"], ["saree", "Sarees"], ["rings", "Jewellery"], ["footwear", "Shoes"], ["beverage", "Drinks"], ["electronics", "Headphones"], ["bags", "Bags"], ["fragrance", "Perfume"], ["necklace", "Necklaces"], ["prepared-food", "Food"], ["decor", "Home decor"], ["lehenga", "Lehenga"], ["makeup", "Makeup"], ["cookware", "Kitchen"], ["mens-ethnic", "Menswear"], ["packaged-food", "Packaged food"]];
const STYLE = ["Studio", "With a model", "Outdoor", "Close-up", "Lifestyle"];

export function ExamplesGallery() {
  const [cat, setCat] = useState<string | null>(null);
  const cards = cat ? [0, 1, 2, 3, 4, 5].map((n) => ({ k: cat, n, label: CATS.find((c) => c[0] === cat)![1], style: `Shot ${n + 1}` }))
    : CATS.map(([k, label], i) => ({ k, n: (i % 5) + 1, label, style: STYLE[i % 5] }));
  return (
    <>
      <div className="between filt"><div className="pills" role="tablist" aria-label="Filter by category">
        <button role="tab" aria-selected={!cat} className={`pill${!cat ? " on" : ""}`} onClick={() => setCat(null)}>All</button>
        {CATS.map(([k, l]) => <button key={k} role="tab" aria-selected={cat === k} className={`pill${cat === k ? " on" : ""}`} onClick={() => setCat(k)}>{l}</button>)}
      </div></div>
      <div className="exg">
        {cards.map((c) => (
          <figure className="ex" key={c.k + c.n}>
            <div className="ph r45 zoom"><img src={shot(`${c.k}-${c.n}`)} alt={`${c.label} product photo`} loading="lazy" /><div className="src"><div className="ph r11"><img src={shot(`${c.k}-before`)} alt="" /></div></div></div>
            <figcaption className="between"><span className="h5">{c.label}</span><span className="sm muted nowrap">{c.style}</span></figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
