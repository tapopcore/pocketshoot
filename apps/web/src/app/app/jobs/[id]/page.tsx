import { notFound } from "next/navigation";
import { requireWeb } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { JobView } from "@/components/job-view";

export const metadata = { title: "Shoot" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWeb();
  const { id } = await params;
  const { data } = await admin().from("generation_jobs").select("id").eq("id", id).eq("organization_id", ctx.orgId).maybeSingle();
  if (!data) notFound();
  const settings = await getSettings();
  return <JobView jobId={id} freeRemakes={settings.credit_policy.freeRemakes} />;
}
