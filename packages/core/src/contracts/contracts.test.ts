import { describe, expect, it } from "vitest";
import {
  canTransition, confirmGoal, deriveVerdict, evidenceIsCurrent, fingerprint, goalFeasibility, goalIntact, presentFailure, retryAllowed, reviseGoal,
  settlementFor, stateForVerdict, validateEvidence, validateGoal, validatePlan, validateQuoteForJob, validateVerdict, FAILURE_REASONS, REVIEW_DIMENSIONS,
  type DimensionResult, type Quote, type ReviewDimension, type ReviewVerdict, type ShotPlan,
} from "./index";
import * as fx from "./fixtures";

const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

describe("ProductEvidence", () => {
  it("every fixture's evidence is structurally valid", () => {
    for (const [name, e] of Object.entries(fx.ALL_EVIDENCE)) expect(validateEvidence(e), name).toEqual({ ok: true, issues: [] });
  });
  it("rejects an ingredient guessed from colour or flavour (C03)", () => {
    expect(codes(validateEvidence(fx.beverageGuessedIngredient))).toContain("ingredient_not_evidenced");
  });
  it("rejects unstitched fabric marked as wearable (C10)", () => {
    const bad = { ...fx.unstitchedEvidence, transformations: fx.unstitchedEvidence.transformations.map((t) => t.transformation === "wear" ? { ...t, status: "supported" as const } : t) };
    expect(codes(validateEvidence(bad))).toContain("unstitched_worn");
  });
  it("rejects claims that cite no source or an unknown source (C02)", () => {
    const bad = { ...fx.bonkersEvidence, facts: [{ ...fx.bonkersEvidence.facts[0], sourceAssetIds: ["a-missing"] }, { ...fx.bonkersEvidence.facts[1], sourceAssetIds: [] }] };
    expect(codes(validateEvidence(bad))).toEqual(expect.arrayContaining(["unknown_asset", "unsourced"]));
  });
  it("cached evidence is stale when a photo is replaced or relabelled, even with the same count (C05, inverts I12)", () => {
    const e = fx.feeoEvidence;
    expect(evidenceIsCurrent(e, e.sources)).toBe(true);
    expect(evidenceIsCurrent(e, e.sources.map((s, i) => i === 2 ? { ...s, checksum: "sha256:replaced", uploadRevision: 2 } : s))).toBe(false);
    expect(evidenceIsCurrent(e, e.sources.map((s, i) => i === 3 ? { ...s, viewRole: "angle" as const } : s))).toBe(false);
  });
  it("a vague missing-reference answer is invalid: it must name the photo", () => {
    const bad = { ...fx.suvEvidence, transformations: [{ transformation: "open" as const, status: "needs_reference" as const, reason: "Need more photos" }] };
    expect(codes(validateEvidence(bad))).toContain("vague_reference_request");
  });
});

describe("ShootGoal", () => {
  it("is frozen and fingerprinted at confirmation (B06)", () => {
    const g = fx.bonkersModelGoal;
    expect(Object.isFrozen(g)).toBe(true);
    expect(goalIntact(g)).toBe(true);
    expect(() => { (g as { quantity: number }).quantity = 2; }).toThrow();
  });
  it("a tampered goal is detected", () => {
    const tampered = { ...fx.bonkersModelGoal, quantity: 2 };
    expect(goalIntact(tampered)).toBe(false);
    expect(codes(validateGoal(tampered))).toContain("goal_tampered");
  });
  it("a revision gets a new fingerprint and keeps the goal id", () => {
    const r = reviseGoal(fx.bonkersModelGoal, { quantity: 4 }, "2026-11-05T01:00:00Z");
    expect(r.revision).toBe(2);
    expect(r.goalId).toBe(fx.bonkersModelGoal.goalId);
    expect(r.fingerprint).not.toBe(fx.bonkersModelGoal.fingerprint);
    expect(goalIntact(r)).toBe(true);
  });
  it("selected additions change the fingerprint, so they cannot be dropped silently (E02)", () => {
    const g2 = fx.goal({ productId: "bonkers-tee", offering: "model_use", family: "model_worn", quantity: 6, usage: "website", selectedAdditions: [fx.untrusted("Rooftop at golden hour")] });
    expect(g2.fingerprint).not.toBe(fx.bonkersModelGoal.fingerprint);
  });
  it("offering and family must match; a model-worn goal cannot allow still lifes", () => {
    expect(codes(validateGoal({ ...fx.bonkersModelGoal, offering: "studio" }))).toContain("family_offering_mismatch");
    const diluted = confirmGoal({ ...fx.bonkersModelGoal, requirement: { humanActions: ["model_wearing", "none"], environment: "any", transformations: ["wear"] } }, "g", "t");
    expect(codes(validateGoal(diluted))).toContain("model_worn_diluted");
  });
  it("feasibility distinguishes unsupported, missing reference and confirmation (B05)", () => {
    expect(goalFeasibility(fx.bonkersModelGoal, fx.bonkersEvidence)).toEqual({ status: "feasible" });
    expect(goalFeasibility(fx.unstitchedWornGoal, fx.unstitchedEvidence)).toMatchObject({ status: "unsupported", transformation: "wear" });
    expect(goalFeasibility(fx.suvInHandGoal, fx.suvEvidence)).toMatchObject({ status: "unsupported", transformation: "hold" });
    const apply = fx.goal({ productId: "feeo-spray", offering: "model_use", family: "product_in_use", quantity: 1, requirement: { humanActions: ["model_using"], environment: "any", transformations: ["apply"] } });
    expect(goalFeasibility(apply, fx.feeoEvidence)).toMatchObject({ status: "needs_confirmation", question: expect.stringMatching(/face/) });
  });
});

