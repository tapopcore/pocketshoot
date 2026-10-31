import "server-only";
import {AsyncLocalStorage} from "node:async_hooks";
import {randomUUID} from "node:crypto";
import {admin} from "./supabase";
import {getSettings} from "./settings";
import {COST_POLICY,IMAGE_COST_LIMIT_INR} from "./cost-policy";
export interface AiScope {organizationId:string;productId:string;jobId?:string;itemId?:string}
const scopes=new AsyncLocalStorage<AiScope>();
export const aiScope=()=>scopes.getStore();
export function withAiScope<T>(scope:AiScope,work:()=>Promise<T>){return scopes.run(scope,work);}
export async function reserveSpend(stage:string,model:string,estimatedInr:number,fx:number){
 const scope=aiScope(); if(!scope)throw new Error("AI cost scope missing; request blocked before spending");
 const id=randomUUID();
 const {data,error}=await admin().rpc("reserve_ai_spend",{p_id:id,p_org:scope.organizationId,p_product:scope.productId,p_job:scope.jobId??null,p_item:scope.itemId??null,p_stage:stage,p_model:model,p_estimate:estimatedInr,p_fx:fx,p_policy:COST_POLICY,p_limit:IMAGE_COST_LIMIT_INR});
 if(error)throw new Error("Cost budget unavailable; request blocked before spending");
 if(data!==true)throw new Error("This photo has reached its generation budget. No additional paid request was made.");
 return id;
}
export async function finishSpend(id:string,costUsd:number|undefined,usage:unknown,requestId?:string){
 const {error}=await admin().from("ai_spend_events").update({status:costUsd===undefined?"unknown":"complete",actual_usd:costUsd??null,usage,request_id:requestId??null,completed_at:new Date().toISOString()}).eq("id",id);
 if(error)throw new Error("AI usage could not be recorded; further spending must stop");
}
export async function spendFx(){
 const {data}=await admin().from("fx_rates").select("rate").eq("base","USD").eq("quote","INR").order("rate_date",{ascending:false}).limit(1).maybeSingle();
 return Number(data?.rate??(await getSettings()).fx_fallback.USDINR);
}
