import {describe,it,expect} from "vitest";
import {PRODUCT_COLLECTIONS,categoryLook,lookEligibility,inferCollection,type ShootProfile} from "./product-looks";
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
  expect(PRODUCT_COLLECTIONS).toHaveLength(24);
  expect(new Set(PRODUCT_COLLECTIONS.flatMap(c=>c.looks.map(l=>l.id))).size).toBe(120);
  for(const c of PRODUCT_COLLECTIONS){expect(c.preserve.length).toBeGreaterThan(20);expect(c.references.length).toBeGreaterThan(20);expect(c.looks.every(l=>l.atlas==="/style-atlas/"+c.id+".webp")).toBe(true);}
 });
});
