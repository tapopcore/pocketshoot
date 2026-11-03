/* eslint-disable @next/next/no-img-element -- showcase images are pre-sized webp files */
import { ArrowRight } from "lucide-react";
import clsx from "clsx";

export const shot = (k: string) => `/showcase/${k}.webp`;

/** Arrow chip used inside primary buttons. */
export function Go() {
  return <span className="go"><ArrowRight /></span>;
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return <span className="kicker"><i />{children}</span>;
}

/** Photo tile. */
export function Ph({ k, ratio = "r11", alt = "", className, children, style }: { k: string; ratio?: string; alt?: string; className?: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return <div className={clsx("ph", ratio, className)} style={style}><img src={shot(k)} alt={alt} loading="lazy" />{children}</div>;
}

/** Viewfinder corners from the logo, drawn over a photo. */
export function Corners({ tone }: { tone?: "ink" | "or" }) {
  return <span className={clsx("vfc", tone)} aria-hidden><i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" /></span>;
}
