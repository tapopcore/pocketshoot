"use client";
import { switchOrg } from "@/app/app/actions";

export function OrgSwitcher({ orgs, current, name, inputId = "org" }: { orgs: { id: string; name: string }[]; current: string; name: string; inputId?: string }) {
  if (orgs.length <= 1) return <div className="mt-6 truncate px-2 text-sm text-mute">{name}</div>;
  return (
    <form action={switchOrg} className="mt-6 px-1">
      <label className="sr-only" htmlFor={inputId}>Workspace</label>
      <select id={inputId} name="orgId" defaultValue={current} onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full truncate rounded-lg border border-line bg-transparent px-2 py-1.5 text-sm">
        {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </form>
  );
}
