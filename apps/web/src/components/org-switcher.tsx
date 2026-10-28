"use client";
import { ChevronsUpDown } from "lucide-react";
import { switchOrg } from "@/app/app/actions";

const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Can edit", viewer: "Can view" };

export function OrgSwitcher({ orgs, current, name, role, initials, inputId = "org" }: { orgs: { id: string; name: string }[]; current: string; name: string; role?: string; initials?: string; inputId?: string }) {
  const card = (
    <><span className="av">{initials ?? name.slice(0, 2).toUpperCase()}</span><div className="t"><b>{name}</b><span>{role ? ROLE[role] ?? role : "Workspace"}{orgs.length > 1 ? ` · ${orgs.length} workspaces` : ""}</span></div></>
  );
  if (orgs.length <= 1) return <div className="ws">{card}</div>;
  return (
    <form action={switchOrg} className="ws" style={{ position: "relative" }}>
      {card}<ChevronsUpDown />
      <label className="sr-only" htmlFor={inputId}>Workspace</label>
      <select id={inputId} name="orgId" defaultValue={current} onChange={(e) => e.currentTarget.form?.requestSubmit()} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}>
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}
