/**
 * ShootGoal: the outcome the customer bought (pack 03 §2, checklist B01, B02, B05, B06).
 * Goal comes before style; quantity is separate. Once confirmed, the goal is frozen and fingerprinted.
 * No planner, renderer or reviewer can rewrite it; a change creates a new revision and invalidates the quote.
 */
import { ASPECT_RATIOS, CONTRACT_VERSION, deepFreeze, fingerprint, result, type AspectRatio, type ContractIssue, type UntrustedText, type ValidationResult } from "./common";
import { permission, type ProductEvidence, type Transformation, type TransformationPermission, type ViewRole } from "./product-evidence";

export const OFFERINGS = ["studio", "model_use", "campaign"] as const;
export type Offering = (typeof OFFERINGS)[number];

export const GOAL_FAMILIES = ["product_only_catalogue", "model_worn", "product_in_use", "lifestyle", "campaign", "detail", "mixed_listing"] as const;
export type GoalFamily = (typeof GOAL_FAMILIES)[number];

export const HUMAN_ACTIONS = ["none", "hands_holding", "hands_using", "model_wearing", "model_holding", "model_using"] as const;
export type HumanAction = (typeof HUMAN_ACTIONS)[number];

export const ENVIRONMENTS = ["white_studio", "neutral_studio", "indoor", "outdoor", "any"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** What every slot of this goal must show. `humanActions` lists the acceptable actions; one is required per slot. */
export interface GoalRequirement {
  humanActions: HumanAction[];
  environment: Environment;
  /** Physical changes the outcome depends on, e.g. "wear" for a model-worn shirt. */
  transformations: Transformation[];
}

/** The three customer offerings and what each may contain (pack 02 "Offerings and hierarchy"). */
export const OFFERING_DEFINITIONS: Record<Offering, { label: string; promise: string; families: GoalFamily[] }> = {
  studio: { label: "Studio photos", promise: "Clear product photographs for listings", families: ["product_only_catalogue", "detail"] },
  model_use: { label: "Model & everyday use", promise: "Your product worn, held or used naturally", families: ["model_worn", "product_in_use", "lifestyle"] },
  campaign: { label: "Creative campaign", promise: "A coordinated shoot with a distinct visual idea", families: ["campaign", "mixed_listing"] },
};

/** Default requirement per family. Mixed listing is the only family that intentionally combines kinds. */
export const FAMILY_REQUIREMENTS: Record<GoalFamily, GoalRequirement> = {
  product_only_catalogue: { humanActions: ["none"], environment: "white_studio", transformations: ["reposition"] },
  detail: { humanActions: ["none"], environment: "any", transformations: ["reposition"] },
  model_worn: { humanActions: ["model_wearing"], environment: "any", transformations: ["wear"] },
  product_in_use: { humanActions: ["hands_holding", "hands_using", "model_holding", "model_using"], environment: "any", transformations: ["hold"] },
  lifestyle: { humanActions: ["none", "hands_holding", "model_holding", "model_using", "model_wearing"], environment: "any", transformations: ["place_in_scene"] },
  campaign: { humanActions: ["none", "hands_holding", "hands_using", "model_wearing", "model_holding", "model_using"], environment: "any", transformations: ["place_in_scene"] },
  mixed_listing: { humanActions: ["none", "hands_holding", "hands_using", "model_wearing", "model_holding", "model_using"], environment: "any", transformations: ["reposition"] },
};

export const USAGES = ["marketplace", "website", "social", "ads", "print", "other"] as const;
export type Usage = (typeof USAGES)[number];

export const MAX_QUANTITY = 6;

export interface ShootGoalDraft {
  productId: string;
  evidenceRevision: number;
  offering: Offering;
  family: GoalFamily;
  requirement?: GoalRequirement;
  usage: Usage;
  quantity: number;
  aspectRatio: AspectRatio;
  creativeLatitude: "low" | "medium" | "high";
  /** Continue keeps the approved visual language; new_direction must avoid repeating it. */
  intent: "first_shoot" | "continue_campaign" | "new_direction";
  directionId?: string;
  campaignId?: string;
  brandKitId?: string;
  /** Selected additions and notes are preferences, never instructions. */
  selectedAdditions: UntrustedText[];
  customerNote?: UntrustedText;
  /** Alternatives the customer explicitly accepted, e.g. a smaller set. */
  approvedAlternatives: string[];
}

export interface ShootGoal extends Readonly<ShootGoalDraft> {
  readonly schemaVersion: typeof CONTRACT_VERSION;
  readonly goalId: string;
  readonly revision: number;
  readonly requirement: GoalRequirement;
  readonly confirmedAt: string;
  /** Fingerprint of everything above. Quotes, plans, attempts and verdicts carry it. */
  readonly fingerprint: string;
}

const body = (g: Omit<ShootGoal, "fingerprint">) => ({ ...g });

/** Freeze the customer's choice. Called once, when the customer confirms. */
export function confirmGoal(draft: ShootGoalDraft, goalId: string, confirmedAt: string, revision = 1): ShootGoal {
  // Copy first: freezing must never lock the caller's own objects.
  const copy = JSON.parse(JSON.stringify(draft)) as ShootGoalDraft;
  const requirement = copy.requirement ?? JSON.parse(JSON.stringify(FAMILY_REQUIREMENTS[copy.family])) as GoalRequirement;
  const g = { ...copy, requirement, schemaVersion: CONTRACT_VERSION, goalId, revision, confirmedAt } as Omit<ShootGoal, "fingerprint">;
  return deepFreeze({ ...g, fingerprint: fingerprint(body(g)) });
}

/** A changed goal is a new revision with a new fingerprint. Never mutate a confirmed goal. */
export function reviseGoal(goal: ShootGoal, changes: Partial<ShootGoalDraft>, confirmedAt: string): ShootGoal {
  const { fingerprint: _f, schemaVersion: _s, goalId, revision, confirmedAt: _c, ...draft } = goal;
  return confirmGoal({ ...(draft as ShootGoalDraft), ...changes, requirement: changes.family ? undefined : goal.requirement }, goalId, confirmedAt, revision + 1);
}

/** True only when the goal is byte-for-byte what the customer confirmed. */
export function goalIntact(goal: ShootGoal): boolean {
  const { fingerprint: f, ...rest } = goal;
  return fingerprint(body(rest)) === f;
}

export function validateGoal(g: ShootGoalDraft | ShootGoal): ValidationResult {
  const issues: ContractIssue[] = [];
  if (!OFFERINGS.includes(g.offering)) issues.push({ code: "unknown_offering", message: "Unknown offering.", path: "offering" });
  if (!OFFERING_DEFINITIONS[g.offering]?.families.includes(g.family)) issues.push({ code: "family_offering_mismatch", message: `"${g.family}" is not part of ${OFFERING_DEFINITIONS[g.offering]?.label ?? g.offering}.`, path: "family" });
  if (!Number.isInteger(g.quantity) || g.quantity < 1 || g.quantity > MAX_QUANTITY) issues.push({ code: "bad_quantity", message: `Quantity must be 1 to ${MAX_QUANTITY}.`, path: "quantity" });
  if (!ASPECT_RATIOS.includes(g.aspectRatio)) issues.push({ code: "bad_aspect", message: "Unsupported output shape.", path: "aspectRatio" });
  const req = g.requirement ?? FAMILY_REQUIREMENTS[g.family];
  if (!req?.humanActions.length) issues.push({ code: "empty_requirement", message: "The goal must say what each photo shows.", path: "requirement" });
  if (g.family === "model_worn" && req.humanActions.some((a) => a !== "model_wearing")) issues.push({ code: "model_worn_diluted", message: "A model-worn shoot must show the product worn in every photo.", path: "requirement.humanActions" });
  if (g.family === "product_only_catalogue" && req.humanActions.some((a) => a !== "none")) issues.push({ code: "catalogue_with_people", message: "Studio catalogue photos are product-only.", path: "requirement.humanActions" });
  if ((g.intent === "continue_campaign") !== !!g.campaignId) issues.push({ code: "campaign_intent", message: "Continue campaign needs a campaign, and only then.", path: "intent" });
  if ("fingerprint" in g && !goalIntact(g)) issues.push({ code: "goal_tampered", message: "This goal no longer matches what the customer confirmed.", path: "fingerprint" });
  return result(issues);
}

/** Outcome of checking a goal against the product's evidence, before planning or quoting (B05). */
export type Feasibility =
  | { status: "feasible" }
  | { status: "needs_reference"; transformation: Transformation; requiredView?: ViewRole; requiredConfiguration?: { component: string; state: string }; reason: string }
  | { status: "needs_confirmation"; transformation: Transformation; question: string; reason: string }
  | { status: "unsupported"; transformation: Transformation; reason: string };

/** Every transformation the goal depends on must be supported by the evidence. Missing evidence and incompatibility are reported differently. */
export function goalFeasibility(goal: ShootGoalDraft | ShootGoal, evidence: ProductEvidence): Feasibility {
  if (goal.productId !== evidence.productId) return { status: "unsupported", transformation: "reposition", reason: "This goal belongs to a different product." };
  const req = goal.requirement ?? FAMILY_REQUIREMENTS[goal.family];
  for (const t of req.transformations) {
    const p: TransformationPermission | undefined = permission(evidence, t);
    if (!p) return { status: "needs_confirmation", transformation: t, question: `Can this product be ${verb(t)}?`, reason: "The product analysis has not assessed this yet." };
    if (p.status === "supported") continue;
    if (p.status === "needs_reference") return { status: "needs_reference", transformation: t, requiredView: p.requiredView, requiredConfiguration: p.requiredConfiguration, reason: p.reason };
    if (p.status === "needs_confirmation") return { status: "needs_confirmation", transformation: t, question: p.question ?? `Can this product be ${verb(t)}?`, reason: p.reason };
    return { status: "unsupported", transformation: t, reason: p.reason };
  }
  return { status: "feasible" };
}

const verb = (t: Transformation) => ({ wear: "worn", hold: "held in a hand", apply: "applied", pour: "poured", open: "opened", unfold: "unfolded", redrape: "draped differently", reposition: "repositioned", place_in_scene: "placed in a scene", remove_tag: "shown without its tag", remove_packaging: "shown without packaging", show_component_state: "shown in another configuration" } as Record<Transformation, string>)[t];
