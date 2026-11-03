-- Defence in depth. The app writes only through the server (service role) and RPCs,
-- and RLS already blocks every client write, but signed-in and anonymous clients still
-- held table-level INSERT/UPDATE/DELETE/TRUNCATE grants. Remove them so a future policy
-- mistake cannot open writes. Reads stay governed by the existing RLS policies.
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;
