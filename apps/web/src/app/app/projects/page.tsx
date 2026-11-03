import Link from "next/link";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { Badge, Card, Empty, Field, Input, PageHeader, Select, formatDate } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { archiveProject, createProject } from "../actions";

export const metadata = { title: "Projects" };

export default async function Projects() {
  const ctx = await requireWeb();
  const [{ data: projects }, { data: kits }] = await Promise.all([
    admin().from("projects").select("id, name, status, created_at, brand_kits(name), generation_jobs(count)").eq("organization_id", ctx.orgId).order("created_at", { ascending: false }),
    admin().from("brand_kits").select("id, name").eq("organization_id", ctx.orgId),
  ]);
  return (
    <div>
      <PageHeader title="Projects">Group shoots by launch, season or client.</PageHeader>
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-3">
          {(projects ?? []).length === 0 && <Empty title="No projects yet">Create one for your next launch or a client.</Empty>}
          {(projects ?? []).map((p) => {
            const row = p as unknown as { id: string; name: string; status: string; created_at: string; brand_kits: { name: string } | null; generation_jobs: { count: number }[] };
            return (
              <Card key={row.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/app/library?project=${row.id}`} className="font-medium hover:underline">{row.name}</Link>
                  <div className="frame-no">{formatDate(row.created_at)} · {row.generation_jobs[0]?.count ?? 0} shoots{row.brand_kits ? ` · ${row.brand_kits.name}` : ""}</div>
                </div>
                <form action={archiveProject} className="flex items-center gap-2">
                  {row.status === "archived" && <Badge>Archived</Badge>}
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="status" value={row.status === "archived" ? "active" : "archived"} />
                  <button className="text-sm underline">{row.status === "archived" ? "Restore" : "Archive"}</button>
                </form>
              </Card>
            );
          })}
        </div>
        <Card className="h-fit p-5">
          <h2 className="display text-2xl">New project</h2>
          <ActionForm action={createProject} submit="Create project" resetOnSuccess className="mt-4 space-y-3">
            <Field label="Name"><Input name="name" required maxLength={120} placeholder="Diwali 2026 campaign" /></Field>
            <Field label="Brand kit (optional)">
              <Select name="brandKitId" defaultValue=""><option value="">None</option>{(kits ?? []).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</Select>
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
