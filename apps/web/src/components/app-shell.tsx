import Link from "next/link";
import { t, type Locale, type MessageKey } from "@packshot/core";
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
  { href: "/app", key: "nav.dashboard", icon: "aperture", mobile: true },
  { href: "/app/library", key: "nav.library", icon: "grid", mobile: true },
  { href: "/app/products", key: "nav.products", icon: "box", mobile: true },
  { href: "/app/batch", key: "nav.batch", icon: "layers" },
  { href: "/app/projects", key: "nav.projects", icon: "folder" },
  { href: "/app/brand", key: "nav.brand", icon: "palette" },
  { href: "/app/wallet", key: "nav.wallet", icon: "coins", mobile: true },
  { href: "/app/team", key: "nav.team", icon: "users" },
  { href: "/app/settings", key: "nav.settings", icon: "settings" },
  { href: "/app/support", key: "nav.support", icon: "help" },
];

function Mark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect x="0.5" y="0.5" width="25" height="25" rx="8" fill="#f3eee6" />
        <circle cx="13" cy="13" r="6" fill="#0d0c0b" />
        <circle cx="13" cy="13" r="3.2" fill="#ff6a2b" />
        <circle cx="19.5" cy="6.5" r="1.4" fill="#0d0c0b" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Pocket<span className="serif-i text-[19px] font-normal">Shoot</span></span>
    </span>
  );
}

export function AppShell({ locale, orgName, orgs, orgId, credits, email, isPlatform, children }: ShellProps) {
  const items = NAV.map((n) => ({ ...n, label: n.href === "/app" ? "Studio" : t(locale, n.key) }));
  return (
    <div className="darkroom min-h-dvh lg:grid lg:grid-cols-[236px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line px-3 py-5 lg:flex">
        <Link href="/app" className="px-3"><Mark /></Link>
        <OrgSwitcher orgs={orgs} current={orgId} name={orgName} />
        <nav className="mt-5 flex-1 space-y-0.5 overflow-y-auto">
          <NavLinks items={items.filter((i) => ["/app", "/app/library", "/app/products", "/app/wallet"].includes(i.href))} />
          <details className="group mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer list-none rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-widest text-mute transition-colors hover:text-ink">More tools <span className="float-right group-open:rotate-180">⌄</span></summary>
            <div className="mt-1"><NavLinks items={items.filter((i) => !["/app", "/app/library", "/app/products", "/app/wallet"].includes(i.href))} /></div>
          </details>
          {isPlatform && <NavLinks items={[{ href: "/admin", label: "Admin", icon: "shield" }]} />}
        </nav>
        <Link href="/app/wallet" className="group mx-1 mt-4 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-ink/25">
          <div className="tracked text-mute">{t(locale, "wallet.available")}</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="serif-i text-4xl leading-none tabular-nums">{credits}</span>
            <span className="text-xs font-medium text-accent opacity-80 group-hover:opacity-100">Top up →</span>
          </div>
        </Link>
        <form action="/auth/sign-out" method="post" className="mt-3 flex items-center justify-between gap-2 px-2 text-xs text-mute">
          <span className="truncate">{email}</span>
          <button className="shrink-0 hover:text-ink">Sign out</button>
        </form>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/app"><Mark /></Link>
        <Link href="/app/wallet" className="rounded-full border border-line bg-card px-3 py-1.5 text-sm"><b className="tabular-nums">{credits}</b> <span className="text-mute">{t(locale, "common.credits")}</span></Link>
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-8 lg:pb-12 lg:pt-7">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Main">
        <NavLinks items={items.filter((i) => i.mobile)} compact />
      </nav>
      <Toaster />
    </div>
  );
}
