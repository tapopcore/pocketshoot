-- Removes whatever is still unspent from the lot(s) created for an order that was refunded or charged back.
create function public.chargeback_order(p_order uuid, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select b.* from lot_balances b join credit_lots l on l.id = b.lot_id
           where l.source_ref = p_order::text and b.available > 0 loop
    insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, order_id, idempotency_key, note)
      values (r.wallet_id, r.organization_id, r.lot_id, 'chargeback', r.available, p_order, 'chargeback:' || r.lot_id, p_reason)
      on conflict (idempotency_key) do nothing;
    n := n + r.available;
  end loop;
  return n;
end $$;
revoke execute on function public.chargeback_order from public, anon, authenticated;
