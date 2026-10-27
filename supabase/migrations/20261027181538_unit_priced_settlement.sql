-- Each accepted image settles the exact per-image amount frozen on its job.
create or replace function public.settle_item(p_item uuid, p_capture boolean)
returns text language plpgsql security definer set search_path=public as $$
declare v_job uuid; v_org uuid; v_wallet uuid; v_settled text; v_free boolean; v_unit int; v_left int; v_take int; r record;
begin
 select i.job_id,i.organization_id,i.settled,j.is_free_remake,
 greatest(1,coalesce((j.settings->>'creditsPerImage')::int,j.credits_reserved/greatest(1,j.requested_count)))
 into v_job,v_org,v_settled,v_free,v_unit
 from generation_items i join generation_jobs j on j.id=i.job_id where i.id=p_item for update of i;
 if not found then return 'not_found'; end if;
 if v_settled is not null then return v_settled; end if;
 if v_free then
  update generation_items set settled=case when p_capture then 'captured' else 'released' end where id=p_item;
  return 'free';
 end if;
 select id into v_wallet from wallets where organization_id=v_org for update;
 if not exists(select 1 from credit_reservations where job_id=v_job) then
  update generation_items set settled='released' where id=p_item; return 'nothing_reserved';
 end if;
 v_left:=v_unit;
 for r in
  select e.lot_id,sum(case when e.entry_type='reserve' then e.quantity when e.entry_type in ('release','capture') then -e.quantity else 0 end)::int as remaining
  from credit_ledger e join credit_lots l on l.id=e.lot_id where e.job_id=v_job
  group by e.lot_id,l.kind,l.expires_at,l.created_at
  having sum(case when e.entry_type='reserve' then e.quantity when e.entry_type in ('release','capture') then -e.quantity else 0 end)>0
  order by (l.kind='paid'),l.expires_at nulls last,l.created_at
 loop
  exit when v_left=0;
  v_take:=least(r.remaining,v_left);
  insert into credit_ledger(wallet_id,organization_id,lot_id,entry_type,quantity,job_id,item_id,idempotency_key)
   values(v_wallet,v_org,r.lot_id,case when p_capture then 'capture' else 'release' end,v_take,v_job,p_item,
    (case when p_capture then 'capture:' else 'release:' end)||p_item||':'||r.lot_id);
  v_left:=v_left-v_take;
 end loop;
 if v_left<>0 then raise exception 'reservation amount does not cover this item'; end if;
 update generation_items set settled=case when p_capture then 'captured' else 'released' end where id=p_item;
 update credit_reservations set captured=captured+case when p_capture then v_unit else 0 end,
  released=released+case when p_capture then 0 else v_unit end where job_id=v_job;
 update credit_reservations set status='settled' where job_id=v_job and captured+released>=quantity;
 return case when p_capture then 'captured' else 'released' end;
end $$;

create or replace function public.refund_item_credit(p_item uuid,p_refund_request uuid,p_actor uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare r record; v_any boolean:=false;
begin
 perform 1 from generation_items where id=p_item for update;
 if not found then return false; end if;
 if exists(select 1 from credit_ledger where item_id=p_item and entry_type='refund') then return true; end if;
 for r in select * from credit_ledger where item_id=p_item and entry_type='capture'
 loop
  insert into credit_ledger(wallet_id,organization_id,lot_id,entry_type,quantity,job_id,item_id,refund_request_id,idempotency_key,actor_id)
   values(r.wallet_id,r.organization_id,r.lot_id,'refund',r.quantity,r.job_id,p_item,p_refund_request,'refund:'||p_item||':'||r.lot_id,p_actor)
   on conflict(idempotency_key) do nothing;
  v_any:=true;
 end loop;
 return v_any;
end $$;
revoke execute on function public.settle_item(uuid,boolean),public.refund_item_credit(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.settle_item(uuid,boolean),public.refund_item_credit(uuid,uuid,uuid) to service_role;
