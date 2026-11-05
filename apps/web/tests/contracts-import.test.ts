import { it, expect } from "vitest";
import { validatePlan, fixtures } from "@packshot/core/contracts";
it("web resolves the versioned contracts through the package subpath", () => {
  expect(validatePlan(fixtures.bonkersValidPlan, fixtures.bonkersModelGoal, fixtures.bonkersEvidence).ok).toBe(true);
});
