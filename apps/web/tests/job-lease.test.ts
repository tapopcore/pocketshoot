import {beforeEach,it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({settings:{customerOption:"keep"} as Record<string,unknown>}));
vi.mock("@/lib/supabase",()=>({admin:()=>({from:()=>{
 const filters:Record<string,unknown>={};let patch:Record<string,unknown>|null=null;
 const query={select:()=>query,eq:(k:string,v:unknown)=>{filters[k]=v;return query;},update:(p:Record<string,unknown>)=>{patch=p;return query;},
 single:async()=>({data:{settings:structuredClone(state.settings)},error:null}),
 then:(resolve:(v:unknown)=>unknown)=>{const match=filters.settings===JSON.stringify(state.settings);if(match&&patch)state.settings=structuredClone(patch.settings as Record<string,unknown>);return resolve({data:match?[{id:"job"}]:[],error:null});}};
 return query;
}})}));
import {withJobLease,updateJobSettings} from "@/lib/job-lease";
beforeEach(()=>{state.settings={customerOption:"keep"};});
it("serializes concurrent deliveries and preserves independently updated settings",async()=>{
 let active=0,max=0,completed=0;
 const work=()=>withJobLease("org","job","studioDeliveryLease",async()=>{active++;max=Math.max(max,active);await updateJobSettings("org","job",s=>({...s,completed:++completed}));await new Promise(r=>setTimeout(r,10));active--;});
 await Promise.all([work(),work(),work()]);
 expect(max).toBe(1);expect(completed).toBe(3);expect(state.settings).toEqual({customerOption:"keep",completed:3});
});
it("releases a failed work lease so a subsequent delivery can finish",async()=>{
 await expect(withJobLease("org","job","studioDeliveryLease",async()=>{throw Error("storage unavailable");})).rejects.toThrow("storage unavailable");
 expect(state.settings.studioDeliveryLease).toBeUndefined();
 expect(await withJobLease("org","job","studioDeliveryLease",async()=>"delivered")).toBe("delivered");
});
