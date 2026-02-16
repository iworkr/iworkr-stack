-- ============================================================
-- Migration 022: Schedule Module Enhancements
-- schedule_events table, estimated_duration_minutes on jobs,
-- conflict detection RPC, schedule view RPC, realtime
-- ============================================================

-- ── 1. Add estimated_duration_minutes to jobs ───────────
alter table public.jobs
  add column if not exists estimated_duration_minutes int default 60;

-- ── 2. Schedule Events table (non-job blocks) ──────────
do $$ begin
  create type public.schedule_event_type as enum ('break', 'meeting', 'personal', 'unavailable');
exception when duplicate_object then null;
end $$;

create table if not exists public.schedule_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  type            public.schedule_event_type not null default 'break',
  title           text not null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_schedule_events_org
  on public.schedule_events (organization_id);

create index if not exists idx_schedule_events_user_time
  on public.schedule_events (user_id, start_time);

-- RLS
alter table public.schedule_events enable row level security;

create policy "Members can read org schedule events"
  on public.schedule_events for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can create org schedule events"
  on public.schedule_events for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can update org schedule events"
  on public.schedule_events for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can delete org schedule events"
  on public.schedule_events for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- ── 3. RPC: Check schedule conflicts ────────────────────
create or replace function public.check_schedule_conflicts(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      a.id as block_a_id,
      b.id as block_b_id,
      a.technician_id,
      a.title as block_a_title,
      b.title as block_b_title,
      a.start_time as block_a_start,
      a.end_time as block_a_end,
      b.start_time as block_b_start,
      b.end_time as block_b_end
    from public.schedule_blocks a
    join public.schedule_blocks b
      on a.technician_id = b.technician_id
      and a.id < b.id
      and a.start_time < b.end_time
      and a.end_time > b.start_time
    where a.organization_id = p_org_id
      and a.status != 'cancelled'
      and b.status != 'cancelled'
      and a.start_time::date = current_date
      and b.start_time::date = current_date
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 4. RPC: Full schedule view (technicians + blocks + events) ─
create or replace function public.get_schedule_view(
  p_org_id uuid,
  p_date date default current_date
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
  v_start timestamptz;
  v_end timestamptz;
begin
  v_start := p_date::timestamptz;
  v_end := (p_date + 1)::timestamptz;

  select json_build_object(
    'technicians', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from (
        select
          p.id,
          p.full_name,
          p.email,
          om.role,
          (
            select coalesce(
              sum(extract(epoch from (least(sb.end_time, v_end) - greatest(sb.start_time, v_start))) / 3600),
              0
            )
            from public.schedule_blocks sb
            where sb.technician_id = p.id
              and sb.start_time < v_end
              and sb.end_time > v_start
              and sb.status != 'cancelled'
          ) as hours_booked
        from public.organization_members om
        join public.profiles p on p.id = om.user_id
        where om.organization_id = p_org_id
          and om.status = 'active'
        order by p.full_name
      ) t
    ),
    'blocks', (
      select coalesce(json_agg(row_to_json(b) order by b.start_time), '[]'::json)
      from (
        select
          sb.*,
          p.full_name as technician_name
        from public.schedule_blocks sb
        left join public.profiles p on p.id = sb.technician_id
        where sb.organization_id = p_org_id
          and sb.start_time < v_end
          and sb.end_time > v_start
      ) b
    ),
    'events', (
      select coalesce(json_agg(row_to_json(e) order by e.start_time), '[]'::json)
      from (
        select
          se.*,
          p.full_name as user_name
        from public.schedule_events se
        left join public.profiles p on p.id = se.user_id
        where se.organization_id = p_org_id
          and se.start_time < v_end
          and se.end_time > v_start
      ) e
    ),
    'backlog', (
      select coalesce(json_agg(row_to_json(j) order by j.created_at desc), '[]'::json)
      from (
        select
          j.id,
          j.display_id,
          j.title,
          j.priority,
          j.location,
          j.estimated_duration_minutes,
          c.name as client_name
        from public.jobs j
        left join public.clients c on c.id = j.client_id
        where j.organization_id = p_org_id
          and j.deleted_at is null
          and (j.status = 'backlog' or j.status = 'todo')
          and j.assignee_id is null
          and not exists (
            select 1 from public.schedule_blocks sb
            where sb.job_id = j.id
              and sb.status != 'cancelled'
          )
      ) j
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ── 5. RPC: Move/reschedule a block (the "snap" mutation) ──
create or replace function public.move_schedule_block(
  p_block_id uuid,
  p_technician_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_block record;
  v_conflict_count int;
begin
  -- Get current block
  select * into v_block
  from public.schedule_blocks
  where id = p_block_id;

  if v_block is null then
    return json_build_object('error', 'Block not found');
  end if;

  -- Check for conflicts at new position
  select count(*) into v_conflict_count
  from public.schedule_blocks
  where technician_id = p_technician_id
    and id != p_block_id
    and status != 'cancelled'
    and start_time < p_end_time
    and end_time > p_start_time;

  -- Update the block
  update public.schedule_blocks
  set
    technician_id = p_technician_id,
    start_time = p_start_time,
    end_time = p_end_time,
    is_conflict = (v_conflict_count > 0),
    updated_at = now()
  where id = p_block_id;

  -- If there are conflicts, also flag the overlapping blocks
  if v_conflict_count > 0 then
    update public.schedule_blocks
    set is_conflict = true, updated_at = now()
    where technician_id = p_technician_id
      and id != p_block_id
      and status != 'cancelled'
      and start_time < p_end_time
      and end_time > p_start_time;
  end if;

  -- Clear conflict flag on blocks that no longer overlap (at old position)
  if v_block.technician_id is distinct from p_technician_id then
    update public.schedule_blocks sb
    set is_conflict = false, updated_at = now()
    where sb.technician_id = v_block.technician_id
      and sb.id != p_block_id
      and sb.is_conflict = true
      and sb.status != 'cancelled'
      and not exists (
        select 1 from public.schedule_blocks other
        where other.technician_id = sb.technician_id
          and other.id != sb.id
          and other.id != p_block_id
          and other.status != 'cancelled'
          and other.start_time < sb.end_time
          and other.end_time > sb.start_time
      );
  end if;

  -- Also update the linked job's assignee if the tech changed
  if v_block.job_id is not null and v_block.technician_id is distinct from p_technician_id then
    update public.jobs
    set assignee_id = p_technician_id
    where id = v_block.job_id;
  end if;

  return json_build_object(
    'success', true,
    'conflict', v_conflict_count > 0,
    'block_id', p_block_id
  );
end;
$$;

-- ── 6. RPC: Assign a backlog job to the schedule ────────
create or replace function public.assign_job_to_schedule(
  p_org_id uuid,
  p_job_id uuid,
  p_technician_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_job record;
  v_block_id uuid;
  v_conflict_count int;
begin
  -- Get job details
  select j.*, c.name as client_name
  into v_job
  from public.jobs j
  left join public.clients c on c.id = j.client_id
  where j.id = p_job_id and j.deleted_at is null;

  if v_job is null then
    return json_build_object('error', 'Job not found');
  end if;

  -- Check for conflicts
  select count(*) into v_conflict_count
  from public.schedule_blocks
  where technician_id = p_technician_id
    and status != 'cancelled'
    and start_time < p_end_time
    and end_time > p_start_time;

  -- Create schedule block
  insert into public.schedule_blocks (
    organization_id, job_id, technician_id, title,
    client_name, location, start_time, end_time,
    status, is_conflict
  ) values (
    p_org_id, p_job_id, p_technician_id, v_job.title,
    v_job.client_name, v_job.location, p_start_time, p_end_time,
    'scheduled', v_conflict_count > 0
  )
  returning id into v_block_id;

  -- Update job: set assignee and move from backlog to todo
  update public.jobs
  set
    assignee_id = p_technician_id,
    status = case when status = 'backlog' then 'todo'::public.job_status else status end
  where id = p_job_id;

  return json_build_object(
    'success', true,
    'block_id', v_block_id,
    'conflict', v_conflict_count > 0
  );
end;
$$;

-- ── 7. Enable realtime on schedule_blocks ───────────────
-- Check if already in publication before adding
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'schedule_blocks'
  ) then
    alter publication supabase_realtime add table public.schedule_blocks;
  end if;
end $$;