describe("ShotPlan", () => {
  it("BONKERS: six distinct model-worn photos from a folded front photo are a valid plan (inverts I2/I3 at contract level)", () => {
    expect(validatePlan(fx.bonkersValidPlan, fx.bonkersModelGoal, fx.bonkersEvidence)).toEqual({ ok: true, issues: [] });
  });
  it("BONKERS: the plan production actually ran fails the model-worn contract on every slot", () => {
    const r = validatePlan(fx.bonkersRecordedPlan, fx.bonkersModelGoal, fx.bonkersEvidence);
    expect(r.issues.filter((i) => i.code === "goal_action_violation").length).toBe(6);
    expect(codes(r)).toContain("clutter_as_merchandise"); // green garment demanded in frame (I4)
  });
  it("BONKERS: a retail tag is dropped from worn photos", () => {
    const p: ShotPlan = { ...fx.bonkersValidPlan, slots: fx.bonkersValidPlan.slots.map((s, i) => i === 0 ? { ...s, entityIds: ["product", "hang-tag"] } : s) };
    expect(codes(validatePlan(p, fx.bonkersModelGoal, fx.bonkersEvidence))).toEqual(expect.arrayContaining(["tag_on_worn", "clutter_as_merchandise"]));
  });
  it("BONKERS: a back view is refused without a back photo; the stitched shirt with one is allowed", () => {
    const p: ShotPlan = { ...fx.bonkersValidPlan, slots: fx.bonkersValidPlan.slots.map((s, i) => i === 5 ? { ...s, view: "back" } : s) };
    expect(codes(validatePlan(p, fx.bonkersModelGoal, fx.bonkersEvidence))).toContain("unsupported_view");
    expect(validatePlan(fx.flatShirtPlan, fx.flatShirtGoal, fx.flatShirtEvidence).ok).toBe(true);
  });
  it("FEEO: the exposed spray-head detail needs the actual uncapped photo (inverts the front-only atomizer gap, I5/I7)", () => {
    expect(validatePlan(fx.feeoStudioPlan, fx.feeoStudioGoal, fx.feeoEvidence).ok).toBe(true);
    const stale = validatePlan(fx.feeoStudioPlan, fx.feeoStudioGoal, fx.feeoNoNozzleEvidence);
    expect(codes(stale)).toEqual(expect.arrayContaining(["evidence_stale", "unsupported_configuration", "unknown_asset"]));
  });
  it("FEEO: a background bottle is never required merchandise", () => {
    const p: ShotPlan = { ...fx.feeoStudioPlan, slots: fx.feeoStudioPlan.slots.map((s, i) => i === 0 ? { ...s, entityIds: ["product", "second-can"] } : s) };
    expect(codes(validatePlan(p, fx.feeoStudioGoal, fx.feeoEvidence))).toContain("clutter_as_merchandise");
  });
  it("pens: three diagonals that differ only by lighting are duplicates, not three views", () => {
    const r = validatePlan(fx.pensPaddedPlan, fx.pensGoal, fx.pensEvidence);
    expect(r.issues.filter((i) => i.code === "duplicate_slot").length).toBe(2);
  });
  it("studio goal rejects a photo with people in it", () => {
    const p: ShotPlan = { ...fx.feeoStudioPlan, slots: fx.feeoStudioPlan.slots.map((s, i) => i === 0 ? { ...s, humanAction: "hands_holding" } : s) };
    expect(codes(validatePlan(p, fx.feeoStudioGoal, fx.feeoEvidence))).toContain("goal_action_violation");
  });
  it("beverage: a flavour fact justifies watermelon props; an unknown fact does not", () => {
    expect(validatePlan(fx.beveragePlan("f-flavour"), fx.beverageGoal, fx.beverageEvidence).ok).toBe(true);
    expect(codes(validatePlan(fx.beveragePlan("f-orange"), fx.beverageGoal, fx.beverageEvidence))).toContain("unjustified_prop");
  });
  it("quantity: never padded, never silently shrunk; a smaller set must say what unlocks the rest (D10)", () => {
    const short: ShotPlan = { ...fx.bonkersValidPlan, slots: fx.bonkersValidPlan.slots.slice(0, 4) };
    expect(codes(validatePlan(short, fx.bonkersModelGoal, fx.bonkersEvidence))).toContain("wrong_quantity");
    const unexplained: ShotPlan = { ...short, status: "smaller_set_available", feasibleQuantity: 4 };
    expect(codes(validatePlan(unexplained, fx.bonkersModelGoal, fx.bonkersEvidence))).toContain("smaller_set_unexplained");
    const honest: ShotPlan = { ...unexplained, missing: [{ requirement: { kind: "view", value: "back", evidenceId: null }, customerAsk: "Add a photo of the back of the shirt." }] };
    expect(validatePlan(honest, fx.bonkersModelGoal, fx.bonkersEvidence).ok).toBe(true);
  });
  it("a campaign cannot smuggle in an action the product does not afford (SUV held, fabric worn)", () => {
    const suvCampaign = fx.goal({ productId: "white-suv", offering: "campaign", family: "campaign", quantity: 1 });
    const p: ShotPlan = { ...fx.bonkersValidPlan, planId: "suv", goalFingerprint: suvCampaign.fingerprint, slots: [{ ...fx.bonkersValidPlan.slots[0], humanAction: "hands_holding", subject: { referenceForm: "object", componentStates: [] }, transformations: [] }] };
    expect(codes(validatePlan(p, suvCampaign, fx.suvEvidence))).toContain("unsupported_transformation");
    const fabricCampaign = fx.goal({ productId: "unstitched-suit", offering: "campaign", family: "campaign", quantity: 1 });
    const q: ShotPlan = { ...p, planId: "fab", goalFingerprint: fabricCampaign.fingerprint, slots: [{ ...fx.bonkersValidPlan.slots[0], transformations: [] }] };
    expect(codes(validatePlan(q, fabricCampaign, fx.unstitchedEvidence))).toContain("unsupported_transformation");
  });
  it("confirming a goal never freezes the caller's own objects", () => {
    const additions = [fx.untrusted("Rooftop")];
    fx.goal({ productId: "p", offering: "studio", family: "product_only_catalogue", quantity: 1, selectedAdditions: additions });
    expect(Object.isFrozen(additions)).toBe(false);
  });
  it("a plan for an unsupported goal cannot be marked feasible", () => {
    const p = { ...fx.bonkersValidPlan, planId: "x", goalFingerprint: fx.suvInHandGoal.fingerprint, evidenceRevision: 1, slots: [] };
    expect(codes(validatePlan(p, fx.suvInHandGoal, fx.suvEvidence))).toContain("goal_infeasible");
  });
});

