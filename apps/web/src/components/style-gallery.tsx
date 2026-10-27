/* eslint-disable @next/next/no-img-element -- Catalogue images are pre-sized and compressed. */
"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { INDUSTRIES, SHOOT_STYLES, SHOOT_STYLE_IDS, signInToShoot } from "@/lib/shoot-catalog";
export function StyleGallery() {
  const [industry, setIndustry] = useState("beauty");
  return <div>
    <div className="no-scrollbar -mx-4 mb-7 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Choose your industry">
      {INDUSTRIES.map(i => <button type="button" key={i.id} aria-pressed={industry === i.id} onClick={() => setIndustry(i.id)} className={"flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors " + (industry === i.id ? "border-ink bg-ink text-paper" : "border-line bg-card text-ink-2")}>{industry === i.id && <Check size={13} />}{i.title}</button>)}
    </div>
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-3 md:gap-x-6">
      {SHOOT_STYLE_IDS.map(id => { const s = SHOOT_STYLES[id]; return <Link key={id} href={signInToShoot(industry, id)} className="group min-w-0">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-paper-2"><img src={s.image} alt={s.title + " AI-created photographic style example"} width={512} height={512} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none" /><span className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full bg-white text-black"><ArrowUpRight size={17} /></span></div>
        <div className="mt-3 text-base font-semibold tracking-tight sm:text-xl">{s.title}</div><p className="mt-1 text-xs leading-relaxed text-ink-2 sm:text-sm">{s.subtitle}</p>
      </Link>; })}
    </div>
    <p className="mt-6 text-xs leading-relaxed text-mute">AI-created style examples across industries. Choose a look; your own product is photographed when you create a shoot.</p>
  </div>;
}
