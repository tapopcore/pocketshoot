-- Two-workspace RLS check. Runs in one transaction and always rolls back (the final RAISE),
-- so it never leaves data behind. Run it in the Supabase SQL editor; the error message holds the results.
do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  oa uuid; ob uuid; pa uuid; pb uuid; r jsonb := '{}'; n int; t text;
begin
  insert into auth.users(id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (ua, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@test.invalid', '{}', now(), now()),
           (ub, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@test.invalid', '{}', now(), now());
  select organization_id into oa from memberships where user_id = ua;
  select organization_id into ob from memberships where user_id = ub;
  insert into products(organization_id, name, category) values (oa, 'A product', 'beauty') returning id into pa;
  insert into products(organization_id, name, category) values (ob, 'B product', 'beauty') returning id into pb;
  insert into support_tickets(organization_id, subject) values (oa, 'A ticket'), (ob, 'B ticket');

  -- signed in as user A
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from products; r := r || jsonb_build_object('A_sees_products', n);
  select count(*) into n from products where id = pb; r := r || jsonb_build_object('A_sees_B_product', n);
  select count(*) into n from organizations where id = ob; r := r || jsonb_build_object('A_sees_B_org', n);
  select count(*) into n from support_tickets where organization_id = ob; r := r || jsonb_build_object('A_sees_B_tickets', n);
  select count(*) into n from wallet_balances where organization_id = ob; r := r || jsonb_build_object('A_sees_B_wallet', n);
  select count(*) into n from profiles where id = ub; r := r || jsonb_build_object('A_sees_B_profile', n);
  select count(*) into n from memberships where user_id = ub; r := r || jsonb_build_object('A_sees_B_membership', n);
  foreach t in array array[
    format('update products set name = %L where id = %L', 'hacked', pb),
    format('delete from products where id = %L', pb),
    format('insert into products(organization_id, name, category) values (%L, %L, %L)', ob, 'x', 'beauty'),
    format('update products set organization_id = %L where id = %L', ob, pa),
    format('insert into memberships(organization_id, user_id, role) values (%L, %L, %L)', ob, ua, 'owner'),
    format('update profiles set platform_role = %L where id = %L', 'platform_admin', ua),
    format('insert into credit_ledger(organization_id, entry_type, quantity) values (%L, %L, 999)', oa, 'grant'),
    format('select reserve_credits(%L::uuid, 1)', gen_random_uuid()),
    'truncate products']
  loop
    begin
      execute t; get diagnostics n = row_count;
      r := r || jsonb_build_object(left(t, 40), 'ALLOWED rows=' || n);
    exception when others then
      r := r || jsonb_build_object(left(t, 40), 'denied');
    end;
  end loop;
  execute 'reset role';

  -- anonymous visitor
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  foreach t in array array['products', 'organizations', 'profiles', 'credit_ledger', 'wallet_balances', 'support_tickets', 'invoices', 'shopify_shops', 'contact_messages']
  loop
    begin
      execute format('select count(*) from %I', t) into n;
      r := r || jsonb_build_object('anon_' || t, n);
    exception when others then r := r || jsonb_build_object('anon_' || t, 'denied');
    end;
  end loop;
  begin
    execute format('insert into contact_messages(name, email, message) values (%L, %L, %L)', 'x', 'x@x.x', 'x');
    r := r || jsonb_build_object('anon_insert_contact', 'ALLOWED');
  exception when others then r := r || jsonb_build_object('anon_insert_contact', 'denied'); end;
  execute 'reset role';
  raise exception 'RLS_RESULTS %', r;
end $$;
