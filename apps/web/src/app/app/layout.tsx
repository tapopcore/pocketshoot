import { requireWeb } from "@/lib/auth";
import { getWallet } from "@/lib/credits";
import { admin } from "@/lib/supabase";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWeb();
  const [wallet, { data: orgs }] = await Promise.all([
    getWallet(ctx.orgId),
    admin().from("memberships").select("organizations(id, name)").eq("user_id", ctx.userId!),
  ]);
  return (
    <AppShell
      locale={ctx.locale}
      orgName={ctx.orgName}
      orgId={ctx.orgId}
      orgs={(orgs ?? []).map((m) => (m as unknown as { organizations: { id: string; name: string } }).organizations)}
      credits={wallet.available}
      email={ctx.email}
      isPlatform={!!ctx.platformRole}
    >
      {children}
    </AppShell>
  );
}
