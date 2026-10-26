-- Public bucket for marketing and UI assets (scene preview images). No customer data goes here.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public', 'public', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;
