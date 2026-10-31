"use server";
import { redirect } from "next/navigation";
import { requirePlatform } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { audit } from "@/lib/observe";
import { REVIEW_VERSION } from "@/lib/generation-review";
import { recheckSavedItem } from "@/lib/generation-recovery";
export async function recheckJob(form: FormData) {
  const ctx = await requirePlatform("platform_admin");
  const jobId = String(form.get("jobId") ?? "");
  if (!/^[a-f0-9-]{36}$/.test(jobId)) throw new Error("Invalid shoot");
  const { data: items } = await admin().from("generation_items").select("id,idx").eq("job_id", jobId).order("idx").limit(6);
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < (items ?? []).length; i += 3) {
    results.push(...await Promise.all((items ?? []).slice(i,i+3).map(async it => {
      try {
        const r = await recheckSavedItem(it.id);
        return r ? { itemId: it.id, slot: it.idx + 1, decision: r.decision, verdict: r.verdict, failures: r.checks.filter(c => c.decision === "fail").map(c => c.type) } : { itemId: it.id, slot: it.idx + 1, decision: "unavailable", error: "No saved output" };
      } catch (e) { return { itemId: it.id, slot: it.idx + 1, decision: "unavailable", error: (e as Error).message.slice(0,160) }; }
    })));
  }
  await audit(ctx, "generation.recheck", { type: "job", id: jobId }, { version: REVIEW_VERSION, noImageGeneration: true, noCreditChange: true, results });
  redirect(`/admin/reliability?job=${jobId}`);
}
