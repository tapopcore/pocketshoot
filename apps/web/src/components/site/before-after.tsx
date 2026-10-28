"use client";
/* eslint-disable @next/next/no-img-element -- showcase images are pre-sized webp files */
import { useRef, useState } from "react";
import clsx from "clsx";

/**
 * Drag-to-compare slider. Only the orange handle drags, so swiping over the photo
 * still scrolls the page on phones. `demo` sweeps until the handle is touched.
 */
export function BeforeAfter({ before, after, alt = "", start = 50, demo, labels = ["Before", "After"], className, style }: {
  before: string; after: string; alt?: string; start?: number; demo?: boolean; labels?: [string, string] | null; className?: string; style?: React.CSSProperties;
}) {
  const [p, setP] = useState(start);
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const set = (x: number) => { const r = ref.current?.getBoundingClientRect(); if (!r) return; setP(Math.max(2, Math.min(98, ((x - r.left) / r.width) * 100))); setTouched(true); };
  const nudge = (d: number) => { setP((v) => Math.max(2, Math.min(98, v + d))); setTouched(true); };
  return (
    <div ref={ref} className={clsx("ba", demo && !touched && "demo", drag.current && "dragging", className)} style={{ ...style, ["--p" as string]: `${p}%` }}>
      <img src={before} alt="" draggable={false} />
      <img className="after" src={after} alt={alt} draggable={false} />
      {labels && <><span className="pill dark lab l">{labels[0]}</span><span className="pill glass lab r">{labels[1]}</span></>}
      <div className="bar">
        <button type="button" className="knob" aria-label="Drag to compare before and after" role="slider" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}
          onPointerDown={(e) => { e.preventDefault(); drag.current = true; e.currentTarget.setPointerCapture(e.pointerId); setTouched(true); }}
          onPointerMove={(e) => { if (drag.current) set(e.clientX); }}
          onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-5); } if (e.key === "ArrowRight") { e.preventDefault(); nudge(5); } }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m9 7-5 5 5 5M15 7l5 5-5 5" /></svg>
        </button>
      </div>
    </div>
  );
}
