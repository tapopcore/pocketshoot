import {describe,it,expect} from "vitest";
import {PRODUCT_COLLECTIONS,COLLECTION_IDS,categoryLook,lookEligibility,inferCollection,packLooks,type ShootProfile} from "./product-looks";
describe("product-specific directions",()=>{
 it("keeps unrelated product collections separate",()=>{
  expect(inferCollection("fashion","embroidered silk saree")).toBe("saree");
  expect(inferCollection("beauty","serum bottle")).toBe("skincare");
  expect(inferCollection("home_kitchen","steel bottle")).toBe("bottle");
  const profile:ShootProfile={type:"saree",construction:"stitched",referenceForm:"worn"};
  expect(lookEligibility(categoryLook("skincare-1")!,profile,[{view_type:"front"}])).toMatch(/product type/);
 });
 it("blocks invented garment poses and missing detail references",()=>{
  const profile:ShootProfile={type:"saree",construction:"unstitched",referenceForm:"flat"};
  expect(lookEligibility(categoryLook("saree-1")!,profile,[{view_type:"front"}])).toMatch(/finished garment/);
  expect(lookEligibility(categoryLook("saree-4")!,profile,[{view_type:"front"}])).toMatch(/detail photo/);
  expect(lookEligibility(categoryLook("saree-5")!,profile,[{view_type:"front"}])).toBeNull();
 });
 it("requires evidence before food contents and movement",()=>{
  expect(lookEligibility(categoryLook("beverage-3")!,{type:"beverage",construction:"not_applicable",referenceForm:"object"},[{view_type:"front"}])).toMatch(/actual contents/);
  expect(lookEligibility(categoryLook("lehenga-5")!,{type:"lehenga",construction:"stitched",referenceForm:"worn"},[{view_type:"front"}])).toMatch(/another angle/);
 });
 it("has a dedicated reference and preservation contract for each collection",()=>{
  expect(PRODUCT_COLLECTIONS).toHaveLength(25);
  expect(new Set(PRODUCT_COLLECTIONS.flatMap(c=>c.looks.map(l=>l.id))).size).toBe(126);
  for(const c of PRODUCT_COLLECTIONS.filter(c=>c.id!=="general")){expect(c.preserve.length).toBeGreaterThan(20);expect(c.references.length).toBeGreaterThan(20);expect(c.looks.every(l=>l.atlas==="/style-atlas/"+c.id+".webp")).toBe(true);}
 });
 it("never gives an unknown product another product type's looks",()=>{
  expect(inferCollection("other","Plastic cap with carry handle")).toBe("general");
  expect(inferCollection("beauty","jar of mood cards")).toBe("general");
  expect(inferCollection("beauty","HC nail lacquer shade 48")).toBe("makeup");
  const p:ShootProfile={type:"general",construction:"not_applicable",referenceForm:"unknown"};
  expect(lookEligibility(categoryLook("general-1")!,p,[{view_type:"front"}])).toBeNull();
  expect(lookEligibility(categoryLook("skincare-1")!,p,[{view_type:"front"}])).toMatch(/product type/);
 });
 it("builds six-photo packs from looks the photos can support",()=>{
  const p:ShootProfile={type:"general",construction:"not_applicable",referenceForm:"unknown"};
  const studio=packLooks("studio",p,[{view_type:"front"}]);
  expect(studio).toHaveLength(6);
  expect(studio.every(l=>l.scene==="pure_white"&&l.human==="none")).toBe(true);
  expect(studio.some(l=>l.id==="studio-back")).toBe(false);
  expect(packLooks("studio",p,[{view_type:"front"},{view_type:"back"}]).some(l=>l.id==="studio-back")).toBe(true);
  for(const t of COLLECTION_IDS){
   const set=packLooks("variety",{type:t,construction:"unknown",referenceForm:"unknown"},[{view_type:"front"}]);
   expect(set).toHaveLength(6);
   expect(new Set(set.map(l=>l.id)).size).toBe(6);
   expect(set.every(l=>!l.requiresDetail&&!l.requiresWorn&&!l.requiresContents&&!l.requiresMultiple)).toBe(true);
  }
 });
});
