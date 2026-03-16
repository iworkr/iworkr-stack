-- ============================================================================
-- Migration 108: Panopticon Mobile Black Box Telemetry Ledger
-- Creates mobile_telemetry_events, RLS, and triage trigger wiring.
-- ============================================================================

create table if not exists public.mobile_telemetry_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  worker_id uuid references public.profiles(id) on delete set null,

  -- Error signatures
  error_type text not null,
  error_message text not null,
  stack_trace text,

  -- Context payloads
  breadcrumbs jsonb not null default '[]'::jsonb,
  device_metrics jsonb not null default '{}'::jsonb,
  gps_location geometry(Point, 4326),

  -- Visual evidence
  screenshot_url text,

  -- Resolution workflow
  status text not null default 'unresolved'
    check (status in ('unresolved', 'investigating', 'resolved', 'ignored')),
  app_version text not null default 'unknown',

  -- Raw payload for forensic replay
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_mobile_telemetry_events_created_at
  on public.mobile_telemetry_events (created_at desc);
create index if not exists idx_mobile_telemetry_events_status
  on public.mobile_telemetry_events (status, created_at desc);
create index if not exists idx_mobile_telemetry_events_error_type
  on public.mobile_telemetry_events (error_type, created_at desc);

alter table public.mobile_telemetry_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'mobile_telemetry_events'
      and policyname = 'Workers can insert mobile telemetry'
  ) then
    create policy "Workers can insert mobile telemetry"
      on public.mobile_telemetry_events
      for insert
      to authenticated
      with check (worker_id is null or auth.uid() = worker_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'mobile_telemetry_events'
      and policyname = 'Admins can read mobile telemetry'
  ) then
    create policy "Admins can read mobile telemetry"
      on public.mobile_telemetry_events
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.is_super_admin = true
        )
        or exists (
          select 1
          from public.organization_members om
          where om.user_id = auth.uid()
            and om.organization_id = mobile_telemetry_events.organization_id
            and om.status = 'active'
            and om.role in ('owner', 'admin', 'manager')
        )
      );
  end if;
end $$;

-- Keep the existing Olympus telemetry dashboard live by mirroring mobile events.
create or replace function public.mirror_mobile_telemetry_to_panopticon()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.telemetry_events (
    event_timestamp,
    severity,
    status,
    organization_id,
    user_id,
    platform,
    app_version,
    route,
    last_action,
    error_name,
    error_message,
    stack_trace,
    payload,
    has_screenshot,
    screenshot_path,
    console_buffer
  ) values (
    new.created_at,
    case when upper(new.error_type) like '%PGRST%' then 'fatal' else 'warning' end,
    new.status,
    new.organization_id,
    new.worker_id,
    'mobile_ios',
    new.app_version,
    new.payload ->> 'route',
    new.payload ->> 'last_action',
    new.error_type,
    new.error_message,
    new.stack_trace,
    new.payload,
    new.screenshot_url is not null,
    new.screenshot_url,
    coalesce(new.breadcrumbs, '[]'::jsonb)
  );
  return new;
end;
$$;

drop trigger if exists trg_mirror_mobile_telemetry_to_panopticon
  on public.mobile_telemetry_events;
create trigger trg_mirror_mobile_telemetry_to_panopticon
  after insert on public.mobile_telemetry_events
  for each row execute function public.mirror_mobile_telemetry_to_panopticon();

-- Critical triage trigger -> Edge Function
create or replace function public.process_mobile_telemetry_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _base_url text;
  _anon_key text;
begin
  _base_url := current_setting('app.settings.supabase_url', true);
  _anon_key := current_setting('app.settings.supabase_anon_key', true);

  if _base_url is not null and _anon_key is not null then
    perform net.http_post(
      url := _base_url || '/functions/v1/process-telemetry-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('record', row_to_json(new))
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_process_mobile_telemetry_alert
  on public.mobile_telemetry_events;
create trigger trg_process_mobile_telemetry_alert
  after insert on public.mobile_telemetry_events
  for each row execute function public.process_mobile_telemetry_alert();

