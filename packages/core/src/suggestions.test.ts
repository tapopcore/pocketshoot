import { describe, expect, it } from "vitest";
import { parseAnalysis, parseSuggestions, photoSetPrompt } from "./director";

describe("written shoot ideas", () => {
  it("keeps valid ideas with stable ids and drops junk", () => {
    const out = parseSuggestions([
      { kind: "props", title: "Fresh peach slices", text: "Scatter a few peach slices around the bottle." },
      { kind: "props", title: "Fresh peach slices", text: "Duplicate should be dropped from the list." },
      { kind: "laser", title: "Bad kind", text: "This kind is not allowed at all." },
      { kind: "angle", title: "", text: "Missing title is dropped." },
      { kind: "mood", title: "Bright summer", text: "short" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "props-fresh-peach-slices", kind: "props" });
  });
  it("caps the list at eight and survives non-arrays", () => {
    expect(parseSuggestions("nope")).toEqual([]);
    const many = Array.from({ length: 12 }, (_, i) => ({ kind: "setting", title: `Setting number ${i}`, text: "A plain sentence about the setting." }));
    expect(parseSuggestions(many)).toHaveLength(8);
  });
  it("is carried through product analysis", () => {
    const a = parseAnalysis({ name: "Tea", category: "food", suggestions: [{ kind: "detail", title: "Cold droplets", text: "Show cold droplets on the glass." }] }, ["neutral_studio"]);
    expect(a?.suggestions?.[0].title).toBe("Cold droplets");
  });
  it("describes a multi-photo set as one product", () => {
    expect(photoSetPrompt(["front"])).toBe("");
    const p = photoSetPrompt(["front", "back", "detail"]);
    expect(p).toContain("3 photos of ONE product");
    expect(p).toContain("photo 2 = back view");
  });
});
