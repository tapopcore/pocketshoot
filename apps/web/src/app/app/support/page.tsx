import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Badge, Card, Field, Input, PageHeader, Textarea, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createTicket } from "../actions";

export const metadata = { title: "Help" };

const FAQ = [
  ["Why did a credit come back?", "Credits are only used for images we deliver. If an image fails or doesn't pass our accuracy check, the credit is returned automatically."],
  ["The label on my product looks different", "Open the image and tap \"Report a problem\". If our checks confirm it, the credit comes back straight away. Otherwise a person reviews it within one working day."],
  ["I don't like the background", "Use the free remake on that image (one per image, within 7 days), or try a different style."],
  ["Can I use these images on Amazon or Flipkart?", "Many sellers do. Use the Marketplace white size, and always check each marketplace's current image rules before listing."],
];

export default async function Support({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const { data: tickets } = await admin().from("support_tickets").select("id, subject, status, updated_at").eq("organization_id", ctx.orgId).order("updated_at", { ascending: false });
  return (
    <div>
      <PageHeader title="Help">Quick answers, and a direct line to our team.</PageHeader>
      <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-8">
          <section>
            <h2 className="display mb-3 text-2xl">Quick answers</h2>
            <div className="divide-y divide-line rounded-xl border border-line bg-card">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group px-4 py-3">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">{q}<ChevronDown size={18} className="shrink-0 text-mute transition-transform group-open:rotate-180" aria-hidden /></summary>
                  <p className="mt-2 text-sm text-ink-2">{a}</p>
                </details>
              ))}
            </div>
          </section>
          <section>
            <h2 className="display mb-3 text-2xl">Your conversations</h2>
            <Card className="divide-y divide-line">
              {(tickets ?? []).length === 0 && <div className="p-4 text-sm text-mute">No messages yet. Ask us anything and the reply shows up here.</div>}
              {(tickets ?? []).map((t) => (
                <Link key={t.id} href={`/app/support/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-paper-2">
                  <div><div className="font-medium">{t.subject}</div><div className="frame-no">{formatDate(t.updated_at, true)}</div></div>
                  <Badge tone={t.status === "resolved" || t.status === "closed" ? "good" : t.status === "pending" ? "warn" : "busy"}>{t.status === "pending" ? "Waiting for you" : t.status === "resolved" || t.status === "closed" ? "Closed" : "Waiting for us"}</Badge>
                </Link>
              ))}
            </Card>
          </section>
        </div>
        <Card className="h-fit p-5">
          <h2 className="display text-2xl">Ask us anything</h2>
          <ActionForm action={createTicket} submit="Send message" className="mt-4 space-y-3">
            <input type="hidden" name="jobId" value={sp.job ?? ""} />
            <Field label="Subject"><Input name="subject" required maxLength={160} /></Field>
            <Field label="Message"><Textarea name="body" required maxLength={4000} className="min-h-36" /></Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
