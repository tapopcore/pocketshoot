/**
 * Item lifecycle, failure reasons and credit settlement (pack 03 §5–6; checklist B09, E14, F01, F02, F09, F10, G17).
 * Accepted is the only billable delivery state. Review is visible for inspection but is not sold as approved.
 */
import type { Verdict } from "./review-verdict";

export const ITEM_STATES = ["queued", "generating", "checking", "accepted", "review", "failed", "cancelled", "superseded"] as const;
export type ItemState = (typeof ITEM_STATES)[number];
export const TERMINAL_STATES: readonly ItemState[] = ["accepted", "failed", "cancelled", "superseded"];

const NEXT: Record<ItemState, readonly ItemState[]> = {
  queued: ["generating", "failed", "cancelled"],
  generating: ["checking", "failed", "cancelled", "queued"],
  checking: ["accepted", "review", "failed"],
  // A held photo is resolved by inspection: approved, rejected, or replaced by a retry.
  review: ["accepted", "failed", "superseded"],
  failed: ["superseded"],
  accepted: ["superseded"],
  cancelled: [],
  superseded: [],
};

export function canTransition(from: ItemState, to: ItemState): boolean {
  return NEXT[from].includes(to);
}

export function stateForVerdict(v: Verdict): ItemState {
  return v === "accept" ? "accepted" : v === "review" ? "review" : "failed";
}

/** capture = charge the reserved credit; release = return it; hold = keep it reserved, uncharged. */
export type CreditSettlement = "capture" | "release" | "hold";

export function settlementFor(state: ItemState): CreditSettlement | null {
  if (state === "accepted") return "capture";
  if (state === "review") return "hold";
  if (state === "failed" || state === "cancelled") return "release";
  // superseded: settlement already happened on the original; never settle twice.
  return null;
}

/** Distinct reasons, so "no budget" and "wrong product" are never shown the same way (E14, F09). */
export const FAILURE_REASONS = [
  "missing_reference", "needs_confirmation", "source_unusable",
  "provider_transient", "provider_refused", "timeout",
  "wrong_product", "wrong_goal", "duplicate", "quality",
  "checker_unavailable", "budget_guard", "settlement_error", "cancelled",
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export type RecoveryAction = "retry" | "add_photo" | "answer_question" | "wait" | "contact_support" | "none";

export interface FailurePresentation {
  title: string;
  message: string;
  action: RecoveryAction;
  /** Shown only when action is retry. */
  retryLabel?: string;
  credit: "released" | "not_charged";
}

/**
 * Customer copy for each reason. Retry is offered only where a retry can actually change the outcome.
 * `detail` is an observable, product-specific sentence from the verdict, e.g. "The spray head changed shape."
 */
export function presentFailure(reason: FailureReason, detail?: string): FailurePresentation {
  const d = detail?.trim();
  switch (reason) {
    case "missing_reference": return { title: "One more photo needed", message: d || "This shot shows a part of the product that none of your photos show.", action: "add_photo", credit: "released" };
    case "needs_confirmation": return { title: "A quick question", message: d || "We need you to confirm one detail before making this photo.", action: "answer_question", credit: "released" };
    case "source_unusable": return { title: "Photo too unclear", message: d || "The product photo is too dark, blurred or cropped to work from.", action: "add_photo", credit: "released" };
    case "provider_transient": return { title: "Temporary problem", message: "The image service had a short outage. Nothing was charged.", action: "retry", retryLabel: "Try again", credit: "released" };
    case "timeout": return { title: "This took too long", message: "The photo did not finish in time. Nothing was charged.", action: "retry", retryLabel: "Try again", credit: "released" };
    case "provider_refused": return { title: "Not possible for this product", message: d || "The image service declined this scene. Try a different direction.", action: "none", credit: "released" };
    case "wrong_product": return { title: "Product came out wrong", message: (d ? d + " " : "A detail of your product changed. ") + "We stopped this photo and returned your credit.", action: "retry", retryLabel: "Try again", credit: "released" };
    case "wrong_goal": return { title: "Didn't match your shoot", message: (d ? d + " " : "This photo did not show what you chose for the shoot. ") + "We stopped it and returned your credit.", action: "retry", retryLabel: "Try again", credit: "released" };
    case "duplicate": return { title: "Too similar to another photo", message: "This came out too close to another photo in the set. Your credit was returned.", action: "retry", retryLabel: "Try a different shot", credit: "released" };
    case "quality": return { title: "Didn't meet our photo standard", message: (d ? d + " " : "") + "Your credit was returned.", action: "retry", retryLabel: "Try again", credit: "released" };
    case "checker_unavailable": return { title: "Couldn't check this photo", message: "Our accuracy check was unavailable, so we did not deliver it. Your credit was returned.", action: "retry", retryLabel: "Check again", credit: "released" };
    case "budget_guard": return { title: "Paused for now", message: "This shoot reached its spending allowance. Your credit was returned. Contact us if this keeps happening.", action: "contact_support", credit: "released" };
    case "settlement_error": return { title: "We're fixing a billing issue", message: "Your photo is safe and you have not been charged twice. Our team will resolve it.", action: "contact_support", credit: "not_charged" };
    case "cancelled": return { title: "Cancelled", message: "This photo was cancelled. Your credit was returned.", action: "none", credit: "released" };
  }
}

/** Retry of a failed slot keeps the original goal, root lineage and never charges twice (F10). */
export interface RetryRequest {
  rootItemId: string;
  parentItemId: string;
  goalFingerprint: string;
  idempotencyKey: string;
}

export function retryAllowed(reason: FailureReason, attemptsOnLineage: number, maxAttempts = 3): boolean {
  return presentFailure(reason).action === "retry" && attemptsOnLineage < maxAttempts;
}
