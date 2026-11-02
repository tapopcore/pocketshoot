import { beforeEach, describe, expect, it, vi } from "vitest";
const fakes=vi.hoisted(()=>({ job:vi.fn(), items:vi.fn(), rpc:vi.fn(), views:[{view_type:"front"}], parent:null as Record<string,unknown>|null, product:null as Record<string,unknown>|null }));
vi.mock("@/lib/auth",()=>({assertRole:vi.fn()}));
vi.mock("@/lib/api",()=>({ApiError:class extends Error{constructor(public status:number,message:string){super(message);}}}));
vi.mock("@/lib/credits",()=>({isTrialOrg:async()=>false}));
vi.mock("@/lib/settings",()=>({getFlag:async()=>true,getSettings:async()=>({credit_policy:{maxImagesPerJob:4,trialWatermark:false,creditsPerImage:2}})}));
vi.mock("@/lib/observe",()=>({audit:vi.fn(),track:vi.fn(),rateLimit:async()=>true}));
vi.mock("@/lib/env",()=>({env:{cronSecret:""}}));
vi.mock("next/server",()=>({after:vi.fn()}));
vi.mock("@/lib/supabase",()=>({admin:()=>({
  rpc:fakes.rpc,
  from:(table:string)=>{
    let inserted=false;
    const chain={
      select:()=>chain,eq:()=>chain,neq:()=>chain,
      maybeSingle:async()=>({data:table==="products"?fakes.product??{id:"p",name:"Bag",category:"fashion",archived_at:null}:table==="generated_assets"?fakes.parent:null}),
      insert:(value:unknown)=>{inserted=true;if(table==="generation_jobs")fakes.job(value);if(table==="generation_items")fakes.items(value);return chain;},
      single:async()=>({data:{id:"job-a"},error:null}),
      then:(resolve:(value:unknown)=>unknown)=>resolve({count:table==="product_assets"?1:undefined,error:null,data:inserted?{id:"job-a"}:table==="product_assets"?fakes.views:null}),
    };return chain;
  },
})}));
import { createJob,createJobSchema,editAsset } from "@/lib/jobs";
import type { AuthContext } from "@/lib/auth";
import {RECIPE_VERSION} from "@packshot/core";
const ctx={orgId:"org-a",userId:"user-a",via:"web"} as AuthContext;
beforeEach(()=>{vi.clearAllMocks();fakes.parent=null;fakes.product=null;fakes.views=[{view_type:"front"}];fakes.rpc.mockResolvedValue({data:true,error:null});});
describe("canonical photographic jobs",()=>{
  it("rejects a recipe for a different product before creating a job or holding credits",async()=>{
    fakes.product={id:"p",name:"Bag",category:"fashion",attributes:{shootProfile:{type:"bags",construction:"not_applicable",referenceForm:"object"}}};
    await expect(createJob(ctx,{productId:"p",mode:"preserve",style:"neutral_studio",recipeId:"skincare-1",recipeVersion:RECIPE_VERSION,quotedCredits:2,output:"square",count:1,idempotencyKey:"cross-category-recipe"})).rejects.toMatchObject({status:400});
    expect(fakes.job).not.toHaveBeenCalled();expect(fakes.rpc).not.toHaveBeenCalled();
  });
  it("rejects a stale price before reservation",async()=>{
    fakes.product={id:"p",name:"Bag",category:"fashion",attributes:{shootProfile:{type:"bags",construction:"not_applicable",referenceForm:"object"}}};
    await expect(createJob(ctx,{productId:"p",mode:"preserve",style:"neutral_studio",recipeId:"bags-1",recipeVersion:RECIPE_VERSION,quotedCredits:1,output:"square",count:1,idempotencyKey:"stale-price-recipe"})).rejects.toMatchObject({status:409});
    expect(fakes.job).not.toHaveBeenCalled();expect(fakes.rpc).not.toHaveBeenCalled();
  });
  it("freezes the category recipe and unit price on the accepted job",async()=>{
    fakes.product={id:"p",name:"Bag",category:"fashion",attributes:{shootProfile:{type:"bags",construction:"not_applicable",referenceForm:"object"}}};
    await createJob(ctx,{productId:"p",mode:"preserve",style:"neutral_studio",shootStyle:"indoor",recipeId:"bags-1",recipeVersion:RECIPE_VERSION,quotedCredits:2,output:"square",count:1,idempotencyKey:"accepted-recipe"});
    expect(fakes.job.mock.calls[0][0].settings).toMatchObject({recipeId:"bags-1",recipeVersion:RECIPE_VERSION,creditsPerImage:2});
    expect(fakes.items.mock.calls[0][0][0]).toMatchObject({max_attempts:1});
  });
  it("persists macro framing and reserves only the displayed image credit total",async()=>{
    await createJob(ctx,{productId:"p",mode:"preserve",style:"neutral_studio",shootStyle:"macro",output:"square",count:3,idempotencyKey:"test-key-macro"});
    expect(fakes.items.mock.calls[0][0]).toHaveLength(3);
    expect(fakes.items.mock.calls[0][0][0]).toMatchObject({params:{framing:"macro",humanPresence:"none",ideaTitle:"Macro"}});
    expect(fakes.job.mock.calls[0][0].settings).toMatchObject({shootStyle:"macro"});
    expect(fakes.rpc).toHaveBeenCalledWith("reserve_credits",{p_job:"job-a",p_quantity:6});
  });
  it("uses the server model recipe even when older scene inputs disagree",async()=>{
    await createJob(ctx,{productId:"p",mode:"preserve",style:"pure_white",shootStyle:"model",output:"portrait",count:1,idempotencyKey:"test-key-model"});
    expect(fakes.items.mock.calls[0][0][0]).toMatchObject({style:"natural_sunlight",params:{humanPresence:"model",framing:"full"}});
    expect(fakes.job.mock.calls[0][0].style).toBe("natural_sunlight");
  });
  it("blocks paid edits of historical watermarked files before creating or reserving a job",async()=>{
    fakes.parent={id:"old",product_id:"p",watermarked:true,generation_jobs:{mode:"preserve",style:"natural_sunlight",output:"square",settings:{shootStyle:"outdoor"}},generation_items:{style:"natural_sunlight"}};
    await expect(editAsset(ctx,"old","change the background","test-old-watermark")).rejects.toMatchObject({status:400});
    expect(fakes.job).not.toHaveBeenCalled(); expect(fakes.rpc).not.toHaveBeenCalled();
  });
  it("creates a studio pack of six different white-studio photos and reserves six images",async()=>{
    fakes.views=[{view_type:"front"},{view_type:"angle"}];
    fakes.product={id:"p",name:"Plastic cap",category:"other",attributes:{shootProfile:{type:"general",construction:"not_applicable",referenceForm:"unknown"}}};
    await createJob(ctx,{productId:"p",mode:"preserve",style:"pure_white",pack:"studio",recipeVersion:RECIPE_VERSION,quotedCredits:12,output:"square",count:6,idempotencyKey:"studio-pack-1"});
    const items=fakes.items.mock.calls[0][0];
    expect(items).toHaveLength(6);
    expect(new Set(items.map((i:{params:{lookId:string}})=>i.params.lookId)).size).toBe(6);
    expect(items.every((i:{style:string;params:{lookId:string;brief:string}})=>i.style==="pure_white"&&i.params.lookId.startsWith("studio-")&&/must not change/.test(i.params.brief))).toBe(true);
    expect(fakes.job.mock.calls[0][0].settings).toMatchObject({pack:"studio",recipeId:null});
    expect(fakes.rpc).toHaveBeenCalledWith("reserve_credits",{p_job:"job-a",p_quantity:12});
  });
  it("gives a photo set six different looks of the product's own type",async()=>{
    fakes.product={id:"p",name:"Bag",category:"fashion",attributes:{shootProfile:{type:"bags",construction:"not_applicable",referenceForm:"object"}}};
    await createJob(ctx,{productId:"p",mode:"preserve",style:"neutral_studio",pack:"variety",recipeVersion:RECIPE_VERSION,quotedCredits:12,output:"square",count:6,idempotencyKey:"variety-pack-1"});
    const ids=fakes.items.mock.calls[0][0].map((i:{params:{lookId:string}})=>i.params.lookId);
    expect(new Set(ids).size).toBe(6);
    expect(ids.some((id:string)=>id.startsWith("bags-"))).toBe(true);
  });
  it("refuses a pack that isn't six photos or has a stale price",async()=>{
    fakes.views=[{view_type:"front"},{view_type:"angle"}];
    fakes.product={id:"p",name:"Bag",category:"fashion",attributes:{shootProfile:{type:"bags",construction:"not_applicable",referenceForm:"object"}}};
    await expect(createJob(ctx,{productId:"p",mode:"preserve",style:"pure_white",pack:"studio",recipeVersion:RECIPE_VERSION,quotedCredits:8,output:"square",count:4,idempotencyKey:"bad-pack-1"})).rejects.toMatchObject({status:400});
    await expect(createJob(ctx,{productId:"p",mode:"preserve",style:"pure_white",pack:"studio",recipeVersion:RECIPE_VERSION,quotedCredits:6,output:"square",count:6,idempotencyKey:"bad-pack-2"})).rejects.toMatchObject({status:409});
    expect(fakes.job).not.toHaveBeenCalled();
  });
  it("rejects unrecognised photographic styles at the API schema",()=>{
    expect(createJobSchema.safeParse({productId:"11111111-1111-4111-8111-111111111111",style:"neutral_studio",shootStyle:"unknown",output:"square",count:1,idempotencyKey:"test-key-invalid"}).success).toBe(false);
  });
  it("creates a supported six-composition studio pack from a single front",async()=>{
    await expect(createJob(ctx,{productId:"p",mode:"preserve",style:"pure_white",pack:"studio",recipeVersion:RECIPE_VERSION,quotedCredits:12,output:"square",count:6,idempotencyKey:"supported-pack"})).resolves.toMatchObject({jobId:"job-a"});
    const items=fakes.items.mock.calls[0][0];expect(items).toHaveLength(6);
    expect(items.some((i:{params:{lookId:string}})=>["studio-side","studio-back","studio-high"].includes(i.params.lookId))).toBe(false);
  });

});

