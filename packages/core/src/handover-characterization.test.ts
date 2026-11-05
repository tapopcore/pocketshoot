/**
 * CHARACTERIZATION TESTS (Phase 0, 5 Nov 2026).
 * Each test reproduces a defect recorded in the handover audit on production source c25eb0a.
 * They assert the CURRENT (wrong) behaviour. When the corresponding fix lands, the test must
 * fail; invert it into a corrected-behaviour regression in the same change. A pass here is a
 * reproduction, never a repair. Checklist IDs are in each title.
 */
import { describe, expect, it } from "vitest";
import { PRODUCT_COLLECTIONS, STUDIO_LOOKS, categoryLook, lookEligibility, packLooks, type ShootProfile } from "./product-looks";

const looks = PRODUCT_COLLECTIONS.flatMap((c) => c.looks);
const front = [{ view_type: "front" }];

describe("CHARACTERIZATION: catalogue and gating (C08, I01)", () => {
  it("catalogue is 7 industries, 25 collections, 126 looks, 15 studio presets", () => {
    expect(new Set(PRODUCT_COLLECTIONS.map((c) => c.category)).size).toBe(7);
    expect(PRODUCT_COLLECTIONS.length).toBe(25);
    expect(looks.length).toBe(126);
    expect(STUDIO_LOOKS.length).toBe(15);
  });
  it("68 looks state a written condition but carry none of the four structured gate flags", () => {
    const ungated = looks.filter((l) => l.condition.trim() && !l.requiresWorn && !l.requiresMultiple && !l.requiresDetail && !l.requiresContents);
    expect(ungated.length).toBe(68);
  });
  it("fragrance-3 says 'Restricted: open atomizer reference' yet a single front photo makes it eligible (C11)", () => {
    const look = categoryLook("fragrance-3")!;
    expect(look.condition).toMatch(/open atomizer/i);
    const profile: ShootProfile = { type: "fragrance", construction: "not_applicable", referenceForm: "object" };
    expect(lookEligibility(look, profile, front)).toBeNull();
  });
});

describe("CHARACTERIZATION: fashion flat-to-worn is universally blocked (C09)", () => {
  const folded: ShootProfile = { type: "mens-modern", construction: "stitched", referenceForm: "flat" };
  it("a stitched, flat menswear source is refused every model-worn look", () => {
    const worn = looks.filter((l) => l.collection === "mens-modern" && l.requiresWorn);
    expect(worn.length).toBeGreaterThan(0);
    for (const look of worn) expect(lookEligibility(look, folded, front)).toMatch(/being worn/);
  });
  it("BONKERS profile (construction and reference form unknown) is refused too", () => {
    const bonkers: ShootProfile = { type: "mens-modern", construction: "unknown", referenceForm: "unknown" };
    expect(lookEligibility(categoryLook("mens-modern-1")!, bonkers, front)).toMatch(/being worn/);
  });
});

describe("CHARACTERIZATION: Variety pack fills fixed roles, not the customer's goal (D01, D05)", () => {
  it("BONKERS-like source: six slots, and none is a worn model photograph", () => {
    const bonkers: ShootProfile = { type: "mens-modern", construction: "unknown", referenceForm: "unknown" };
    const set = packLooks("variety", bonkers, front);
    expect(set.length).toBe(6);
    expect(set.some((l) => l.human === "model")).toBe(false);
    // Generic and studio looks are pulled in to reach six.
    expect(set.some((l) => l.collection === "general" || l.collection === "studio")).toBe(true);
  });
  it("general category Variety includes a generic 'In hand' look for any object, e.g. a vehicle (C07)", () => {
    const vehicle: ShootProfile = { type: "general", construction: "not_applicable", referenceForm: "object" };
    expect(packLooks("variety", vehicle, front).some((l) => l.id === "general-3" && l.human === "hands")).toBe(true);
  });
});
