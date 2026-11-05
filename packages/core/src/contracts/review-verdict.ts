/**
 * ReviewVerdict: independent judgement of one output against the originals and the immutable goal
 * (pack 03 §2, R4; checklist E09–E14). Planner prose is not evidence. Critical failures cannot be
 * averaged away, and a reviewer cannot declare "accept" over a critical failure.
 */
import { CONTRACT_VERSION, result, type ContractIssue, type ValidationResult } from "./common";

export const REVIEW_DIMENSIONS = ["goal", "identity", "components", "label", "human_realism", "photographic", "usefulness", "distinctness"] as const;
export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number];
/** A wrong product or a missing required model fails the photo however attractive it is. */
export const CRITICAL_DIMENSIONS: readonly ReviewDimension[] = ["goal", "identity", "components", "label"];

export interface DimensionResult {
  status: "pass" | "fail" | "uncertain" | "not_applicable";
  reasonCode?: string;
  /** Observable evidence: what differs and where. Required for fail and uncertain. */
  evidence?: string;
  sourceAssetIds?: string[];
}

export const VERDICTS = ["accept", "review", "reject"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const NEXT_ACTIONS = ["none", "retry", "add_reference", "inspect", "contact_support"] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

export interface ReviewVerdict {
  schemaVersion: typeof CONTRACT_VERSION;
  outputId: string;
  attemptId: string;
  slotId: string;
  goalFingerprint: string;
  dimensions: Record<ReviewDimension, DimensionResult>;
  verdict: Verdict;
  nextAction: NextAction;
  confidence: "high" | "medium" | "low";
  reviewerModel: string;
}

/** The only verdict the dimensions allow. Any critical fail rejects; any critical uncertainty needs review. */
export function deriveVerdict(d: Record<ReviewDimension, DimensionResult>): Verdict {
  const crit: (DimensionResult["status"] | undefined)[] = CRITICAL_DIMENSIONS.map((k) => d[k]?.status);
  if (crit.includes("fail")) return "reject";
  // A critical dimension that was not assessed, or was skipped, can never pass.
  if (crit.some((s) => s === "uncertain" || s === undefined || s === "not_applicable")) return "review";
  const rest = REVIEW_DIMENSIONS.filter((k) => !CRITICAL_DIMENSIONS.includes(k)).map((k) => d[k]?.status);
  if (rest.includes("fail")) return "reject";
  if (rest.includes("uncertain")) return "review";
  return "accept";
}

export function validateVerdict(v: ReviewVerdict, goalFingerprint: string): ValidationResult {
  const issues: ContractIssue[] = [];
  if (v.goalFingerprint !== goalFingerprint) issues.push({ code: "goal_mismatch", message: "Verdict was given against a different goal.", path: "goalFingerprint" });
  for (const k of REVIEW_DIMENSIONS) {
    const r = v.dimensions[k];
    if (!r) issues.push({ code: "missing_dimension", message: `No ${k} assessment.`, path: "dimensions." + k });
    else if (["fail", "uncertain"].includes(r.status) && !r.evidence?.trim()) issues.push({ code: "unexplained", message: `A ${r.status} on ${k} must describe what is visibly wrong or unclear.`, path: "dimensions." + k });
  }
  for (const k of CRITICAL_DIMENSIONS) if (v.dimensions[k]?.status === "not_applicable") issues.push({ code: "critical_skipped", message: `${k} cannot be marked not applicable.`, path: "dimensions." + k });
  const derived = deriveVerdict(v.dimensions);
  if (v.verdict !== derived) issues.push({ code: "verdict_inconsistent", message: `Dimensions imply "${derived}", not "${v.verdict}".`, path: "verdict" });
  if (v.verdict === "accept" && v.nextAction !== "none") issues.push({ code: "action_on_accept", message: "An accepted photo needs no action.", path: "nextAction" });
  return result(issues);
}
