-- Keeps the app's page function warm so the first tap after a quiet spell doesn't wait for a cold start.
-- Applied to production on 2026-11-01. Skipped where pg_cron is not installed (local tests).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule('pocketshoot-keep-warm') where exists (select 1 from cron.job where jobname = 'pocketshoot-keep-warm');
    perform cron.schedule('pocketshoot-keep-warm', '*/2 * * * *', 'select net.http_get(url := ''https://pocketshoot.vercel.app/api/version?warm=1'', timeout_milliseconds := 5000);');
  end if;
end $$;
