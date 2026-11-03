import Link from "next/link";
import { requirePlatform } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { recheckJob } from "./actions";
export const maxDuration = 300;
export default async function Reliability({searchParams}:{searchParams:Promise<{job?:string}>}) {
  await requirePlatform("platform_admin");
  const {job} = await searchParams;
  const db = admin();
  const {data:jobs} = await db.from("generation_jobs").select("id,created_at,requested_count,products(name)").order("created_at",{ascending:false}).limit(50);
  const {data:reports} = job ? await db.from("audit_logs").select("metadata,created_at").eq("action","generation.recheck").eq("target_id",job).order("created_at",{ascending:false}).limit(1) : {data:[]};
  return <div className="space-y-5"><h1 className="text-3xl font-semibold">Generation reliability</h1><p>Compare saved images with the current checker. This makes vision/text requests only. It creates no images, changes no customer credits and does not publish rejected outputs.</p>{job&&<form action={recheckJob}><input type="hidden" name="jobId" value={job}/><button className="btn btn-lime">Recheck up to 6 saved photos</button> <Link href={`/admin/jobs/${job}`} className="underline">See original and output images</Link></form>}{reports?.map(r=><section key={r.created_at}><h2 className="text-xl">Saved comparison · {r.created_at}</h2><pre className="whitespace-pre-wrap break-words rounded border p-4 text-xs">{JSON.stringify(r.metadata,null,2)}</pre></section>)}<ul className="space-y-2">{jobs?.map(j=><li key={j.id}><Link className="underline" href={`/admin/reliability?job=${j.id}`}>{(j.products as unknown as {name:string})?.name} · {j.requested_count} photos · {j.created_at}</Link></li>)}</ul></div>;
}
