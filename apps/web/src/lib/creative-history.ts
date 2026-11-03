import "server-only";
import {createHash} from "node:crypto";
import {admin} from "./supabase";
import {getObject} from "./storage";
import type {CreativeSpec,ShotDirection} from "@packshot/core";
export interface CreativeHistory {family:string;productIds:string[];shots:ShotDirection[];specs:CreativeSpec[]}
/** Photo checksums connect reuploads only inside the authorised workspace. */
export async function creativeHistory(orgId:string,productId:string,jobId:string):Promise<CreativeHistory>{
 const db=admin();
 const {data:refs,error}=await db.from("product_assets").select("checksum,view_type").eq("organization_id",orgId).eq("product_id",productId).order("created_at");
 if(error)throw error;
 const checksums=[...new Set((refs??[]).map(r=>r.checksum).filter((v):v is string=>typeof v==="string"&&!!v))];
 let ids=[productId];
 if(checksums.length){const {data:matches,error}=await db.from("product_assets").select("product_id").eq("organization_id",orgId).in("checksum",checksums).limit(500);if(error)throw error;ids=[...new Set([productId,...(matches??[]).map(r=>r.product_id as string)])];}
 const primary=refs?.find(r=>r.view_type==="front")?.checksum??checksums.sort()[0]??productId;
 const family=createHash("sha256").update(orgId+":"+primary).digest("hex");
 const {data:history,error:historyError}=await db.from("generation_items").select("params,generation_jobs!inner(product_id)").eq("organization_id",orgId).in("generation_jobs.product_id",ids).neq("job_id",jobId).order("created_at",{ascending:false}).limit(144);
 if(historyError)throw historyError;
 const shots=(history??[]).map(r=>(r.params as {shot?:ShotDirection}|null)?.shot).filter((s):s is ShotDirection=>!!s);
 return {family,productIds:ids,shots,specs:shots.map(s=>s.creativeSpec).filter((s):s is CreativeSpec=>!!s)};
}
export async function creativeEdition(jobId:string,orgId:string,history:CreativeHistory):Promise<{family:string;edition:number}>{
 const {data,error}=await admin().rpc("reserve_creative_edition",{p_job:jobId,p_org:orgId,p_family:history.family,p_related:history.productIds});
 if(error)throw error;
 if(!data||typeof data.family!=="string"||!Number.isSafeInteger(Number(data.edition)))throw new Error("Creative edition could not be reserved before image spending");
 return {family:data.family,edition:Number(data.edition)};
}
/** These buffers are for LOCAL comparison only. Never pass them to an external model. */
export async function previousDeliverables(orgId:string,productId:string,jobId:string,lookId:string|undefined,style:string,itemId:string):Promise<{id:string;image:Buffer}[]>{
 const history=await creativeHistory(orgId,productId,jobId);
 const {data,error}=await admin().from("generated_assets").select("id,job_id,storage_key,thumb_key,generation_items!generated_assets_item_id_fkey(params,style)").eq("organization_id",orgId).in("product_id",history.productIds).neq("item_id",itemId).in("quality_status",["pass","review"]).order("created_at",{ascending:false}).limit(96);
 if(error)throw error;
 const candidates=(data??[]).filter(a=>{const item=a.generation_items as unknown as {params?:{lookId?:string};style?:string}|null;return item&&(a.job_id===jobId||(lookId?item.params?.lookId===lookId:item.style===style));}).slice(0,8);
 const images=await Promise.all(candidates.map(async a=>{try{return {id:a.id,image:await getObject("outputs",a.thumb_key??a.storage_key)};}catch{return null;}}));
 return images.filter((v):v is {id:string;image:Buffer}=>v!==null);
}

/** Fresh same-pack candidates, read only while the studio delivery lease is held. */
export async function studioPackDeliverables(orgId:string,jobId:string,itemId:string,slotItemId=itemId){
 const db=admin();
 const {data:children,error:childError}=await db.from("generation_jobs").select("id").eq("organization_id",orgId).contains("settings",{studioPackJobId:jobId}).limit(96);
 if(childError)throw childError;
 const ids=[jobId,...(children??[]).map(j=>j.id)];
 const {data,error}=await db.from("generated_assets").select("id,item_id,storage_key,thumb_key,generation_items!generated_assets_item_id_fkey(params)").eq("organization_id",orgId).in("job_id",ids).neq("item_id",itemId).in("quality_status",["pass","review"]);
 if(error)throw error;
 return Promise.all((data??[]).filter(a=>{const p=(a.generation_items as unknown as {params?:{studioSlotItemId?:string}}|null)?.params;return (p?.studioSlotItemId??a.item_id)!==slotItemId;}).map(async a=>({id:a.id,image:await getObject("outputs",a.thumb_key??a.storage_key)})));
}
