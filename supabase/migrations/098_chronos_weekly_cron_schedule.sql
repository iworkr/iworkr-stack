-- ============================================================================
-- Migration 098: Chronos Weekly Aggregator pg_cron job
-- ============================================================================

do $$
begin
  begin
    perform cron.unschedule('chronos-weekly-aggregation');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'chronos-weekly-aggregation',
    '59 13 * * 0',
    $job$
    select net.http_post(
      url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{"job":"chronos-weekly-aggregation"}'::jsonb
    );
    $job$
  );
exception
  when others then
    -- Safe no-op in local envs missing app settings.
    null;
end $$;