describe("ReviewVerdict", () => {
  const dims = (over: Partial<Record<ReviewDimension, DimensionResult>> = {}) => Object.fromEntries(REVIEW_DIMENSIONS.map((k) => [k, over[k] ?? { status: "pass" }])) as Record<ReviewDimension, DimensionResult>;
  const verdict = (d: Record<ReviewDimension, DimensionResult>, v = deriveVerdict(d)): ReviewVerdict => ({ schemaVersion: "2026-11-05.contracts-1", outputId: "o", attemptId: "a", slotId: "s0", goalFingerprint: fx.bonkersModelGoal.fingerprint, dimensions: d, verdict: v, nextAction: v === "accept" ? "none" : "retry", confidence: "high", reviewerModel: "fixture" });
  it("a missing required model rejects however good the photo is (E09)", () => {
    expect(deriveVerdict(dims({ goal: { status: "fail", reasonCode: "no_model", evidence: "Folded shirt, no person" } }))).toBe("reject");
  });
  it("uncertain identity goes to review, never accept (E13)", () => {
    expect(deriveVerdict(dims({ components: { status: "uncertain", evidence: "Spray head hidden by glare" } }))).toBe("review");
  });
  it("a reviewer cannot accept over a critical failure", () => {
    const v = verdict(dims({ identity: { status: "fail", evidence: "Collar silver instead of black" } }), "accept");
    expect(codes(validateVerdict(v, fx.bonkersModelGoal.fingerprint))).toContain("verdict_inconsistent");
  });
  it("failures must describe visible evidence, and verdicts bind to the goal", () => {
    const v = verdict(dims({ label: { status: "fail" } }));
    expect(codes(validateVerdict(v, "other"))).toEqual(expect.arrayContaining(["unexplained", "goal_mismatch"]));
  });
});

