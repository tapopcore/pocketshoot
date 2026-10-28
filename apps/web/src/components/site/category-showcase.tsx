"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { BeforeAfter } from "./before-after";
import { SHOT_LABELS } from "./shots";
import { shot } from "./bits";

/** One phone photo, six results. Each category uses tiles of the same product, so the comparison is honest. */
export const SHOWCASE: { key: string; label: string; after: number }[] = [
  { key: "skincare", after: 4, label: "Skincare" },
  { key: "saree", after: 2, label: "Sarees" },
  { key: "rings", after: 1, label: "Jewellery" },
  { key: "footwear", after: 1, label: "Shoes" },
  { key: "beverage", after: 2, label: "Drinks" },
  { key: "electronics", after: 1, label: "Headphones" },
  { key: "bags", after: 2, label: "Bags" },
  { key: "fragrance", after: 1, label: "Perfume" },
  { key: "cookware", after: 2, label: "Kitchen" },
];

export function CategoryShowcase() {
  const [i, setI] = useState(0);
  const c = SHOWCASE[i];
  return (
    <>
      <div className="pills" style={{ marginBottom: "var(--s5)" }} role="tablist" aria-label="Product category">
        {SHOWCASE.map((x, n) => <button key={x.key} role="tab" aria-selected={n === i} className={`pill${n === i ? " on" : ""}`} onClick={() => setI(n)}>{x.label}</button>)}
      </div>
      <div className="cat">
        <div className="orig">
          <BeforeAfter key={c.key} before={shot(`${c.key}-before`)} after={shot(`${c.key}-${c.after}`)} alt={`${c.label} product photo`} demo labels={["Before", "After"]} style={{ flex: 1 }} />
          <div className="cap"><span>Original phone photo</span><span className="muted" style={{ fontWeight: 400 }}>Drag to compare</span></div>
        </div>
        {SHOT_LABELS[c.key].map((s, n) => (
          <div key={c.key + n}><div className="ph r11 zoom"><img src={shot(`${c.key}-${n}`)} alt={`${c.label} product photo, ${s.toLowerCase()} style`} loading="lazy" /></div><div className="cap">{s}</div></div>
        ))}
      </div>
    </>
  );
}
