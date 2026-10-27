import "server-only";
import { admin } from "./supabase";
import { ProviderError } from "./providers/types";

/**
 * Conservative preflight guard against runaway AI costs.
 * This is an additional safety limit, NOT an atomic billing system.
 * TODO: migrate to a serialized budget reservation RPC for high-volume production.
 */
export async function assertAiBudget(orgId?: string) {
  const budget = Number(process.env.AI_DAILY_BUDGET_USD ?? "5");
  const maxCalls = Number(process.env.AI_DAILY_MAX_CALLS ?? "70");
  if (!Number.isFinite(budget) || budget <= 0 || !Number.isFinite(maxCalls) || maxCalls <= 0) {
    throw new ProviderError("AI spend limits are not configured", "budget_config", false);
  }
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const db = admin();
  const [imageAttempts, extraCosts, calls] = await Promise.all([
    db.from("generation_attempts").select("cost_usd").gte("created_at", since.toISOString()).eq("status", "succeeded").limit(10000),
    db.from("analytics_events").select("props").gte("created_at", since.toISOString()).eq("name", "ai_cost").limit(10000),
    db.from("analytics_events").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString()).eq("name", "ai_operation"),
  ]);
  if (imageAttempts.error || extraCosts.error || calls.error) {
    throw new ProviderError("Could not verify AI budget; generation stopped to prevent unexpected charges", "budget_unavailable", true);
  }
  const spend = (imageAttempts.data ?? []).reduce((sum, x) => sum + Number(x.cost_usd ?? 0), 0)
    + (extraCosts.data ?? []).reduce((sum, x) => sum + Number((x.props as { usd?: number })?.usd ?? 0), 0);
  const callCount = (imageAttempts.data?.length ?? 0) + (calls.count ?? 0);
  // Reserve cost headroom for the upcoming call. Ledger values can underestimate provider billing.
  if (spend + 0.35 >= budget || callCount >= maxCalls) {
    throw new ProviderError(
      "Pocket Shoot reached its daily AI spending guardrail. An administrator must review the budget.",
      "budget_exceeded", false,
    );
  }
  void orgId; // Organization budgets can be layered on after testing.
}
