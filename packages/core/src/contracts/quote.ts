/**
 * Quote: binds price to the exact goal, evidence and plan revisions (pack 03 §2; checklist B04, D01).
 * Any change to those invalidates the quote before a job is created. Customer credits are independent
 * of the provider-spend budget.
 */
import { CONTRACT_VERSION, result, type ContractIssue, type ValidationResult } from "./common";
import type { ProductEvidence } from "./product-evidence";
import type { ShootGoal } from "./shoot-goal";
import { validatePlan, type ShotPlan } from "./shot-plan";

export interface ResolutionProfile {
  model: string;
  quality: "low" | "medium" | "high";
  /** Long edge the image model actually generates. */
  nativeLongEdge: number;
  /** Long edge delivered to the customer. When larger than native, the file is enlarged, not more detailed. */
  deliveredLongEdge: number;
}

export interface Quote {
  schemaVersion: typeof CONTRACT_VERSION;
  quoteId: string;
  version: number;
  productId: string;
  goalFingerprint: string;
  evidenceRevision: number;
  planId: string;
  planRevision: number;
  slots: number;
  creditsPerSlot: number;
  totalCredits: number;
  resolution: ResolutionProfile;
  issuedAt: string;
  expiresAt: string;
}

export const upscaled = (r: ResolutionProfile) => r.deliveredLongEdge > r.nativeLongEdge;

/** Called by job creation. Every failure here happens before credits are reserved or images bought. */
export function validateQuoteForJob(q: Quote, goal: ShootGoal, evidence: ProductEvidence, plan: ShotPlan, balance: number, now: Date): ValidationResult {
  const issues: ContractIssue[] = [];
  if (q.schemaVersion !== CONTRACT_VERSION) issues.push({ code: "schema_version", message: "Quote was issued for another contract version.", path: "schemaVersion" });
  if (new Date(q.expiresAt).getTime() <= now.getTime()) issues.push({ code: "quote_expired", message: "This price has expired. Refresh to see the current total.", path: "expiresAt" });
  if (q.productId !== goal.productId || q.productId !== evidence.productId) issues.push({ code: "product_mismatch", message: "Quote belongs to another product.", path: "productId" });
  if (q.goalFingerprint !== goal.fingerprint) issues.push({ code: "goal_changed", message: "Your choices changed after this price was shown.", path: "goalFingerprint" });
  if (q.evidenceRevision !== evidence.evidenceRevision) issues.push({ code: "evidence_changed", message: "Product photos or details changed after this price was shown.", path: "evidenceRevision" });
  if (q.planId !== plan.planId || q.planRevision !== plan.revision) issues.push({ code: "plan_changed", message: "The shot plan changed after this price was shown.", path: "planId" });
  if (!["feasible", "smaller_set_available"].includes(plan.status)) issues.push({ code: "plan_not_ready", message: "The shot plan is waiting for a photo or an answer.", path: "plan.status" });
  if (q.slots !== plan.slots.length) issues.push({ code: "slot_mismatch", message: `Quoted ${q.slots} photos but the plan has ${plan.slots.length}.`, path: "slots" });
  if (q.totalCredits !== q.slots * q.creditsPerSlot) issues.push({ code: "total_mismatch", message: "Total credits do not match photos × price.", path: "totalCredits" });
  if (balance < q.totalCredits) issues.push({ code: "insufficient_credits", message: `This shoot needs ${q.totalCredits} credits; you have ${balance}.`, path: "totalCredits" });
  const planCheck = validatePlan(plan, goal, evidence);
  for (const i of planCheck.issues) issues.push({ ...i, path: "plan." + (i.path ?? "") });
  return result(issues);
}
