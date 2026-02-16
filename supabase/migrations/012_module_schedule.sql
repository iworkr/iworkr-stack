-- ============================================================
-- Migration 012: Schedule (Dispatch & Scheduling)
-- Schedule blocks linked to jobs and technicians
-- ============================================================

create type public.schedule_block_status as enum ('scheduled', 'en_route', 'in_progress', 'complete', 'cancelled');

create table public.schedule_blocks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  job_id          uuid references public.jobs on delete cascade,
  technician_id   uuid not null references public.profiles on delete cascade,
  title           text not null,
  client_name     text,
  location        text,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  status          public.schedule_block_status default 'scheduled',
  travel_minutes  int default 0,
  is_conflict     boolean default false,
  notes           text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_schedule_org on public.schedule_blocks (organization_id);
create index idx_schedule_tech on public.schedule_blocks (technician_id, start_time);
create index idx_schedule_job on public.schedule_blocks (job_id);
create index idx_schedule_date on public.schedule_blocks (organization_id, start_time, end_time);

create trigger set_schedule_blocks_updated_at
  before update on public.schedule_blocks
  for each row execute function public.update_updated_at();

-- RLS
alter table public.schedule_blocks enable row level security;

create policy "Members can read org schedule"
  on public.schedule_blocks for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can create schedule blocks"
  on public.schedule_blocks for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can update schedule blocks"
  on public.schedule_blocks for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can delete schedule blocks"
  on public.schedule_blocks for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );
