-- ============================================================================
-- Migration 102: Project Convoy — Complex Fleet & Asset Management
-- ============================================================================

create extension if not exists btree_gist;

create table if not exists public.fleet_vehicles (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_facility_id uuid references public.care_facilities(id) on delete set null,
  name text not null,
  registration_number text not null,
  make text not null,
  model text not null,
  year integer,
  vin text,
  is_wav boolean not null default false,
  wav_type text not null default 'none' check (wav_type in ('rear_entry', 'side_entry', 'none')),
  wheelchair_capacity integer not null default 0,
  seating_capacity integer not null default 1,
  status text not null default 'active' check (status in ('active', 'in_use', 'maintenance', 'out_of_service_defect', 'out_of_service_compliance')),
  current_odometer numeric(10,2) not null default 0.00,
  fuel_type text check (fuel_type in ('petrol', 'diesel', 'ev', 'hybrid')),
  registration_expiry date,
  insurance_expiry date,
  hoist_service_expiry date,
  roadside_provider text,
  roadside_contact text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, registration_number)
);

create index if not exists idx_fleet_vehicles_org on public.fleet_vehicles (organization_id, status, created_at desc);
create index if not exists idx_fleet_vehicles_facility on public.fleet_vehicles (assigned_facility_id, status) where assigned_facility_id is not null;

