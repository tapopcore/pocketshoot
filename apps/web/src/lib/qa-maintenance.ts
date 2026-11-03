import "server-only";
import {admin} from "./supabase";
import {signedUrl} from "./storage";
import {recordQaArtifact} from "./qa-artifacts";
interface QaJob {id:string;organization_id:string;product_id:string;created_by:string|null;settings:Record<string,unknown>&{internalQa?:boolean}}
/** Backend-only diagnostics; public job input cannot set these fields. No image generation. */
export async function maintainQaJob(job:QaJob){
 const task=job.settings.qaMaintenance as {refresh?:boolean;recover?:string[];auditJobIds?:string[]}|undefined;
 if(job.created_by!==null||job.settings.internalQa!==true||!task)return false;
 const db=admin(), claimedSettings={...job.settings,qaMaintenance:null};
 const {data:claimed,error}=await db.from("generation_jobs").update({settings:claimedSettings}).eq("id",job.id).eq("organization_id",job.organization_id).eq("settings",JSON.stringify(job.settings)).select("id").maybeSingle();
 if(error)throw error;if(!claimed)return false;
 const results:Record<string,unknown>[]=[];
 if(task.auditJobIds?.length){
  // Cron-authenticated diagnostic tasks can inspect only this QA job's org and product. No generation.
  const ids=[...new Set(task.auditJobIds)].slice(0,3);
  const {data:targets,error:auditError}=await db.from("generation_jobs").select("id").eq("organization_id",job.organization_id).eq("product_id",job.product_id).in("id",ids);
  if(auditError)throw auditError;
  const validIds=(targets??[]).map(j=>j.id);
  const [{data:originals,error:originalError},{data:outputs,error:outputError}]=await Promise.all([
   db.from("product_assets").select("id,storage_key,view_type").eq("organization_id",job.organization_id).eq("product_id",job.product_id).order("created_at").limit(6),
   db.from("generated_assets").select("id,storage_key,job_id,item_id").eq("organization_id",job.organization_id).eq("product_id",job.product_id).in("job_id",validIds).limit(24)
  ]);
  if(originalError||outputError)throw originalError??outputError;
  const images=await Promise.all([...(originals??[]).map(a=>({...a,bucket:"originals" as const})),...(outputs??[]).map(a=>({...a,bucket:"outputs" as const}))].map(async a=>({...a,url:await signedUrl(a.bucket,a.storage_key,600)})));
  await db.from("analytics_events").insert({organization_id:job.organization_id,name:"internal_visual_audit",props:{jobId:job.id,productId:job.product_id,noImageGeneration:true,expiresAt:new Date(Date.now()+600000).toISOString(),images}});
 }
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

