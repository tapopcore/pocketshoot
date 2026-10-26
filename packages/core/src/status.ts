export type JobStatus = "queued" | "preparing" | "generating" | "checking" | "completed" | "review_needed" | "failed" | "cancelled";
export type ItemStatus = "queued" | "preparing" | "generating" | "checking" | "delivered" | "failed" | "cancelled";

export const JOB_STATUS_LABEL: Record<JobStatus, { label: string; labelHi: string; tone: "neutral" | "busy" | "good" | "warn" | "bad" }> = {
  queued: { label: "Waiting in queue", labelHi: "कतार में", tone: "neutral" },
  preparing: { label: "Preparing your photos", labelHi: "फ़ोटो तैयार हो रही हैं", tone: "busy" },
  generating: { label: "Creating images", labelHi: "इमेज बन रही हैं", tone: "busy" },
  checking: { label: "Checking product accuracy", labelHi: "प्रोडक्ट की जाँच", tone: "busy" },
  completed: { label: "Ready", labelHi: "तैयार", tone: "good" },
  review_needed: { label: "Ready, please check closely", labelHi: "तैयार, ध्यान से देखें", tone: "warn" },
  failed: { label: "Failed, no credits used", labelHi: "असफल, क्रेडिट नहीं कटे", tone: "bad" },
  cancelled: { label: "Cancelled", labelHi: "रद्द", tone: "neutral" },
};

/** Rolls item statuses up into a job status. */
export function rollupJobStatus(items: { status: ItemStatus; decision?: "pass" | "review" | "fail" | null }[]): JobStatus {
  if (items.length === 0) return "queued";
  const active = items.filter((i) => i.status !== "cancelled");
  if (active.length === 0) return "cancelled";
  const busy = active.find((i) => ["preparing", "generating", "checking"].includes(i.status));
  if (busy) return busy.status as JobStatus;
  if (active.some((i) => i.status === "queued")) {
    return active.some((i) => i.status !== "queued") ? "generating" : "queued";
  }
  const delivered = active.filter((i) => i.status === "delivered");
  if (delivered.length === 0) return "failed";
  return delivered.some((i) => i.decision === "review") ? "review_needed" : "completed";
}

export const TERMINAL_ITEM: ItemStatus[] = ["delivered", "failed", "cancelled"];

/** Retry delay with exponential backoff and jitter, in ms. */
export function backoffMs(attempt: number, baseMs = 4000, capMs = 120_000, rand = Math.random): number {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + rand() * (exp / 2));
}
