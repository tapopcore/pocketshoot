"use client";
/* eslint-disable @next/next/no-img-element -- private photos served by /media, already sized by the server */
import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * Shows the whole photo inside any box: fitted (never cropped) on a neutral surface, so products
 * and models are never cut off. If a photo can't load, a calm placeholder shows instead of the
 * browser's broken-image icon.
 */
export function FitImg({ src, alt = "", className, eager }: { src: string; alt?: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <span className="fit-miss" role="img" aria-label={alt || "Photo unavailable"}><ImageOff size={20} aria-hidden /></span>;
  return <img src={src} alt={alt} className={["fit-fg", className].filter(Boolean).join(" ")} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(src)} />;
}
