import Link from "next/link";
import { Building2, ChevronRight, CircleHelp, Images, Layers, LogOut, Palette, Receipt, Settings2, Users, FolderKanban } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { requireWeb } from "@/lib/auth";
import { getWallet } from "@/lib/credits";
import { OrgSwitcher } from "@/components/org-switcher";

export const metadata = { title: "Account" };

type Item = [href: string, label: string, hint: string, icon: typeof Images];

/** The "You" tab: who is signed in, credits, and every workspace page in one list. */
export default async function AccountPage() {
  const ctx = await requireWeb();
  const wallet = await getWallet(ctx.orgId);
  const email = ctx.email || "Email not available";
  const initial = ctx.email?.trim().charAt(0).toUpperCase() || "?";
  const admin = ["owner", "admin"].includes(ctx.role);
  const groups: [string, Item[]][] = [
    ["Your work", [
      ["/app/library", "All photos", "Every photo you have made", Images],
      ["/app/projects", "Projects", "Group shoots by launch or client", FolderKanban],
      ...(ctx.role !== "viewer" ? [["/app/batch", "Bulk shoots", "Shoot many products in one go", Layers] as Item] : []),
      ["/app/brand", "Brand kit", "Colours, mood and rules", Palette],
    ]],
    ["Workspace", [
      ["/app/wallet", "Credits and invoices", `${wallet.available} credit${wallet.available === 1 ? "" : "s"} left`, Receipt],
      ...(admin ? [["/app/team", "Team", "Invite people and set access", Users] as Item] : []),
      ["/app/settings", "Settings", "Workspace, billing and emails", Settings2],
    ]],
    ["Support", [["/app/support", "Help", "Quick answers and a direct line to us", CircleHelp]]],
  ];

  return (
    <div className="pg-you">
      <PageHeader title="You" />
      <section className="me card" aria-label="Signed-in account">
        <span className="av" aria-hidden>{initial}</span>
        <div className="who"><span className="xs muted">Signed in as</span><b title={email}>{email}</b></div>
      </section>
      <section className="org card" aria-label="Workspace">
        <span className="ic" aria-hidden><Building2 size={18} /></span>
        <div className="who">
          <span className="xs muted">Workspace</span>
          {ctx.orgs && ctx.orgs.length > 1
            ? <OrgSwitcher orgs={ctx.orgs} current={ctx.orgId} name={ctx.orgName} inputId="account-workspace" />
            : <b>{ctx.orgName}</b>}
        </div>
      </section>
      <Link href="/app/wallet" className="bal">
        <div><span className="sm">Credits left</span><b className="num">{wallet.available}</b><span className="xs">1 credit makes 1 photo</span></div>
        <span className="btn btn-lime">Buy credits</span>
      </Link>
      {groups.map(([title, items]) => (
        <section key={title} className="grp" aria-label={title}>
          <h2 className="sm muted">{title}</h2>
          <div className="card list">
            {items.map(([href, label, hint, Icon]) => (
              <Link key={href} href={href}><span className="ic" aria-hidden><Icon size={18} /></span><span className="t"><b>{label}</b><span className="xs muted">{hint}</span></span><ChevronRight size={18} className="chev" aria-hidden /></Link>
            ))}
          </div>
        </section>
      ))}
      <form action="/auth/sign-out" method="post" className="out">
        <button type="submit" className="btn btn-soft btn-block"><LogOut size={17} aria-hidden />Sign out</button>
        <p className="xs muted">Signing out does not delete your photos or credits.</p>
      </form>
    </div>
  );
}
