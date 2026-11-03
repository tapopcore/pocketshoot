import {it,expect,vi} from "vitest";
const f=vi.hoisted(()=>({queries:[] as {table:string;filters:[string,unknown][]}[]}));
vi.mock("@/lib/storage",()=>({getObject:vi.fn()}));
vi.mock("@/lib/supabase",()=>({admin:()=>({from:(table:string)=>{const q={table,filters:[] as [string,unknown][]};f.queries.push(q);let selection="";const chain={select:(s:string)=>{selection=s;return chain;},eq:(k:string,v:unknown)=>{q.filters.push([k,v]);return chain;},in:()=>chain,neq:()=>chain,order:()=>chain,limit:()=>chain,then:(resolve:(v:unknown)=>unknown)=>resolve({data:table==="product_assets"?(selection.includes("checksum")?[{checksum:"same-upload",view_type:"front"}]:[{product_id:"old-record"},{product_id:"new-record"}]):[{params:{shot:{scene:"old scene"}}}],error:null})};return chain;}})}));
import {creativeHistory} from "@/lib/creative-history";
it("links reuploaded photos through checksums and scopes every history query to the workspace",async()=>{const h=await creativeHistory("org","new-record","job");expect(h.productIds).toEqual(["new-record","old-record"]);expect(h.shots).toHaveLength(1);expect(f.queries.every(q=>q.filters.some(([k,v])=>k==="organization_id"&&v==="org"))).toBe(true);});
