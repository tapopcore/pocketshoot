-- Run once after deploying the web app. Replace APP_URL and CRON_SECRET.
-- Requires the pg_cron and pg_net extensions (both available on Supabase).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Queue worker: every minute
select cron.schedule('packshot-worker', '* * * * *', $$
  select net.http_post(
    url := 'APP_URL/api/worker/tick',
    headers := jsonb_build_object('authorization', 'Bearer CRON_SECRET', 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
$$);

-- Daily checks: expiry, retention, exchange rate, alerts (02:30 IST = 21:00 UTC)
select cron.schedule('packshot-daily', '0 21 * * *', $$
  select net.http_post(
    url := 'APP_URL/api/cron/daily',
    headers := jsonb_build_object('authorization', 'Bearer CRON_SECRET', 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
$$);

-- Keep rate-limit and old pg_net rows small
select cron.schedule('packshot-cleanup', '15 21 * * *', $$
  delete from public.rate_limits where window_start < now() - interval '2 days';
$$);
