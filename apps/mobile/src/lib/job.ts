export interface Asset {
  id: string; item_id: string; url: string | null; thumbUrl: string | null; width: number; height: number;
  quality_status: "pass" | "review"; approval_status: string; watermarked: boolean; remakes_used: number; delivered_at: string;
  quality_checks: { check_type: string; decision: string; details: Record<string, unknown> }[];
  refund_requests: { status: string }[] | { status: string } | null;
}
export interface Item { id: string; idx: number; status: string; attempts: number; last_error: string | null; delivered_asset_id: string | null }
export interface JobData {
  job: { id: string; status: string; statusLabel: string; statusTone: string; mode: string; style: string; output: string; requested_count: number; is_trial: boolean; products: { id: string; name: string } };
  items: Item[]; assets: Asset[]; references: { id: string; url: string | null }[];
}

export const DONE = ["completed", "review_needed", "failed", "cancelled"];

/** Last loaded jobs, so the full-screen image viewer can open instantly. */
export const jobCache = new Map<string, JobData>();
