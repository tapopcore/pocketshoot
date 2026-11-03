-- Brand kit mood words (for example "Natural light", "Calm"), applied to every shoot that uses the kit.
alter table public.brand_kits add column if not exists moods text[] not null default '{}';
