import "server-only";
import {admin} from "./supabase";
import {recordQaArtifact} from "./qa-artifacts";
interface QaJob {id:string;organization_id:string;product_id:string;created_by:string|null;settings:Record<string,unknown>&{internalQa?:boolean}}
/** Backend-only diagnostics; public job input cannot set these fields. No image generation. */
export async function maintainQaJob(job:QaJob){
 const task=job.settings.qaMaintenance as {refresh?:boolean;recover?:string[]}|undefined;
 if(job.created_by!==null||job.settings.internalQa!==true||!task)return false;
 const db=admin(), claimedSettings={...job.settings,qaMaintenance:null};
 const {data:claimed,error}=await db.from("generation_jobs").update({settings:claimedSettings}).eq("id",job.id).eq("organization_id",job.organization_id).eq("settings",JSON.stringify(job.settings)).select("id").maybeSingle();
 if(error)throw error;if(!claimed)return false;
 const results:Record<string,unknown>[]=[];
 const {data:items,error:itemError}=await db.from("generation_items").select("id,status").eq("job_id",job.id).eq("organization_id",job.organization_id).order("idx").limit(6);
 if(itemError)throw itemError;
 for(const it of items??[]){
  if(task.recover?.includes(it.id)&&it.status==="failed"){
   try{const {tryRecoverFailedItem}=await import("./generation-recovery");const result=await tryRecoverFailedItem(it.id,job.organization_id);results.push({itemId:it.id,recovered:!!result});}
   catch(e){results.push({itemId:it.id,recovered:false,error:(e as Error).message.slice(0,160)});}
  }
  if(task.refresh){
   const [{data:asset},{data:ref}]=await Promise.all([db.from("generated_assets").select("storage_key").eq("item_id",it.id).eq("organization_id",job.organization_id).order("created_at",{ascending:false}).limit(1).maybeSingle(),db.from("product_assets").select("storage_key").eq("product_id",job.product_id).eq("organization_id",job.organization_id).order("created_at").limit(1).maybeSingle()]);
   if(asset)await recordQaArtifact(job,it.id,asset.storage_key,ref?.storage_key);
  }
 }
 if(task.recover?.length){const {refreshJobStatus}=await import("./jobs");await refreshJobStatus(job.id);}
 await db.from("analytics_events").insert({organization_id:job.organization_id,name:"internal_qa_maintenance",props:{jobId:job.id,noImageGeneration:true,noCreditCharge:true,results}});
 return true;
}
export async function maintainQaJobs(){
 const {data,error}=await admin().from("generation_jobs").select("id,organization_id,product_id,created_by,settings").is("created_by",null).contains("settings",{internalQa:true}).not("settings->>qaMaintenance","is",null).order("created_at",{ascending:false}).limit(2);
 if(error)throw error;
 for(const job of data??[])await maintainQaJob(job as QaJob);
}

