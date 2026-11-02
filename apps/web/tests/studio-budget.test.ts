import {it,expect} from "vitest";
import {renderPrompt} from "@/lib/render-prompt";
import {forecastImageInr} from "@/lib/cost-policy";
import {categoryLook,studioDirection,type ProductAnalysis} from "@packshot/core";
it("does not duplicate a long back-label OCR into the studio image request",()=>{
 const look=categoryLook("studio-front")!;
 const analysis={name:"Makeup spray",orientation:"upright",materials:["plastic"],visible_text:Array(500).fill("Detailed back label and instructions")} as unknown as ProductAnalysis;
 const prompt=renderPrompt({look,shot:studioDirection(look),analysis,name:"Makeup spray"});
 expect(prompt.length).toBeLessThan(3000);
 expect(forecastImageInr(prompt,2,94.95)).toBeLessThan(5);
 expect(prompt).toContain("readable printed lettering from the original images");
});