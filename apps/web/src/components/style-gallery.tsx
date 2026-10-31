"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Plus, Minus } from "lucide-react";
import { PRODUCT_COLLECTIONS } from "@packshot/core";
import { INDUSTRIES, signInToShoot } from "@/lib/shoot-catalog";
import { LookImage } from "./look-image";
export function StyleGallery() {
  const [industry,setIndustry]=useState("fashion"), [type,setType]=useState("saree"), [more,setMore]=useState(false);
  const types = PRODUCT_COLLECTIONS.filter(c=>c.category===industry);
  const collection=types.find(c=>c.id===type) ?? types[0];
  if (!collection) return null;
  return <div className="look-browser">
    <div className="look-industries" aria-label="Choose your industry">{INDUSTRIES.map(i=><button type="button" key={i.id} aria-pressed={industry===i.id} onClick={()=>{setIndustry(i.id);setType(PRODUCT_COLLECTIONS.find(c=>c.category===i.id)!.id);setMore(false);}}>{industry===i.id&&<Check size={15}/>} {i.title}</button>)}</div>
    <label className="look-type">What do you sell?<select value={collection.id} onChange={e=>{setType(e.target.value);setMore(false);}}>{types.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <div className="look-cards">{collection.looks.slice(0,more?collection.looks.length:3).map(l=><Link key={l.id} href={signInToShoot(industry,l.id)}><div className="look-card-photo"><LookImage look={l}/><span><ArrowUpRight size={18}/></span></div><h3>{l.title}</h3><p>{l.subtitle}</p></Link>)}</div>
    <button type="button" className="look-more" aria-expanded={more} onClick={()=>setMore(!more)}>{more?<Minus size={16}/>:<Plus size={16}/>} {more?"Show recommended looks":"More looks for "+collection.label.toLowerCase()}</button>
    <p className="look-disclosure">Original illustrative examples. People shown are synthetic adults. Some views need additional reference photos.</p>
  </div>;
}
