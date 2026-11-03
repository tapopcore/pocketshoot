import {beforeAll,beforeEach,afterAll,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const db=new PGlite();
const org="00000000-0000-0000-0000-000000000001", product="00000000-0000-0000-0000-000000000002", job="00000000-0000-0000-0000-000000000003", item="00000000-0000-0000-0000-000000000004";
const policy="2026-11-03.pooled-average-2";
beforeAll(async()=>{
 await db.exec("create role anon;create role authenticated;create role service_role;create table products(id uuid,organization_id uuid);create table generation_jobs(id uuid,organization_id uuid,product_id uuid,requested_count int,status text,settings jsonb,created_at timestamptz default now());create table generation_items(id uuid,job_id uuid,organization_id uuid,status text,decision text default 'pass');create table ai_spend_events(id uuid,organization_id uuid,product_id uuid,job_id uuid,item_id uuid,budget_job_id uuid,budget_item_id uuid,stage text,model text,policy text,estimated_inr numeric,actual_usd numeric,fx_rate numeric,status text default 'reserved',request_id text);create table generation_attempts(item_id uuid,request_id text,cost_inr numeric);create function pg_advisory_xact_lock(int) returns void language sql as 'select';");
 await db.exec(readFileSync(resolve(process.cwd(),"../../supabase/migrations/20261103135530_pooled_generation_budget.sql"),"utf8"));
 await db.exec(readFileSync(resolve(process.cwd(),"../../supabase/migrations/20261103142400_usable_deliveries_budget.sql"),"utf8"));
},30000);
beforeEach(async()=>{
 await db.exec("truncate products,generation_jobs,generation_items,ai_spend_events,generation_attempts");
 await db.query("insert into products values($1,$2)",[product,org]);
 await db.query("insert into generation_jobs(id,organization_id,product_id,requested_count,status,settings) values($1,$2,$3,6,'review_needed','{}')",[job,org,product]);
 await db.query("insert into generation_items(id,job_id,organization_id,status) values($1,$2,$3,'failed')",[item,job,org]);
});
afterAll(()=>db.close());
async function reserve(estimate:number,scope=org,chosenPolicy=policy,j=job,i=item){
 return (await db.query<{allowed:boolean}>("select reserve_ai_spend(gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,$4::uuid,'image','test',$5,100,$6,5) allowed",[scope,product,j,i,estimate,chosenPolicy])).rows[0].allowed;
}
async function spend(amount:number,status="complete",eventOrg=org){
 await db.query("insert into ai_spend_events(id,organization_id,product_id,job_id,item_id,budget_job_id,budget_item_id,stage,model,policy,estimated_inr,actual_usd,fx_rate,status) values(gen_random_uuid(),$1,$2,$3,$4,$3,$4,'image','test',$5,$6,$7,100,$8)",[eventOrg,product,job,item,policy,amount,amount/100,status]);
}
it("allows a ₹6 request from unused six-photo budget after an earlier failed cost",async()=>{await spend(18.7);expect(await reserve(6)).toBe(true);});
it("counts outstanding reservations so workers cannot spend the same remainder",async()=>{await spend(23);expect(await reserve(4)).toBe(true);expect(await reserve(4)).toBe(false);});
it("counts unknown charges conservatively",async()=>{await spend(26,"unknown");expect(await reserve(5)).toBe(false);});
it("isolates organizations",async()=>expect(await reserve(3,"00000000-0000-0000-0000-000000000099")).toBe(false));
it("does not let another organization's unknown charge freeze this one",async()=>{await spend(100,"unknown","00000000-0000-0000-0000-000000000099");expect(await reserve(6)).toBe(true);});
it("allows above ₹5 while keeping a bounded per-request stop",async()=>{expect(await reserve(10.01)).toBe(false);expect(await reserve(5.5)).toBe(true);});
it("retains legacy behavior for an application rollback",async()=>expect(await reserve(6,org,"2026-10-31.five-rupee-1")).toBe(false));
it("shares the original pack budget with retry descendants",async()=>{
 await spend(18.7);
 const child="00000000-0000-0000-0000-000000000005",childItem="00000000-0000-0000-0000-000000000006";
 await db.query("insert into generation_jobs(id,organization_id,product_id,requested_count,status,settings) values($1,$2,$3,1,'queued',$4)",[child,org,product,JSON.stringify({retryOf:{jobId:job,itemId:item}})]);
 await db.query("insert into generation_items(id,job_id,organization_id,status) values($1,$2,$3,'queued')",[childItem,child,org]);
 expect(await reserve(6,org,policy,child,childItem)).toBe(true);
});

it("does not count flagged outputs as savings for the next image",async()=>{
 await db.query("update generation_jobs set requested_count=1 where id=$1",[job]);
 const past="00000000-0000-0000-0000-000000000008",pastItem="00000000-0000-0000-0000-000000000009";
 await db.query("insert into generation_jobs(id,organization_id,product_id,requested_count,status,settings) values($1,$2,$3,1,'completed','{}')",[past,org,product]);
 await db.query("insert into generation_items(id,job_id,organization_id,status,decision) values($1,$2,$3,'delivered','review')",[pastItem,past,org]);
 await db.query("insert into ai_spend_events(id,organization_id,product_id,budget_job_id,stage,model,policy,estimated_inr,actual_usd,fx_rate,status) values(gen_random_uuid(),$1,$2,$3,'image','test',$4,0,0,100,'complete')",[org,product,past,policy]);
 expect(await reserve(6)).toBe(false);
 await db.query("update generation_items set decision='pass' where id=$1",[pastItem]);
 expect(await reserve(6)).toBe(true);
});
