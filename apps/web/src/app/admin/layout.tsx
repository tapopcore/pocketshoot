/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requirePlatform } from "@/lib/auth";
import { AdminNav } from "@/components/nav-links";
import { Toaster } from "@/components/toaster";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s | Admin" } };

const NAV: [string, string][] = [
  ["/admin", "Overview"], ["/admin/orgs", "Workspaces"], ["/admin/jobs", "Generation jobs"], ["/admin/costs", "Provider costs"],
  ["/admin/ledger", "Credit ledger"], ["/admin/refunds", "Refund requests"], ["/admin/pricing", "Pricing and coupons"], ["/admin/abuse", "Abuse signals"],
  ["/admin/support", "Support tickets"], ["/admin/quality", "Quality"], ["/admin/settings", "Settings and flags"], ["/admin/audit", "Audit log"], ["/admin/health", "System health"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePlatform();
  return (
    <div className="admin">
      <aside className="aside">
        <Link href="/admin" className="blogo"><img src="/brand/logo-dark.svg" alt="PocketShoot" style={{ height: 32 }} /></Link>
        <span className="pill sm" style={{ background: "var(--night-3)", color: "#fff", marginTop: 14 }}>Staff · {ctx.platformRole === "platform_admin" ? "admin" : "support"}</span>
        <AdminNav items={NAV} />
        <Link href="/app" className="btn btn-lime btn-sm btn-block" style={{ marginTop: "auto" }}>Back to app</Link>
      </aside>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">{children}</main>
      <Toaster />
    </div>
  );
}
