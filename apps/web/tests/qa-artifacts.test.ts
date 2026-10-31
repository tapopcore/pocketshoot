import {it,expect,vi} from "vitest";
const f=vi.hoisted(()=>({signed:vi.fn(async()=>"temporary-object-url"),insert:vi.fn()}));
vi.mock("@/lib/storage",()=>({signedUrl:f.signed}));vi.mock("@/lib/supabase",()=>({admin:()=>({from:()=>({insert:f.insert})})}));
import {recordQaArtifact} from "@/lib/qa-artifacts";
it("never signs diagnostic links for ordinary customer jobs",async()=>{await recordQaArtifact({id:"j",organization_id:"o",product_id:"p",created_by:"user",settings:{internalQa:true}},"i","key");await recordQaArtifact({id:"j",organization_id:"o",product_id:"p",created_by:null,settings:{}},"i","key");expect(f.signed).not.toHaveBeenCalled();});
it("uses short-lived links only for explicitly internal backend QA jobs",async()=>{await recordQaArtifact({id:"j",organization_id:"o",product_id:"p",created_by:null,settings:{internalQa:true}},"i","key");expect(f.signed).toHaveBeenCalledWith("outputs","key",600);expect(f.insert).toHaveBeenCalledWith(expect.objectContaining({name:"internal_qa_artifact"}));});
