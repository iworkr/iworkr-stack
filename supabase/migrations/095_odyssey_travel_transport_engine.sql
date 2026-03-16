-- ============================================================================
-- Migration 095: Project Odyssey - Intelligent Travel & Transport Engine
-- Background route tracking, variance analysis, financial split calculation,
-- and transport-assignment compliance controls.
-- ============================================================================

create extension if not exists postgis;

create table if not exists public.shift_travel_logs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.schedule_blocks(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid references public.participant_profiles(id) on delete set null,

  travel_type text not null check (travel_type in ('provider_travel', 'participant_transport')),
  start_time timestamptz not null,
  end_time timestamptz,

  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  start_location geometry(Point, 4326),
  end_location geometry(Point, 4326),

  route_polyline text,
  raw_breadcrumbs jsonb not null default '[]'::jsonb,

  calculated_distance_km numeric(8,2),
  expected_distance_km numeric(8,2),
  claimed_distance_km numeric(8,2) not null default 0,
  travel_minutes integer,

  variance_percent numeric(8,2),
  variance_status text check (variance_status in ('auto_approved', 'flagged_amber', 'manual_review')),

  is_approved boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approval_note text,

  payroll_wage_amount numeric(10,2),
  payroll_allowance_amount numeric(10,2),
  ndis_billed_amount numeric(10,2),
  capped_billable_minutes integer,

  provider_time_item_number text default '01_011_0107_1_1',
  provider_km_item_number text default '01_799_0107_1_1',
  participant_transport_item_number text default '04_590_0125_6_1',

  is_claim_exported boolean not null default false,
  claim_exported_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shift_travel_logs_org on public.shift_travel_logs (organization_id, start_time desc);
create index if not exists idx_shift_travel_logs_shift on public.shift_travel_logs (shift_id);
create index if not exists idx_shift_travel_logs_participant on public.shift_travel_logs (participant_id, start_time desc);
create index if not exists idx_shift_travel_logs_approval on public.shift_travel_logs (organization_id, is_approved, variance_status);
create index if not exists idx_shift_travel_logs_claim_export on public.shift_travel_logs (organization_id, is_claim_exported, is_approved);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_shift_travel_logs_updated_at') then
    create trigger set_shift_travel_logs_updated_at
      before update on public.shift_travel_logs
      for each row execute function public.update_updated_at();
  end if;
end $$;

alter table public.schedule_blocks
  add column if not exists requires_transport boolean default false,
  add column if not exists estimated_transport_km numeric(6,2);

alter table public.participant_profiles
  add column if not exists mmm_zone integer check (mmm_zone between 1 and 7) default 1;

create or replace function public.apply_travel_geometry_from_lat_lng()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.start_lat is not null and new.start_lng is not null then
    new.start_location := st_setsrid(st_makepoint(new.start_lng, new.start_lat), 4326);
  end if;
  if new.end_lat is not null and new.end_lng is not null then
    new.end_location := st_setsrid(st_makepoint(new.end_lng, new.end_lat), 4326);
  end if;
  return new;
end;
$$;

drop trigger if exists set_shift_travel_logs_geometry on public.shift_travel_logs;
create trigger set_shift_travel_logs_geometry
  before insert or update of start_lat, start_lng, end_lat, end_lng
  on public.shift_travel_logs
  for each row execute function public.apply_travel_geometry_from_lat_lng();

create or replace function public.get_provider_travel_cap_minutes(p_mmm_zone integer)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_mmm_zone, 1) between 1 and 3 then 30
    else 60
  end;
$$;

