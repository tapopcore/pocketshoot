"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Aperture, Box, Coins, Folder, Grid3x3, House as Home, LifeBuoy as HelpCircle, Layers, Palette, Plus, Settings, Shield, UserRound, Users } from "lucide-react";

const ICONS = { aperture: Aperture, home: Home, plus: Plus, box: Box, grid: Grid3x3, layers: Layers, folder: Folder, palette: Palette, coins: Coins, users: Users, settings: Settings, help: HelpCircle, shield: Shield, user: UserRound };

export function NavLinks({ items, compact }: { items: { href: string; label: string; icon: string }[]; compact?: boolean }) {
  const path = usePathname();
  return (
    <>
      {items.map((i) => {
        const active = i.href === "/app" ? path === "/app" || path.startsWith("/app/new") || path.startsWith("/app/jobs") : i.href === "/admin" ? path === i.href : path.startsWith(i.href);
        const Icon = ICONS[i.icon as keyof typeof ICONS] ?? Home;
        if (compact) {
          return (
            <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-ink" : "text-mute")}>
              <Icon size={20} strokeWidth={active ? 2.2 : 1.7} className={clsx(active && i.icon === "aperture" && "text-accent")} />
              <span className="truncate">{i.label}</span>
            </Link>
          );
        }
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
            className={clsx("group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors", active ? "bg-paper-2 text-ink" : "text-mute hover:text-ink")}>
            {active && <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
            <Icon size={17} strokeWidth={active ? 2.2 : 1.7} />
            {i.label}
          </Link>
        );
      })}
    </>
  );
}
