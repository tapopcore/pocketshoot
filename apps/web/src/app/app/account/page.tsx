import Link from "next/link";
import { ArrowRight, LogOut, Settings2, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { requireWeb } from "@/lib/auth";
import { getWallet } from "@/lib/credits";
import { OrgSwitcher } from "@/components/org-switcher";

export const metadata = { title: "Account | Pocket Shoot" };

export default async function AccountPage() {
  const ctx = await requireWeb();
  const wallet = await getWallet(ctx.orgId);
  const email = ctx.email || "Email not available";
  const initial = ctx.email?.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <div className="mb-7">
        <p className="tracked text-accent">Pocket Shoot / Account</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">Your account</h1>
        <p className="mt-2 text-sm text-mute">Check which account is signed in, manage your workspace, or sign out.</p>
      </div>

      <section aria-label="Signed-in account" className="rounded-3xl border border-line bg-card p-5 shadow-sm sm:p-7">
        <div className="flex min-w-0 items-center gap-4">
          <div aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-2xl bg-paper-2 text-2xl font-semibold text-ink">{initial}</div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-mute">Signed in as</p>
            <p className="mt-1 break-all text-[15px] font-semibold leading-snug text-ink sm:text-lg">{email}</p>
          </div>
          <ShieldCheck size={20} aria-label="Signed-in session" className="shrink-0 text-good" />
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-xs font-medium uppercase tracking-widest text-mute">Active workspace</p>
          {ctx.orgs && ctx.orgs.length > 1 ? (
            <div className="-mt-2"><OrgSwitcher orgs={ctx.orgs} current={ctx.orgId} name={ctx.orgName} inputId="account-workspace" /></div>
          ) : (
            <p className="mt-2 break-words text-sm font-medium text-ink">{ctx.orgName}</p>
          )}
          <p className="mt-1 text-xs text-mute">Your photos and credits belong to this workspace.</p>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/app/wallet" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-5 transition-colors hover:border-accent">
          <span className="flex items-center gap-3"><Wallet size={20} aria-hidden="true" /><span><strong className="block text-sm">Credits</strong><span className="mt-1 block text-xs text-mute">{wallet.available} available</span></span></span>
          <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-mute" />
        </Link>
        <Link href="/app/settings" className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-5 transition-colors hover:border-accent">
          <span className="flex items-center gap-3"><Settings2 size={20} aria-hidden="true" /><span><strong className="block text-sm">Workspace settings</strong><span className="mt-1 block text-xs text-mute">Details and preferences</span></span></span>
          <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-mute" />
        </Link>
      </div>

      <section className="mt-7 rounded-2xl border border-line bg-card p-5" aria-label="Workspace tools">
        <h2 className="text-lg font-semibold">Workspace tools</h2>
        <div className="mt-3 divide-y divide-line">{[
          ["/app/library", "Image library"], ["/app/brand", "Brand preferences"], ["/app/projects", "Projects"],
          ...(ctx.role !== "viewer" ? [["/app/batch", "Batch shoots"]] : []),
          ...(["owner","admin"].includes(ctx.role) ? [["/app/team", "Workspace & team"]] : []),
          ["/app/support", "Help & support"],
        ].map(([href,label]) => <Link key={href} href={href} className="flex min-h-12 items-center justify-between gap-3 py-3 text-sm"><span>{label}</span><ArrowRight size={16}/></Link>)}</div>
      </section>

      <div className="mt-7 rounded-3xl border border-line bg-card p-5 sm:p-7">
        <div className="flex items-center gap-2"><UserRound size={18} aria-hidden="true" /><h2 className="text-lg font-semibold">Not the right account?</h2></div>
        <p className="mt-2 text-sm leading-relaxed text-mute">Sign out and use the email address that owns your Pocket Shoot workspace. This will not delete your photos or credits.</p>
        <form action="/auth/sign-out" method="post" className="mt-5">
          <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-paper px-5 text-sm font-semibold transition-colors hover:border-accent sm:w-auto">
            <LogOut size={17} aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-xs text-mute">Need help? <Link href="/app/support" className="font-medium text-ink underline underline-offset-4">Contact support</Link></p>
    </div>
  );
}
