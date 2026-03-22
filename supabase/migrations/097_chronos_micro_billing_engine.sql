-- ============================================================================
-- @migration ChronosMicroBillingEngine
-- @status COMPLETE
-- @description Project Chronos — support coordination time entries and micro-billing
-- @tables coordination_time_entries, coordination_invoices, coordination_weekly_summaries
-- @lastAudit 2026-03-22
-- ============================================================================

create extension if not exists btree_gist;

create table if not exists public.coordination_time_entries (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coordinator_id uuid not null references public.profiles(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  raw_duration_minutes integer not null check (raw_duration_minutes >= 1),
  billable_units integer not null check (billable_units >= 1),
  ndis_line_item text not null,
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  total_charge numeric(10,2) not null check (total_charge >= 0),
  billable_charge numeric(10,2) not null default 0 check (billable_charge >= 0),
  unbillable_charge numeric(10,2) not null default 0 check (unbillable_charge >= 0),
  activity_type text not null check (activity_type in ('phone', 'email', 'research', 'meeting', 'report_writing', 'travel', 'other')),
  case_note text not null check (char_length(trim(case_note)) >= 30),
  status text not null default 'unbilled' check (status in ('unbilled', 'aggregated', 'claimed', 'paid', 'written_off')),
  linked_invoice_id uuid references public.invoices(id) on delete set null,
  linked_claim_line_item_id uuid references public.claim_line_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (round(billable_charge + unbillable_charge, 2) = round(total_charge, 2))
);

create index if not exists idx_coord_time_entries_org on public.coordination_time_entries(organization_id, created_at desc);
create index if not exists idx_coord_time_entries_coordinator on public.coordination_time_entries(coordinator_id, created_at desc);
create index if not exists idx_coord_time_entries_participant on public.coordination_time_entries(participant_id, created_at desc);
create index if not exists idx_coord_time_entries_status on public.coordination_time_entries(organization_id, status);
create index if not exists idx_coord_time_entries_weekly on public.coordination_time_entries(organization_id, participant_id, ndis_line_item, status, start_time);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_coordination_time_entries_updated_at') then
    create trigger set_coordination_time_entries_updated_at
      before update on public.coordination_time_entries
      for each row execute function public.update_updated_at();
  end if;
end $$;

create or replace function public.calculate_ndis_micro_billing(
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_hourly_rate numeric
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_raw_minutes integer;
  v_billable_units integer;
  v_total_charge numeric(10,2);
begin
  v_raw_minutes := floor(extract(epoch from (p_end_time - p_start_time)) / 60);
  if v_raw_minutes < 1 then
    v_raw_minutes := 1;
  end if;

  v_billable_units := ceil(v_raw_minutes::numeric / 6.0);
  v_total_charge := round(((v_billable_units * 0.1) * p_hourly_rate)::numeric, 2);

  return jsonb_build_object(
    'raw_minutes', v_raw_minutes,
    'billable_units', v_billable_units,
    'total_charge', v_total_charge
  );
end;
$$;

create or replace function public.prevent_coordination_entry_overlap()
returns trigger
language plpgsql
as $$
declare
  v_overlap interval;
begin
  select least(new.end_time, e.end_time) - greatest(new.start_time, e.start_time)
  into v_overlap
  from public.coordination_time_entries e
  where e.coordinator_id = new.coordinator_id
    and e.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and e.status <> 'written_off'
    and tstzrange(e.start_time, e.end_time, '[)') && tstzrange(new.start_time, new.end_time, '[)')
  order by e.start_time desc
  limit 1;

  if v_overlap is not null and v_overlap > interval '2 minutes' then
    raise exception 'Conflict Detected: You cannot bill two participants for the exact same timeframe. Please adjust your logs.';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'coordination_overlap_guard') then
    create trigger coordination_overlap_guard
      before insert or update on public.coordination_time_entries
      for each row execute function public.prevent_coordination_entry_overlap();
  end if;
end $$;

create or replace function public.prevent_mutation_after_aggregation()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'unbilled' then
    raise exception 'Entry is immutable once aggregated/claimed';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'coordination_immutability_guard') then
    create trigger coordination_immutability_guard
      before update or delete on public.coordination_time_entries
      for each row execute function public.prevent_mutation_after_aggregation();
  end if;
end $$;

