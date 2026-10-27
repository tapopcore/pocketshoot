"use client";
import { useState } from "react";
import clsx from "clsx";

const DIRECTIONS = [
  { id: "hero", label: "Campaign hero", title: "Make the material memorable.", description: "Directional morning light reveals amber glass and casts a warm reflection across green stone." },
  { id: "human", label: "In real life", title: "Give the product a human moment.", description: "Natural skin, a believable gesture and window light connect the bottle to a daily ritual." },
  { id: "detail", label: "Material story", title: "Make the details tangible.", description: "A closer view of glass, paper, linen and a droplet brings the textures forward." },
];
export function DemoSlider() {
  const [selected, setSelected] = useState(0);
  const current = DIRECTIONS[selected];
  return <figure className="overflow-hidden rounded-3xl border border-line bg-card">
    <div className="relative aspect-[4/5] overflow-hidden bg-paper-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={"/directions/" + current.id + ".webp"} alt={current.description} width={512} height={1024} className="size-full object-cover" />
      <span className="absolute left-4 top-4 rounded-full bg-paper/90 px-3 py-1.5 text-xs font-medium text-ink">AI-created example</span>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-6 pt-20 text-white">
        <p className="text-xs uppercase tracking-widest text-white/70">{current.label}</p>
        <p className="mt-2 text-3xl font-semibold leading-tight">{current.title}</p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-1 border-t border-line p-2" aria-label="Example creative directions">
      {DIRECTIONS.map((direction, i) => <button type="button" key={direction.id} aria-pressed={selected === i} onClick={() => setSelected(i)} className={clsx("min-h-11 rounded-xl px-2 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent", selected === i ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2")}>{direction.label}</button>)}
    </div>
    <figcaption className="px-4 pb-4 text-xs leading-relaxed text-mute">{current.description} Illustrative AI photography, not a customer testimonial or a verified before/after.</figcaption>
  </figure>;
}
