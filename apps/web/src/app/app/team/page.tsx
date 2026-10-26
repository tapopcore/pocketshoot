import { hasRole, requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Badge, Card, Field, Input, PageHeader, Select, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { changeRole, inviteMember, removeMember, revokeInvite } from "../actions";

export const metadata = { title: "Team" };

const ROLE_HELP: Record<string, string> = {
  owner: "Everything, including billing and deleting the workspace",
  admin: "Buy credits, manage the team and settings",
  editor: "Upload products and create shoots",
  viewer: "See and download images",
};

export default async function Team() {
  const ctx = await requireWeb();
  const db = admin();
  const [{ data: members }, { data: invites }] = await Promise.all([
    db.from("memberships").select("id, role, created_at, user_id, profiles(email, name)").eq("organization_id", ctx.orgId).order("created_at"),
    db.from("invitations").select("id, email, role, expires_at").eq("organization_id", ctx.orgId).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);
  const canManage = hasRole(ctx, "admin");
  return (
    <div>
      <PageHeader eyebrow={ctx.orgName} title="Team">Everyone shares the same credits and image library.</PageHeader>
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <Card className="divide-y divide-line">
          {(members ?? []).map((m) => {
            const p = (m as unknown as { profiles: { email: string; name: string | null } }).profiles;
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="font-medium">{p.name || p.email}</div>
                  <div className="frame-no">{p.email} · joined {formatDate(m.created_at)}</div>
                </div>
                {canManage && m.role !== "owner" && m.user_id !== ctx.userId ? (
                  <div className="flex items-center gap-2">
                    <form action={changeRole} className="flex items-center gap-1">
                      <input type="hidden" name="memberId" value={m.id} />
                      <Select name="role" defaultValue={m.role} className="!h-9 !w-28 text-sm">{["admin", "editor", "viewer"].map((r) => <option key={r} value={r}>{r}</option>)}</Select>
                      <button className="text-sm underline">Save</button>
                    </form>
                    <form action={removeMember}><input type="hidden" name="memberId" value={m.id} /><button className="text-sm text-bad underline">Remove</button></form>
                  </div>
                ) : <Badge tone={m.role === "owner" ? "accent" : "neutral"}>{m.role}</Badge>}
              </div>
            );
          })}
          {(invites ?? []).map((i) => (
            <div key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div><div>{i.email}</div><div className="frame-no">Invited as {i.role} · expires {formatDate(i.expires_at)}</div></div>
              {canManage && <form action={revokeInvite}><input type="hidden" name="id" value={i.id} /><button className="text-sm underline">Revoke</button></form>}
            </div>
          ))}
        </Card>
        <div className="space-y-6">
          {canManage && (
            <Card className="p-5">
              <h2 className="display text-2xl">Invite someone</h2>
              <ActionForm action={inviteMember} submit="Send invitation" resetOnSuccess className="mt-4 space-y-3">
                <Field label="Email"><Input type="email" name="email" required /></Field>
                <Field label="Role"><Select name="role" defaultValue="editor">{["admin", "editor", "viewer"].map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
              </ActionForm>
            </Card>
          )}
          <Card className="p-5 text-sm">
            <div className="eyebrow mb-3">Roles</div>
            <dl className="space-y-2">{Object.entries(ROLE_HELP).map(([r, h]) => <div key={r}><dt className="font-medium capitalize">{r}</dt><dd className="text-mute">{h}</dd></div>)}</dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
