import {expect,it,vi} from "vitest";
const f=vi.hoisted(()=>({recover:vi.fn(),artifact:vi.fn(),audit:vi.fn(),refresh:vi.fn(),claimed:true}));
vi.mock("@/lib/generation-recovery",()=>({tryRecoverFailedItem:f.recover}));
vi.mock("@/lib/qa-artifacts",()=>({recordQaArtifact:f.artifact}));
vi.mock("@/lib/jobs",()=>({refreshJobStatus:f.refresh}));
vi.mock("@/lib/supabase",()=>({admin:()=>({from:(table:string)=>{
 const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,update:()=>q,insert:(v:unknown)=>{f.audit(v);return q;},maybeSingle:async()=>({data:table==="generation_jobs"?(f.claimed?{id:"j"}:null):{storage_key:"key"}}),then:(r:(x:unknown)=>unknown)=>r({data:table==="generation_items"?[{id:"allowed",status:"failed"}]:[]})};return q;
}})}));
import {maintainQaJob} from "@/lib/qa-maintenance";
const job={id:"j",organization_id:"o",product_id:"p",created_by:null,settings:{internalQa:true,qaMaintenance:{recover:["allowed","foreign"],refresh:true}}};
it("rejects customer-created and unmarked tasks",async()=>{
 expect(await maintainQaJob({...job,created_by:"u"})).toBe(false);expect(await maintainQaJob({...job,settings:{...job.settings,internalQa:false}})).toBe(false);expect(f.recover).not.toHaveBeenCalled();
});
it("claims once and rechecks only the specified job's own saved output without generation",async()=>{
 f.recover.mockResolvedValue({recovered:true});expect(await maintainQaJob(job)).toBe(true);expect(f.recover).toHaveBeenCalledExactlyOnceWith("allowed","o");expect(f.artifact).toHaveBeenCalledOnce();expect(f.refresh).toHaveBeenCalledWith("j");expect(f.audit).toHaveBeenCalledWith(expect.objectContaining({props:expect.objectContaining({noImageGeneration:true,noCreditCharge:true})}));
 f.claimed=false;expect(await maintainQaJob(job)).toBe(false);expect(f.recover).toHaveBeenCalledOnce();
});
