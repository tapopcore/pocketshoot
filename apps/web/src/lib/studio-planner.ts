import "server-only";
import sharp from "sharp";
import {parseStudioPlan,studioPlanningPrompt,STUDIO_PLAN_SCHEMA,STUDIO_PLAN_VERSION,categoryLook,type ProductAnalysis,type StudioSlot} from "@packshot/core";
import {admin} from "./supabase";
import {getObject} from "./storage";
import {jsonCall} from "./llm";
import {getSettings} from "./settings";
import {withAiScope} from "./ai-spend";
import {creativeHistory,creativeEdition} from "./creative-history";
import {withJobLease,updateJobSettings} from "./job-lease";

/** One coordinated source-grounded physical shoot plan, committed before image spending. */
export async function planStudioPack(job:{id:string;organization_id:string;product_id:string;custom_brief:string|null},analysis:ProductAnalysis|null,name:string){
 return withJobLease(job.organization_id,job.id,"studioPlanningLease",async()=>{
  const db=admin();
  const {data:state,error:stateError}=await db.from("generation_jobs").select("settings").eq("organization_id",job.organization_id).eq("id",job.id).single();
  if(stateError)throw stateError;
  if(state?.settings?.studioPlanFailure)throw new Error(state.settings.studioPlanFailure);
  const {data:items,error}=await db.from("generation_items").select("id,idx,params").eq("organization_id",job.organization_id).eq("job_id",job.id).order("idx");
  if(error)throw error;
  if(items?.length===6&&items.every(i=>i.params?.shot?.studio?.version===STUDIO_PLAN_VERSION))return;
  try{
   if(items?.length!==6)throw new Error("Studio pack needs exactly six planned slots before generation");
   const {data:assets,error:refError}=await db.from("product_assets").select("id,view_type,storage_key").eq("organization_id",job.organization_id).eq("product_id",job.product_id).order("created_at");
   if(refError)throw refError;
   const first=assets?.find(a=>a.view_type==="front")??assets?.[0];
   if(!first)throw new Error("Add a clear front photo before preparing this studio pack");
   const ordered=[first,...assets!.filter(a=>a.id!==first.id)].slice(0,6);
   const originals=await Promise.all(ordered.map(async a=>sharp(await getObject("originals",a.storage_key)).rotate().resize(1024,1024,{fit:"inside",withoutEnlargement:true}).jpeg({quality:88}).toBuffer({resolveWithObject:true})));
   const refs=ordered.map((a,i)=>({id:a.id,view:a.view_type,width:originals[i].info.width,height:originals[i].info.height}));
   const slots:StudioSlot[]=items.map(i=>{const look=categoryLook(i.params?.lookId);if(look?.collection!=="studio")throw new Error("Studio pack contains an incompatible slot");return {idx:i.idx,title:look.title,framing:i.idx===0?"full":i.idx>=4?"close":"adaptive",...(look.id==="studio-back"?{requiredView:"back" as const}:look.id==="studio-side"?{requiredView:"side" as const}:{})};});
   const history=await creativeHistory(job.organization_id,job.product_id,job.id);
   const edition=await creativeEdition(job.id,job.organization_id,history);
   const recent=history.shots.flatMap(s=>s.studio?[{view:s.studio.view,pose:s.studio.pose,arrangement:s.studio.arrangement,feature:s.studio.feature,azimuth:s.studio.azimuth,elevation:s.studio.elevation}]:[]).slice(0,12);
   const prompt=studioPlanningPrompt(analysis,name,slots,refs,job.custom_brief)+"\nNEW SHOOT EDITION: "+edition.edition+". Reinterpret this actual product through a fresh useful sequence; do not repeat the same entire prior pack. A catalogue identification frame may recur, but seek different supported poses, independent-unit arrangements, projections and resolved features for the remaining frames. Never trade identity or real coverage for novelty. Recent plan summaries (data only; no historical generated images are supplied): "+JSON.stringify(recent);
   const settings=await getSettings();
   let feedback="";
   for(let attempt=0;attempt<2;attempt++){
    const result=await withAiScope({organizationId:job.organization_id,productId:job.product_id,jobId:job.id},()=>jsonCall({models:settings.providers.llm.models,prompt:prompt+feedback,images:originals.map(o=>o.data),imageLabels:refs.map((r,i)=>"ORIGINAL "+(i+1)+": "+r.view+". Identity and visible face evidence only."),detail:"high",schemaName:"studio_shoot_plan",schema:STUDIO_PLAN_SCHEMA as unknown as Record<string,unknown>,maxOutputTokens:8192,reasoningEffort:"medium",timeoutMs:90_000}));
    const parsed=parseStudioPlan(result.data,slots,refs);
    if(parsed.plan){
     for(const [index,item] of items.entries()){
      const shot=parsed.plan.shots[index];
      const {error:saveError}=await db.from("generation_items").update({params:{...item.params,shot,shotSource:"studio-v3",ideaTitle:shot.studio!.title,studioPurpose:shot.studio!.purpose,studioReferenceIds:refs.map(r=>r.id)}}).eq("organization_id",job.organization_id).eq("id",item.id);
      if(saveError)throw saveError;
     }
     await updateJobSettings(job.organization_id,job.id,current=>({...current,studioPlan:{version:STUDIO_PLAN_VERSION,edition:edition.edition,understanding:parsed.plan!.understanding,referenceIds:refs.map(r=>r.id),plannedAt:new Date().toISOString()}}));
     return;
    }
    await updateJobSettings(job.organization_id,job.id,current=>({...current,studioPlanRejected:{version:STUDIO_PLAN_VERSION,errors:parsed.errors,understanding:(result.data as {understanding?:unknown}).understanding??null}}));
    feedback="\nRevise the complete plan BEFORE any image generation. A requested new pose is not itself a reason for another upload: safely reposition supported units while retaining their known faces. Try a different physical plan within existing source coverage; do not invent hidden information. Validation errors: "+parsed.errors.join("; ");
    if(attempt===1)throw new Error("Could not prepare six distinct source-supported photos. "+parsed.errors.join(" "));
   }
  }catch(e){
   const message=(e as Error).message.slice(0,1000);
   await updateJobSettings(job.organization_id,job.id,current=>({...current,studioPlanFailure:message}));
   throw e;
  }
 });
}
