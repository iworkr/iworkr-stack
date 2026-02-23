-- ============================================================
-- 031: Cron Job Registration
-- Registers scheduled jobs using pg_cron extension.
-- These call the Next.js API automation endpoint.
-- ============================================================

-- Ensure pg_cron and pg_net are available
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Grant usage to postgres role (required for pg_cron)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ── Invoice overdue watchdog — runs daily at 8am UTC ────────
select cron.schedule(
  'invoice-overdue-watchdog',
  '0 8 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "invoice-overdue-watchdog"}'::jsonb
  );
  $$
);

-- ── Daily digest emails — runs daily at 7am UTC ────────────
select cron.schedule(
  'daily-digest-emails',
  '0 7 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "daily-digest-emails"}'::jsonb
  );
  $$
);

-- ── Asset service reminders — runs daily at 6am UTC ────────
select cron.schedule(
  'asset-service-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "asset-service-reminders"}'::jsonb
  );
  $$
);

-- ── Subscription sync with Polar — runs every 6 hours ──────
select cron.schedule(
  'sync-polar-subscriptions',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "sync-polar-subscriptions"}'::jsonb
  );
  $$
);

-- ── Automation scheduler — runs every 15 minutes ───────────
select cron.schedule(
  'run-scheduled-automations',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "run-scheduled-automations"}'::jsonb
  );
  $$
);

-- ── Stale job cleanup — runs weekly on Sundays at 3am UTC ──
select cron.schedule(
  'stale-job-cleanup',
  '0 3 * * 0',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "stale-job-cleanup"}'::jsonb
  );
  $$
);

-- ── Expired invite cleanup — runs daily at 2am UTC ─────────
select cron.schedule(
  'expired-invite-cleanup',
  '0 2 * * *',
  $$
  delete from public.organization_invites
  where status = 'pending'
    and expires_at < now();
  $$
);
