/**
 * ShotPlan: one slot per deliverable, validated as a whole set before any paid image (pack 03 §2, §4; D01–D10).
 * The plan serves the confirmed goal; it never picks fixed looks first and fits the product into them.
 */
import { CONTRACT_VERSION, fingerprint, result, type ContractIssue, type ValidationResult } from "./common";
import { hasConfiguration, permission, type ProductEvidence, type ReferenceForm, type Transformation } from "./product-evidence";
import { FAMILY_REQUIREMENTS, goalFeasibility, type Environment, type HumanAction, type ShootGoal } from "./shoot-goal";

export const SLOT_PURPOSES = ["hero", "alternate_view", "detail", "scale", "in_use", "worn", "context", "campaign", "packaging", "set_overview"] as const;
export type SlotPurpose = (typeof SLOT_PURPOSES)[number];

/** Physical camera relationship to the product. A tighter crop of the same view is NOT another view. */
export const CAMERA_VIEWS = ["front", "three_quarter_left", "three_quarter_right", "side", "back", "top_down", "low_angle", "detail", "macro", "full_body", "half_body", "body_crop"] as const;
export type CameraView = (typeof CAMERA_VIEWS)[number];
export const FRAMINGS = ["full", "medium", "close", "macro"] as const;
export type Framing = (typeof FRAMINGS)[number];

/** A human action is only possible if the product affords it: a vehicle cannot be held, fabric cannot be worn. */
const IMPLIED_TRANSFORMATION: Partial<Record<HumanAction, Transformation>> = { model_wearing: "wear", hands_holding: "hold", model_holding: "hold", hands_using: "hold", model_using: "hold" };

/** Views that expose a product face the front photo cannot prove. */
const VIEW_NEEDS_SOURCE: Partial<Record<CameraView, string[]>> = { back: ["back"], side: ["side", "angle"], three_quarter_left: ["angle", "side"], three_quarter_right: ["angle", "side"] };

export interface SlotRequirement {
  kind: "view" | "component_state" | "transformation" | "contents";
  value: string;
  /** Asset or fact that satisfies it. Null means it is not yet evidenced. */
  evidenceId: string | null;
}

export interface Prop { item: string; justification: { factId: string } | { style: string } }

export interface ShotSlot {
  slotId: string;
  index: number;
  purpose: SlotPurpose;
  view: CameraView;
  framing: Framing;
  subject: { referenceForm: ReferenceForm; componentStates: { component: string; state: string }[] };
  humanAction: HumanAction;
  environment: Exclude<Environment, "any">;
  location: string;
  set: string;
  lighting: string;
  productProminence: "dominant" | "balanced" | "contextual";
  props: Prop[];
  /** Merchandise entities in frame; a detail crop may show only part of one. */
  entityIds: string[];
  referenceAssetIds: string[];
  requirements: SlotRequirement[];
  transformations: Transformation[];
  /** One sentence on what this photo shows that its siblings do not. */
  distinction: string;
}

export const PLAN_STATUSES = ["feasible", "needs_reference", "needs_clarification", "smaller_set_available"] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export interface ShotPlan {
  schemaVersion: typeof CONTRACT_VERSION;
  planId: string;
  revision: number;
  goalFingerprint: string;
  evidenceRevision: number;
  /** One product-specific selling idea shared by the set. */
  idea: string;
  slots: ShotSlot[];
  status: PlanStatus;
  /** When fewer distinct shots are honestly possible: the count, and what would unlock the rest. */
  feasibleQuantity?: number;
  missing: { requirement: SlotRequirement; customerAsk: string }[];
  /** Fingerprints of directions already delivered for this product, used to avoid repeats. */
  historyFingerprints: string[];
}

