import { hasRole, requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Field, Input, PageHeader, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { changeRole, inviteMember, removeMember, revokeInvite } from "../actions";

export const metadata = { title: "Team" };

const ROLES: [string, string, string][] = [
  ["owner", "Owner", "Everything, including billing and deleting the workspace"],
  ["admin", "Admin", "Buys credits and manages the team and settings"],
  ["editor", "Can edit", "Adds products and creates shoots with the shared credits"],
  ["viewer", "Can view", "Sees and downloads photos"],
];
const roleName = (r: string) => ROLES.find((x) => x[0] === r)?.[1] ?? r;
const initials = (s: string) => s.replace(/@.*/, "").split(/[\s._+-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export default async function Team() {
  const ctx = await requireWeb();
  const db = admin();
  const [{ data: members }, { data: invites }] = await Promise.all([
    db.from("memberships").select("id, role, created_at, user_id, profiles(email, name)").eq("organization_id", ctx.orgId).order("created_at"),
    db.from("invitations").select("id, email, role, expires_at").eq("organization_id", ctx.orgId).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  const canManage = hasRole(ctx, "admin");
  return (
    <div className="pg-team">
      <PageHeader title="Team">Everyone shares the same credits, products and photos.</PageHeader>
      {canManage && <section className="card pl">
        <h2 className="h4">Invite someone</h2>
        <ActionForm action={inviteMember} submit="Send invite" resetOnSuccess className="inv">
          <Field label="Email"><Input type="email" name="email" required placeholder="colleague@yourbrand.com" /></Field>
          <fieldset className="rolepick"><legend className="label">Access</legend>
            {ROLES.slice(1).map(([id, name, help]) => <label key={id}><input type="radio" name="role" value={id} defaultChecked={id === "editor"} /><span><b>{name}</b><small>{help}</small></span></label>)}
          </fieldset>
        </ActionForm>
      </section>}
      <section className="card" style={{ marginTop: "var(--s4)", overflowX: "auto" }}>
        <table className="tbl">
          <thead><tr><th>Person</th><th>Access</th><th>Joined</th>{canManage && <th style={{ textAlign: "right" }}>Manage</th>}</tr></thead>
          <tbody>
            {(members ?? []).map((m, i) => {
              const p = (m as unknown as { profiles: { email: string; name: string | null } | null }).profiles;
              const email = p?.email ?? "";
              const editable = canManage && m.role !== "owner" && m.user_id !== ctx.userId;
              return <tr key={m.id ?? i}>
                <td><div className="row" style={{ gap: 12 }}><span className="av">{initials(p?.name || email)}</span><div style={{ minWidth: 0 }}><b>{p?.name || email}</b>{p?.name && <div className="xs muted">{email}</div>}{m.user_id === ctx.userId && <div className="xs muted">You</div>}</div></div></td>
                <td>{editable ? <form action={changeRole} className="row" style={{ gap: 8 }}><input type="hidden" name="memberId" value={m.id} /><select name="role" defaultValue={m.role} className="input sel" aria-label={`Access for ${email}`}>{ROLES.slice(1).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><button className="link sm">Save</button></form> : <span className={"pill sm" + (m.role === "owner" ? " brand" : "")}>{roleName(m.role)}</span>}</td>
                <td className="muted">{formatDate(m.created_at)}</td>
                {canManage && <td style={{ textAlign: "right" }}>{editable && <form action={removeMember}><input type="hidden" name="memberId" value={m.id} /><button className="link sm" style={{ color: "var(--bad)" }}>Remove</button></form>}</td>}
              </tr>;
            })}
            {(invites ?? []).map((iv) => <tr key={iv.id}>
              <td><div className="row" style={{ gap: 12 }}><span className="av muted-av">{initials(iv.email)}</span><b>{iv.email}</b></div></td>
              <td><span className="pill sm warn">Invite sent · {roleName(iv.role)}</span></td>
              <td className="muted">Expires {formatDate(iv.expires_at)}</td>
              {canManage && <td style={{ textAlign: "right" }}><form action={revokeInvite}><input type="hidden" name="id" value={iv.id} /><button className="link sm" style={{ color: "var(--muted)" }}>Cancel invite</button></form></td>}
            </tr>)}
          </tbody>
        </table>
      </section>
    </div>
  );
}
