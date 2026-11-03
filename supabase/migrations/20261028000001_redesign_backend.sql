-- Redesign backend additions: contact form inbox and notification preferences.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254),
  topic text not null default 'other' check (topic in ('photo','payment','bulk','other')),
  message text not null check (char_length(message) between 1 and 4000),
  ip_hash text,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
-- No policies: only the service role (server) reads and writes this table.
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_ip_idx on public.contact_messages (ip_hash, created_at desc);

alter table public.profiles
  add column if not exists notify_ready boolean not null default true,
  add column if not exists notify_low_credits boolean not null default true,
  add column if not exists notify_news boolean not null default false;