it("preserves a failed pack slot's planned geometry and reference selection before the worker starts",async()=>{
 fakes.product={id:"p",name:"Cartridge",category:"other",attributes:{shootProfile:{type:"general",construction:"not_applicable",referenceForm:"object"}}};
 const shot={scene:"Known box and cartridge",camera:"Standing cartridge beside box",lighting:"Soft white studio",framing:"full",human_presence:"none",product_scale:.74,offset_x:0,baseline:.82,studio:{version:"2026-11-02.geometry-4",title:"Standing pose",purpose:"Show height",view:"elevated",pose:"upright",arrangement:"box-beside-standing-cartridge",azimuth:30,elevation:25,references:[1],visibleFaces:["box-front","cartridge-barrel"],difference:"Cartridge stands on its actual end",feature:"",region:null}} as import("@packshot/core").ShotDirection;
 await createJob(ctx,{productId:"p",mode:"preserve",style:"pure_white",recipeId:"studio-pose",recipeVersion:RECIPE_VERSION,quotedCredits:2,output:"square",count:1,idempotencyKey:"retry-studio-slot"},{studioRetry:{shot,referenceIds:["source-front"],packJobId:"original-pack",slotItemId:"original-slot"}});
 expect(fakes.items.mock.calls[0][0][0].params).toMatchObject({shot,shotSource:"studio-v3",studioReferenceIds:["source-front"],studioPackJobId:"original-pack",studioSlotItemId:"original-slot"});
 expect(fakes.job.mock.calls[0][0].settings).toMatchObject({studioPackJobId:"original-pack"});
});
