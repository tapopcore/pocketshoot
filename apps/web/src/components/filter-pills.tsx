"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type FilterItem = { href: string; label: ReactNode; active: boolean };

/**
 * Filter chips that respond the moment they are tapped.
 * Each chip's page is fetched ahead of time, so switching is usually instant. If the page is
 * still on its way, the tapped chip lights up straight away and the list below dims until it lands.
 */
export function FilterPills({ items, className = "pills", base = "pill", on = "on", off = "", label = "Filter" }: {
  items: FilterItem[]; className?: string; base?: string; on?: string; off?: string; label?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const current = items.find((i) => i.active)?.href ?? "";
  useEffect(() => {
    setPicked(null);
    delete document.documentElement.dataset.filtering;
  }, [current]);
  useEffect(() => {
    if (!picked) return;
    const t = setTimeout(() => { delete document.documentElement.dataset.filtering; setPicked(null); }, 15000);
    return () => clearTimeout(t);
  }, [picked]);
  return <div className={className} role="group" aria-label={label}>
    {items.map((it) => {
      const isOn = picked ? it.href === picked : it.active;
      return <Link key={it.href} href={it.href} prefetch scroll={false} aria-current={isOn ? "page" : undefined}
        className={[base, isOn ? on : off].filter(Boolean).join(" ")}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          if (it.href === current) { e.preventDefault(); return; }
          setPicked(it.href);
          document.documentElement.dataset.filtering = "1";
        }}>{it.label}</Link>;
    })}
  </div>;
}
