import { describe, expect, it } from "vitest";
import { analysisPrompt, CREATIVE_VERSION, directionPrompt, fallbackDirections, parseAnalysis } from "./director";
import { buildPrompt } from "./prompts";
import { OUTPUTS, STYLES } from "./presets";

const raw = {
  name: "Amber serum", category: "beauty", description: "Amber glass bottle with a paper label.",
  materials: ["glass", "paper"], colours: ["#a86523"], visible_text: ["SERUM"], size: "small",
  orientation: "standing", viewpoint: "front", key_ingredients: [], suggested_scenes: ["neutral_studio"],
  photo_issues: [], label_legibility: 0.8, use_case: "A labelled facial cosmetic.",
  audience: "A skincare buyer", visual_strategy: "Reveal the amber glass through transmitted light.",
  usage_confidence: "observed",
  ideas: [
    { title: "Amber light", description: "Amber glass throws a warm caustic onto green stone.", base_scene: "neutral_studio", purpose: "hero", why: "Shows the glass clearly.", human_presence: "none" },
    { title: "Morning ritual", description: "An adult holds the closed bottle naturally at a window.", base_scene: "neutral_studio", purpose: "human", why: "Shows believable scale and use.", human_presence: "hands" },
    { title: "Paper and glass", description: "Raking light reveals the label texture against linen.", base_scene: "neutral_studio", purpose: "detail", why: "Makes the materials tangible.", human_presence: "none" },
  ],
};
describe("product-led creative direction", () => {
  it("retains use, rationale and human choices while refreshing the analysis version", () => {
    const a = parseAnalysis(raw, ["neutral_studio"])!;
    expect(a.creative_version).toBe(CREATIVE_VERSION);
    expect(a.ideas.map(i => i.purpose)).toEqual(["hero", "human", "detail"]);
    expect(a.ideas[1].human_presence).toBe("hands");
    expect(a.use_case).toBe(raw.use_case);
    expect(a.key_ingredients).toEqual([]);
  });
  it("does not infer a human-use interaction for an unidentified product", () => {
    const a = parseAnalysis({ ...raw, usage_confidence: "unknown" }, ["neutral_studio"])!;
    expect(a.ideas.every(i => i.human_presence === "none")).toBe(true);
  });
  it("bounds malformed model output and rejects invalid human modes", () => {
    const a = parseAnalysis({ ...raw, ideas: Array(8).fill({ ...raw.ideas[0], human_presence: "celebrity", base_scene: "missing" }) }, ["neutral_studio"])!;
    expect(a.ideas).toHaveLength(3);
    expect(a.ideas[0].human_presence).toBe("none");
    expect(a.ideas[0].base_scene).toBe("neutral_studio");
    expect(parseAnalysis("broken JSON", [])).toBeNull();
  });
  it("keeps a human brief in fallback direction and the final prompt without a contradictory ban", () => {
    const a = parseAnalysis(raw, ["neutral_studio"])!;
    const input = { style: STYLES.neutral_studio, output: OUTPUTS.square, count: 1, analysis: a, productName: a.name, brief: raw.ideas[1].description, humanPresence: "hands" as const };
    const shot = fallbackDirections(input)[0];
    expect(shot.human_presence).toBe("hands");
    expect(directionPrompt(input)).toContain("HUMAN DIRECTION: hands");
    const prompt = buildPrompt({ mode: "preserve", category: "beauty", productName: a.name, locks: [], style: "neutral_studio", output: "square", analysis: a, direction: shot });
    expect(prompt.text).toContain("anonymous adult interaction");
    expect(prompt.text).not.toContain("- No people or hands.");
    expect(prompt.text).toContain("SERUM");
  });
  it("keeps static photography free of unwanted people", () => {
    const prompt = buildPrompt({ mode: "preserve", category: "beauty", productName: "Serum", locks: [], style: "neutral_studio", output: "square" });
    expect(prompt.text).toContain("- No people or hands.");
    expect(analysisPrompt(["neutral_studio"])).toContain("EXACTLY THREE DIRECTIONS");
  });
});
