-- Average target across a bounded organization pool; legacy policy remains rollback-compatible.
create function public.reserve_ai_spend_per_item_legacy(p_id uuid,p_org uuid,p_product uuid,p_job uuid,p_item uuid,p_stage text,p_model text,p_estimate numeric,p_fx numeric,p_policy text,p_limit numeric)
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
revoke all on function public.reserve_ai_spend_per_item_legacy(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_ai_spend_per_item_legacy(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,numeric) to service_role;

create or replace function public.reserve_ai_spend(p_id uuid,p_org uuid,p_product uuid,p_job uuid,p_item uuid,p_stage text,p_model text,p_estimate numeric,p_fx numeric,p_policy text,p_limit numeric)
returns boolean language plpgsql security definer set search_path=public as $$
declare root_job uuid:=p_job; root_item uuid:=p_item; next_job uuid; next_item uuid; cfg jsonb; slots int:=1; used numeric:=0; pool_used numeric:=0; capacity int:=0; n int:=0;
begin
 if p_policy<>'2026-11-03.pooled-average-2' then
  return public.reserve_ai_spend_per_item_legacy(p_id,p_org,p_product,p_job,p_item,p_stage,p_model,p_estimate,p_fx,p_policy,p_limit);
 end if;
 if p_limit<>5 or p_estimate<0 or p_estimate>p_limit*2 or p_fx<=0 then return false;end if;
 perform pg_advisory_xact_lock(hashtext('pocketshoot-ai-budget-v1'));
 if not exists(select 1 from products where id=p_product and organization_id=p_org) then return false;end if;
 if p_item is not null and not exists(select 1 from generation_items where id=p_item and job_id=p_job and organization_id=p_org) then return false;end if;
 if p_job is null then
  select coalesce(sum(case when status='complete' then coalesce(actual_usd*fx_rate,estimated_inr) else estimated_inr end),0) into used from ai_spend_events where organization_id=p_org and product_id=p_product and budget_job_id is null and status<>'not_sent';
  if used+p_estimate>p_limit then return false;end if;
 else
  loop
   select settings,requested_count into cfg,slots from generation_jobs where id=root_job and organization_id=p_org and product_id=p_product;
   if not found then return false;end if;
   exit when cfg->'retryOf'->>'jobId' is null;
   next_job:=(cfg->'retryOf'->>'jobId')::uuid;next_item:=(cfg->'retryOf'->>'itemId')::uuid;root_job:=next_job;root_item:=next_item;n:=n+1;
   if n>32 then return false;end if;
  end loop;
  if root_item is not null and not exists(select 1 from generation_items where id=root_item and job_id=root_job and organization_id=p_org) then return false;end if;
  update ai_spend_events set budget_job_id=root_job where organization_id=p_org and product_id=p_product and budget_job_id is null;
  select coalesce(sum(case when status='complete' then coalesce(actual_usd*fx_rate,estimated_inr) else estimated_inr end),0) into used from ai_spend_events where organization_id=p_org and budget_job_id=root_job and status<>'not_sent';
  -- Even a pooled budget cannot fund an unbounded retry loop on one job.
  if used+p_estimate>greatest(p_limit*2,p_limit*greatest(slots,1)*1.5) then return false;end if;
  with recursive roots as (
   select j.id,j.requested_count,j.status from generation_jobs j
   where j.organization_id=p_org and j.settings->'retryOf'->>'jobId' is null and
    (j.id=root_job or (coalesce((cfg->>'internalQa')::boolean,false)=false and coalesce((j.settings->>'internalQa')::boolean,false)=false and exists(select 1 from ai_spend_events e where e.budget_job_id=j.id and e.policy=p_policy)))
   order by (j.id=root_job) desc,j.created_at desc limit 100
  ), family(root,id,slot,depth) as (
   select id,id,null::text,0 from roots
   union all
   select f.root,j.id,coalesce(f.slot,j.settings->'retryOf'->>'itemId'),f.depth+1 from family f join generation_jobs j on j.settings->'retryOf'->>'jobId'=f.id::text and j.organization_id=p_org where f.depth<32
  ), deliveries as (
   select f.root,count(distinct coalesce(f.slot,i.id::text))::int delivered from family f join generation_items i on i.job_id=f.id and i.organization_id=p_org where i.status='delivered' group by f.root
  )
  select coalesce(sum(case when r.id=root_job or r.status not in ('completed','review_needed','failed','cancelled') then greatest(r.requested_count,1) else coalesce(d.delivered,0) end),0),
   coalesce((select sum(case when e.status='complete' then coalesce(e.actual_usd*e.fx_rate,e.estimated_inr) else e.estimated_inr end) from ai_spend_events e where e.organization_id=p_org and e.budget_job_id in(select id from roots) and e.status<>'not_sent'),0)
  into capacity,pool_used from roots r left join deliveries d on d.root=r.id;
  if pool_used+p_estimate>p_limit*capacity then return false;end if;
 end if;
 insert into ai_spend_events(id,organization_id,product_id,job_id,item_id,budget_job_id,budget_item_id,stage,model,policy,estimated_inr,fx_rate) values(p_id,p_org,p_product,p_job,p_item,root_job,root_item,p_stage,p_model,p_policy,p_estimate,p_fx);
 return true;
end;$$;
revoke all on function public.reserve_ai_spend(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_ai_spend(uuid,uuid,uuid,uuid,uuid,text,text,numeric,numeric,text,numeric) to service_role;

create index if not exists ai_spend_org_policy_budget_idx on public.ai_spend_events(organization_id,policy,budget_job_id);
create index if not exists generation_jobs_retry_parent_idx on public.generation_jobs(organization_id,(settings->'retryOf'->>'jobId')) where settings->'retryOf'->>'jobId' is not null;
