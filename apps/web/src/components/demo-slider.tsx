"use client";
import { useState } from "react";
import clsx from "clsx";

const SCENES = [
  { id: "white", label: "Pure White", bg: "radial-gradient(120% 90% at 50% 35%, #ffffff, #ecebe8)", floor: "#00000010" },
  { id: "botanical", label: "Botanical", bg: "radial-gradient(120% 90% at 50% 30%, #e7efdf, #9fb98f)", floor: "#2d4a2118", leaves: true },
  { id: "luxury", label: "Luxury Dark", bg: "radial-gradient(90% 80% at 50% 30%, #3a3a3e, #0e0e10)", floor: "#00000060", rim: true },
  { id: "festive", label: "Festive", bg: "radial-gradient(120% 90% at 50% 30%, #f7d88f, #b5481f)", floor: "#5a1a0430", lights: true },
];

/** An illustrated jar: the same "product" drawn on every scene, to show that only the surroundings change. */
function Jar({ rim }: { rim?: boolean }) {
  return (
    <svg viewBox="0 0 120 150" className="h-full w-auto drop-shadow-[0_18px_14px_rgba(0,0,0,0.25)]" aria-hidden>
      <defs>
        <linearGradient id="glass" x1="0" x2="1"><stop offset="0" stopColor="#1f3d2c" /><stop offset=".45" stopColor="#2f5a41" /><stop offset="1" stopColor="#173022" /></linearGradient>
        <linearGradient id="cap" x1="0" x2="1"><stop offset="0" stopColor="#b98b4a" /><stop offset=".5" stopColor="#f0d29a" /><stop offset="1" stopColor="#9a6f35" /></linearGradient>
      </defs>
      <rect x="22" y="8" width="76" height="22" rx="5" fill="url(#cap)" />
      <rect x="14" y="28" width="92" height="116" rx="16" fill="url(#glass)" stroke={rim ? "#ffffff70" : "none"} strokeWidth="1.2" />
      <rect x="14" y="58" width="92" height="52" fill="#f3ece0" />
      <text x="60" y="80" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fill="#1f3d2c" fontWeight="700">HERBAL</text>
      <text x="60" y="94" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="7" fill="#1f3d2c" letterSpacing="1.5">FACE CREAM</text>
      <text x="60" y="104" textAnchor="middle" fontFamily="Helvetica, Arial" fontSize="5.5" fill="#6b5b45">50 g · NET WT.</text>
      <rect x="22" y="34" width="6" height="104" rx="3" fill="#ffffff22" />
    </svg>
  );
}

export function DemoSlider() {
  const [split, setSplit] = useState(48);
  const [scene, setScene] = useState(0);
  const s = SCENES[scene];
  return (
    <div>
      <div className="cropmarks relative aspect-[4/5] w-full select-none overflow-hidden rounded-[18px] sm:aspect-square">
        <div className="absolute inset-0 transition-[background] duration-700" style={{ background: s.bg }}>
          {s.leaves && (
            <svg className="absolute bottom-[14%] left-[8%] h-[38%] opacity-90" viewBox="0 0 100 120" aria-hidden><path d="M50 120 C 40 80, 10 70, 5 30 C 35 40, 50 70, 50 120Z M52 120 C 60 70, 90 60, 96 20 C 70 35, 55 70, 52 120Z" fill="#4c7a3a" /></svg>
          )}
          {s.lights && Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="absolute rounded-full bg-[#fff3c4] blur-[2px]" style={{ width: 8 + (i % 4) * 5, height: 8 + (i % 4) * 5, left: `${(i * 37) % 100}%`, top: `${8 + ((i * 23) % 40)}%`, opacity: 0.55 }} />
          ))}
          <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: `linear-gradient(to bottom, transparent, ${s.floor})` }} />
          <div className="absolute bottom-[17%] left-1/2 h-[54%] -translate-x-1/2"><Jar rim={s.rim} /></div>
          <div className="absolute bottom-[15.5%] left-1/2 h-4 w-[30%] -translate-x-1/2 rounded-[50%] bg-black/30 blur-md" />
        </div>
        {/* "Before": a phone photo on a cluttered desk */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #b8ad9b 0%, #8f8574 55%, #6f6656 100%)", filter: "saturate(0.8)" }}>
            <div className="absolute right-[10%] top-[12%] h-[22%] w-[18%] rotate-6 rounded-sm bg-[#d9d2c4] opacity-70" />
            <div className="absolute left-[6%] top-[60%] h-[4%] w-[40%] -rotate-12 rounded-full bg-[#4a4033] opacity-50" />
            <div className="absolute inset-x-0 bottom-0 h-[40%] bg-[#7b705f]" />
            <div className="absolute bottom-[17%] left-1/2 h-[54%] -translate-x-1/2 brightness-[0.82] contrast-[0.9]"><Jar /></div>
            <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_20%,#fff4,transparent)]" />
          </div>
          <span className="eyebrow absolute left-4 top-4 rounded-full bg-paper/85 px-2.5 py-1 !text-ink">Your phone photo</span>
        </div>
        <span className="eyebrow absolute right-4 top-4 rounded-full bg-paper/85 px-2.5 py-1 !text-ink">{s.label}</span>
        <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-accent" style={{ left: `${split}%` }}>
          <span className="absolute top-1/2 -ml-[15px] grid size-8 -translate-y-1/2 place-items-center rounded-full bg-accent text-xs text-white shadow">⇆</span>
        </div>
        <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label="Drag to compare" className="absolute inset-0 size-full cursor-ew-resize opacity-0" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {SCENES.map((x, i) => (
          <button key={x.id} onClick={() => setScene(i)} className={clsx("rounded-full border px-3 py-1 text-sm transition-colors", i === scene ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}>{x.label}</button>
        ))}
        <span className="ml-auto text-xs text-mute">Illustration. The jar and its label stay the same in every scene.</span>
      </div>
    </div>
  );
}
