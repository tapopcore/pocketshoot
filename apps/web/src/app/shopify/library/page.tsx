"use client";
import { useEffect, useState } from "react";
import { api, toast } from "@/lib/client";
import { Empty, Spinner } from "@/components/ui";
import { JobCard, type JobSummary } from "@/components/job-card";
import { useMe } from "../use-me";

export default function ShopifyLibrary() {
  const { me } = useMe();
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  useEffect(() => {
    if (!me) return;
    const load = () => api<{ jobs: JobSummary[] }>("/api/jobs?limit=40").then((r) => setJobs(r.jobs)).catch((e) => toast(e.message, true));
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [me]);
  if (!jobs) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  return (
    <div>
      <h1 className="display mb-6 text-4xl">Shoots</h1>
      {jobs.length === 0 ? <Empty title="No shoots yet">Pick products on the Products page to start.</Empty> : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">{jobs.map((j, i) => <JobCard key={j.id} job={j} index={i} hrefBase="/shopify/jobs" />)}</div>
      )}
    </div>
  );
}
