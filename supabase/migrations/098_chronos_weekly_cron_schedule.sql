-- ============================================================================
-- @migration ChronosWeeklyCronSchedule
-- @status COMPLETE
-- @description Chronos weekly aggregator pg_cron job for coordination billing
-- @tables cron.job (inserts)
-- @lastAudit 2026-03-22
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