describe("Settlement", () => {
  it("only accepted photos are charged; review is held; failures release (F02, inverts I6)", () => {
    expect(settlementFor(stateForVerdict("accept"))).toBe("capture");
    expect(settlementFor(stateForVerdict("review"))).toBe("hold");
    expect(settlementFor(stateForVerdict("reject"))).toBe("release");
    expect(settlementFor("superseded")).toBeNull();
  });
  it("state machine forbids skipping the check or re-settling", () => {
    expect(canTransition("generating", "accepted")).toBe(false);
    expect(canTransition("checking", "accepted")).toBe(true);
    expect(canTransition("accepted", "failed")).toBe(false);
    expect(canTransition("superseded", "accepted")).toBe(false);
  });
  it("each failure reason has its own message, and budget is never described as a product defect (E14)", () => {
    const messages = new Set(FAILURE_REASONS.map((r) => presentFailure(r).message));
    expect(messages.size).toBe(FAILURE_REASONS.length);
    expect(presentFailure("budget_guard").message).not.toMatch(/product|photo came out/i);
    expect(presentFailure("wrong_product", "The spray head changed shape.").message).toContain("spray head");
  });
  it("retry is offered only where it can help, and is bounded", () => {
    expect(retryAllowed("missing_reference", 0)).toBe(false);
    expect(retryAllowed("budget_guard", 0)).toBe(false);
    expect(retryAllowed("provider_transient", 0)).toBe(true);
    expect(retryAllowed("wrong_product", 3)).toBe(false);
  });
});

describe("Quote", () => {
  const q = (over: Partial<Quote> = {}): Quote => ({ schemaVersion: "2026-11-05.contracts-1", quoteId: "q", version: 1, productId: "bonkers-tee", goalFingerprint: fx.bonkersModelGoal.fingerprint, evidenceRevision: 1, planId: fx.bonkersValidPlan.planId, planRevision: 1, slots: 6, creditsPerSlot: 1, totalCredits: 6, resolution: { model: "m", quality: "medium", nativeLongEdge: 1024, deliveredLongEdge: 2048 }, issuedAt: "2026-11-05T00:00:00Z", expiresAt: "2026-11-05T00:30:00Z", ...over });
  const now = new Date("2026-11-05T00:10:00Z");
  it("a current quote for a valid plan passes", () => {
    expect(validateQuoteForJob(q(), fx.bonkersModelGoal, fx.bonkersEvidence, fx.bonkersValidPlan, 10, now)).toEqual({ ok: true, issues: [] });
  });
  it("is invalid after expiry, goal change, evidence change, or with too few credits (B04)", () => {
    const changed = reviseGoal(fx.bonkersModelGoal, { aspectRatio: "1:1" }, "t");
    const r = validateQuoteForJob(q(), changed, { ...fx.bonkersEvidence, evidenceRevision: 2 }, fx.bonkersValidPlan, 3, new Date("2026-11-05T01:00:00Z"));
    expect(codes(r)).toEqual(expect.arrayContaining(["quote_expired", "goal_changed", "evidence_changed", "insufficient_credits"]));
  });
  it("cannot be issued for the plan production ran on BONKERS", () => {
    expect(validateQuoteForJob(q({ planId: fx.bonkersRecordedPlan.planId }), fx.bonkersModelGoal, fx.bonkersEvidence, fx.bonkersRecordedPlan, 10, now).ok).toBe(false);
  });
});

describe("UI fixtures (B10)", () => {
  it("result summary is derived from the tiles", () => {
    expect(fx.jobResultFixture.summary).toEqual({ accepted: 1, review: 1, failed: 3, inProgress: 1, charged: 1 });
    expect(fx.jobResultFixture.items.find((i) => i.state === "review")!.credit).toBe("held");
  });
  it("fingerprint is stable across key order", () => {
    expect(fingerprint({ a: 1, b: [1, 2] })).toBe(fingerprint({ b: [1, 2], a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
});
