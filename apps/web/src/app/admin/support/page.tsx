import Link from "next/link";
import clsx from "clsx";
import { admin } from "@/lib/supabase";
import { Badge, Card, PageHeader, Select, Textarea, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { staffReplyAction } from "../actions";

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ t?: string; status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status ?? "open";
  const db = admin();
  const { data: tickets } = await db.from("support_tickets").select("id, subject, status, priority, updated_at, organization_id, related_job_id, organizations(name)").eq("status", status).order("updated_at", { ascending: false }).limit(50);
  const current = sp.t ? (await db.from("support_tickets").select("*, organizations(name)").eq("id", sp.t).maybeSingle()).data : null;
  const { data: msgs } = current ? await db.from("support_messages").select("*").eq("ticket_id", current.id).order("created_at") : { data: [] };
  return (
    <div>
      <PageHeader title="Support tickets" />
      <div className="mb-4 flex gap-2">{["open", "pending", "resolved", "closed"].map((s) => <Link key={s} href={`/admin/support?status=${s}`} className={`rounded-full px-3 py-1 text-sm ${s === status ? "bg-ink text-paper" : "border border-line"}`}>{s}</Link>)}</div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="divide-y divide-line">
          {(tickets ?? []).map((t) => (
            <Link key={t.id} href={`/admin/support?status=${status}&t=${t.id}`} className={clsx("block px-4 py-3 hover:bg-paper-2", sp.t === t.id && "bg-paper-2")}>
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{t.subject}</span>{t.priority === "high" && <Badge tone="bad">high</Badge>}</div>
              <div className="frame-no">{(t as unknown as { organizations: { name: string } }).organizations?.name} · {formatDate(t.updated_at, true)}</div>
            </Link>
          ))}
          {(tickets ?? []).length === 0 && <div className="p-4 text-sm text-mute">No tickets.</div>}
        </Card>
        {current && (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="display text-2xl">{current.subject}</h2>
              <Link className="text-sm underline" href={`/admin/orgs/${current.organization_id}`}>{(current as unknown as { organizations: { name: string } }).organizations?.name}</Link>
              {current.related_job_id && <Link className="text-sm underline" href={`/admin/jobs/${current.related_job_id}`}>Related job</Link>}
            </div>
            <div className="space-y-2">
              {(msgs ?? []).map((m) => (
                <div key={m.id} className={clsx("rounded-xl px-4 py-2.5 text-sm", m.is_staff ? "ml-8 bg-ink text-paper" : "mr-8 border border-line")}>
                  <div className="whitespace-pre-wrap">{m.body}</div><div className={clsx("frame-no mt-1", m.is_staff && "!text-paper/50")}>{m.is_staff ? "Staff" : "Customer"} · {formatDate(m.created_at, true)}</div>
                </div>
              ))}
            </div>
            <ActionForm action={staffReplyAction} submit="Send reply" resetOnSuccess className="mt-4 space-y-2">
              <input type="hidden" name="ticketId" value={current.id} />
              <Textarea name="body" placeholder="Reply to the customer" />
              <Select name="status" defaultValue="pending" className="max-w-xs"><option value="pending">Waiting for customer</option><option value="open">Keep open</option><option value="resolved">Resolved</option><option value="closed">Closed</option></Select>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
