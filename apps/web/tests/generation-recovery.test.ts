import sharp from "sharp";
import {beforeEach,expect,it,vi} from "vitest";
const f=vi.hoisted(()=>({review:vi.fn(),patch:vi.fn(),put:vi.fn(),rpc:vi.fn(),image:Buffer.alloc(0)}));
vi.mock("@/lib/generation-review",()=>({reviewGeneratedImage:f.review}));
vi.mock("@/lib/settings",()=>({getSettings:async()=>({providers:{llm:{models:["test"]}}})}));
vi.mock("@/lib/storage",()=>({getObject:async()=>f.image,putObject:f.put}));
vi.mock("@/lib/images",()=>({thumbnail:async()=>Buffer.from("thumb")}));
vi.mock("@/lib/supabase",()=>({admin:()=>({rpc:f.rpc,from:(table:string)=>{
 let op="read",value:unknown;
 const chain={select:()=>chain,eq:()=>chain,is:()=>chain,order:()=>chain,limit:()=>chain,
 update:(v:unknown)=>{op="update";value=v;f.patch(table,v);return chain;},insert:()=>chain,
 single:async()=>({data:table==="generation_items"?{id:"item",job_id:"job",status:"failed",params:{lookId:"studio-front"}}:table==="generation_jobs"?{product_id:"p",settings:{}}:{attributes:{}},error:null}),
 maybeSingle:async()=>({data:table==="generated_assets"?{id:"a",storage_key:"old.png",watermarked:false}:{id:"item"},error:null}),
 then:(resolve:(v:unknown)=>unknown)=>resolve({data:table==="product_assets"?[{storage_key:"ref",view_type:"front"}]:value,error:null}),
 };return chain;
}})}));
import {tryRecoverFailedItem} from "@/lib/generation-recovery";
beforeEach(async()=>{vi.clearAllMocks();f.image=await sharp({create:{width:32,height:32,channels:3,background:"white"}}).png().toBuffer();});
it("restores a passing stored image under a lease without charging customer credits",async()=>{
 f.review.mockResolvedValue({verdict:{},checks:[{type:"vlm_judge",decision:"pass",score:1,details:{}}]});
 expect(await tryRecoverFailedItem("item","org")).toMatchObject({jobId:"job",recovered:true});
 expect(f.patch.mock.calls).toContainEqual(["generation_items",expect.objectContaining({status:"checking",locked_by:"saved-image-recovery",locked_until:expect.any(String)})]);
 expect(f.patch.mock.calls).toContainEqual(["generation_items",expect.objectContaining({status:"delivered",delivered_asset_id:"a"})]);
 expect(f.rpc).not.toHaveBeenCalled();
});
it("keeps a genuinely defective stored image rejected",async()=>{
 f.review.mockResolvedValue({verdict:{},checks:[{type:"product_inventory",decision:"fail",score:0,details:{}}]});
 expect(await tryRecoverFailedItem("item","org")).toBeNull();expect(f.patch).not.toHaveBeenCalled();expect(f.rpc).not.toHaveBeenCalled();
});
