import Link from "next/link";
import { t, type Locale, type MessageKey } from "@packshot/core";
import { Logo } from "./ui";
import { NavLinks } from "./nav-links";
import { Toaster } from "./toaster";
import { OrgSwitcher } from "./org-switcher";

export interface ShellProps {
  locale: Locale;
  orgName: string;
  orgs: { id: string; name: string }[];
  orgId: string;
  credits: number;
  email: string | null;
  isPlatform: boolean;
  children: React.ReactNode;
}

const NAV: { href: string; key: MessageKey; icon: string; mobile?: boolean }[] = [
  { href: "/app", key: "nav.dashboard", icon: "home", mobile: true },
  { href: "/app/new", key: "nav.new", icon: "plus", mobile: true },
  { href: "/app/products", key: "nav.products", icon: "box", mobile: true },
  { href: "/app/library", key: "nav.library", icon: "grid", mobile: true },
  { href: "/app/batch", key: "nav.batch", icon: "layers" },
  { href: "/app/projects", key: "nav.projects", icon: "folder" },
  { href: "/app/brand", key: "nav.brand", icon: "palette" },
  { href: "/app/wallet", key: "nav.wallet", icon: "coins", mobile: true },
  { href: "/app/team", key: "nav.team", icon: "users" },
  { href: "/app/settings", key: "nav.settings", icon: "settings" },
  { href: "/app/support", key: "nav.support", icon: "help" },
];

export function AppShell({ locale, orgName, orgs, orgId, credits, email, isPlatform, children }: ShellProps) {
  const items = NAV.map((n) => ({ ...n, label: t(locale, n.key) }));
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper/80 px-4 py-6 backdrop-blur lg:flex">
        <Link href="/app" className="px-2"><Logo /></Link>
        <OrgSwitcher orgs={orgs} current={orgId} name={orgName} />
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto">
          <NavLinks items={items} />
          {isPlatform && <NavLinks items={[{ href: "/admin", label: "Admin", icon: "shield" }]} />}
        </nav>
        <Link href="/app/wallet" className="mt-4 rounded-xl border border-line bg-card p-3 transition-colors hover:border-ink">
          <div className="eyebrow">{t(locale, "wallet.available")}</div>
          <div className="mt-1 flex items-baseline gap-1.5"><span className="display text-3xl tabular-nums">{credits}</span><span className="text-sm text-mute">{t(locale, "common.credits")}</span></div>
        </Link>
        <form action="/auth/sign-out" method="post" className="mt-3 flex items-center justify-between px-2 text-xs text-mute">
          <span className="truncate">{email}</span>
          <button className="underline hover:text-ink">Sign out</button>
        </form>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/app"><Logo /></Link>
        <Link href="/app/wallet" className="rounded-full border border-line bg-card px-3 py-1 text-sm"><b className="tabular-nums">{credits}</b> {t(locale, "common.credits")}</Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-8 lg:pb-16 lg:pt-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        <NavLinks items={items.filter((i) => i.mobile)} compact />
      </nav>
      <Toaster />
    </div>
  );
}
