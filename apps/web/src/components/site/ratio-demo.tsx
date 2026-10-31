"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";

const SIZES: [string, string, number][] = [["1:1", "Square", 1], ["4:5", "Portrait", 4 / 5], ["9:16", "Story", 9 / 16], ["16:9", "Wide", 16 / 9]];

/** One photo, cropped live to each marketplace size. Cycles on its own; tap a size to pick it. */
export function RatioDemo() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => { if (!auto) return; const t = setInterval(() => setI((n) => (n + 1) % SIZES.length), 2200); return () => clearInterval(t); }, [auto]);
  const r = SIZES[i][2];
  return (
    <div className="rdemo">
      <div className="stagebox">
        <img src="/showcase/beverage-4.webp" alt="" loading="lazy" decoding="async" />
        <div className="crop" style={{ aspectRatio: String(r), height: r > 1.2 ? "auto" : "88%", width: r > 1.2 ? "92%" : "auto" }}><span>{SIZES[i][0]}</span></div>
      </div>
      <div className="rsel" role="radiogroup" aria-label="Photo size">
        {SIZES.map(([id, name], n) => <button key={id} type="button" role="radio" aria-checked={i === n} className={i === n ? "on" : ""} onClick={() => { setI(n); setAuto(false); }}><b>{id}</b><span>{name}</span></button>)}
      </div>
    </div>
  );
}