/** What makes two slots "the same photograph". Lighting, crop and shadow alone do not differ it. */
export function slotSignature(s: ShotSlot): string {
  return fingerprint({ view: s.view, action: s.humanAction, env: s.environment, location: s.location.trim().toLowerCase(), states: s.subject.componentStates, form: s.subject.referenceForm, purpose: s.purpose === "detail" ? s.distinction.trim().toLowerCase() : s.purpose });
}

export function planFingerprint(p: ShotPlan): string {
  return fingerprint({ idea: p.idea.trim().toLowerCase(), slots: p.slots.map(slotSignature).sort() });
}

/**
 * Validate the whole plan against the confirmed goal and the evidence. Everything here runs
 * before a quote is issued; an invalid plan must never reach paid generation.
 */
export function validatePlan(plan: ShotPlan, goal: ShootGoal, evidence: ProductEvidence): ValidationResult {
  const issues: ContractIssue[] = [];
  const at = (i: number, f = "") => `slots.${i}${f ? "." + f : ""}`;
  if (plan.schemaVersion !== CONTRACT_VERSION) issues.push({ code: "schema_version", message: "Plan was produced for another contract version.", path: "schemaVersion" });
  if (plan.goalFingerprint !== goal.fingerprint) issues.push({ code: "goal_mismatch", message: "Plan was made for a different or changed goal.", path: "goalFingerprint" });
  if (plan.evidenceRevision !== evidence.evidenceRevision) issues.push({ code: "evidence_stale", message: "Plan was made from older product evidence.", path: "evidenceRevision" });
  const feas = goalFeasibility(goal, evidence);
  if (feas.status !== "feasible" && plan.status === "feasible") issues.push({ code: "goal_infeasible", message: feas.reason, path: "status" });

  // Quantity: never pad, never silently shrink.
  const expected = plan.status === "smaller_set_available" ? plan.feasibleQuantity : goal.quantity;
  if (plan.status === "smaller_set_available" && !(plan.feasibleQuantity && plan.feasibleQuantity < goal.quantity && plan.missing.length)) issues.push({ code: "smaller_set_unexplained", message: "A smaller set must state its size and what would unlock the rest.", path: "feasibleQuantity" });
  if (plan.status === "feasible" && plan.missing.length) issues.push({ code: "feasible_with_missing", message: "A feasible plan cannot have missing requirements.", path: "missing" });
  if (["feasible", "smaller_set_available"].includes(plan.status) && plan.slots.length !== expected) issues.push({ code: "wrong_quantity", message: `Plan has ${plan.slots.length} photos; ${expected} were agreed.`, path: "slots" });

  const assets = new Set(evidence.sources.map((s) => s.assetId));
  const facts = new Set(evidence.facts.map((f) => f.factId));
  const byId = new Map(evidence.entities.map((e) => [e.entityId, e]));
  const req = goal.requirement ?? FAMILY_REQUIREMENTS[goal.family];
  const seen = new Map<string, number>();

  plan.slots.forEach((s, i) => {
    if (s.index !== i) issues.push({ code: "slot_order", message: "Slot indexes must be sequential.", path: at(i, "index") });
    // The goal's subject state applies to EVERY contracted slot (pack: "six model photos means six worn-model outputs").
    if (!req.humanActions.includes(s.humanAction)) issues.push({ code: "goal_action_violation", message: `This photo shows "${s.humanAction}", but the goal requires ${req.humanActions.join(" or ")}.`, path: at(i, "humanAction") });
    if (req.environment !== "any" && s.environment !== req.environment) issues.push({ code: "goal_environment_violation", message: `This photo is "${s.environment}", but the goal requires ${req.environment}.`, path: at(i, "environment") });
    if (s.humanAction === "model_wearing" && s.subject.referenceForm !== "worn") issues.push({ code: "worn_state_mismatch", message: "A model-wearing photo must show the product worn, not folded or flat.", path: at(i, "subject.referenceForm") });
    if (!s.distinction.trim()) issues.push({ code: "no_distinction", message: "Each photo must say what it shows that the others do not.", path: at(i, "distinction") });

    // References resolve to real sources.
    if (!s.referenceAssetIds.length) issues.push({ code: "no_reference", message: "Each photo must cite at least one source photo.", path: at(i, "referenceAssetIds") });
    for (const id of s.referenceAssetIds) if (!assets.has(id)) issues.push({ code: "unknown_asset", message: `Unknown source asset ${id}.`, path: at(i, "referenceAssetIds") });

    // Only sold merchandise is required in frame; source clutter never is (C14).
    if (!s.entityIds.length) issues.push({ code: "no_merchandise", message: "Each photo must contain the product.", path: at(i, "entityIds") });
    for (const id of s.entityIds) {
      const e = byId.get(id);
      if (!e) issues.push({ code: "unknown_entity", message: `Unknown entity ${id}.`, path: at(i, "entityIds") });
      else if (!["merchandise", "included_accessory"].includes(e.role) && !(e.role === "retail_packaging" && e.keepInPhotos) && !(e.role === "removable_tag" && e.keepInPhotos)) issues.push({ code: "clutter_as_merchandise", message: `"${e.label}" is ${e.role.replace(/_/g, " ")}, not part of the sale.`, path: at(i, "entityIds") });
    }
    // A worn garment drops a removable retail tag unless the seller asked to keep it.
    if (s.humanAction === "model_wearing") for (const e of evidence.entities) if (e.role === "removable_tag" && s.entityIds.includes(e.entityId)) issues.push({ code: "tag_on_worn", message: "Remove the retail tag in worn photos.", path: at(i, "entityIds") });

    // Every transformation used by the slot, including the one its human action implies, must be permitted by evidence (C07).
    const implied = IMPLIED_TRANSFORMATION[s.humanAction];
    for (const t of new Set([...s.transformations, ...(implied ? [implied] : [])])) {
      const p = permission(evidence, t);
      if (!p || p.status !== "supported") issues.push({ code: "unsupported_transformation", message: p?.reason || `The photos do not support "${t}".`, path: at(i, "transformations") });
    }
    // Revealing a face or a component state needs a real source showing it (C11).
    const need = VIEW_NEEDS_SOURCE[s.view];
    if (need && !evidence.sources.some((src) => need.includes(src.viewRole))) issues.push({ code: "unsupported_view", message: `A ${s.view.replace(/_/g, " ")} view needs a ${need.join(" or ")} photo.`, path: at(i, "view") });
    for (const c of s.subject.componentStates) if (!hasConfiguration(evidence, c.component, c.state)) issues.push({ code: "unsupported_configuration", message: `No source photo shows the ${c.component} ${c.state}.`, path: at(i, "subject.componentStates") });
    for (const r of s.requirements) if (!r.evidenceId || !(assets.has(r.evidenceId) || facts.has(r.evidenceId))) issues.push({ code: "unevidenced_requirement", message: `Requirement "${r.value}" has no source evidence.`, path: at(i, "requirements") });

    // Props: ingredient-style props need a fact; style props are allowed but declared.
    for (const p of s.props) if ("factId" in p.justification && !facts.has(p.justification.factId)) issues.push({ code: "unjustified_prop", message: `Prop "${p.item}" cites an unknown fact.`, path: at(i, "props") });

    const sig = slotSignature(s);
    if (seen.has(sig)) issues.push({ code: "duplicate_slot", message: `Photo ${i + 1} repeats photo ${seen.get(sig)! + 1}; a different crop or light is not a different photo.`, path: at(i) });
    else seen.set(sig, i);
  });

  if (goal.intent === "new_direction" && plan.historyFingerprints.includes(planFingerprint(plan))) issues.push({ code: "repeat_direction", message: "A new direction must not repeat a previous shoot.", path: "idea" });
  if (plan.status === "needs_reference" && !plan.missing.length) issues.push({ code: "vague_needs_reference", message: "Say exactly which photo is needed.", path: "missing" });
  return result(issues);
}
