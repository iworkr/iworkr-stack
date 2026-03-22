-- ============================================================================
-- @migration ChoreographyTaskManagementEngine
-- @status COMPLETE
-- @description Project Choreography — care facilities, tasks, routines, SIL daily ops
-- @tables care_facilities, care_tasks, care_routines, daily_ops_logs
-- @lastAudit 2026-03-22
-- ============================================================================

create table if not exists public.care_facilities (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address jsonb default '{}'::jsonb,
  max_capacity integer,
  documents jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_care_facilities_org on public.care_facilities (organization_id, created_at desc);

alter table public.participant_profiles
  add column if not exists facility_id uuid references public.care_facilities(id) on delete set null;

alter table public.schedule_blocks
  add column if not exists facility_id uuid references public.care_facilities(id) on delete set null;

create table if not exists public.task_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  target_type text not null check (target_type in ('participant', 'facility', 'global')),
  participant_id uuid references public.participant_profiles(id) on delete cascade,
  facility_id uuid references public.care_facilities(id) on delete cascade,
  title text not null,
  description text,
  task_type text not null check (task_type in ('checkbox', 'number_input', 'photo_required', 'form_trigger')),
  linked_form_template_id uuid references public.shift_note_templates(id) on delete set null,
  is_mandatory boolean not null default false,
  is_critical boolean not null default false,
  visible_to_family boolean not null default false,
  schedule_cron text not null default '* * * * *',
  time_of_day time,
  trigger_mode text not null default 'calendar' check (trigger_mode in ('calendar', 'per_shift')),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_template_target_guard check (
    (target_type = 'participant' and participant_id is not null)
    or (target_type = 'facility' and facility_id is not null)
    or (target_type = 'global')
  )
);

create index if not exists idx_task_templates_org_active on public.task_templates (organization_id, is_active, created_at desc);
create index if not exists idx_task_templates_facility on public.task_templates (facility_id, is_active) where facility_id is not null;
create index if not exists idx_task_templates_participant on public.task_templates (participant_id, is_active) where participant_id is not null;

