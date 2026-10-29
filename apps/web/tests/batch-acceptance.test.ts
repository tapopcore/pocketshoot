import {beforeEach,describe,it,expect,vi} from "vitest";
const f=vi.hoisted(()=>({prior:[] as {id:string;product_id:string;batch_id:string}[],create:vi.fn(),insert:vi.fn(),wallet:vi.fn()}));
vi.mock("@/lib/auth",()=>({assertRole:vi.fn()}));
vi.mock("@/lib/api",()=>({handler:(fn:unknown)=>fn,body:async(req:Request,s:{parse:(x:unknown)=>unknown})=>s.parse(await req.json()),ApiError:class extends Error{constructor(public status:number,message:string){super(message);}}}));
vi.mock("@/lib/settings",()=>({getFlag:async()=>true,getSettings:async()=>({credit_policy:{creditsPerImage:2}})}));
vi.mock("@/lib/credits",()=>({getWallet:f.wallet}));
vi.mock("@/lib/jobs",()=>({createJob:f.create}));
vi.mock("@/lib/supabase",()=>({admin:()=>({from:(table:string)=>{const q={select:()=>q,eq:()=>q,in:()=>q,is:()=>q,insert:(v:unknown)=>{f.insert(v);return q;},single:async()=>({data:{id:"new-batch"}}),then:(resolve:(v:unknown)=>unknown)=>resolve({data:table==="generation_jobs"?f.prior:table==="products"?[{id:"11111111-1111-4111-8111-111111111111"}]:[]})};return q;}})}));
import {POST} from "@/app/api/batch/route";
const product="11111111-1111-4111-8111-111111111111";
const invoke=(extra={})=>(POST as unknown as (r:Request,c:unknown)=>Promise<unknown>)(new Request("https://example.com/api/batch",{method:"POST",body:JSON.stringify({name:"Catalogue",productIds:[product],pack:"studio",output:"square",countPerProduct:6,batchKey:"stable-batch-key",quotedCredits:12,...extra})}),{orgId:"org",userId:"u",via:"web"});
beforeEach(()=>{vi.clearAllMocks();f.prior=[];f.wallet.mockResolvedValue({available:20});f.create.mockResolvedValue({jobId:"job"});});
describe("batch acceptance safeguards",()=>{
 it("rejects a changed displayed price before creating a batch or image job",async()=>{await expect(invoke({quotedCredits:6})).rejects.toMatchObject({status:409});expect(f.insert).not.toHaveBeenCalled();expect(f.create).not.toHaveBeenCalled();});
 it("returns an already accepted batch even after its reservation reduced the wallet",async()=>{f.prior=[{id:"accepted",product_id:product,batch_id:"batch"}];f.wallet.mockResolvedValue({available:0});expect(await invoke()).toMatchObject({duplicate:true,results:[{jobId:"accepted"}]});expect(f.wallet).not.toHaveBeenCalled();expect(f.create).not.toHaveBeenCalled();});
 it("deduplicates product IDs before quoting and creating jobs",async()=>{await invoke({productIds:[product,product]});expect(f.create).toHaveBeenCalledTimes(1);});
});
