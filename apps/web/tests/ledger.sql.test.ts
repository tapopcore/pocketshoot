/**
 * Runs the real migrations in an in-process Postgres (PGlite) and exercises
 * the credit ledger, queue claiming and tenant isolation.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS = join(__dirname, "../../../supabase/migrations");

const AUTH_STUB = `
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
`;

let db: PGlite;

async function newUser(email: string) {
  const r = await db.query<{ id: string }>(`insert into auth.users(email) values ($1) returning id`, [email]);
  const uid = r.rows[0].id;
  const org = await db.query<{ organization_id: string }>(`select organization_id from memberships where user_id = $1`, [uid]);
  return { uid, org: org.rows[0].organization_id };
}

async function balance(org: string) {
  const r = await db.query<{ available: number; reserved: number; consumed: number }>(
    `select available, reserved, consumed from wallet_balances where organization_id = $1`, [org]);
  return r.rows[0];
}

async function newJob(org: string, count: number, opts: { free?: boolean } = {}) {
  const p = await db.query<{ id: string }>(`insert into products(organization_id, name, category) values ($1,'Mug','home_kitchen') returning id`, [org]);
  const j = await db.query<{ id: string }>(
    `insert into generation_jobs(organization_id, product_id, mode, style, output, requested_count, idempotency_key, is_free_remake)
     values ($1,$2,'preserve','pure_white','square',$3,gen_random_uuid()::text,$4) returning id`, [org, p.rows[0].id, count, !!opts.free]);
  const job = j.rows[0].id;
  for (let i = 0; i < count; i++) await db.query(`insert into generation_items(job_id, organization_id, idx) values ($1,$2,$3)`, [job, org, i]);
  const items = await db.query<{ id: string }>(`select id from generation_items where job_id = $1 order by idx`, [job]);
  return { job, items: items.rows.map((r) => r.id) };
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(MIGRATIONS).sort()) {
    if (f.includes("storage") || f.includes("cron") || f.includes("bucket")) continue;
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
}, 60_000);

describe("signup", () => {
  it("creates profile, org, owner membership and wallet", async () => {
    const { org } = await newUser("a@example.com");
    expect(org).toBeTruthy();
    expect(await balance(org)).toEqual({ available: 0, reserved: 0, consumed: 0 });
  });
});

describe("credit ledger", () => {
  it("settles and refunds a multi-credit image across lots exactly once", async () => {
    const {org}=await newUser("multi-price@example.com");
    await db.query(`select grant_credits($1,'trial','trial',1,null,'trial',null,'multi:trial')`,[org]);
    await db.query(`select grant_credits($1,'paid','purchase',8,null,'order',null,'multi:paid')`,[org]);
    const {job,items}=await newJob(org,2);
    await db.query(`update generation_jobs set settings='{"creditsPerImage":3}'::jsonb where id=$1`,[job]);
    await db.query(`select reserve_credits($1,6)`,[job]);
    await db.query(`select settle_item($1,true)`,[items[0]]);
    await db.query(`select settle_item($1,true)`,[items[0]]);
    await db.query(`select settle_item($1,false)`,[items[1]]);
    expect(await balance(org)).toEqual({available:6,reserved:0,consumed:3});
    await db.query(`select refund_item_credit($1,null,null)`,[items[0]]);
    await db.query(`select refund_item_credit($1,null,null)`,[items[0]]);
    expect(await balance(org)).toEqual({available:9,reserved:0,consumed:0});
  });
  it("grants idempotently (duplicate webhook never doubles credits)", async () => {
    const { org } = await newUser("b@example.com");
    for (let i = 0; i < 3; i++) {
      await db.query(`select grant_credits($1,'paid','purchase',5, now() + interval '1 year','order','o1','order:o1')`, [org]);
    }
    expect((await balance(org)).available).toBe(5);
  });

  it("reserves, captures delivered items, releases failed ones (AC-03, AC-04)", async () => {
    const { org } = await newUser("c@example.com");
    await db.query(`select grant_credits($1,'trial','trial',2, now() + interval '30 days','trial',null,'trial:c')`, [org]);
    await db.query(`select grant_credits($1,'paid','purchase',5, now() + interval '1 year','order','o2','order:o2')`, [org]);
    const { job, items } = await newJob(org, 4);
    const ok = await db.query<{ reserve_credits: boolean }>(`select reserve_credits($1, 4)`, [job]);
    expect(ok.rows[0].reserve_credits).toBe(true);
    expect(await balance(org)).toEqual({ available: 3, reserved: 4, consumed: 0 });
    // second reserve call for the same job is a no-op
    await db.query(`select reserve_credits($1, 4)`, [job]);
    expect((await balance(org)).reserved).toBe(4);

    await db.query(`select settle_item($1, true)`, [items[0]]);
    await db.query(`select settle_item($1, true)`, [items[1]]);
    await db.query(`select settle_item($1, false)`, [items[2]]);
    // repeated provider callback for the same failure
    await db.query(`select settle_item($1, false)`, [items[2]]);
    await db.query(`select settle_item($1, true)`, [items[3]]);
    expect(await balance(org)).toEqual({ available: 4, reserved: 0, consumed: 3 });

    // trial lot was spent first
    const trial = await db.query<{ available: number; consumed: number }>(`select available, consumed from lot_balances where organization_id = $1 and kind = 'trial'`, [org]);
    expect(trial.rows[0].available).toBe(0);
  });

  it("refuses to reserve more than the balance and leaves nothing half-reserved", async () => {
    const { org } = await newUser("d@example.com");
    await db.query(`select grant_credits($1,'paid','purchase',2, null,'order','o3','order:o3')`, [org]);
    const { job } = await newJob(org, 3);
    const r = await db.query<{ reserve_credits: boolean }>(`select reserve_credits($1, 3)`, [job]);
    expect(r.rows[0].reserve_credits).toBe(false);
    expect(await balance(org)).toEqual({ available: 2, reserved: 0, consumed: 0 });
  });

  it("restores a captured credit once after a validated report (AC-06)", async () => {
    const { org } = await newUser("e@example.com");
    await db.query(`select grant_credits($1,'paid','purchase',1, null,'order','o4','order:o4')`, [org]);
    const { job, items } = await newJob(org, 1);
    await db.query(`select reserve_credits($1, 1)`, [job]);
    await db.query(`select settle_item($1, true)`, [items[0]]);
    expect((await balance(org)).available).toBe(0);
    await db.query(`select refund_item_credit($1, null, null)`, [items[0]]);
    await db.query(`select refund_item_credit($1, null, null)`, [items[0]]);
    expect(await balance(org)).toEqual({ available: 1, reserved: 0, consumed: 0 });
  });

  it("does not charge free remakes", async () => {
    const { org } = await newUser("f@example.com");
    const { items } = await newJob(org, 1, { free: true });
    const r = await db.query<{ settle_item: string }>(`select settle_item($1, true)`, [items[0]]);
    expect(r.rows[0].settle_item).toBe("free");
    expect(await balance(org)).toEqual({ available: 0, reserved: 0, consumed: 0 });
  });

  it("expires lots once", async () => {
    const { org } = await newUser("g@example.com");
    await db.query(`select grant_credits($1,'promo','promo',3, now() - interval '1 day','coupon','x','promo:g')`, [org]);
    await db.query(`select expire_credit_lots()`);
    await db.query(`select expire_credit_lots()`);
    const r = await db.query<{ expired: number; available: number }>(`select expired, available from lot_balances where organization_id = $1`, [org]);
    expect(r.rows[0]).toEqual({ expired: 3, available: 0 });
  });

  it("supports admin debit adjustments", async () => {
    const { org } = await newUser("h@example.com");
    await db.query(`select grant_credits($1,'paid','purchase',5, null,'order','o5','order:o5')`, [org]);
    await db.query(`select adjust_credits($1, -2, null, 'test', 'adj:h1')`, [org]);
    await db.query(`select adjust_credits($1, -2, null, 'test', 'adj:h1')`, [org]);
    expect((await balance(org)).available).toBe(3);
  });

  it("is append-only", async () => {
    await expect(db.query(`update credit_ledger set quantity = 99`)).rejects.toThrow(/append-only/);
    await expect(db.query(`delete from credit_ledger`)).rejects.toThrow(/append-only/);
  });
});

describe("queue", () => {
  it("claims each item once and re-claims after the lease expires", async () => {
    const { org } = await newUser("q@example.com");
    const { items } = await newJob(org, 2);
    const a = await db.query<{ id: string }>(`select id from claim_generation_items('w1', 100, 60)`);
    const b = await db.query<{ id: string }>(`select id from claim_generation_items('w2', 100, 60)`);
    const claimedA = a.rows.map((r) => r.id).filter((id) => items.includes(id));
    expect(claimedA.length).toBe(2);
    expect(b.rows.filter((r) => items.includes(r.id)).length).toBe(0);
    await db.query(`update generation_items set locked_until = now() - interval '1 second' where id = $1`, [items[0]]);
    const c = await db.query<{ id: string }>(`select id from claim_generation_items('w3', 100, 60)`);
    expect(c.rows.map((r) => r.id)).toContain(items[0]);
  });
});

describe("tenant isolation (AC-08)", () => {
  it("RLS hides other organizations' rows", async () => {
    const one = await newUser("t1@example.com");
    const two = await newUser("t2@example.com");
    await newJob(one.org, 1);
    await db.exec(`grant usage on schema public to authenticated; grant select on all tables in schema public to authenticated;`);
    await db.exec(`set role authenticated`);
    await db.query(`select set_config('test.uid', $1, false)`, [two.uid]);
    const products = await db.query(`select * from products where organization_id = '${one.org}'`);
    const wallets = await db.query(`select * from wallets where organization_id = '${one.org}'`);
    const own = await db.query(`select * from wallets where organization_id = '${two.org}'`);
    await db.exec(`reset role`);
    expect(products.rows.length).toBe(0);
    expect(wallets.rows.length).toBe(0);
    expect(own.rows.length).toBe(1);
  });
});

describe("invoices", () => {
  it("hands out gapless sequence numbers per financial year", async () => {
    const a = await db.query<{ next_invoice_seq: number }>(`select next_invoice_seq('2026-27')`);
    const b = await db.query<{ next_invoice_seq: number }>(`select next_invoice_seq('2026-27')`);
    const c = await db.query<{ next_invoice_seq: number }>(`select next_invoice_seq('2027-28')`);
    expect([a.rows[0].next_invoice_seq, b.rows[0].next_invoice_seq, c.rows[0].next_invoice_seq]).toEqual([1, 2, 1]);
  });
});

// No network calls: exercise real admission transactions and retry ancestry in Postgres.
describe("AI spend admission",()=>{
 async function fixture(){const {org}=await newUser(Math.random()+"-budget@example.com");const {job,items}=await newJob(org,2);const p=await db.query<{product_id:string}>("select product_id from generation_jobs where id=$1",[job]);return {org,job,items,product:p.rows[0].product_id,policy:Math.random().toString()};}
 async function reserve(f:Awaited<ReturnType<typeof fixture>>,item:string|null,estimate:number,stage="image"){
  const r=await db.query<{ok:boolean}>("select reserve_ai_spend(gen_random_uuid(),$1,$2,$3,$4,$5,'gpt-image-2.5-sunburst',$6,100,$7,5) as ok",[f.org,f.product,f.job,item,stage,estimate,f.policy]);return r.rows[0].ok;
 }
 it("shares one planning charge and prevents duplicate in-flight spending per photo",async()=>{const f=await fixture();expect(await reserve(f,null,1,"shot_briefs")).toBe(true);expect(await reserve(f,f.items[0],4)).toBe(true);expect(await reserve(f,f.items[0],1)).toBe(false);expect(await reserve(f,f.items[1],4)).toBe(true);});
 it("carries the budget into child retry jobs and includes historical image attempts",async()=>{const f=await fixture();await db.query("insert into generation_attempts(item_id,job_id,organization_id,attempt_no,provider,model,status,cost_inr) values($1,$2,$3,1,'openai','gpt-image-2.5-sunburst','succeeded',4)",[f.items[0],f.job,f.org]);expect(await reserve(f,f.items[0],2)).toBe(false);const c=await db.query<{id:string}>("insert into generation_jobs(organization_id,product_id,mode,style,output,requested_count,idempotency_key,settings) values($1,$2,'preserve','pure_white','square',1,gen_random_uuid()::text,$3) returning id",[f.org,f.product,JSON.stringify({retryOf:{jobId:f.job,itemId:f.items[0]}})]);const i=await db.query<{id:string}>("insert into generation_items(job_id,organization_id,idx)values($1,$2,0)returning id",[c.rows[0].id,f.org]);expect(await reserve({...f,job:c.rows[0].id},i.rows[0].id,2)).toBe(false);});
 it("retains unknown provider charges and pauses further image admissions",async()=>{const f=await fixture();expect(await reserve(f,f.items[0],3)).toBe(true);await db.query("update ai_spend_events set status='unknown' where policy=$1",[f.policy]);expect(await reserve(f,f.items[1],3)).toBe(false);});
 it("refuses workspace mismatch before recording any reservation",async()=>{const f=await fixture();expect(await reserve({...f,org:crypto.randomUUID()},f.items[0],2)).toBe(false);});
});
