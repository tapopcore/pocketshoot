import {describe,it,expect} from "vitest";
import {packLooks,categoryLook,type ShootProfile} from "./product-looks";
import {studioDirection,studioImagePrompt} from "./studio-directions";
const profile:ShootProfile={type:"general",construction:"not_applicable",referenceForm:"object"};
describe("supported studio view contracts",()=>{
 it("offers distinct camera views and a visible detail instead of lighting-only repeats",()=>{
  const looks=packLooks("studio",profile,[{view_type:"front"}]);
  expect(looks.map(l=>l.id)).toEqual(["studio-front","studio-three-quarter","studio-high","studio-low","studio-diagonal","studio-detail"]);
  expect(new Set(looks.map(l=>studioDirection(l).camera)).size).toBe(6);
  expect(looks.some(l=>l.id==="studio-back"||l.id==="studio-side")).toBe(false);
 });
 it("does not treat a second front or detail photo as proof of a side",()=>{
  expect(packLooks("studio",profile,[{view_type:"front"},{view_type:"detail"}]).some(l=>l.id==="studio-side")).toBe(false);
  expect(packLooks("studio",profile,[{view_type:"front"},{view_type:"back"}]).some(l=>l.id==="studio-back")).toBe(true);
 });
 it("locks multi-piece inventory and assembly without inheriting source hands",()=>{
  const l=categoryLook("studio-three-quarter")!,p=studioImagePrompt(l,studioDirection(l),null,2);
  expect(p).toContain("Exactly 2 product unit(s)");expect(p).toContain("Do not add a third colour");expect(p).toContain("Remove the original hands");
  expect(studioDirection(l).camera).toContain("foreshortening");
 });
 it("allows a supported close crop without inventing hidden geometry",()=>{
  const l=categoryLook("studio-detail")!,p=studioImagePrompt(l,studioDirection(l),null);
  expect(l.framing).toBe("close");expect(p).toContain("Other units may be outside this crop");
  expect(studioDirection(l).camera).toContain("Do not expose hidden parts");
 });
});
