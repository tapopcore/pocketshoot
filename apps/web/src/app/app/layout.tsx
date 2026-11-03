import { requireWeb } from "@/lib/auth";
import { walletSummary } from "@/lib/credits";
import { AppShell } from "@/components/app-shell";
import { timed } from "@/lib/timing";

export const dynamic = "force-dynamic";
// App pages run in their own server function, separate from photo generation (300 s routes),
// so a busy generation worker can never slow down taps in the app.
export const maxDuration = 60;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await timed("layout.auth", () => requireWeb());
  const wallet = await timed("layout.wallet", () => walletSummary(ctx.orgId));
  return (
    <AppShell
      locale={ctx.locale}
      orgName={ctx.orgName}
      orgId={ctx.orgId}
      orgs={ctx.orgs ?? []}
      credits={wallet.available}
      email={ctx.email}
      isPlatform={!!ctx.platformRole}
      role={ctx.role}
    >
      {children}
    </AppShell>
  );
}
