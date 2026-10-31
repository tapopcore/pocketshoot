import { describe, expect, it } from "vitest";
import { parseAnalysis, parseDirections, directionPrompt } from "./director";
import { categoryArtDirection, campaignPlan, photographicContract } from "./art-direction";
import { judgeDecision } from "./quality";
import { OUTPUTS, STYLES } from "./presets";
import { inferCollection } from "./product-looks";

describe("product-led campaign regressions", () => {
  it("retains first-photo inventory and worn source form", () => {
    const a = parseAnalysis({ name: "Worn nail art", category: "beauty", description: "Three worn nail designs on fingers.", subject_count: 3 }, []);
    expect(a?.subject_count).toBe(3);
    expect(a?.description).toContain("worn");
    expect(parseAnalysis({subject_count: 1.5}, [])?.subject_count).toBeUndefined();
  });
  it("does not pad missing shots or sell identical directions as different shots", () => {
    const shot={scene:"An open-air urban setting with a geometric shadow",camera:"85mm lens at product height"};
    expect(parseDirections({shots:[shot]},2)).toBeNull();
    expect(parseDirections({shots:[shot,shot]},2)).toBeNull();
  });
  it("plans distinct commercial roles and category-specific constraints", () => {
    expect(new Set(campaignPlan(6).split("\n")).size).toBe(6);
    expect(categoryArtDirection("fashion")).toContain("pallu");
    expect(categoryArtDirection("food")).toContain("regional preparation");
    expect(categoryArtDirection("jewellery")).toContain("stone count");
    expect(photographicContract(null)).toContain("a room beside a sunny window is indoor");
    expect(photographicContract(null)).toContain("unprinted side");
  });
  it("keeps per-shot constraints together in one campaign request", () => {
    const prompt=directionPrompt({style:STYLES.neutral_studio,output:OUTPUTS.square,count:2,analysis:null,productName:"Bottle",assignments:[{title:"In hand",brief:"Hand holds bottle",humanPresence:"hands",framing:"full",shootStyle:"model"},{title:"Outside",brief:"Open-air street",humanPresence:"none",framing:"full",shootStyle:"outdoor"}]});
    expect(prompt).toContain("ORDERED SHOT ASSIGNMENTS");
    expect(prompt).toContain("Open-air street");
    expect(prompt).toContain("CATEGORY DISCIPLINE");
  });
  it("fails confirmed changed product details in both delivery modes", () => {
    const base={same_product:true,text_changed:false,logo_changed:false,colour_changed:false,shape_changed:false,extra_or_missing_items:false,artefacts:false};
    expect(judgeDecision(base,"creative")).toBe("pass");
    for(const mode of ["preserve","creative"] as const) {
      expect(judgeDecision({...base,extra_or_missing_items:true},mode)).toBe("fail");
      expect(judgeDecision({...base,shape_changed:true},mode)).toBe("fail");
    }
  });
  it("recognises nail art and Indian dishes without a skincare or generic fallback", () => {
    expect(inferCollection("beauty","Worn nail art")).toBe("makeup");
    expect(inferCollection("food","Masala dosa with chutney")).toBe("prepared-food");
  });
});
