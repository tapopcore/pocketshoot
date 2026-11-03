"use client";
/* eslint-disable @next/next/no-img-element -- local illustrative product examples */
import { useState } from "react";
import { PRODUCT_COLLECTIONS } from "@packshot/core";
import { BeforeAfter } from "./before-after";

export const SHOWCASE = [
  { key: "skincare", label: "Skincare" }, { key: "saree", label: "Sarees" },
  { key: "rings", label: "Jewellery" }, { key: "footwear", label: "Shoes" },
  { key: "beverage", label: "Drinks" }, { key: "electronics", label: "Electronics" },
  { key: "bags", label: "Bags" }, { key: "fragrance", label: "Perfume" }, { key: "cookware", label: "Kitchen" },
];
/** Previous category/compare layout, now using the current app's shared visual catalogue. */
export function CategoryShowcase() {
  const [i, setI] = useState(0);
  const c = SHOWCASE[i];
  const collection = PRODUCT_COLLECTIONS.find(x => x.id === c.key)!;
  const image = (id:string) => `/looks/${id}.webp`;
  const first = collection.looks[0], last = collection.looks.at(-1)!;
  return <>
    <div className="cpills" role="group" aria-label="Product category">
      {SHOWCASE.map((x,n)=><button type="button" key={x.key} aria-pressed={n===i} className={`cpill${n===i?" on":""}`} onClick={()=>setI(n)}><img src={image(x.key+"-1")} alt="" width={36} height={36}/>{x.label}</button>)}
    </div>
    <div className="cat current-examples">
      <div className="orig">
        <BeforeAfter key={c.key} before={image(first.id)} after={image(last.id)} alt={`${c.label} illustrative product styles`} labels={["Product example","Styled example"]} style={{aspectRatio:"1"}}/>
        <div className="cap"><span>Same demo product</span><span className="muted" style={{fontWeight:400}}>Drag to compare</span></div>
      </div>
      {collection.looks.map(l=><div key={l.id}><div className="ph r11 zoom"><img src={image(l.id)} alt={`${c.label}: ${l.title}, illustrative example`} width={640} height={640} loading="lazy" decoding="async"/></div><div className="cap">{l.title}</div></div>)}
    </div>
    <p className="xs muted" style={{marginTop:16}}>Shared AI-created style examples, not results generated from your upload. Some views need additional reference photos.</p>
  </>;
}
