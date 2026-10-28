/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Locale } from "@packshot/core";
import { Plus } from "lucide-react";
import { SideNav, TabBar, Crumbs } from "./nav-links";
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
  role?: string;
  children: React.ReactNode;
}

const initials = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "P";

export function AppShell({ orgName, orgs, orgId, credits, email, isPlatform, role, children }: ShellProps) {
  const me = initials((email ?? "").split("@")[0].replace(/[._-]+/g, " "));
  return (
    <div className="app">
      <aside className="side">
        <Link href="/app" className="blogo" style={{ padding: "6px 8px" }}><img src="/brand/logo-light.svg" alt="PocketShoot" /></Link>
        <OrgSwitcher orgs={orgs} current={orgId} name={orgName} role={role} initials={initials(orgName)} />
        <Link href="/app/new" className="btn btn-lime btn-block new"><Plus />New shoot</Link>
        <SideNav isPlatform={isPlatform} />
        <Link href="/app/wallet" className="wallet">
          <div className="between"><span className="xs" style={{ color: "var(--on-night-2)" }}>Credits left</span><span className="xs" style={{ color: "var(--on-night-2)" }}>1 credit = 1 photo</span></div>
          <div className="v num" style={{ marginTop: 8 }}>{credits}</div>
          <div className="meter"><i style={{ width: `${Math.min(100, (credits / 40) * 100)}%` }} /></div>
          <span className="sm" style={{ fontWeight: 600 }}>Buy more credits</span>
        </Link>
        <form action="/auth/sign-out" method="post" className="between xs" style={{ marginTop: 12, padding: "0 8px", color: "var(--muted)" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
          <button style={{ flex: "none", fontWeight: 600 }}>Log out</button>
        </form>
      </aside>
      <div className="main">
        <div className="top"><Crumbs /><div className="r">
          <Link href="/app/support" className="ib" aria-label="Help"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 4M12 17.2v.1" /></svg></Link>
          <Link href="/app/account" className="ib dark" aria-label="Account">{me}</Link>
        </div></div>
        <div className="mtop">
          <Link href="/app" className="blogo"><img src="/brand/logo-light.svg" alt="PocketShoot" /></Link>
          <div className="r"><Link href="/app/wallet" className="pill line"><span className="live" style={{ animation: "none", background: "var(--brand)", boxShadow: "none" }} />{credits} credits</Link><Link href="/app/account" className="ib dark" aria-label="Account">{me}</Link></div>
        </div>
        <main className="content">{children}</main>
      </div>
      <TabBar />
      <Toaster />
    </div>
  );
}
