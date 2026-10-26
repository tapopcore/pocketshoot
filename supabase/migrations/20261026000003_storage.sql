-- Private buckets. Nothing is public; the server hands out short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('uploads', 'uploads', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('originals', 'originals', false, 52428800, array['image/png','image/jpeg']),
  ('outputs', 'outputs', false, 52428800, array['image/png','image/jpeg','image/webp']),
  ('brand', 'brand', false, 10485760, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;
