/* eslint-disable @next/next/no-img-element -- Showcase images. */
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { requireWeb, clientIp } from "@/lib/auth";
import { grantTrialIfEligible } from "@/lib/credits";
import { recentJobs, productList } from "@/lib/views";
import { JobCard } from "@/components/job-card";
import { ResumeDraft } from "@/components/resume-draft";
import { StartBox, FirstActions } from "@/components/home-start";
import { BeforeAfter } from "@/components/site/before-after";
import { BulkCta } from "@/components/bulk-cta";
import { getFlag } from "@/lib/settings";

export const metadata = { title: "Home" };

const IDEAS: [string, string, string, string][] = [
  ["skincare-2", "On skin", "Skincare", "beauty"], ["beverage-3", "Pouring", "Drinks", "food"], ["saree-3", "Fabric close-up", "Sarees", "fashion"],
  ["fragrance-3", "Held up", "Perfume", "beauty"], ["rings-2", "On the hand", "Jewellery", "jewellery"],
];

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Home({ searchParams }: { searchParams: Promise<{ product?: string; industry?: string; look?: string; denied?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireWeb();
  if (sp.product) { const { redirect } = await import("next/navigation"); redirect("/app/new?product=" + encodeURIComponent(sp.product)); }
  const [jobs, products, granted, bulkOn] = await Promise.all([recentJobs(ctx.orgId, 4), productList(ctx.orgId, { limit: 6 }), grantTrialIfEligible(ctx, await clientIp()), getFlag("batch_jobs", ctx.orgId)]);
  const canEdit = ctx.role !== "viewer";
  const busy = jobs.filter((j) => ["queued", "preparing", "generating", "checking"].includes(j.status)).length;
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
  const notices = <>
    {sp.denied && <div role="alert" className="note">Your role cannot open that page. Ask a workspace admin for access.</div>}
    {granted > 0 && <div role="status" className="note good"><Check size={16} />{granted} free photos added to your account.</div>}
  </>;

  if (!jobs.length && !products.products.length) return <div className="pg-ahome">
    {notices}
    <div className="wel">
      <div>
        {!granted && <span className="pill good">2 free photos to start</span>}
        <h1 className="h1">Let&apos;s make your first <span className="it">product photos</span></h1>
        <p className="lead">It takes about a minute. Take a photo of the product you sell most, near a window. Add the back and sides too if you like.</p>
        <div className="chk">{([["done", "Create your account", "Done. Your free photos are ready to use"], ["on", "Upload photos of your product", "One is enough. More angles give better results"], ["", "Pick a style and ideas", "Browsing is free"], ["", "Download your photos", "Square, portrait, story and wide sizes"]] as const).map(([c, h, p], n) =>
          <div key={h} className={"ck " + c}><i>{c === "done" ? <Check size={14} strokeWidth={3} /> : n + 1}</i><div><b>{h}</b><span>{p}</span></div></div>)}</div>
        <FirstActions canEdit={canEdit} />
      </div>
      <BeforeAfter before="/showcase/beverage-before.webp" after="/showcase/beverage-2.webp" alt="Iced tea bottle" demo labels={["Phone photo", "PocketShoot"]} className="ba-wel" />
    </div>
    <h2 className="h3" style={{ marginTop: "var(--s8)" }}>What makes a good photo</h2>
    <div className="tips">{([["skincare-before", "Good", "good", "Whole product in frame, label facing you"], ["fragrance-before", "Good", "good", "Soft daylight from a window"], ["bags-before", "Avoid", "warn", "Cut-off edges or fingers over the logo"]] as const).map(([k, t, c, p]) =>
      <div key={k} className="tip card"><div className="ph r11"><img src={`/showcase/${k}.webp`} alt="" loading="lazy" decoding="async" /></div><div><span className={"pill sm " + c}>{t}</span><p className="sm" style={{ marginTop: 8 }}>{p}</p></div></div>)}</div>
  </div>;

  return <div className="pg-ahome">
    {notices}
    <div className="hi"><div><p className="sm muted">{today}</p><h1 className="h2">{greeting()}</h1></div>{busy > 0 && <span className="pill line d-only"><span className="live" />{busy} shoot{busy === 1 ? "" : "s"} in progress</span>}</div>
    <StartBox canEdit={canEdit} products={products.products.filter((p) => p.photoCount > 0).slice(0, 5).map((p) => ({ id: p.id, name: p.name, coverUrl: p.coverUrl }))} />
    <ResumeDraft scope={ctx.orgId} />
    {bulkOn && canEdit && products.products.length > 1 && <BulkCta />}
    {jobs.length > 0 && <>
      <div className="between hsec"><h2 className="h3">Recent shoots</h2><Link href="/app/shoots" className="link sm">View all <ArrowRight size={16} /></Link></div>
      <div className="gx c4" style={{ marginTop: "var(--s4)" }}>{jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} />)}</div>
    </>}
    <div className="between hsec"><h2 className="h3">Styles to try next</h2><Link href="/examples" className="link sm d-only">See examples <ArrowRight size={16} /></Link></div>
    <div className="ideas">{IDEAS.map(([k, n, c, ind]) => <Link key={k} href={"/app/new?industry=" + ind}><div className="ph r11 zoom"><img src={`/showcase/${k}.webp`} alt="" loading="lazy" /></div><b>{n}</b><span>{c}</span></Link>)}</div>
  </div>;
}
