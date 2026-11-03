import {describe,it,expect} from "vitest";
import {campaignIntent,commissionFor,commissionPrompt,referenceLessons,campaignPlanningPrompt} from "./campaign-direction";
import {packLooks,COLLECTION_IDS,type ShootProfile} from "./product-looks";
import type {ProductAnalysis} from "./director";
const analysis={category:"jewellery",description:"Antique gold choker",materials:["gold-coloured metal"],visible_text:[],key_ingredients:[]} as ProductAnalysis;
const look={human:"none",environment:"indoor",framing:"full",directionRole:"graphic"} as const;
describe("product-specific commissions",()=>{
 it("keeps studio white and inventory-readable",()=>{const c=commissionFor({analysis,look:{...look,environment:"studio"},edition:1,slot:0});expect(c.tone).toBe("white");expect(commissionPrompt(c)).toContain("seamless-white");});
 it("does not impose a colour-wheel palette or one of three poses on any edition",()=>{for(let edition=0;edition<20;edition++){const c=commissionFor({analysis,look:{...look,human:"model"},edition,slot:0});expect(c.paletteName).toBeUndefined();expect(c.paletteHue).toBeUndefined();expect(c.light).toBe("product-directed");expect(c.composition).toBe("product-directed");expect(c.humanDirection).toContain("vary from supplied recent history");}});
 it("retains explicit customer direction",()=>{const c=commissionFor({analysis,look,edition:2,slot:0,customerNotes:"Pale pink daylight",palette:["#ffddee"]});expect(c.light).toBe("client-directed");expect(c.tone).toBe("client-directed");});
 it("separates a body-detail purpose from a wearable portrait",()=>{const c=commissionFor({analysis,look:{...look,human:"model",directionRole:"human-detail"},edition:1,slot:0});expect(c.composition).toBe("product-body-crop");expect(commissionPrompt(c)).toContain("not another head-and-shoulders portrait");});
 it("does not prescribe activation of unseen mechanisms",()=>{expect(campaignPlanningPrompt(analysis,"hands",false,"indoor")).toContain("mechanism/contents are not visible");});
 it("uses category-specific craft principles",()=>{expect(referenceLessons({...analysis,category:"fashion"},"footwear")).toContain("stance");expect(referenceLessons({...analysis,category:"fashion"})).toContain("motif placement");expect(referenceLessons({...analysis,category:"beauty"})).toContain("vitamin C is not orange");});
 it("preserves six eligible customer purposes across collections",()=>{for(const type of COLLECTION_IDS){const p:ShootProfile={type,construction:"unknown",referenceForm:"unknown"};const pack=packLooks("variety",p,[{view_type:"front"}]);expect(pack).toHaveLength(6);expect(new Set(pack.map(l=>l.id)).size).toBe(6);}});
 it("does not pass catalogue example scenery into campaign intent",()=>{const intent=campaignIntent({...look,title:"Outdoor",environment:"outdoor"},"context");expect(intent).toContain("genuinely outdoor");expect(intent).not.toContain("warm stone");});
});
