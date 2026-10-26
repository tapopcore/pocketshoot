import Link from "next/link";
import { ArrowRight, Camera } from "lucide-react";
import { clientIp, requireWeb } from "@/lib/auth";
import { getWallet, grantTrialIfEligible, isTrialOrg } from "@/lib/credits";
import { recentJobs } from "@/lib/views";
import { admin } from "@/lib/supabase";
import { Empty, LinkButton, Notice, Stat } from "@/components/ui";
import { JobCard } from "@/components/job-card";

export const metadata = { title: "Dashboard" };

const TIPS = [
  { n: "01", t: "Shoot on a plain surface", d: "A sheet of white paper or a plain wall behind the product gives the cleanest result." },
  { n: "02", t: "Use soft daylight", d: "Near a window, not in direct sun. Avoid the phone flash, it creates glare on labels." },
  { n: "03", t: "Fill the frame", d: "Get close so the label is sharp and readable. Small blurry text can't be fixed later." },
  { n: "04", t: "Add a second angle", d: "A three-quarter view helps for lifestyle shots that show the product from the side." },
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const ctx = await requireWeb();
  const sp = await searchParams;
  const granted = await grantTrialIfEligible(ctx, await clientIp());
  const [wallet, jobs, trial, { count: approved }] = await Promise.all([
    getWallet(ctx.orgId),
    recentJobs(ctx.orgId, 8),
    isTrialOrg(ctx.orgId),
    admin().from("generated_assets").select("id", { count: "exact", head: true }).eq("organization_id", ctx.orgId).neq("quality_status", "fail"),
  ]);
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      {sp.denied && <Notice tone="warn" className="mb-6">You don&apos;t have permission for that page. Ask a workspace admin.</Notice>}
      {granted > 0 && <Notice tone="good" className="mb-6">Welcome! We&apos;ve added {granted} free credits so you can try your first shoot.</Notice>}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-ink p-7 text-paper sm:p-10 animate-rise">
          <div className="eyebrow !text-paper/50">{hello}</div>
          <h1 className="display mt-3 text-5xl sm:text-6xl">What are we<br />shooting <em className="text-accent">today?</em></h1>
          <p className="mt-4 max-w-md text-paper/70">Upload a photo of any product. Pick a style. Get studio images that keep your label and logo exactly as they are.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/app/new" variant="accent" size="lg"><Camera size={18} /> New photoshoot</LinkButton>
            <LinkButton href="/app/batch" variant="ghost" size="lg" className="!text-paper hover:!bg-paper/10">Shoot many products</LinkButton>
          </div>
          <svg className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 text-paper/[0.06]" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1" />
            <circle cx="50" cy="50" r="12" fill="currentColor" />
          </svg>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Credits left" value={wallet.available} sub={wallet.reserved ? `${wallet.reserved} in progress` : trial ? "Trial credits" : "1 credit = 1 image"} accent={wallet.available === 0} />
          <Stat label="Images made" value={approved ?? 0} sub={`${wallet.consumed} credits used`} />
          <Link href="/app/wallet" className="col-span-2 flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-card p-5 transition-colors hover:border-ink">
            <div>
              <div className="eyebrow">No subscription</div>
              <div className="mt-1 font-medium">{wallet.available < 3 ? "Running low. Top up credits" : "Buy credits when you need them"}</div>
            </div>
            <ArrowRight />
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="display text-3xl">Recent shoots</h2>
          {jobs.length > 0 && <Link href="/app/library" className="text-sm underline">See all images</Link>}
        </div>
        {jobs.length === 0 ? (
          <Empty title="Nothing shot yet" action={<LinkButton href="/app/new">Start your first shoot</LinkButton>}>
            Your first shoot takes about a minute. Free credits are already in your account.
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="display mb-5 text-3xl">Better photos in, better photos out</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIPS.map((t) => (
            <div key={t.n} className="rounded-[var(--radius-card)] border border-line p-5">
              <div className="frame-no">{t.n}</div>
              <div className="mt-2 font-medium">{t.t}</div>
              <p className="mt-1 text-sm text-mute">{t.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
