-- Provider token usage and conservative reservations are deliberately distinct.
create table public.ai_spend_events (
 id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 job_id uuid references public.generation_jobs(id) on delete set null,
 item_id uuid references public.generation_items(id) on delete set null,
 budget_job_id uuid, budget_item_id uuid, stage text not null, model text not null, policy text not null,
 estimated_inr numeric not null check(estimated_inr>=0), actual_usd numeric, fx_rate numeric not null check(fx_rate>0),
 status text not null default 'reserved' check(status in ('reserved','complete','unknown','not_sent')),
 usage jsonb, request_id text, created_at timestamptz not null default now(), completed_at timestamptz
);
create index ai_spend_budget_job on public.ai_spend_events(budget_job_id);
create index ai_spend_product on public.ai_spend_events(product_id);
alter table public.ai_spend_events enable row level security;
revoke all on public.ai_spend_events from anon,authenticated;
grant all on public.ai_spend_events to service_role;
create function public.reserve_ai_spend(p_id uuid,p_org uuid,p_product uuid,p_job uuid,p_item uuid,p_stage text,p_model text,p_estimate numeric,p_fx numeric,p_policy text,p_limit numeric)
returns boolean language plpgsql security definer set search_path=public as $$
declare root_job uuid:=p_job; root_item uuid:=p_item; next_job uuid; next_item uuid; cfg jsonb; slots int:=1; used numeric:=0; legacy_spend numeric:=0; n int:=0;
begin
 if p_estimate<0 or p_estimate>p_limit or p_fx<=0 then return false; end if;
 -- Short transaction: serializes only admissions, never network calls. Avoid cross-worker races.
 perform pg_advisory_xact_lock(hashtext('pocketshoot-ai-budget-v1'));
 if not exists(select 1 from products where id=p_product and organization_id=p_org) then return false;end if;
 if p_job is not null then
  loop
   select settings,requested_count into cfg,slots from generation_jobs where id=root_job and organization_id=p_org and product_id=p_product;
   if not found then return false;end if;
   exit when cfg->'retryOf'->>'jobId' is null;
   next_job:=(cfg->'retryOf'->>'jobId')::uuid; next_item:=(cfg->'retryOf'->>'itemId')::uuid;
   root_job:=next_job; root_item:=next_item; n:=n+1;
   if n>32 then return false;end if;
  end loop;
  -- Cached analysis belongs to the first shoot that consumes it, once only.
  update ai_spend_events set budget_job_id=root_job where product_id=p_product and budget_job_id is null;
  if root_item is not null then
   if not exists(select 1 from generation_items where id=root_item and job_id=root_job and organization_id=p_org) then return false;end if;
   select coalesce(sum(case when status='complete' then actual_usd*fx_rate else estimated_inr end * case when budget_item_id is null then 1.0/greatest(slots,1) else 1 end),0) into used
    from ai_spend_events where budget_job_id=root_job and (budget_item_id=root_item or budget_item_id is null) and status<>'not_sent';
  else
   select coalesce(max(coalesce((select sum(case when e.status='complete' then e.actual_usd*e.fx_rate else e.estimated_inr end) from ai_spend_events e where e.budget_item_id=i.id and e.status<>'not_sent'),0)),0) into used from generation_items i where i.job_id=root_job;
   select used+coalesce(sum(case when status='complete' then actual_usd*fx_rate else estimated_inr end),0)/greatest(slots,1) into used from ai_spend_events where budget_job_id=root_job and budget_item_id is null and status<>'not_sent';
  end if;
 else
  select coalesce(sum(case when status='complete' then actual_usd*fx_rate else estimated_inr end),0) into used from ai_spend_events where product_id=p_product and budget_job_id is null and status<>'not_sent';
 end if;
 if root_item is not null then
  with recursive lineage(id) as (
   select root_item union
   select child.id from lineage l join generation_jobs j on j.settings->'retryOf'->>'itemId'=l.id::text join generation_items child on child.job_id=j.id
  ) select coalesce(sum(a.cost_inr),0) into legacy_spend from generation_attempts a join lineage l on l.id=a.item_id
    where not exists(select 1 from ai_spend_events e where e.stage='image' and e.item_id=a.item_id and (e.request_id=a.request_id or e.request_id is null));
  used:=used+legacy_spend;
 end if;
 -- Any measured overrun or unknown image charge pauses new image admissions for investigation.
 if p_stage='image' and exists(select 1 from ai_spend_events where policy=p_policy and stage='image' and (status='unknown' or status='complete' and actual_usd*fx_rate>p_limit)) then return false;end if;
 if p_stage='image' and exists(
  select 1 from (
   select budget_job_id,budget_item_id,sum(actual_usd*fx_rate) as cost from ai_spend_events where policy=p_policy and status='complete' and budget_item_id is not null group by budget_job_id,budget_item_id
  ) own join generation_jobs j on j.id=own.budget_job_id
  where own.cost+coalesce((select sum(e.actual_usd*e.fx_rate) from ai_spend_events e where e.budget_job_id=own.budget_job_id and e.budget_item_id is null and e.status='complete'),0)/greatest(j.requested_count,1)>p_limit
 )then return false;end if;
 if used+p_estimate/(case when root_item is null and p_job is not null then greatest(slots,1) else 1 end)>p_limit then return false;end if;
 insert into ai_spend_events(id,organization_id,product_id,job_id,item_id,budget_job_id,budget_item_id,stage,model,policy,estimated_inr,fx_rate)
 values(p_id,p_org,p_product,p_job,p_item,root_job,root_item,p_stage,p_model,p_policy,p_estimate,p_fx);
 return true;
end;$$;
revoke all on function public.reserve_ai_spend(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_ai_spend(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,numeric) to service_role;
