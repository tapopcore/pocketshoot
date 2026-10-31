import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Plus, Search } from "lucide-react";
import { requireWeb } from "@/lib/auth";
import { recentJobs } from "@/lib/views";
import { JobCard, type JobSummary } from "@/components/job-card";
import { Empty, PageHeader } from "@/components/ui";
import { BulkCta } from "@/components/bulk-cta";
import { getFlag } from "@/lib/settings";

export const metadata = { title: "My shoots" };
const PER = 24;
const FILTERS = [["", "All"], ["ready", "Ready"], ["creating", "Creating"], ["failed", "Failed"]] as const;

/** Groups shoots into "This week", "Earlier in October" and so on. */
function groups(jobs: JobSummary[]) {
  const out: { label: string; jobs: JobSummary[] }[] = [];
  const week = Date.now() - 7 * 86400000;
  for (const j of jobs) {
    const d = new Date(j.createdAt);
    const label = d.getTime() > week ? "This week" : (d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear() ? "Earlier in " : "") + new Intl.DateTimeFormat("en-IN", { month: "long", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) }).format(d);
    const g = out.at(-1);
    if (g?.label === label) g.jobs.push(j); else out.push({ label, jobs: [j] });
  }
  return out;
}

export default async function Shoots({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; s?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const bulkOn = await getFlag("batch_jobs", ctx.orgId);
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (["ready", "creating", "failed"] as const).find((x) => x === sp.s) ?? null;
  const jobs = await recentJobs(ctx.orgId, PER, (page - 1) * PER, { q: sp.q, status });
  const qs = (o: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); const m = { q: sp.q, s: status ?? undefined, ...o }; for (const [k, v] of Object.entries(m)) if (v) p.set(k, String(v)); const t = p.toString(); return "/app/shoots" + (t ? "?" + t : ""); };
  const filtered = !!(sp.q || status);
  return <div className="pg-shoots">
    <PageHeader title="My shoots" actions={ctx.role !== "viewer" && <Link href="/app/new" className="btn btn-lime"><Plus />New shoot</Link>}>All your photos in one place, newest first.</PageHeader>
    {bulkOn && ctx.role !== "viewer" && <BulkCta />}
    {(jobs.length > 0 || filtered) && <div className="tb">
      <form className="srch" action="/app/shoots"><Search /><input name="q" defaultValue={sp.q} placeholder="Search by product name" aria-label="Search shoots" />{status && <input type="hidden" name="s" value={status} />}</form>
      <Link href="/app/library" className="link sm d-only" style={{ marginLeft: "auto", order: 3 }}>All photos <ArrowRight size={16} /></Link>
      <div className="pills">{FILTERS.map(([k, l]) => <Link key={k} href={qs({ s: k || undefined, page: undefined })} className={clsx("pill", (status ?? "") === k && "on")}>{l}</Link>)}</div>
    </div>}
    {jobs.length === 0 ? (filtered
      ? <div className="note" style={{ marginTop: "var(--s6)" }}>No shoots match. <Link className="link" href="/app/shoots">Clear search</Link></div>
      : <Empty title="No shoots yet" action={<Link href="/app/new" className="btn btn-lg btn-lime">Upload product photos</Link>}>Your first one takes about a minute.</Empty>)
      : groups(jobs).map((g) => <section key={g.label}>
        <h2 className="h5 grp">{g.label}</h2>
        <div className="gx c4" style={{ gap: "var(--s5) var(--s4)" }}>{g.jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}</div>
      </section>)}
    {(page > 1 || jobs.length === PER) && <nav aria-label="More shoots" className="row" style={{ marginTop: "var(--s7)", justifyContent: "center" }}>
      {page > 1 && <Link className="btn btn-soft" href={qs({ page: page - 1 })}><ArrowLeft />Newer</Link>}
      {jobs.length === PER && <Link className="btn btn-soft" href={qs({ page: page + 1 })}>Older<ArrowRight /></Link>}
    </nav>}
  </div>;
}
