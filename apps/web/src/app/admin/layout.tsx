import Link from "next/link";
import { requirePlatform } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { NavLinks } from "@/components/nav-links";
import { Toaster } from "@/components/toaster";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s | Admin" } };

const NAV = [
  ["/admin", "Overview"], ["/admin/orgs", "Workspaces"], ["/admin/jobs", "Generation jobs"], ["/admin/costs", "Provider costs"],
  ["/admin/ledger", "Credit ledger"], ["/admin/refunds", "Refund requests"], ["/admin/pricing", "Pricing & coupons"], ["/admin/abuse", "Abuse signals"],
  ["/admin/support", "Support tickets"], ["/admin/quality", "Quality"], ["/admin/settings", "Settings & flags"], ["/admin/audit", "Audit log"], ["/admin/health", "System health"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePlatform();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[230px_1fr]">
      <aside className="border-b border-line bg-ink px-4 py-5 text-paper lg:sticky lg:top-0 lg:h-dvh lg:border-0">
        <div className="flex items-center justify-between lg:block">
          <Link href="/admin"><Logo className="text-paper" /></Link>
          <div className="eyebrow mt-1 !text-paper/50">Staff · {ctx.platformRole === "platform_admin" ? "admin" : "support"}</div>
        </div>
        <nav className="mt-6 flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-0.5 [&_a]:!text-paper/75 [&_a:hover]:!bg-paper/10 [&_a[aria-current=page]]:!bg-paper [&_a[aria-current=page]]:!text-ink [&_a]:whitespace-nowrap">
          <NavLinks items={NAV.map(([href, label]) => ({ href, label, icon: "shield" }))} />
          <NavLinks items={[{ href: "/app", label: "Back to app", icon: "home" }]} />
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">{children}</main>
      <Toaster />
    </div>
  );
}
