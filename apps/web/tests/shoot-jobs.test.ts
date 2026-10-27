import { beforeEach, describe, expect, it, vi } from "vitest";
const fakes=vi.hoisted(()=>({ job:vi.fn(), items:vi.fn(), rpc:vi.fn() }));
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
      select:()=>chain,eq:()=>chain,
      maybeSingle:async()=>({data:table==="products"?{id:"p",name:"Bag",category:"fashion",archived_at:null}:null}),
      insert:(value:unknown)=>{inserted=true;if(table==="generation_jobs")fakes.job(value);if(table==="generation_items")fakes.items(value);return chain;},
      single:async()=>({data:{id:"job-a"},error:null}),
      then:(resolve:(value:unknown)=>unknown)=>resolve({count:table==="product_assets"?1:undefined,error:null,data:inserted?{id:"job-a"}:null}),
    };return chain;
  },
})}));
import { createJob,createJobSchema } from "@/lib/jobs";
import type { AuthContext } from "@/lib/auth";
const ctx={orgId:"org-a",userId:"user-a",via:"web"} as AuthContext;
beforeEach(()=>{vi.clearAllMocks();fakes.rpc.mockResolvedValue({data:true,error:null});});
describe("canonical photographic jobs",()=>{
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
  it("rejects unrecognised photographic styles at the API schema",()=>{
    expect(createJobSchema.safeParse({productId:"11111111-1111-4111-8111-111111111111",style:"neutral_studio",shootStyle:"unknown",output:"square",count:1,idempotencyKey:"test-key-invalid"}).success).toBe(false);
  });
});
