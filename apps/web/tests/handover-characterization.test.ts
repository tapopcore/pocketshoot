/**
 * CHARACTERIZATION TESTS (Phase 0, 5 Nov 2026), production source c25eb0a.
 * Each test reproduces a recorded defect and asserts the CURRENT (wrong) behaviour.
 * When the fix lands this test must fail; invert it into a corrected-behaviour regression
 * in the same change. A pass here is a reproduction, never a repair.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/llm", () => ({ jsonCall: vi.fn() }));
import { aggregate, categoryLook, commissionFor, parseAnalysis, studioDirection, type ShotDirection } from "@packshot/core";
import { renderPrompt } from "@/lib/render-prompt";
import { humanActionProblem } from "@/lib/direction-validation";

const analysis = parseAnalysis({ name: "Gold choker", category: "jewellery", materials: ["gold coloured metal"], description: "Floral choker and two earrings", visible_text: [] }, [])!;
const c = commissionFor({ analysis, look: { human: "model", environment: "indoor", framing: "full", directionRole: "human-detail" }, edition: 1, slot: 1 });
const commissionShot = { product_scale: .6, offset_x: 0, baseline: .8, scene: "Selective light on a real choker against a deep tonal field", lighting: "Selective lateral light", camera: "A deliberate product-body crop", framing: "full", human_presence: "model", artDirection: { commission: c, idea: "Metal relief meets real skin", fact_ids: [], mechanism: "intimate-human-detail", product_role: "Worn choker set", light_design: "Selective side key with negative fill", camera_design: "Close body composition", styling: "Controlled tonal background", gesture: "Hand rests below collarbone", finish: "Natural skin and matte gold", ingredient_props: [] } } as ShotDirection;
const ADDITION = "Fresh marigold petals";
const src = (p: string) => readFileSync(path.resolve(__dirname, "../src", p), "utf8");

describe("CHARACTERIZATION: selected additions are dropped on live render paths (E01, E02)", () => {
  it("legacy path (no art direction) includes SELECTED ADDITIONS", () => {
    const p = renderPrompt({ look: { id: "necklace-3", title: "Portrait", brief: "Wear the set", human: "model", environment: "indoor" }, shot: { ...commissionShot, artDirection: undefined }, analysis, name: analysis.name, suggestions: [ADDITION] });
    expect(p).toContain(ADDITION);
  });
  it("commission path (every new campaign shot) silently omits them", () => {
    const p = renderPrompt({ look: { id: "necklace-3", title: "Portrait", brief: "Wear the set", human: "model", environment: "indoor" }, shot: commissionShot, analysis, name: analysis.name, suggestions: [ADDITION] });
    expect(p).toContain("AUTHORITATIVE PHOTOGRAPHIC COMMISSION");
    expect(p).not.toContain(ADDITION);
  });
  it("studio path silently omits them", () => {
    const look = categoryLook("studio-front")!;
    const p = renderPrompt({ look, shot: studioDirection(look), analysis, name: analysis.name, suggestions: [ADDITION] });
    expect(p).not.toContain(ADDITION);
  });
  it("selectedShotContract exists and is tested in isolation but no live module imports it", () => {
    const users = ["lib/pipeline.ts", "lib/render-prompt.ts", "lib/prep.ts", "lib/jobs.ts", "lib/generation-review.ts"].filter((f) => src(f).includes("selectedShotContract"));
    expect(users).toEqual([]);
  });
});

describe("CHARACTERIZATION: human-action validation is word matching (E08)", () => {
  const still = (scene: string) => ({ scene, artDirection: { styling: "", gesture: "" } }) as unknown as ShotDirection;
  it("'handbag' satisfies a required hand interaction", () => {
    expect(humanActionProblem(still("A leather handbag resting on a marble plinth"), "hands")).toBeNull();
  });
  it("a product-only still life without that word is correctly rejected (control)", () => {
    expect(humanActionProblem(still("A leather tote resting on a marble plinth"), "hands")).not.toBeNull();
  });
});

describe("CHARACTERIZATION: review outcomes are captured as deliveries (F01, F02, B09)", () => {
  it("aggregate returns 'review' for an inconclusive check, and the delivery path does not branch on it", () => {
    expect(aggregate([{ type: "vlm_judge", score: null, decision: "review", details: {} }])).toBe("review");
    const pipeline = src("lib/pipeline.ts");
    const deliver = pipeline.slice(pipeline.indexOf('if (decision === "fail")'));
    // After the fail branch, the next settlement call captures credit for any non-fail decision.
    expect(deliver).toMatch(/status: "delivered", decision[\s\S]*?settle_item", \{ p_item: item\.id, p_capture: true \}/);
  });
});

describe("CHARACTERIZATION: plan metadata and fallback (D01, E08, D05)", () => {
  const prep = src("lib/prep.ts");
  it("director output framing and human presence are overwritten by the assignment before validation", () => {
    expect(prep).toMatch(/framing: input\.assignments\?\.\[index\]\?\.framing \?\? input\.framing \?\? "full", human_presence/);
  });
  it("after two invalid plans the job silently falls back to rule-based generic directions", () => {
    expect(prep).toMatch(/Shot plan failed count, distinctness or selected-style validation[\s\S]{0,120}return fallback\(\)/);
  });
  it("cached product analysis is reused when a photo is replaced or relabelled (same count and version) (C05)", () => {
    expect(prep).toMatch(/creative_version === CREATIVE_VERSION && \(attrs\.analysis\.photo_count \?\? 1\) === refs\.length\) return attrs\.analysis/);
    expect(prep).not.toMatch(/checksum|content_hash|sha256/i);
  });
  it("studio job submission always sends mode 'preserve' (no customer outcome field)", () => {
    expect(src("app/app/new/studio.tsx")).toMatch(/mode: "preserve"/);
  });
});
