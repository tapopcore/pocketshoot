import Link from "next/link";
import {requireWeb} from "@/lib/auth";
import {recentJobs} from "@/lib/views";
import {JobCard} from "@/components/job-card";
export const metadata={title:"Your shoots"};
export default async function Shoots({searchParams}:{searchParams:Promise<{page?:string}>}){
 const ctx=await requireWeb();const sp=await searchParams;const page=Math.max(1,Number(sp.page)||1);
 const jobs=await recentJobs(ctx.orgId,18,(page-1)*18);
 return <div><header className="mb-7 flex items-end justify-between gap-4"><div><p className="tracked text-accent">Your studio</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Your shoots.</h1><p className="mt-3 text-sm text-mute">Running and finished work, ready to reopen.</p></div><Link href="/app/new" className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-white">Create</Link></header>{jobs.length?<div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">{jobs.map((j,i)=><JobCard key={j.id} job={j} index={i}/>)}</div>:<p className="rounded-2xl border border-line bg-card p-6 text-sm">No shoots here yet. Start with a product photo.</p>}<nav aria-label="Shoots pages" className="mt-7 flex gap-5">{page>1&&<Link className="min-h-11 py-3 text-sm underline" href={"/app/shoots?page="+(page-1)}>Previous</Link>}{jobs.length===18&&<Link className="min-h-11 py-3 text-sm underline" href={"/app/shoots?page="+(page+1)}>Next</Link>}</nav></div>;
}