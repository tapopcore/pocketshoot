import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/llm",()=>({jsonCall:vi.fn()}));
import { reviewChecks, reviewPrompt } from "@/lib/generation-review";
import { categoryLook, aggregate } from "@packshot/core";
const clean={same_product:true,text_changed:false,logo_changed:false,design_changed:false,colour_changed:false,shape_changed:false,extra_or_missing_items:false,artefacts:false,photographic:true,natural_anatomy:true,brief_followed:true,style_match:true,human_visible:false,framing_match:true,studio_view_match:true,environment:"studio" as const};
describe("generation screening contracts",()=>{
 it("does not confuse selling a set with physical component count",()=>{
  expect(aggregate(reviewChecks({...clean,reference_product_count:2,output_product_count:1},{recipe:categoryLook("studio-front"),analysis:{subject_count:2} as never}))).toBe("pass");
 });
 it("rejects an actual missing component even when raw counts match",()=>{
  expect(aggregate(reviewChecks({...clean,extra_or_missing_items:true,reference_product_count:1,output_product_count:1},{recipe:categoryLook("studio-front")}))).toBe("fail");
 });
 it("keeps design, text, colour, anatomy and outdoor constraints strict",()=>{
  for(const defect of [{design_changed:true},{text_changed:true},{colour_changed:true},{human_visible:true,natural_anatomy:false}])expect(aggregate(reviewChecks({...clean,...defect},{}))).toBe("fail");
  expect(aggregate(reviewChecks(clean,{selectedStyle:"outdoor"}))).toBe("fail");
 });
 it("shares the intentional crop contract with the selected view",()=>{
  expect(reviewPrompt({recipe:categoryLook("studio-detail")})).toContain("INTENTIONAL DETAIL CROP");
  expect(reviewPrompt({recipe:categoryLook("studio-front")})).toContain("Full product: preserve all supplied components");
 });
 it("fails closed on unreadable checker output",()=>expect(aggregate(reviewChecks({} as never,{}))).toBe("fail"));
});
