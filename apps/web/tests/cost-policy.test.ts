import {describe,it,expect} from "vitest";
import {imageUsageCost,textUsageCost,selectReferences,forecastImageInr} from "@/lib/cost-policy";
describe("cost policy",()=>{
 it("separates image and text input rates instead of pricing all at image rates",()=>{expect(imageUsageCost("gpt-image-2.5-sunburst",{input_tokens:3000,input_tokens_details:{text_tokens:2000,image_tokens:1000},output_tokens:500},{default:{input:8,output:30}})).toBeCloseTo(.033);});
 it("keeps missing usage unknown",()=>{expect(imageUsageCost("gpt-image-2.5-sunburst",{}, {default:{input:8,output:30}})).toBeUndefined();expect(textUsageCost("unpriced-model",100,100)).toBeUndefined();});
 it("accounts for cached text and completion tokens",()=>{expect(textUsageCost("gpt-5-mini",1000,1000,500)).toBeCloseTo(.0021375);});
 it("selects the actual requested back/side rather than all reference photos",()=>{const r=[{view_type:"front"},{view_type:"angle"},{view_type:"back"},{view_type:"side"},{view_type:"detail"}];expect(selectReferences(r,"studio-back").map(x=>x.view_type)).toEqual(["front","back"]);expect(selectReferences(r,"studio-side").map(x=>x.view_type)).toEqual(["front","side"]);expect(selectReferences(r,"studio-detail").map(x=>x.view_type)).toEqual(["front","detail"]);});
 it("raises the forecast for extra references and longer prompts",()=>{expect(forecastImageInr("a".repeat(5000),2,95)).toBeGreaterThan(forecastImageInr("a".repeat(1000),1,95));});
});