create or replace function public.analyze_travel_variance(p_log_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.shift_travel_logs%rowtype;
  v_variance numeric;
  v_status text;
begin
  select * into v_log from public.shift_travel_logs where id = p_log_id;
  if v_log.id is null then
    raise exception 'Travel log not found';
  end if;

  if coalesce(v_log.expected_distance_km, 0) <= 0 then
    update public.shift_travel_logs
    set variance_percent = null,
        variance_status = 'manual_review',
        is_approved = false
    where id = p_log_id;
    return jsonb_build_object('status', 'manual_review', 'reason', 'No baseline data');
  end if;

  v_variance := abs((coalesce(v_log.claimed_distance_km, 0) - v_log.expected_distance_km) / v_log.expected_distance_km) * 100;
  if v_variance <= 10 then
    v_status := 'auto_approved';
    update public.shift_travel_logs
    set variance_percent = round(v_variance, 2),
        variance_status = v_status,
        is_approved = true,
        approved_at = now()
    where id = p_log_id;
  else
    v_status := 'flagged_amber';
    update public.shift_travel_logs
    set variance_percent = round(v_variance, 2),
        variance_status = v_status,
        is_approved = false
    where id = p_log_id;
  end if;

  return jsonb_build_object(
    'variance_percent', round(v_variance, 2),
    'status', v_status
  );
end;
$$;

create or replace function public.calculate_travel_financials(
  p_log_id uuid,
  p_base_hourly_rate numeric default 35.00,
  p_km_allowance_rate numeric default 0.96,
  p_ndis_hourly_cap numeric default 65.47
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log public.shift_travel_logs%rowtype;
  v_participant_mmm integer := 1;
  v_minutes integer := 0;
  v_claimed_km numeric := 0;
  v_payable_minutes integer := 0;
  v_worker_wages numeric := 0;
  v_allowance numeric := 0;
  v_ndis_total numeric := 0;
  v_cap integer := 60;
begin
  select * into v_log from public.shift_travel_logs where id = p_log_id;
  if v_log.id is null then
    raise exception 'Travel log not found';
  end if;

  if v_log.participant_id is not null then
    select coalesce(pp.mmm_zone, 1) into v_participant_mmm
    from public.participant_profiles pp
    where pp.id = v_log.participant_id;
  end if;

  v_minutes := coalesce(v_log.travel_minutes, greatest(0, floor(extract(epoch from (coalesce(v_log.end_time, now()) - v_log.start_time)) / 60)::int));
  v_claimed_km := coalesce(v_log.claimed_distance_km, 0);

  if v_log.travel_type = 'provider_travel' then
    v_cap := public.get_provider_travel_cap_minutes(v_participant_mmm);
    v_payable_minutes := least(v_minutes, v_cap);
    v_worker_wages := round((p_base_hourly_rate * (v_minutes::numeric / 60.0))::numeric, 2);
    v_allowance := round((v_claimed_km * p_km_allowance_rate)::numeric, 2);
    v_ndis_total := round(((p_ndis_hourly_cap * (v_payable_minutes::numeric / 60.0)) + (v_claimed_km * p_km_allowance_rate))::numeric, 2);
  else
    -- Participant transport: shift wages are handled elsewhere; only km billing/allowance here.
    v_payable_minutes := v_minutes;
    v_worker_wages := 0;
    v_allowance := round((v_claimed_km * p_km_allowance_rate)::numeric, 2);
    v_ndis_total := round((v_claimed_km * p_km_allowance_rate)::numeric, 2);
  end if;

  update public.shift_travel_logs
  set travel_minutes = v_minutes,
      capped_billable_minutes = v_payable_minutes,
      payroll_wage_amount = v_worker_wages,
      payroll_allowance_amount = v_allowance,
      ndis_billed_amount = v_ndis_total
  where id = p_log_id;

  update public.shift_financial_ledgers sfl
  set travel_distance_km = coalesce(v_log.claimed_distance_km, 0),
      travel_duration_mins = v_minutes,
      travel_cost = coalesce(v_allowance, 0) + coalesce(v_worker_wages, 0),
      travel_revenue = coalesce(v_ndis_total, 0),
      updated_at = now()
  where sfl.schedule_block_id = v_log.shift_id;

  return jsonb_build_object(
    'log_id', p_log_id,
    'travel_type', v_log.travel_type,
    'minutes_logged', v_minutes,
    'minutes_billable', v_payable_minutes,
    'worker_wage_amount', v_worker_wages,
    'worker_km_allowance_amount', v_allowance,
    'ndis_billed_amount', v_ndis_total,
    'mmm_zone', v_participant_mmm,
    'provider_travel_cap', case when v_log.travel_type = 'provider_travel' then v_cap else null end
  );
end;
$$;

alter table public.shift_travel_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shift_travel_logs' and policyname = 'Org members view shift travel logs') then
    create policy "Org members view shift travel logs"
      on public.shift_travel_logs for select
      using (
        organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shift_travel_logs' and policyname = 'Workers can insert own travel logs') then
    create policy "Workers can insert own travel logs"
      on public.shift_travel_logs for insert
      with check (
        worker_id = auth.uid()
        and organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shift_travel_logs' and policyname = 'Workers and managers update travel logs') then
    create policy "Workers and managers update travel logs"
      on public.shift_travel_logs for update
      using (
        worker_id = auth.uid()
        or public.user_has_role(organization_id, 'manager')
      )
      with check (
        worker_id = auth.uid()
        or public.user_has_role(organization_id, 'manager')
      );
  end if;
end $$;

grant execute on function public.analyze_travel_variance(uuid) to authenticated, service_role;
grant execute on function public.calculate_travel_financials(uuid, numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.get_provider_travel_cap_minutes(integer) to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.shift_travel_logs;
  exception
    when duplicate_object then
      null;
    when undefined_object then
      null;
  end;
end $$;

