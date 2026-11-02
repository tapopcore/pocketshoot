import "server-only";
import {randomUUID} from "node:crypto";
import {admin} from "./supabase";

/** Compare-and-set current JSON, preserving other workers' settings. */
export async function updateJobSettings(org:string,id:string,change:(current:Record<string,unknown>)=>Record<string,unknown>){
 for(let attempt=0;attempt<20;attempt++){
  const db=admin();
  const {data,error}=await db.from("generation_jobs").select("settings").eq("organization_id",org).eq("id",id).single();
  if(error||!data)throw error??new Error("Shoot not found");
  const before=data.settings??{};
  const {data:updated,error:writeError}=await db.from("generation_jobs").update({settings:change(before)}).eq("organization_id",org).eq("id",id).eq("settings",JSON.stringify(before)).select("id");
  if(writeError)throw writeError;
  if(updated?.length)return;
 }
 throw new Error("Shoot settings are busy; no additional image request was made");
}

/** Durable leases span server instances; no model calls inside a delivery lease. */
export async function withJobLease<T>(org:string,id:string,key:"studioPlanningLease"|"studioDeliveryLease",work:()=>Promise<T>):Promise<T>{
 const owner=randomUUID(),ttl=key==="studioPlanningLease"?240_000:90_000;
 const until=Date.now()+ttl;
 let owned=false;
 while(Date.now()<until){
  await updateJobSettings(org,id,current=>{
   const lease=current[key] as {owner?:string;expires?:number}|undefined;
   if(lease&&Number(lease.expires)>Date.now()&&lease.owner!==owner)return current;
   return {...current,[key]:{owner,expires:Date.now()+ttl}};
  });
  const {data,error}=await admin().from("generation_jobs").select("settings").eq("organization_id",org).eq("id",id).single();
  if(error)throw error;
  if(data?.settings?.[key]?.owner===owner){owned=true;break;}
  await new Promise(resolve=>setTimeout(resolve,400));
 }
 if(!owned)throw new Error("This shoot is still being checked. No additional paid request was made.");
 try{return await work();}
 finally{await updateJobSettings(org,id,current=>{if((current[key] as {owner?:string}|undefined)?.owner!==owner)return current;const next={...current};delete next[key];return next;});}
}
