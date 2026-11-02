import {describe,it,expect} from "vitest";
import {parseStudioPlan,studioGeometryDistinct,type StudioSlot,type StudioGeometry} from "./studio-plan";
const refs=[{id:"front",view:"front",width:1024,height:1024}];
const slots:StudioSlot[]=[{idx:0,title:"Hero",framing:"full"},{idx:1,title:"Depth",framing:"full"}];
function raw(){return {feasible:true,missingReferences:[],understanding:{form:"Rigid cylindrical container",shapeConstraints:["Tall slender body, length about three times diameter"],inventory:["one closed can"],safePoses:["upright","lying"],coverage:[{reference:1,faces:[{id:"front label",description:"Visible printed front"},{id:"top rim",description:"Visible top rim"}]}],unknowns:["rear label"],unseenSurfaces:["back"]},shots:[0,1].map((slot)=>({slot,title:slot?"Raised viewpoint":"Front label",purpose:slot?"Show actual top depth":"Identify the product",view:slot?"elevated":"front",pose:"upright",arrangement:"single-unit",azimuth:0,elevation:slot?40:5,references:[1],visibleFaces:["front label","top rim"],difference:slot?"Top ellipse deepens, front foreshortens":"Front label faces camera",feature:"",region:null,camera:"Front and rim relationship shows real depth",lighting:"Large soft key with controlled reflections"}))};}
describe("studio physical shoot preflight",()=>{
 it("accepts a product-specific supported projection change",()=>{expect(parseStudioPlan(raw(),slots,refs).plan?.shots).toHaveLength(2);});
 it("rejects six-pack padding by zoom, lighting or renamed shot title",()=>{const r=raw();r.shots[1].elevation=5;r.shots[1].title="Rim light";r.shots[1].camera="Zoom out, move product to left, long shadow";expect(parseStudioPlan(r,slots,refs).errors.join()).toContain("repeat geometry");});
 it("requires a real labelled original before showing a back",()=>{const r=raw();r.shots[1].view="back";expect(parseStudioPlan(r,slots,refs).errors.join()).toContain("actual back photograph");});
 it("blocks invented faces even when the angle is different",()=>{const r=raw();r.shots[1].visibleFaces=["rear barcode"];expect(parseStudioPlan(r,slots,refs).errors.join()).toContain("exact face IDs");});
 it("blocks detail fabricated beyond the resolution of the original",()=>{const r:Omit<ReturnType<typeof raw>,"shots">&{shots:Array<Omit<ReturnType<typeof raw>["shots"][number],"region">&{region:StudioGeometry["region"]}>}=raw();r.shots[1].region={reference:1,x:.1,y:.1,width:.05,height:.05};r.shots[1].feature="pull tab";expect(parseStudioPlan(r,[slots[0],{...slots[1],framing:"close"}],[{...refs[0],width:512,height:512}]).errors.join()).toContain("unresolved microdetail");});
 it("does not count overlapping crops of the same area as two details",()=>{const a={...raw().shots[0],region:{reference:1,x:.2,y:.2,width:.4,height:.4},feature:"closure"} as unknown as StudioGeometry;expect(studioGeometryDistinct(a,{...a,feature:"upper closure",region:{...a.region!,x:.25}})).toBe(false);});
 it("does not pad an infeasible source with generated hidden information",()=>{expect(parseStudioPlan({feasible:false,missingReferences:["clear side photo"]},slots,refs)).toMatchObject({plan:null});});
 it("requires all requested slots before permitting generation",()=>{const r=raw();r.shots.pop();expect(parseStudioPlan(r,slots,refs).plan).toBeNull();});
});

it("does not infer an entire closure from a rim visible in a front photo",()=>{
 const r=raw();r.shots[1].view="overhead";r.shots[1].elevation=80;
 expect(parseStudioPlan(r,slots,refs).errors.join()).toContain("a visible rim alone does not prove closure");
});

it("rejects an elevated oblique shot when only the front face is known",()=>{
 const r=raw();r.understanding.unseenSurfaces=["top"];r.shots[1].view="oblique";r.shots[1].elevation=35;
 expect(parseStudioPlan(r,slots,refs).errors.join()).toContain("unreferenced top");
});


it("accepts actual front and back faces at equal local camera coordinates",()=>{const r=raw();r.understanding.coverage.push({reference:2,faces:[{id:"back label",description:"Actual printed rear panel"}]});r.understanding.unseenSurfaces=[];r.shots[1]={...r.shots[1],view:"back",elevation:5,references:[1,2],visibleFaces:["back label"]};expect(parseStudioPlan(r,slots,[...refs,{id:"back",view:"back",width:1024,height:1024}]).plan?.shots).toHaveLength(2);});
it("keeps a supported shot when a second requested face is unsupported",()=>{const r=raw();r.shots[1].view="back";const result=parseStudioPlan(r,slots,refs);expect(result.plan).toBeNull();expect(result.partial?.shots.map(s=>s.idx)).toEqual([0]);expect(result.rejected?.find(s=>s.idx===1)?.errors.join()).toContain("actual back");});
it("accepts visually documented side coverage in an angle-tagged original",()=>{const r=raw();r.understanding.coverage.push({reference:2,faces:[{id:"body-side",description:"Actual lateral side profile of product"}]});r.shots[1]={...r.shots[1],view:"side",references:[1,2],visibleFaces:["body-side"]};expect(parseStudioPlan(r,slots,[...refs,{id:"angle",view:"angle",width:1024,height:1024}]).plan).not.toBeNull();});
