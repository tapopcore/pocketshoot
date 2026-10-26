-- PocketShoot core schema
-- Every tenant-owned row carries organization_id. The app server talks to the
-- database with the service role and always filters by the caller's org;
-- RLS below is a second line of defence for any direct client access.

-- gen_random_uuid() is built into Postgres 13+

-- ---------------------------------------------------------------- identity
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  locale text not null default 'en' check (locale in ('en','hi')),
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  platform_role text check (platform_role in ('platform_support','platform_admin')),
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  country text not null default 'IN',
  currency text not null default 'INR',
  business_type text,
  preferred_language text not null default 'en',
  billing_name text,
  billing_gstin text,
  billing_address text,
  billing_state_code text,
  source text not null default 'web' check (source in ('web','shopify','mobile')),
  status text not null default 'active' check (status in ('active','suspended')),
  suspended_reason text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on public.memberships(user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','editor','viewer')),
  token_hash text not null unique,
  invited_by uuid references public.profiles(id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create table public.shopify_shops (
  id uuid primary key default gen_random_uuid(),
  shop_domain text not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  access_token_enc text,
  scopes text,
  shop_name text,
  shop_email text,
  plan_name text,
  installed_at timestamptz not null default now(),
  uninstalled_at timestamptz,
  redacted_at timestamptz
);

-- ---------------------------------------------------------------- catalogue
create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  logo_key text,
  palette text[] not null default '{}',
  style_rules text,
  default_style text,
  default_output text,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sku text,
  name text not null,
  category text not null,
  locks text[] not null default '{}',
  must_not_change text,
  attributes jsonb not null default '{}',
  source text not null default 'upload' check (source in ('upload','shopify','csv','mobile')),
  shopify_product_id text,
  created_by uuid references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.products(organization_id, created_at desc);
create unique index products_shopify_uniq on public.products(organization_id, shopify_product_id) where shopify_product_id is not null;

create table public.product_assets (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_key text not null,
  view_type text not null default 'front' check (view_type in ('front','angle','back','detail','other')),
  width int, height int, bytes int, mime text,
  checksum text,
  cutout_key text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.product_assets(product_id);

-- ---------------------------------------------------------------- generation
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  source text not null default 'web',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  product_id uuid not null references public.products(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  created_by uuid references public.profiles(id),
  source text not null default 'web' check (source in ('web','shopify','mobile','api')),
  mode text not null check (mode in ('preserve','creative')),
  style text not null,
  output text not null,
  requested_count int not null check (requested_count between 1 and 20),
  custom_brief text,
  settings jsonb not null default '{}',
  status text not null default 'queued',
  idempotency_key text not null,
  credits_reserved int not null default 0,
  is_trial boolean not null default false,
  parent_asset_id uuid,
  is_free_remake boolean not null default false,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (organization_id, idempotency_key)
);
create index on public.generation_jobs(organization_id, created_at desc);
create index on public.generation_jobs(status);

create table public.generation_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idx int not null,
  status text not null default 'queued' check (status in ('queued','preparing','generating','checking','delivered','failed','cancelled')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  locked_by text,
  last_error text,
  decision text check (decision in ('pass','review','fail')),
  delivered_asset_id uuid,
  settled text check (settled in ('captured','released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, idx)
);
create index generation_items_claim on public.generation_items(next_attempt_at) where status in ('queued','preparing','generating','checking');

create table public.generation_attempts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.generation_items(id) on delete cascade,
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  attempt_no int not null,
  provider text not null,
  model text not null,
  request_id text,
  status text not null check (status in ('started','succeeded','failed')),
  prompt_text text,
  prompt_version text,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,5),
  fx_rate numeric(10,4),
  fx_date date,
  cost_inr numeric(10,3),
  latency_ms int,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create index on public.generation_attempts(created_at desc);
create index on public.generation_attempts(job_id);

create table public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  item_id uuid not null references public.generation_items(id) on delete cascade,
  attempt_id uuid references public.generation_attempts(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  storage_key text not null,
  thumb_key text,
  width int, height int,
  quality_status text not null check (quality_status in ('pass','review','fail')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  watermarked boolean not null default false,
  remakes_used int not null default 0,
  delivered_at timestamptz not null default now(),
  shopify_media_id text,
  pushed_to_shopify_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.generated_assets(organization_id, created_at desc);
create index on public.generated_assets(product_id);
alter table public.generation_items add constraint items_asset_fk foreign key (delivered_asset_id) references public.generated_assets(id) on delete set null;
alter table public.generation_jobs add constraint jobs_parent_fk foreign key (parent_asset_id) references public.generated_assets(id) on delete set null;

create table public.quality_checks (
  id uuid primary key default gen_random_uuid(),
  generated_asset_id uuid not null references public.generated_assets(id) on delete cascade,
  check_type text not null,
  score numeric,
  details jsonb not null default '{}',
  decision text not null check (decision in ('pass','review','fail')),
  created_at timestamptz not null default now()
);
create index on public.quality_checks(generated_asset_id);

-- ---------------------------------------------------------------- credits
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);

create table public.credit_lots (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('paid','promo','trial','restored','adjustment')),
  expires_at timestamptz,
  source_type text not null,
  source_ref text,
  created_at timestamptz not null default now()
);
create index on public.credit_lots(wallet_id);

create table public.credit_ledger (
  id bigint generated always as identity primary key,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lot_id uuid not null references public.credit_lots(id) on delete cascade,
  entry_type text not null check (entry_type in ('purchase','promo','trial','adjustment_credit','reserve','release','capture','refund','expiry','chargeback','adjustment_debit')),
  quantity int not null check (quantity > 0),
  job_id uuid references public.generation_jobs(id) on delete set null,
  item_id uuid references public.generation_items(id) on delete set null,
  order_id uuid,
  refund_request_id uuid,
  idempotency_key text unique,
  actor_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index on public.credit_ledger(wallet_id, created_at desc);
create index on public.credit_ledger(lot_id);
create index on public.credit_ledger(job_id);

-- The ledger is append-only.
create function public.forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'credit_ledger is append-only'; end $$;
create trigger credit_ledger_no_update before update or delete on public.credit_ledger
  for each row execute function public.forbid_mutation();

create table public.credit_reservations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.generation_jobs(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quantity int not null,
  captured int not null default 0,
  released int not null default 0,
  status text not null default 'open' check (status in ('open','settled')),
  created_at timestamptz not null default now()
);

create view public.lot_balances with (security_invoker = true) as
select l.id as lot_id, l.wallet_id, l.organization_id, l.kind, l.expires_at, l.created_at, l.source_type, l.source_ref,
  coalesce(sum(e.quantity) filter (where e.entry_type in ('purchase','promo','trial','adjustment_credit')),0)::int as granted,
  (coalesce(sum(e.quantity) filter (where e.entry_type in ('purchase','promo','trial','adjustment_credit','refund','release')),0)
   - coalesce(sum(e.quantity) filter (where e.entry_type in ('reserve','expiry','chargeback','adjustment_debit')),0))::int as available,
  (coalesce(sum(e.quantity) filter (where e.entry_type = 'reserve'),0)
   - coalesce(sum(e.quantity) filter (where e.entry_type in ('release','capture')),0))::int as reserved,
  (coalesce(sum(e.quantity) filter (where e.entry_type = 'capture'),0)
   - coalesce(sum(e.quantity) filter (where e.entry_type = 'refund'),0))::int as consumed,
  coalesce(sum(e.quantity) filter (where e.entry_type = 'expiry'),0)::int as expired
from public.credit_lots l
left join public.credit_ledger e on e.lot_id = l.id
group by l.id;

create view public.wallet_balances with (security_invoker = true) as
select w.id as wallet_id, w.organization_id,
  coalesce(sum(greatest(b.available,0)) filter (where b.expires_at is null or b.expires_at > now()),0)::int as available,
  coalesce(sum(greatest(b.available,0)) filter (where b.kind = 'paid' and (b.expires_at is null or b.expires_at > now())),0)::int as paid_available,
  coalesce(sum(greatest(b.available,0)) filter (where b.kind <> 'paid' and (b.expires_at is null or b.expires_at > now())),0)::int as promo_available,
  coalesce(sum(b.reserved),0)::int as reserved,
  coalesce(sum(b.consumed),0)::int as consumed,
  coalesce(sum(b.expired),0)::int as expired
from public.wallets w
left join public.lot_balances b on b.wallet_id = w.id
group by w.id;

-- ---------------------------------------------------------------- commerce
create table public.pricing_packs (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version int not null default 1,
  name text not null,
  credits int not null check (credits > 0),
  price_minor int not null check (price_minor >= 0),
  currency text not null default 'INR',
  channel text not null default 'web' check (channel in ('web','shopify','ios','android')),
  store_product_id text,
  badge text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (code, channel, version)
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  percent_off int check (percent_off between 0 and 100),
  bonus_credits int not null default 0,
  max_redemptions int,
  redeemed_count int not null default 0,
  per_org_limit int not null default 1,
  valid_until timestamptz,
  pack_codes text[],
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  pack_id uuid references public.pricing_packs(id),
  pack_snapshot jsonb not null,
  credits int not null,
  bonus_credits int not null default 0,
  channel text not null check (channel in ('web','shopify','ios','android')),
  gateway text not null check (gateway in ('razorpay','shopify','revenuecat','sandbox')),
  gateway_order_id text,
  currency text not null,
  list_minor int not null,
  discount_minor int not null default 0,
  taxable_minor int not null,
  tax jsonb not null default '{}',
  tax_minor int not null default 0,
  total_minor int not null,
  status text not null default 'created' check (status in ('created','pending','paid','failed','refunded','cancelled')),
  buyer_name text,
  buyer_gstin text,
  buyer_state_code text,
  place_of_supply text,
  sac_code text,
  coupon_id uuid references public.coupons(id),
  invoice_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index orders_gateway_uniq on public.orders(gateway, gateway_order_id) where gateway_order_id is not null;
create index on public.orders(organization_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  gateway text not null,
  gateway_payment_id text not null,
  status text not null,
  amount_minor int not null,
  method text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (gateway, gateway_payment_id)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_id)
);

create table public.invoice_sequences (fy text primary key, last_seq int not null default 0);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  number text not null unique,
  fy text not null,
  seq int not null,
  seller jsonb not null,
  buyer jsonb not null,
  lines jsonb not null,
  tax jsonb not null,
  total_minor int not null,
  currency text not null,
  issued_at timestamptz not null default now()
);
alter table public.orders add constraint orders_invoice_fk foreign key (invoice_id) references public.invoices(id);

-- ---------------------------------------------------------------- support & trust
create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  generated_asset_id uuid not null references public.generated_assets(id) on delete cascade,
  reason text not null check (reason in ('logo_changed','text_changed','wrong_product','missing_product','extra_items','colour_wrong','shape_wrong','corrupt_image','other')),
  details text,
  evidence jsonb not null default '{}',
  status text not null default 'open' check (status in ('open','approved','rejected','auto_approved')),
  resolution text,
  credits_restored int not null default 0,
  created_by uuid references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (generated_asset_id)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id),
  subject text not null,
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  assignee_id uuid references public.profiles(id),
  related_job_id uuid references public.generation_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.profiles(id),
  is_staff boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  organization_id uuid,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.audit_logs(created_at desc);
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  scope text not null default 'global',
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (key, scope)
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null,
  organization_id uuid,
  user_id uuid,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.analytics_events(name, created_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  severity text not null check (severity in ('info','warning','critical')),
  message text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.app_logs (
  id bigint generated always as identity primary key,
  level text not null,
  source text not null,
  message text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.app_logs(created_at desc);

create table public.trial_grants (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  ip_hash text,
  credits int not null,
  created_at timestamptz not null default now()
);
create index on public.trial_grants(ip_hash, created_at);

create table public.fx_rates (
  rate_date date not null,
  base text not null,
  quote text not null,
  rate numeric(12,6) not null,
  source text,
  primary key (rate_date, base, quote)
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------- functions
create function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
        n int;
begin
  insert into rate_limits(key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = rate_limits.hits + 1
  returning hits into n;
  return n <= p_limit;
end $$;

create function public.grant_credits(
  p_org uuid, p_kind text, p_entry_type text, p_quantity int, p_expires_at timestamptz,
  p_source_type text, p_source_ref text, p_idempotency_key text, p_actor uuid default null, p_note text default null,
  p_order_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_wallet uuid; v_lot uuid; v_existing uuid;
begin
  if p_entry_type not in ('purchase','promo','trial','adjustment_credit') then raise exception 'invalid grant type %', p_entry_type; end if;
  if p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  select lot_id into v_existing from credit_ledger where idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;
  select id into v_wallet from wallets where organization_id = p_org for update;
  if v_wallet is null then raise exception 'wallet not found for org %', p_org; end if;
  insert into credit_lots(wallet_id, organization_id, kind, expires_at, source_type, source_ref)
    values (v_wallet, p_org, p_kind, p_expires_at, p_source_type, p_source_ref) returning id into v_lot;
  insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, idempotency_key, actor_id, note, order_id)
    values (v_wallet, p_org, v_lot, p_entry_type, p_quantity, p_idempotency_key, p_actor, p_note, p_order_id);
  return v_lot;
end $$;

-- Reserves credits for a job. Returns false when the wallet cannot cover it.
create function public.reserve_credits(p_job uuid, p_quantity int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_wallet uuid; v_left int := p_quantity; r record; v_take int;
begin
  if p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if exists (select 1 from credit_reservations where job_id = p_job) then return true; end if;
  select organization_id into v_org from generation_jobs where id = p_job;
  select id into v_wallet from wallets where organization_id = v_org for update;
  for r in
    select lot_id, available from lot_balances
    where wallet_id = v_wallet and available > 0 and (expires_at is null or expires_at > now())
    order by (kind = 'paid'), expires_at nulls last, created_at
  loop
    exit when v_left = 0;
    v_take := least(r.available, v_left);
    insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, job_id, idempotency_key)
      values (v_wallet, v_org, r.lot_id, 'reserve', v_take, p_job, 'reserve:' || p_job || ':' || r.lot_id);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  insert into credit_reservations(job_id, wallet_id, organization_id, quantity) values (p_job, v_wallet, v_org, p_quantity);
  update generation_jobs set credits_reserved = p_quantity where id = p_job;
  return true;
exception when sqlstate 'P0001' then
  return false;
end $$;

-- Captures (charge) or releases (no charge) one credit for a finished item. Idempotent per item.
create function public.settle_item(p_item uuid, p_capture boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_job uuid; v_org uuid; v_wallet uuid; v_settled text; v_lot uuid; v_is_free boolean;
begin
  select i.job_id, i.organization_id, i.settled, j.is_free_remake into v_job, v_org, v_settled, v_is_free
    from generation_items i join generation_jobs j on j.id = i.job_id where i.id = p_item for update of i;
  if v_settled is not null then return v_settled; end if;
  if v_is_free then
    update generation_items set settled = case when p_capture then 'captured' else 'released' end where id = p_item;
    return 'free';
  end if;
  select id into v_wallet from wallets where organization_id = v_org for update;
  -- the lot that still holds an open reservation for this job, spending order
  select e.lot_id into v_lot
  from credit_ledger e join credit_lots l on l.id = e.lot_id
  where e.job_id = v_job
  group by e.lot_id, l.kind, l.expires_at, l.created_at
  having sum(case when e.entry_type = 'reserve' then e.quantity when e.entry_type in ('release','capture') then -e.quantity else 0 end) > 0
  order by (l.kind = 'paid'), l.expires_at nulls last, l.created_at
  limit 1;
  if v_lot is null then
    update generation_items set settled = 'released' where id = p_item;
    return 'nothing_reserved';
  end if;
  insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, job_id, item_id, idempotency_key)
    values (v_wallet, v_org, v_lot, case when p_capture then 'capture' else 'release' end, 1, v_job, p_item,
            (case when p_capture then 'capture:' else 'release:' end) || p_item);
  update generation_items set settled = case when p_capture then 'captured' else 'released' end where id = p_item;
  update credit_reservations set
    captured = captured + case when p_capture then 1 else 0 end,
    released = released + case when p_capture then 0 else 1 end
  where job_id = v_job;
  update credit_reservations set status = 'settled' where job_id = v_job and captured + released >= quantity;
  return case when p_capture then 'captured' else 'released' end;
end $$;

-- Restores the credit captured for an item after a validated product-integrity report.
create function public.refund_item_credit(p_item uuid, p_refund_request uuid, p_actor uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_capture record;
begin
  select * into v_capture from credit_ledger where item_id = p_item and entry_type = 'capture' limit 1;
  if v_capture is null then return false; end if;
  insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, job_id, item_id, refund_request_id, idempotency_key, actor_id)
    values (v_capture.wallet_id, v_capture.organization_id, v_capture.lot_id, 'refund', 1, v_capture.job_id, p_item, p_refund_request, 'refund:' || p_item, p_actor)
    on conflict (idempotency_key) do nothing;
  return true;
end $$;

create function public.adjust_credits(p_org uuid, p_quantity int, p_actor uuid, p_note text, p_idempotency_key text)
returns void language plpgsql security definer set search_path = public as $$
declare v_wallet uuid; v_left int := -p_quantity; r record; v_take int;
begin
  if p_quantity > 0 then
    perform grant_credits(p_org, 'adjustment', 'adjustment_credit', p_quantity, null, 'admin', null, p_idempotency_key, p_actor, p_note);
    return;
  end if;
  if exists (select 1 from credit_ledger where idempotency_key like p_idempotency_key || '%') then return; end if;
  select id into v_wallet from wallets where organization_id = p_org for update;
  for r in select lot_id, available from lot_balances where wallet_id = v_wallet and available > 0 order by (kind = 'paid'), expires_at nulls last loop
    exit when v_left = 0;
    v_take := least(r.available, v_left);
    insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, idempotency_key, actor_id, note)
      values (v_wallet, p_org, r.lot_id, 'adjustment_debit', v_take, p_idempotency_key || ':' || r.lot_id, p_actor, p_note);
    v_left := v_left - v_take;
  end loop;
end $$;

-- Writes expiry entries for lots past their expiry date. Safe to run repeatedly.
create function public.expire_credit_lots() returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select * from lot_balances where expires_at is not null and expires_at <= now() and available > 0 loop
    insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, idempotency_key, note)
      values (r.wallet_id, r.organization_id, r.lot_id, 'expiry', r.available, 'expiry:' || r.lot_id, 'Lot expired')
      on conflict (idempotency_key) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

create function public.next_invoice_seq(p_fy text) returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into invoice_sequences(fy, last_seq) values (p_fy, 1)
  on conflict (fy) do update set last_seq = invoice_sequences.last_seq + 1
  returning last_seq into v;
  return v;
end $$;

-- Hands out work to queue workers. Items whose lease expired are picked up again.
create function public.claim_generation_items(p_worker text, p_limit int, p_lease_seconds int)
returns setof public.generation_items language plpgsql security definer set search_path = public as $$
begin
  return query
  update generation_items i set
    locked_by = p_worker,
    locked_until = now() + make_interval(secs => p_lease_seconds),
    status = case when i.status = 'queued' then 'preparing' else i.status end,
    updated_at = now()
  where i.id in (
    select id from generation_items
    where status in ('queued','preparing','generating','checking')
      and next_attempt_at <= now()
      and (locked_until is null or locked_until < now())
    order by next_attempt_at
    limit p_limit
    for update skip locked
  )
  returning i.*;
end $$;

-- New auth user: profile, personal organization, owner membership, wallet.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_name text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  insert into profiles(id, email, name) values (new.id, new.email, v_name) on conflict (id) do nothing;
  if coalesce(new.raw_user_meta_data->>'skip_org', 'false') = 'true' then return new; end if;
  insert into organizations(name, owner_user_id, source)
    values (coalesce(new.raw_user_meta_data->>'business_name', v_name || '''s workspace'), new.id, coalesce(new.raw_user_meta_data->>'source', 'web'))
    returning id into v_org;
  insert into memberships(organization_id, user_id, role) values (v_org, new.id, 'owner');
  insert into wallets(organization_id) values (v_org);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.is_org_member(p_org uuid, p_roles text[] default array['owner','admin','editor','viewer'])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where organization_id = p_org and user_id = auth.uid() and role = any(p_roles));
$$;

-- ---------------------------------------------------------------- RLS
do $$
declare t text;
begin
  foreach t in array array['profiles','organizations','memberships','invitations','shopify_shops','brand_kits','projects','products',
    'product_assets','batches','generation_jobs','generation_items','generation_attempts','generated_assets','quality_checks','wallets',
    'credit_lots','credit_ledger','credit_reservations','pricing_packs','coupons','orders','payments','webhook_events','invoice_sequences',
    'invoices','refund_requests','support_tickets','support_messages','audit_logs','feature_flags','app_settings','analytics_events',
    'alerts','app_logs','trial_grants','fx_rates','rate_limits']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "member orgs" on public.organizations for select using (public.is_org_member(id));
create policy "member memberships" on public.memberships for select using (public.is_org_member(organization_id));
create policy "active packs" on public.pricing_packs for select using (active);

do $$
declare t text;
begin
  foreach t in array array['brand_kits','projects','products','product_assets','batches','generation_jobs','generation_items',
    'generated_assets','wallets','credit_lots','credit_ledger','credit_reservations','orders','invoices','refund_requests','support_tickets']
  loop
    execute format('create policy "org members read" on public.%I for select using (public.is_org_member(organization_id))', t);
  end loop;
end $$;

-- Ledger and queue functions are for the server only.
revoke execute on function public.grant_credits, public.reserve_credits, public.settle_item, public.refund_item_credit,
  public.adjust_credits, public.expire_credit_lots, public.next_invoice_seq, public.claim_generation_items, public.hit_rate_limit,
  public.handle_new_user
  from public, anon, authenticated;