create or replace function public.create_coordination_time_entry(
  p_organization_id uuid,
  p_participant_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_ndis_line_item text,
  p_hourly_rate numeric,
  p_activity_type text,
  p_case_note text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_calc jsonb;
  v_raw_minutes integer;
  v_units integer;
  v_total numeric(10,2);
  v_available numeric(10,2);
  v_billable numeric(10,2);
  v_unbillable numeric(10,2);
  v_entry public.coordination_time_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  ) then
    raise exception 'Unauthorized';
  end if;

  v_calc := public.calculate_ndis_micro_billing(p_start_time, p_end_time, p_hourly_rate);
  v_raw_minutes := coalesce((v_calc->>'raw_minutes')::integer, 1);
  v_units := coalesce((v_calc->>'billable_units')::integer, 1);
  v_total := coalesce((v_calc->>'total_charge')::numeric, 0);

  select coalesce(sum(ba.total_budget - ba.consumed_budget - ba.quarantined_budget), 0)
  into v_available
  from public.budget_allocations ba
  where ba.organization_id = p_organization_id
    and ba.participant_id = p_participant_id
    and ba.category = 'capacity_building';

  v_billable := least(v_total, greatest(v_available, 0));
  v_unbillable := round(v_total - v_billable, 2);

  insert into public.coordination_time_entries (
    organization_id,
    coordinator_id,
    participant_id,
    start_time,
    end_time,
    raw_duration_minutes,
    billable_units,
    ndis_line_item,
    hourly_rate,
    total_charge,
    billable_charge,
    unbillable_charge,
    activity_type,
    case_note,
    status,
    metadata
  ) values (
    p_organization_id,
    auth.uid(),
    p_participant_id,
    p_start_time,
    p_end_time,
    v_raw_minutes,
    v_units,
    p_ndis_line_item,
    p_hourly_rate,
    v_total,
    v_billable,
    v_unbillable,
    p_activity_type,
    p_case_note,
    case when v_billable > 0 then 'unbilled' else 'written_off' end,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('created_via', 'chronos')
  )
  returning * into v_entry;

  if v_billable > 0 then
    update public.budget_allocations
    set consumed_budget = round(consumed_budget + v_billable, 2)
    where id = (
      select id
      from public.budget_allocations ba
      where ba.organization_id = p_organization_id
        and ba.participant_id = p_participant_id
        and ba.category = 'capacity_building'
      order by ba.updated_at desc nulls last, ba.created_at desc
      limit 1
    );
  end if;

  return jsonb_build_object(
    'id', v_entry.id,
    'raw_minutes', v_raw_minutes,
    'billable_units', v_units,
    'total_charge', v_total,
    'billable_charge', v_billable,
    'unbillable_charge', v_unbillable,
    'status', v_entry.status
  );
end;
$$;

alter table public.coordination_time_entries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'coordination_time_entries' and policyname = 'Org members can view coordination entries') then
    create policy "Org members can view coordination entries"
      on public.coordination_time_entries
      for select
      using (
        organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'coordination_time_entries' and policyname = 'Coordinators can create own coordination entries') then
    create policy "Coordinators can create own coordination entries"
      on public.coordination_time_entries
      for insert
      with check (
        coordinator_id = auth.uid()
        and organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid() and status = 'active'
        )
      );
  end if;

  if not exists (select 1 from pg_policies where tablename = 'coordination_time_entries' and policyname = 'Coordinators can edit own unbilled entries') then
    create policy "Coordinators can edit own unbilled entries"
      on public.coordination_time_entries
      for update
      using (coordinator_id = auth.uid() and status = 'unbilled')
      with check (coordinator_id = auth.uid() and status = 'unbilled');
  end if;

  if not exists (select 1 from pg_policies where tablename = 'coordination_time_entries' and policyname = 'Admins can write off entries') then
    create policy "Admins can write off entries"
      on public.coordination_time_entries
      for update
      using (
        organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid()
            and status = 'active'
            and role in ('owner', 'admin', 'manager', 'office_admin')
        )
      )
      with check (
        organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid()
            and status = 'active'
            and role in ('owner', 'admin', 'manager', 'office_admin')
        )
      );
  end if;
end $$;

grant execute on function public.calculate_ndis_micro_billing(timestamptz, timestamptz, numeric) to authenticated, service_role;
grant execute on function public.create_coordination_time_entry(uuid, uuid, timestamptz, timestamptz, text, numeric, text, text, jsonb) to authenticated, service_role;

do $$
begin
  begin
    alter publication supabase_realtime add table public.coordination_time_entries;
  exception when others then null;
  end;
end $$;


