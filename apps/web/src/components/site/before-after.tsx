"use client";
/* eslint-disable @next/next/no-img-element -- showcase images are pre-sized webp files */
import { useRef, useState } from "react";
import clsx from "clsx";

/** Drag-to-compare slider with the brand orange handle. `demo` sweeps once a few seconds until touched. */
export function BeforeAfter({ before, after, alt = "", start = 50, demo, labels = ["Before", "After"], className, style }: {
  before: string; after: string; alt?: string; start?: number; demo?: boolean; labels?: [string, string] | null; className?: string; style?: React.CSSProperties;
}) {
  const [p, setP] = useState(start);
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const set = (x: number) => { const r = ref.current?.getBoundingClientRect(); if (!r) return; setP(Math.max(2, Math.min(98, ((x - r.left) / r.width) * 100))); setTouched(true); };
  return (
    <div ref={ref} className={clsx("ba", demo && !touched && "demo", className)} style={{ ...style, ["--p" as string]: `${p}%` }}
      onPointerDown={(e) => { drag.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(e.clientX); }}
      onPointerMove={(e) => drag.current && set(e.clientX)} onPointerUp={() => { drag.current = false; }}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") { setP((v) => Math.max(2, v - 5)); setTouched(true); } if (e.key === "ArrowRight") { setP((v) => Math.min(98, v + 5)); setTouched(true); } }}
      role="slider" aria-label="Compare before and after" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)} tabIndex={0}>
      <img src={before} alt="" draggable={false} />
      <img className="after" src={after} alt={alt} draggable={false} />
      {labels && <><span className="pill dark lab l">{labels[0]}</span><span className="pill glass lab r">{labels[1]}</span></>}
      <div className="bar"><div className="knob"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m9 7-5 5 5 5M15 7l5 5-5 5" /></svg></div></div>
    </div>
  );
}
