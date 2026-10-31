"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, type LucideIcon, Box, Coins, Folder, Grid2x2, House, Layers, LifeBuoy, Palette, Plus, Settings, Shield, UserRound, Users } from "lucide-react";

function NavMark({ Icon }: { Icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="animate-spin" aria-label="Opening page" /> : <Icon />;
}

const GROUPS: [string, [string, typeof House, string][]][] = [
  ["Create", [["/app", House, "Home"], ["/app/shoots", Grid2x2, "My shoots"], ["/app/products", Box, "Products"]]],
  ["Workspace", [["/app/brand", Palette, "Brand kit"], ["/app/batch", Layers, "Bulk shoots"], ["/app/projects", Folder, "Projects"], ["/app/team", Users, "Team"]]],
  ["Account", [["/app/wallet", Coins, "Credits"], ["/app/settings", Settings, "Settings"], ["/app/support", LifeBuoy, "Help"]]],
];
const LABELS: Record<string, string> = { "": "Home", new: "New shoot", shoots: "My shoots", jobs: "My shoots", library: "All photos", products: "Products", brand: "Brand kit", batch: "Bulk shoots", projects: "Projects", team: "Team", wallet: "Credits", invoices: "Credits", settings: "Settings", support: "Help", account: "Account" };
const GROUP_OF: Record<string, string> = { brand: "Workspace", batch: "Workspace", projects: "Workspace", team: "Workspace", wallet: "Account", invoices: "Account", settings: "Account", support: "Account", account: "Account" };

function isActive(path: string, href: string) {
  if (href === "/app") return path === "/app";
  if (href === "/app/shoots") return path.startsWith("/app/shoots") || path.startsWith("/app/jobs") || path.startsWith("/app/library");
  if (href === "/app/wallet") return path.startsWith("/app/wallet") || path.startsWith("/app/invoices");
  return path.startsWith(href);
}

export function SideNav({ isPlatform }: { isPlatform: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="App">
      {GROUPS.map(([g, items]) => (
        <div className="grp" key={g}><h6>{g}</h6>{items.map(([href, Icon, label]) => (
          <Link key={href} href={href} className={`nv${isActive(path, href) ? " on" : ""}`} aria-current={isActive(path, href) ? "page" : undefined}><NavMark Icon={Icon} />{label}</Link>
        ))}</div>
      ))}
      {isPlatform && <div className="grp"><h6>Platform</h6><Link href="/admin" className="nv"><Shield />Admin</Link></div>}
    </nav>
  );
}

export function Crumbs() {
  const path = usePathname();
  const seg = path.split("/")[2] ?? "";
  const label = LABELS[seg] ?? "PocketShoot";
  const group = GROUP_OF[seg];
  const deep = path.split("/").length > 3 && seg !== "new";
  return <div className="crumbs">{group && <>{group} / </>}{deep ? <><Link href={`/app/${seg === "jobs" || seg === "library" ? "shoots" : seg === "invoices" ? "wallet" : seg}`}>{label}</Link> / <b>Details</b></> : <b>{label}</b>}</div>;
}

export function TabBar() {
  const path = usePathname();
  if (path.startsWith("/app/new") || path.startsWith("/dev/studio")) return null;
  const you = ["/app/account", "/app/wallet", "/app/settings", "/app/support", "/app/team", "/app/brand", "/app/batch", "/app/projects", "/app/invoices"].some((p) => path.startsWith(p));
  const T: [string, typeof House, string, boolean][] = [["/app", House, "Home", path === "/app"], ["/app/shoots", Grid2x2, "Shoots", isActive(path, "/app/shoots")], ["/app/new", Plus, "", false], ["/app/products", Box, "Products", path.startsWith("/app/products")], ["/app/account", UserRound, "You", you]];
  return (
    <nav className="tabs" aria-label="Main">
      {T.map(([href, Icon, label, on]) => href === "/app/new"
        ? <Link key={href} href={href} className="plus" aria-label="New shoot"><span><NavMark Icon={Icon} /></span></Link>
        : <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}><NavMark Icon={Icon} />{label}</Link>)}
    </nav>
  );
}

export function AdminNav({ items }: { items: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="anav" aria-label="Admin">
      {items.map(([href, label]) => { const on = href === "/admin" ? path === href : path.startsWith(href); return <Link key={href} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>{label}</Link>; })}
    </nav>
  );
}
