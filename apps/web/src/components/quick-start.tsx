"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Camera, ImagePlus, Sparkles } from "lucide-react";
import { STYLES, type StyleId } from "@packshot/core";
import { setPendingFiles } from "@/lib/photo-client";

const SHOWCASE: StyleId[] = ["pastel_podium", "water_splash", "luxury_dark", "botanical", "festive", "shadow_play", "kitchen_lifestyle", "colour_pop", "velvet_gold", "neon_night"];

export function QuickStart({ hello, credits }: { hello: string; credits: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  function go(files: FileList | File[] | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setPendingFiles(list);
    router.push("/app/new");
  }
  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); go(e.dataTransfer.files); }}
      className={clsx("relative overflow-hidden rounded-[28px] bg-ink px-6 py-9 text-white shadow-[var(--shadow-pop)] transition-transform sm:px-10 sm:py-12", over && "scale-[1.01]")}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-[radial-gradient(circle,#7c5cff_0%,transparent_65%)] opacity-60 [animation:glow_6s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-32 left-1/3 size-[380px] rounded-full bg-[radial-gradient(circle,#ff5a1f_0%,transparent_65%)] opacity-40 [animation:glow_7s_ease-in-out_infinite]" />
      <div className="relative">
        <div className="text-sm font-medium text-white/60">{hello}</div>
        <h1 className="display mt-2 max-w-xl text-4xl sm:text-5xl">Turn one photo into a <span className="ai-text">whole photoshoot</span></h1>
        <p className="mt-3 max-w-lg text-white/70">Drop a product photo. We cut it out, read the label, and build studio and lifestyle scenes around your real product.</p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => input.current?.click()} className="inline-flex h-13 items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink shadow-lg transition-transform hover:scale-[1.03]">
            <ImagePlus size={19} /> Upload a photo
          </button>
          <button type="button" onClick={() => camera.current?.click()} className="inline-flex h-13 items-center gap-2 rounded-full bg-white/10 px-5 font-medium backdrop-blur hover:bg-white/15 sm:hidden">
            <Camera size={18} /> Camera
          </button>
          <span className="hidden text-sm text-white/50 sm:inline">or drop it anywhere here</span>
        </div>
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"><Sparkles size={12} /> {credits} credit{credits === 1 ? "" : "s"} available · 1 credit per image</div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => go(e.target.files)} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => go(e.target.files)} />
    </section>
  );
}

export function SceneStrip() {
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
      {SHOWCASE.map((id) => {
        const s = STYLES[id];
        return (
          <a key={id} href="/app/new" className="group w-36 shrink-0">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl ring-1 ring-black/5" style={{ background: s.art }}>
              <div className="absolute inset-x-0 bottom-[16%] mx-auto h-[38%] w-[24%] rounded-[40%_40%_14%_14%/30%_30%_10%_10%] bg-white/55 shadow-[0_18px_22px_-14px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div className="mt-1.5 text-sm font-semibold">{s.name}</div>
            <div className="truncate text-xs text-mute">{s.description}</div>
          </a>
        );
      })}
    </div>
  );
}
