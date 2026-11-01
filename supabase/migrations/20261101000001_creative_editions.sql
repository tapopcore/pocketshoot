create table public.shoot_creative_editions(
 job_id uuid primary key references public.generation_jobs(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 family text not null,edition bigint not null check(edition>0),created_at timestamptz not null default now(),
 unique(organization_id,family,edition)
);
create index shoot_creative_product on public.shoot_creative_editions(organization_id,product_id);
create index product_assets_org_checksum on public.product_assets(organization_id,checksum);
alter table public.shoot_creative_editions enable row level security;
revoke all on public.shoot_creative_editions from public,anon,authenticated;
grant all on public.shoot_creative_editions to service_role;
create function public.reserve_creative_edition(p_job uuid,p_org uuid,p_family text,p_related uuid[])
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing public.shoot_creative_editions; pid uuid; chosen text; next_edition bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,1));
 select * into existing from shoot_creative_editions where job_id=p_job;
 if found then
  if existing.organization_id<>p_org then raise exception 'Workspace mismatch';end if;
  return jsonb_build_object('family',existing.family,'edition',existing.edition);
 end if;
 select product_id into pid from generation_jobs where id=p_job and organization_id=p_org;
 if not found then raise exception 'Job not found';end if;
 if exists(select 1 from unnest(p_related) r(id) left join products p on p.id=r.id and p.organization_id=p_org where p.id is null) then raise exception 'Workspace mismatch';end if;
 select family into chosen from shoot_creative_editions where organization_id=p_org and (product_id=pid or product_id=any(p_related)) order by created_at,job_id limit 1;
 chosen:=coalesce(chosen,p_family);
 select coalesce(max(edition),0)+1 into next_edition from shoot_creative_editions where organization_id=p_org and family=chosen;
 insert into shoot_creative_editions(job_id,organization_id,product_id,family,edition)values(p_job,p_org,pid,chosen,next_edition);
 return jsonb_build_object('family',chosen,'edition',next_edition);
end;$$;
revoke all on function public.reserve_creative_edition(uuid,uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function public.reserve_creative_edition(uuid,uuid,text,uuid[]) to service_role;
