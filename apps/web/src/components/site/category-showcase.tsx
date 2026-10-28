"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { BeforeAfter } from "./before-after";
import { shot } from "./bits";

/** One phone photo, six results. Each category uses tiles of the same product, so the comparison is honest. */
export const SHOWCASE: { key: string; label: string; styles: string[]; after: number }[] = [
  { key: "skincare", after: 4, label: "Skincare", styles: ["Studio", "In hand", "On skin", "Texture", "Botanical", "Close-up"] },
  { key: "saree", after: 2, label: "Sarees", styles: ["Studio", "Full drape", "Courtyard", "Seated", "Fabric detail", "Pallu fold"] },
  { key: "rings", after: 2, label: "Jewellery", styles: ["Studio", "Soft light", "On hand", "Garden", "Stone detail", "On silk"] },
  { key: "footwear", after: 2, label: "Shoes", styles: ["Outdoor", "Mountain", "On trail", "Lacing up", "Detail", "Studio"] },
  { key: "beverage", after: 2, label: "Drinks", styles: ["Studio", "Window light", "With a model", "Pouring", "Close-up", "Seaside table"] },
  { key: "electronics", after: 3, label: "Headphones", styles: ["Studio", "Soft light", "In hand", "Lifestyle", "Detail", "Desk"] },
  { key: "bags", after: 3, label: "Bags", styles: ["Studio", "Soft light", "Café", "Street", "Leather detail", "Inside"] },
  { key: "fragrance", after: 2, label: "Perfume", styles: ["Studio", "Warm light", "Held up", "On skin", "Macro", "Vanity"] },
  { key: "cookware", after: 2, label: "Kitchen", styles: ["Studio", "Stovetop", "Serving", "Handle detail", "Dinner table", "Lid detail"] },
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
        {c.styles.map((s, n) => (
          <div key={c.key + n}><div className="ph r11 zoom"><img src={shot(`${c.key}-${n}`)} alt={`${c.label} product photo, ${s.toLowerCase()} style`} loading="lazy" /></div><div className="cap">{s}</div></div>
        ))}
      </div>
    </>
  );
}
