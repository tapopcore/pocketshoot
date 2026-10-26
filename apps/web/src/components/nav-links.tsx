"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Box, Coins, Folder, Grid3x3, House as Home, LifeBuoy as HelpCircle, Layers, Palette, Plus, Settings, Shield, Users } from "lucide-react";

const ICONS = { home: Home, plus: Plus, box: Box, grid: Grid3x3, layers: Layers, folder: Folder, palette: Palette, coins: Coins, users: Users, settings: Settings, help: HelpCircle, shield: Shield };

export function NavLinks({ items, compact }: { items: { href: string; label: string; icon: string }[]; compact?: boolean }) {
  const path = usePathname();
  return (
    <>
      {items.map((i) => {
        const active = i.href === "/app" || i.href === "/admin" ? path === i.href : path.startsWith(i.href);
        const Icon = ICONS[i.icon as keyof typeof ICONS] ?? Home;
        if (compact) {
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-ink" : "text-mute")}>
              {i.icon === "plus" ? <span className="-mt-5 grid size-12 place-items-center rounded-2xl bg-ink text-white shadow-[var(--shadow-pop)]"><Icon size={22} /></span> : <Icon size={20} />}
              <span className="truncate">{i.label}</span>
            </Link>
          );
        }
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
            className={clsx("group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors", active ? "bg-paper-2 text-ink" : "text-ink-2 hover:bg-paper-2/70 hover:text-ink")}>
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            {i.label}
          </Link>
        );
      })}
    </>
  );
}
