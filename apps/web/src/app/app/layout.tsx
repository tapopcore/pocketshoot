import { requireWeb } from "@/lib/auth";
import { getWallet } from "@/lib/credits";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWeb();
  const wallet = await getWallet(ctx.orgId);
  return (
    <AppShell
      locale={ctx.locale}
      orgName={ctx.orgName}
      orgId={ctx.orgId}
      orgs={ctx.orgs ?? []}
      credits={wallet.available}
      email={ctx.email}
      isPlatform={!!ctx.platformRole}
    >
      {children}
    </AppShell>
  );
}
