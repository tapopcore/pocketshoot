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
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-1 py-2.5 text-[11px]", active ? "text-accent" : "text-ink-2")}>
              {i.icon === "plus" ? <span className="-mt-5 grid size-11 place-items-center rounded-full bg-accent text-white shadow-[var(--shadow-lift)]"><Icon size={22} /></span> : <Icon size={20} />}
              <span className="truncate">{i.label}</span>
            </Link>
          );
        }
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
            className={clsx("group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14.5px] transition-colors", active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2 hover:text-ink")}>
            <Icon size={17} strokeWidth={1.8} className={clsx(i.icon === "plus" && !active && "text-accent")} />
            {i.label}
          </Link>
        );
      })}
    </>
  );
}
