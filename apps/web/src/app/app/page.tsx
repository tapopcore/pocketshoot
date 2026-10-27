import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { requireWeb, clientIp } from "@/lib/auth";
import { grantTrialIfEligible } from "@/lib/credits";
import { recentJobs, productList } from "@/lib/views";
import { JobCard } from "@/components/job-card";
import { ResumeDraft } from "@/components/resume-draft";
export const metadata={title:"Your studio"};
export default async function Home({searchParams}:{searchParams:Promise<{product?:string;industry?:string;look?:string;denied?:string}>}){
 const sp=await searchParams;
 const ctx=await requireWeb();
 if(sp.product){const {redirect}=await import("next/navigation");redirect("/app/new?product="+encodeURIComponent(sp.product));}
 const [jobs,products,granted]=await Promise.all([recentJobs(ctx.orgId,6),productList(ctx.orgId,{limit:4}),grantTrialIfEligible(ctx,await clientIp())]);
 return <div className="mx-auto max-w-5xl">
  {sp.denied&&<p role="alert" className="mb-5 rounded-xl bg-warn/10 p-4 text-sm">Your role cannot open that page. Workspace tools are available in Account.</p>}
  {granted>0&&<p role="status" className="mb-5 rounded-xl bg-good/10 p-4 text-sm">{granted} free credits added. Your credit balance updates on the next page.</p>}
  <section className="mb-9 flex flex-col items-start justify-between gap-6 border-b border-line pb-8 sm:flex-row sm:items-end"><div><p className="tracked mb-3 text-accent">Your studio</p><h1 className="text-[38px] font-semibold leading-[1.05] tracking-[-.045em] sm:text-6xl">What will you<br/><span className="serif-i font-normal">shoot next?</span></h1><p className="mt-4 max-w-md text-sm leading-relaxed text-ink-2">Start with a photo. Find a direction made for your product.</p></div>{ctx.role!=="viewer"&&<Link href="/app/new" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-white"><Plus size={19}/>Create a shoot</Link>}</section>
  <ResumeDraft scope={ctx.orgId}/>
  <section><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">Your shoots</h2><Link href="/app/shoots" className="inline-flex min-h-11 items-center gap-2 text-sm">View all <ArrowRight size={15}/></Link></div>{jobs.length?<div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-5">{jobs.map((j,i)=><JobCard key={j.id} job={j} index={i}/>)}</div>:<div className="rounded-2xl border border-line bg-card p-6 sm:p-9"><h3 className="text-lg font-semibold">Your first shoot starts with one photo.</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-mute">Take a photo or choose one from your library. You will see the direction and price before creating.</p><Link href="/app/new" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent">Start a shoot <ArrowRight size={15}/></Link></div>}</section>
  {products.products.length>0&&<section className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Shoot it again</h2><Link href="/app/products" className="min-h-11 py-3 text-sm">All products →</Link></div><div className="grid gap-3 sm:grid-cols-2">{products.products.filter(p=>p.photoCount>0).map(p=><Link key={p.id} href={"/app/new?product="+p.id} className="flex items-center gap-4 rounded-2xl border border-line bg-card p-3">{p.coverUrl&&<img src={p.coverUrl} alt="" className="size-16 rounded-xl object-cover"/>}<span className="flex-1 text-sm font-semibold">{p.name}</span><ArrowRight size={17}/></Link>)}</div></section>}
 </div>;
}