create table if not exists public.task_instances (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.task_templates(id) on delete set null,
  shift_id uuid references public.schedule_blocks(id) on delete set null,
  target_date date not null,
  scheduled_for_at timestamptz,
  participant_id uuid references public.participant_profiles(id) on delete set null,
  facility_id uuid references public.care_facilities(id) on delete set null,
  title text not null,
  task_type text not null check (task_type in ('checkbox', 'number_input', 'photo_required', 'form_trigger')),
  is_mandatory boolean not null default false,
  is_critical boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'completed', 'exempted', 'missed')),
  exemption_reason text,
  exemption_note text,
  completed_by_user_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  evidence_data jsonb not null default '{}'::jsonb,
  source text not null default 'template' check (source in ('template', 'ad_hoc')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_instances_org_date on public.task_instances (organization_id, target_date desc, status);
create index if not exists idx_task_instances_facility_date on public.task_instances (facility_id, target_date desc) where facility_id is not null;
create index if not exists idx_task_instances_participant_date on public.task_instances (participant_id, target_date desc) where participant_id is not null;
create index if not exists idx_task_instances_shift on public.task_instances (shift_id) where shift_id is not null;

create unique index if not exists uniq_task_instances_dedupe on public.task_instances (
  template_id,
  target_date,
  coalesce(shift_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(participant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(facility_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create or replace function public.cron_field_matches(
  p_field text,
  p_value integer,
  p_is_dow boolean default false
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_part text;
  v_value integer;
begin
  if p_field is null or btrim(p_field) = '' then
    return false;
  end if;

  if p_field = '*' then
    return true;
  end if;

  foreach v_part in array string_to_array(replace(p_field, ' ', ''), ',')
  loop
    if v_part = '*' then
      return true;
    end if;

    if p_is_dow and right(v_part, 1) = '7' and length(v_part) = 1 then
      v_part := '0';
    end if;

    if v_part ~ '^[0-9]+$' then
      v_value := v_part::integer;
      if v_value = p_value then
        return true;
      end if;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.cron_matches_date(
  p_cron text,
  p_target_date date,
  p_target_time time default '00:00:00'::time
)
returns boolean
language plpgsql
stable
as $$
declare
  v_minute text;
  v_hour text;
  v_dom text;
  v_month text;
  v_dow text;
  v_dow_iso integer;
  v_dow_pg integer;
  v_last_dow date;
  v_last_syntax text;
begin
  v_minute := split_part(p_cron, ' ', 1);
  v_hour := split_part(p_cron, ' ', 2);
  v_dom := split_part(p_cron, ' ', 3);
  v_month := split_part(p_cron, ' ', 4);
  v_dow := split_part(p_cron, ' ', 5);

  if v_minute = '' or v_hour = '' or v_dom = '' or v_month = '' or v_dow = '' then
    return false;
  end if;

  if not public.cron_field_matches(v_minute, extract(minute from p_target_time)::integer) then
    return false;
  end if;

  if not public.cron_field_matches(v_hour, extract(hour from p_target_time)::integer) then
    return false;
  end if;

  if not public.cron_field_matches(v_month, extract(month from p_target_date)::integer) then
    return false;
  end if;

  if v_dom <> '*' and not public.cron_field_matches(v_dom, extract(day from p_target_date)::integer) then
    return false;
  end if;

  if v_dow like 'L%' then
    v_last_syntax := right(v_dow, length(v_dow) - 1);
    if v_last_syntax !~ '^[0-7]$' then
      return false;
    end if;
    v_dow_pg := case when v_last_syntax::integer = 7 then 0 else v_last_syntax::integer end;
    v_last_dow := (date_trunc('month', p_target_date)::date + interval '1 month - 1 day')::date;
    while extract(dow from v_last_dow)::integer <> v_dow_pg loop
      v_last_dow := v_last_dow - interval '1 day';
    end loop;
    return p_target_date = v_last_dow;
  end if;

  v_dow_iso := extract(isodow from p_target_date)::integer;
  v_dow_pg := case when v_dow_iso = 7 then 0 else v_dow_iso end;
  if not public.cron_field_matches(v_dow, v_dow_pg, true) then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.generate_daily_tasks(
  p_target_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template record;
  v_shift record;
  v_inserted integer := 0;
  v_match_time time;
begin
  for v_template in
    select *
    from public.task_templates
    where is_active = true
  loop
    if v_template.trigger_mode = 'per_shift' then
      for v_shift in
        select sb.id, sb.organization_id, sb.participant_id, sb.facility_id, sb.start_time
        from public.schedule_blocks sb
        where sb.organization_id = v_template.organization_id
          and sb.start_time::date = p_target_date
          and (
            (v_template.target_type = 'participant' and sb.participant_id = v_template.participant_id)
            or (v_template.target_type = 'facility' and sb.facility_id = v_template.facility_id)
            or (v_template.target_type = 'global')
          )
      loop
        insert into public.task_instances (
          organization_id,
          template_id,
          shift_id,
          target_date,
          scheduled_for_at,
          participant_id,
          facility_id,
          title,
          task_type,
          is_mandatory,
          is_critical,
          source
        ) select
          v_shift.organization_id,
          v_template.id,
          v_shift.id,
          p_target_date,
          v_shift.start_time,
          coalesce(v_template.participant_id, v_shift.participant_id),
          coalesce(v_template.facility_id, v_shift.facility_id),
          v_template.title,
          v_template.task_type,
          v_template.is_mandatory,
          v_template.is_critical,
          'template'
        where not exists (
          select 1
          from public.task_instances ti
          where ti.template_id is not distinct from v_template.id
            and ti.target_date = p_target_date
            and ti.shift_id is not distinct from v_shift.id
            and ti.participant_id is not distinct from coalesce(v_template.participant_id, v_shift.participant_id)
            and ti.facility_id is not distinct from coalesce(v_template.facility_id, v_shift.facility_id)
        );

        if found then
          v_inserted := v_inserted + 1;
        end if;
      end loop;
    else
      v_match_time := coalesce(v_template.time_of_day, '00:00:00'::time);
      if public.cron_matches_date(v_template.schedule_cron, p_target_date, v_match_time) then
        insert into public.task_instances (
          organization_id,
          template_id,
          target_date,
          scheduled_for_at,
          participant_id,
          facility_id,
          title,
          task_type,
          is_mandatory,
          is_critical,
          source
        ) select
          v_template.organization_id,
          v_template.id,
          p_target_date,
          (p_target_date::timestamp + v_match_time)::timestamptz,
          v_template.participant_id,
          v_template.facility_id,
          v_template.title,
          v_template.task_type,
          v_template.is_mandatory,
          v_template.is_critical,
          'template'
        where not exists (
          select 1
          from public.task_instances ti
          where ti.template_id is not distinct from v_template.id
            and ti.target_date = p_target_date
            and ti.shift_id is null
            and ti.participant_id is not distinct from v_template.participant_id
            and ti.facility_id is not distinct from v_template.facility_id
        );

        if found then
          v_inserted := v_inserted + 1;
        end if;
      end if;
    end if;
  end loop;

  return v_inserted;
exception
  when others then
    begin
      insert into public.telemetry_events (
        event_type,
        severity,
        source,
        message,
        payload
      ) values (
        'choreography_generate_daily_tasks_failed',
        'critical',
        'db:generate_daily_tasks',
        SQLERRM,
        jsonb_build_object('target_date', p_target_date::text)
      );
    exception
      when undefined_table then
        null;
    end;
    raise;
end;
$$;

create or replace function public.complete_task_instance(
  p_task_instance_id uuid,
  p_evidence_data jsonb default '{}'::jsonb
)
returns public.task_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.task_instances;
begin
  update public.task_instances
  set
    status = 'completed',
    completed_by_user_id = auth.uid(),
    completed_at = now(),
    evidence_data = coalesce(task_instances.evidence_data, '{}'::jsonb) || coalesce(p_evidence_data, '{}'::jsonb),
    updated_at = now()
  where id = p_task_instance_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.exempt_task_instance(
  p_task_instance_id uuid,
  p_reason text,
  p_note text default null
)
returns public.task_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.task_instances;
begin
  update public.task_instances
  set
    status = 'exempted',
    exemption_reason = p_reason,
    exemption_note = p_note,
    completed_by_user_id = auth.uid(),
    completed_at = now(),
    evidence_data = coalesce(task_instances.evidence_data, '{}'::jsonb) || jsonb_build_object(
      'exemption_reason', p_reason,
      'exemption_note', p_note
    ),
    updated_at = now()
  where id = p_task_instance_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.create_ad_hoc_task_instance(
  p_organization_id uuid,
  p_shift_id uuid,
  p_title text,
  p_facility_id uuid default null,
  p_participant_id uuid default null,
  p_task_type text default 'checkbox'
)
returns public.task_instances
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.task_instances;
  v_target_date date;
begin
  select coalesce(start_time::date, current_date)
  into v_target_date
  from public.schedule_blocks
  where id = p_shift_id;

  insert into public.task_instances (
    organization_id,
    template_id,
    shift_id,
    target_date,
    scheduled_for_at,
    participant_id,
    facility_id,
    title,
    task_type,
    is_mandatory,
    is_critical,
    source
  ) values (
    p_organization_id,
    null,
    p_shift_id,
    coalesce(v_target_date, current_date),
    now(),
    p_participant_id,
    p_facility_id,
    p_title,
    case when p_task_type in ('checkbox', 'number_input', 'photo_required', 'form_trigger') then p_task_type else 'checkbox' end,
    false,
    false,
    'ad_hoc'
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.get_shift_mandatory_task_gate(
  p_shift_id uuid
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with shift_ctx as (
    select
      sb.id as shift_id,
      sb.organization_id,
      sb.technician_id,
      sb.participant_id,
      sb.facility_id,
      sb.start_time::date as shift_date
    from public.schedule_blocks sb
    where sb.id = p_shift_id
    limit 1
  ),
  pending as (
    select ti.*
    from public.task_instances ti
    join shift_ctx s on s.organization_id = ti.organization_id
    where ti.target_date = s.shift_date
      and ti.is_mandatory = true
      and ti.status = 'pending'
      and (
        ti.shift_id = s.shift_id
        or (ti.shift_id is null and ti.participant_id is not distinct from s.participant_id)
        or (ti.shift_id is null and ti.facility_id is not distinct from s.facility_id)
      )
  )
  select jsonb_build_object(
    'can_clock_out', (select count(*) = 0 from pending),
    'pending_mandatory_count', (select count(*) from pending),
    'pending_task_ids', coalesce((select jsonb_agg(id) from pending), '[]'::jsonb)
  );
$$;

drop trigger if exists set_care_facilities_updated_at on public.care_facilities;
create trigger set_care_facilities_updated_at
  before update on public.care_facilities
  for each row execute function public.update_updated_at();

drop trigger if exists set_task_templates_updated_at on public.task_templates;
create trigger set_task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.update_updated_at();

drop trigger if exists set_task_instances_updated_at on public.task_instances;
create trigger set_task_instances_updated_at
  before update on public.task_instances
  for each row execute function public.update_updated_at();

alter table public.care_facilities enable row level security;
alter table public.task_templates enable row level security;
alter table public.task_instances enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'care_facilities' and policyname = 'Org members can view care facilities'
  ) then
    create policy "Org members can view care facilities"
      on public.care_facilities for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = care_facilities.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'care_facilities' and policyname = 'Managers can manage care facilities'
  ) then
    create policy "Managers can manage care facilities"
      on public.care_facilities for all
      using (public.user_has_role(organization_id, 'manager'))
      with check (public.user_has_role(organization_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'task_templates' and policyname = 'Org members can view task templates'
  ) then
    create policy "Org members can view task templates"
      on public.task_templates for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = task_templates.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'task_templates' and policyname = 'Managers can manage task templates'
  ) then
    create policy "Managers can manage task templates"
      on public.task_templates for all
      using (public.user_has_role(organization_id, 'manager'))
      with check (public.user_has_role(organization_id, 'manager'));
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'task_instances' and policyname = 'Org members can view task instances'
  ) then
    create policy "Org members can view task instances"
      on public.task_instances for select
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = task_instances.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'task_instances' and policyname = 'Org members can insert task instances'
  ) then
    create policy "Org members can insert task instances"
      on public.task_instances for insert
      with check (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = task_instances.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'task_instances' and policyname = 'Workers can update own completed task instances'
  ) then
    create policy "Workers can update own completed task instances"
      on public.task_instances for update
      using (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = task_instances.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
      with check (
        exists (
          select 1
          from public.organization_members m
          where m.organization_id = task_instances.organization_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      );
  end if;
end
$$;

grant execute on function public.generate_daily_tasks(date) to authenticated, service_role;
grant execute on function public.complete_task_instance(uuid, jsonb) to authenticated, service_role;
grant execute on function public.exempt_task_instance(uuid, text, text) to authenticated, service_role;
grant execute on function public.create_ad_hoc_task_instance(uuid, uuid, text, uuid, uuid, text) to authenticated, service_role;
grant execute on function public.get_shift_mandatory_task_gate(uuid) to authenticated, service_role;
grant execute on function public.cron_matches_date(text, date, time) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_instances'
  ) then
    alter publication supabase_realtime add table public.task_instances;
  end if;
exception
  when undefined_object then
    null;
end $$;

do $$
begin
  begin
    perform cron.unschedule('generate-daily-tasks');
  exception
    when others then
      null;
  end;

  perform cron.schedule(
    'generate-daily-tasks',
    '1 0 * * *',
    $task$select public.generate_daily_tasks(current_date);$task$
  );
exception
  when undefined_table then
    null;
end $$;

comment on table public.care_facilities is 'Project Choreography: SIL/SDA house/facility entities for shared operations.';
comment on table public.task_templates is 'Project Choreography: reusable routine/task blueprints.';
comment on table public.task_instances is 'Project Choreography: generated daily task execution ledger.';
