import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { JobView } from "@/components/job-view";

export default function DevJob() {
  if (process.env.PREVIEW_UI !== "1") notFound();
  return (
    <AppShell locale="en" orgName="Demo workspace" orgs={[]} orgId="x" credits={12} email="demo@example.com" isPlatform={false}>
      <JobView jobId="demo" />
    </AppShell>
  );
}
