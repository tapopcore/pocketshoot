import "server-only";
import {admin} from "./supabase";
import {signedUrl} from "./storage";
/** Backend-only visual verification. The public job schema cannot set internalQa.
 * Short-lived object links remain in a server-only table; buckets never become public. */
export async function recordQaArtifact(job:{id:string;organization_id:string;product_id:string;created_by:string|null;settings:{internalQa?:boolean}},itemId:string,key:string,originalKey?:string){
 if(job.created_by!==null||job.settings.internalQa!==true)return;
 try{
  const [url,originalUrl]=await Promise.all([signedUrl("outputs",key,600),originalKey?signedUrl("originals",originalKey,600):Promise.resolve(null)]);
  await admin().from("analytics_events").insert({organization_id:job.organization_id,name:"internal_qa_artifact",props:{jobId:job.id,itemId,productId:job.product_id,url,originalUrl,expiresAt:new Date(Date.now()+600000).toISOString()}});
 }catch{/* A diagnostic link must never affect delivery. */}
}