create table if not exists public.vehicle_bookings (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  shift_id uuid not null references public.schedule_blocks(id) on delete cascade,
  worker_id uuid references public.profiles(id) on delete set null,
  booked_start timestamptz not null,
  booked_end timestamptz not null,
  checkout_time timestamptz,
  checkin_time timestamptz,
  checkout_odometer numeric(10,2),
  checkin_odometer numeric(10,2),
  fuel_level_percent integer check (fuel_level_percent between 0 and 100),
  status text not null default 'scheduled' check (status in ('scheduled', 'checked_out', 'completed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_booking_time_guard check (booked_end > booked_start),
  exclude using gist (
    vehicle_id with =,
    tstzrange(booked_start, booked_end, '[)') with &&
  ) where (status in ('scheduled', 'checked_out'))
);

create index if not exists idx_vehicle_bookings_vehicle_time on public.vehicle_bookings (vehicle_id, booked_start, booked_end);
create index if not exists idx_vehicle_bookings_shift on public.vehicle_bookings (shift_id);
create index if not exists idx_vehicle_bookings_org_status on public.vehicle_bookings (organization_id, status, booked_start);

create table if not exists public.vehicle_inspections (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  booking_id uuid references public.vehicle_bookings(id) on delete set null,
  worker_id uuid references public.profiles(id) on delete set null,
  inspection_type text not null check (inspection_type in ('checkout', 'checkin', 'routine_audit')),
  inspection_data jsonb not null default '{}'::jsonb,
  has_defects boolean not null default false,
  fuel_level_percent integer check (fuel_level_percent between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_inspections_vehicle on public.vehicle_inspections (vehicle_id, created_at desc);
create index if not exists idx_vehicle_inspections_booking on public.vehicle_inspections (booking_id);

create table if not exists public.vehicle_defects (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  reported_in_inspection_id uuid references public.vehicle_inspections(id) on delete set null,
  booking_id uuid references public.vehicle_bookings(id) on delete set null,
  severity text not null check (severity in ('minor', 'major', 'critical_grounded')),
  description text not null,
  photo_urls text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'scheduled_for_repair', 'resolved')),
  resolved_at timestamptz,
  resolved_by_user_id uuid references public.profiles(id) on delete set null,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_defects_vehicle on public.vehicle_defects (vehicle_id, status, created_at desc);
create index if not exists idx_vehicle_defects_org on public.vehicle_defects (organization_id, status, severity);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_fleet_vehicles_updated_at') then
    create trigger set_fleet_vehicles_updated_at
      before update on public.fleet_vehicles
      for each row execute function public.update_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'set_vehicle_bookings_updated_at') then
    create trigger set_vehicle_bookings_updated_at
      before update on public.vehicle_bookings
      for each row execute function public.update_updated_at();
  end if;
end $$;

create or replace function public.convoy_requires_wav(
  p_participant_id uuid
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_profile record;
  v_text text;
begin
  if p_participant_id is null then
    return false;
  end if;

  select
    mobility_requirements,
    mobility_status,
    coalesce(array_to_string(critical_alerts, ' '), '') as critical_text
  into v_profile
  from public.participant_profiles
  where id = p_participant_id;

  v_text := lower(
    coalesce(v_profile.mobility_requirements, '') || ' ' ||
    coalesce(v_profile.mobility_status, '') || ' ' ||
    coalesce(v_profile.critical_text, '')
  );

  return (
    v_text like '%wheelchair%'
    or v_text like '%power chair%'
    or v_text like '%hoist%'
  );
end;
$$;

create or replace function public.convoy_validate_booking_wav_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_shift record;
  v_vehicle record;
begin
  select participant_id into v_shift
  from public.schedule_blocks
  where id = new.shift_id;

  select is_wav, wav_type, status, organization_id
  into v_vehicle
  from public.fleet_vehicles
  where id = new.vehicle_id;

  if v_vehicle.organization_id is null then
    raise exception 'Vehicle not found';
  end if;

  if v_vehicle.status not in ('active', 'in_use') then
    raise exception 'Vehicle is not available for booking (status=%)', v_vehicle.status;
  end if;

  if public.convoy_requires_wav(v_shift.participant_id) and (v_vehicle.is_wav is distinct from true or v_vehicle.wav_type = 'none') then
    raise exception 'WAV required for participant mobility profile; standard vehicle blocked';
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_convoy_validate_booking_wav_match on public.vehicle_bookings;
create trigger trigger_convoy_validate_booking_wav_match
  before insert or update of vehicle_id, shift_id
  on public.vehicle_bookings
  for each row execute function public.convoy_validate_booking_wav_match();

create or replace function public.convoy_ground_expired_vehicles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.fleet_vehicles
  set status = 'out_of_service_compliance',
      updated_at = now()
  where status in ('active', 'in_use')
    and (
      (registration_expiry is not null and registration_expiry < current_date)
      or (insurance_expiry is not null and insurance_expiry < current_date)
      or (is_wav = true and hoist_service_expiry is not null and hoist_service_expiry < current_date)
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Odyssey interception: company vehicle usage suppresses worker km allowance.
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
  v_has_company_vehicle boolean := false;
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

  select exists(
    select 1
    from public.vehicle_bookings vb
    where vb.shift_id = v_log.shift_id
      and vb.status in ('checked_out', 'completed')
  ) into v_has_company_vehicle;

  v_minutes := coalesce(v_log.travel_minutes, greatest(0, floor(extract(epoch from (coalesce(v_log.end_time, now()) - v_log.start_time)) / 60)::int));
  v_claimed_km := coalesce(v_log.claimed_distance_km, 0);

  if v_log.travel_type = 'provider_travel' then
    v_cap := public.get_provider_travel_cap_minutes(v_participant_mmm);
    v_payable_minutes := least(v_minutes, v_cap);
    v_worker_wages := round((p_base_hourly_rate * (v_minutes::numeric / 60.0))::numeric, 2);
    if v_has_company_vehicle then
      v_allowance := 0;
    else
      v_allowance := round((v_claimed_km * p_km_allowance_rate)::numeric, 2);
    end if;
    v_ndis_total := round(((p_ndis_hourly_cap * (v_payable_minutes::numeric / 60.0)) + (v_claimed_km * p_km_allowance_rate))::numeric, 2);
  else
    v_payable_minutes := v_minutes;
    v_worker_wages := 0;
    if v_has_company_vehicle then
      v_allowance := 0;
    else
      v_allowance := round((v_claimed_km * p_km_allowance_rate)::numeric, 2);
    end if;
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
    'provider_travel_cap', case when v_log.travel_type = 'provider_travel' then v_cap else null end,
    'company_vehicle_used', v_has_company_vehicle
  );
end;
$$;

alter table public.fleet_vehicles enable row level security;
alter table public.vehicle_bookings enable row level security;
alter table public.vehicle_inspections enable row level security;
alter table public.vehicle_defects enable row level security;

create policy "Org members view fleet vehicles"
  on public.fleet_vehicles for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Managers manage fleet vehicles"
  on public.fleet_vehicles for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

create policy "Org members view vehicle bookings"
  on public.vehicle_bookings for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Workers and managers manage vehicle bookings"
  on public.vehicle_bookings for all
  using (
    worker_id = auth.uid()
    or public.user_has_role(organization_id, 'manager')
  )
  with check (
    worker_id = auth.uid()
    or public.user_has_role(organization_id, 'manager')
  );

create policy "Org members view vehicle inspections"
  on public.vehicle_inspections for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Workers and managers manage vehicle inspections"
  on public.vehicle_inspections for all
  using (
    worker_id = auth.uid()
    or public.user_has_role(organization_id, 'manager')
  )
  with check (
    worker_id = auth.uid()
    or public.user_has_role(organization_id, 'manager')
  );

create policy "Org members view vehicle defects"
  on public.vehicle_defects for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Workers and managers manage vehicle defects"
  on public.vehicle_defects for all
  using (
    public.user_has_role(organization_id, 'manager')
    or exists (
      select 1 from public.vehicle_bookings vb
      where vb.id = vehicle_defects.booking_id and vb.worker_id = auth.uid()
    )
  )
  with check (
    public.user_has_role(organization_id, 'manager')
    or exists (
      select 1 from public.vehicle_bookings vb
      where vb.id = vehicle_defects.booking_id and vb.worker_id = auth.uid()
    )
  );

grant execute on function public.convoy_ground_expired_vehicles() to authenticated, service_role;
grant execute on function public.convoy_requires_wav(uuid) to authenticated, service_role;
grant execute on function public.calculate_travel_financials(uuid, numeric, numeric, numeric) to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.fleet_vehicles;
  exception when duplicate_object then null; when undefined_object then null; end;
  begin
    alter publication supabase_realtime add table public.vehicle_bookings;
  exception when duplicate_object then null; when undefined_object then null; end;
  begin
    alter publication supabase_realtime add table public.vehicle_defects;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- Optional pg_cron schedule (runs daily at 02:10). Safe no-op if pg_cron unavailable.
do $$
begin
  begin
    if not exists (select 1 from cron.job where jobname = 'convoy_daily_grounding') then
      perform cron.schedule(
        'convoy_daily_grounding',
        '10 2 * * *',
        'select public.convoy_ground_expired_vehicles();'
      );
    end if;
  exception when undefined_table then
    null;
  end;
end $$;
