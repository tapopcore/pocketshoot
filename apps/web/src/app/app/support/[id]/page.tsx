import { notFound } from "next/navigation";
import clsx from "clsx";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Badge, PageHeader, Textarea, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { replyTicket } from "../../actions";

export default async function Ticket({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeb();
  const { id } = await params;
  const { data: t } = await admin().from("support_tickets").select("*").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!t) notFound();
  const { data: msgs } = await admin().from("support_messages").select("*").eq("ticket_id", id).order("created_at");
  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Help" title={t.subject}><Badge>{t.status}</Badge></PageHeader>
      <div className="space-y-3">
        {(msgs ?? []).map((m) => (
          <div key={m.id} className={clsx("max-w-[85%] rounded-2xl px-4 py-3", m.is_staff ? "bg-card border border-line" : "ml-auto bg-ink text-paper")}>
            <div className="whitespace-pre-wrap text-sm">{m.body}</div>
            <div className={clsx("frame-no mt-1", !m.is_staff && "!text-paper/50")}>{m.is_staff ? "Support" : "You"} · {formatDate(m.created_at, true)}</div>
          </div>
        ))}
      </div>
      {t.status !== "closed" && (
        <ActionForm action={replyTicket} submit="Reply" resetOnSuccess className="mt-6">
          <input type="hidden" name="ticketId" value={id} />
          <Textarea name="body" required placeholder="Write a reply" />
        </ActionForm>
      )}
    </div>
  );
}
