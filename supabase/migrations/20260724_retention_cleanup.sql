-- Data retention enforcement. Applied directly to production 2026-07-24.
--
-- The privacy policy promised deletion that never actually ran:
--   "Technical logs — automatically deleted after 30 days"
--   "Cached profiles — expire after 7 days and are periodically cleaned up"
-- At audit time 6,546 expired cache rows, 45 client-error logs and 2 request
-- logs sat past their stated windows. This makes the promise true and gives
-- every personal-data / log table an enforced retention (GDPR minimisation).
--
-- Runs daily via pg_cron (job "retention-cleanup", 03:17 UTC). The first run
-- was executed manually to clear the backlog.

CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb := '{}'::jsonb;
  n bigint;
BEGIN
  DELETE FROM request_logs WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('request_logs', n);

  DELETE FROM client_errors WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('client_errors', n);

  DELETE FROM edge_function_errors WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('edge_function_errors', n);

  -- Expired rows are never served (reads filter expires_at > now()); deleting
  -- them only removes dead weight and fulfils "periodically cleaned up".
  DELETE FROM scholar_cache WHERE expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('scholar_cache', n);

  -- Pseudonymous usage analytics: 12-month retention.
  DELETE FROM analytics_events WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS n = ROW_COUNT; v := v || jsonb_build_object('analytics_events', n);

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention_cleanup() FROM public, anon, authenticated;

-- Schedule (pg_cron). Idempotent: unschedule any prior job of the same name.
SELECT cron.unschedule('retention-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retention-cleanup');
SELECT cron.schedule('retention-cleanup', '17 3 * * *',
  $cron$SELECT public.run_retention_cleanup();$cron$);
