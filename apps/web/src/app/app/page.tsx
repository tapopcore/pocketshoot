import Link from "next/link";
import { clientIp, requireWeb } from "@/lib/auth";
import { getWallet, grantTrialIfEligible, isTrialOrg } from "@/lib/credits";
import { recentJobs } from "@/lib/views";
import { admin } from "@/lib/supabase";
import { Notice } from "@/components/ui";
import { QuickStart, SceneStrip } from "@/components/quick-start";
import { JobCard } from "@/components/job-card";

export const metadata = { title: "Dashboard" };

const TIPS = [
  { n: "01", t: "Label facing the camera", d: "We keep your real label pixels, so make sure it's sharp and readable." },
  { n: "02", t: "Use soft daylight", d: "Near a window, not in direct sun. Avoid the phone flash, it creates glare on labels." },
  { n: "03", t: "Fill the frame", d: "Get close so the label is sharp and readable. Small blurry text can't be fixed later." },
  { n: "04", t: "Any background works", d: "We remove hands and clutter, but a plain background gives the cleanest edges." },
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

      <QuickStart hello={hello} credits={wallet.available} />

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="display text-2xl">Recent shoots</h2>
          {jobs.length > 0 && <Link href="/app/library" className="text-sm font-medium text-mute hover:text-ink">All images →</Link>}
        </div>
        {jobs.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TIPS.map((t) => (
              <div key={t.n} className="rounded-2xl border border-line bg-card p-5">
                <div className="text-xs font-semibold text-accent">Tip {t.n}</div>
                <div className="mt-1.5 font-semibold">{t.t}</div>
                <p className="mt-1 text-sm text-mute">{t.d}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
            {jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="display text-2xl">Scenes to try</h2>
          <span className="text-sm text-mute">{approved ?? 0} images made · {wallet.available} credits left</span>
        </div>
        <SceneStrip />
      </section>
    </div>
  );
}
