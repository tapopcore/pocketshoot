-- Baby Shoot: consumer app on baby-shoot.com, sharing PocketShoot's accounts, wallet, orders and invoices.
-- Additive only. No existing PocketShoot table or row is changed except two CHECK lists that gain 'baby'.

-- 1. Baby Shoot sells its own packs through the existing orders flow.
alter table public.pricing_packs drop constraint if exists pricing_packs_channel_check;
alter table public.pricing_packs add constraint pricing_packs_channel_check check (channel in ('web','shopify','ios','android','baby'));
alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders add constraint orders_channel_check check (channel in ('web','shopify','ios','android','baby'));

-- New sign-ups from baby-shoot.com are marked source = 'baby'.
alter table public.organizations drop constraint if exists organizations_source_check;
alter table public.organizations add constraint organizations_source_check check (source in ('web','shopify','mobile','baby'));

-- Prices are what the parent pays, GST included. price_minor holds that total for the 'baby' channel.
insert into public.pricing_packs (code, version, name, credits, price_minor, currency, channel, badge, sort, active) values
  ('baby_1', 1, 'One photo', 1, 14900, 'INR', 'baby', null, 1, true),
  ('baby_6', 1, '6-photo shoot', 6, 69900, 'INR', 'baby', null, 2, true),
  ('baby_10', 1, '10-photo shoot', 10, 109900, 'INR', 'baby', null, 3, true),
  ('baby_15', 1, '15-photo shoot', 15, 149900, 'INR', 'baby', 'Best value', 4, true)
on conflict (code, channel, version) do nothing;

-- 2. The baby, the parent's preferences and the free first photo.
create table if not exists public.baby_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  baby_name text check (char_length(baby_name) <= 40),
  age_band text check (age_band in ('u2','2-4','1-2','2+')),
  prefs jsonb not null default '{}'::jsonb,
  consent_at timestamptz,
  free_photo_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One free photo per person, whichever way they sign in.
create table if not exists public.baby_free_grants (
  identity_key text primary key,            -- normalised email or phone
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3. Photos of the baby that the parent added (kept 90 days unless they choose otherwise).
create table if not exists public.baby_refs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storage_key text not null,
  width int, height int,
  created_at timestamptz not null default now(),
  delete_after timestamptz not null default now() + interval '90 days'
);
create index if not exists baby_refs_org on public.baby_refs(organization_id, created_at desc);

-- 4. Shoots and the photos in them.
create table if not exists public.baby_shoots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  shape text not null check (shape in ('4:5','1:1','9:16')),
  ref_ids uuid[] not null,
  credits_spent int not null default 0,
  status text not null default 'running' check (status in ('running','done')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists baby_shoots_org on public.baby_shoots(organization_id, created_at desc);

create table if not exists public.baby_photos (
  id uuid primary key default gen_random_uuid(),
  shoot_id uuid not null references public.baby_shoots(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idx int not null,
  theme_id text not null,
  moment int not null default 0,
  status text not null default 'queued' check (status in ('queued','running','done','failed','deleted')),
  storage_key text,
  first_key text,                            -- the first take, kept when the free remake is used
  kept text not null default 'new' check (kept in ('first','new')),
  remade boolean not null default false,
  refunded boolean not null default false,
  feedback text check (feedback in ('yes','no')),
  error_code text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index if not exists baby_photos_shoot on public.baby_photos(shoot_id, idx);
create index if not exists baby_photos_queue on public.baby_photos(status, created_at) where status in ('queued','running');

-- Server-only tables: the app reads and writes them with the service role. No client access.
alter table public.baby_profiles enable row level security;
alter table public.baby_free_grants enable row level security;
alter table public.baby_refs enable row level security;
alter table public.baby_shoots enable row level security;
alter table public.baby_photos enable row level security;

-- 5. Spend Baby Shoot credits only (never PocketShoot credits in a shared wallet), free and refunded ones first. All or nothing; safe to call twice.
create or replace function public.baby_spend(p_org uuid, p_shoot uuid, p_quantity int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_wallet uuid; v_left int := p_quantity; r record; v_take int;
begin
  if p_quantity <= 0 then raise exception 'quantity must be positive'; end if;
  if exists (select 1 from credit_ledger where idempotency_key like 'baby:' || p_shoot || ':%') then return true; end if;
  select id into v_wallet from wallets where organization_id = p_org for update;
  if v_wallet is null then return false; end if;
  if (select coalesce(sum(greatest(available,0)),0) from lot_balances where wallet_id = v_wallet
        and source_type in ('order:baby','baby_free_photo','baby_failed_photo')
        and (expires_at is null or expires_at > now())) < p_quantity then
    return false;
  end if;
  for r in
    select lot_id, available from lot_balances
    where wallet_id = v_wallet and available > 0 and source_type in ('order:baby','baby_free_photo','baby_failed_photo')
      and (expires_at is null or expires_at > now())
    order by (kind = 'paid'), expires_at nulls last, created_at
  loop
    exit when v_left = 0;
    v_take := least(r.available, v_left);
    insert into credit_ledger(wallet_id, organization_id, lot_id, entry_type, quantity, idempotency_key, note)
      values (v_wallet, p_org, r.lot_id, 'adjustment_debit', v_take, 'baby:' || p_shoot || ':' || r.lot_id, 'Baby Shoot photos');
    v_left := v_left - v_take;
  end loop;
  return v_left = 0;
end $$;
revoke all on function public.baby_spend(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.baby_spend(uuid, uuid, int) to service_role;

-- Atomically pick the next queued photos for a worker (used by the background runner and the cron safety net).
create or replace function public.baby_claim(p_limit int)
returns setof public.baby_photos language sql security definer set search_path = public as $$
  update baby_photos set status = 'running', started_at = now(), attempts = attempts + 1
  where id in (
    select id from baby_photos
    where (status = 'queued') or (status = 'running' and started_at < now() - interval '6 minutes' and attempts < 3)
    order by created_at limit p_limit for update skip locked
  ) returning *;
$$;
revoke all on function public.baby_claim(int) from public, anon, authenticated;
grant execute on function public.baby_claim(int) to service_role;

create or replace function public.baby_balance(p_org uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(greatest(available,0)),0)::int from lot_balances
  where organization_id = p_org and source_type in ('order:baby','baby_free_photo','baby_failed_photo')
    and (expires_at is null or expires_at > now());
$$;
revoke all on function public.baby_balance(uuid) from public, anon, authenticated;
grant execute on function public.baby_balance(uuid) to service_role;
