-- ============================================================
-- Migration 011: Jobs (Core Workflow)
-- Job management, subtasks, activity timeline
-- ============================================================

create type public.job_status as enum ('backlog', 'todo', 'in_progress', 'done', 'cancelled');
create type public.job_priority as enum ('urgent', 'high', 'medium', 'low', 'none');

create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  display_id      text not null,  -- e.g. "JOB-401"
  title           text not null,
  description     text,
  status          public.job_status default 'backlog',
  priority        public.job_priority default 'none',
  client_id       uuid references public.clients on delete set null,
  assignee_id     uuid references public.profiles on delete set null,
  due_date        timestamptz,
  location        text,
  location_lat    double precision,
  location_lng    double precision,
  labels          text[] default '{}',
  revenue         numeric(12,2) default 0,
  cost            numeric(12,2) default 0,
  estimated_hours numeric(6,2) default 0,
  actual_hours    numeric(6,2) default 0,
  metadata        jsonb default '{}',
  created_by      uuid references public.profiles on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

-- Auto-increment display ID per org
create sequence public.job_display_seq;

create index idx_jobs_org on public.jobs (organization_id) where deleted_at is null;
create index idx_jobs_status on public.jobs (organization_id, status) where deleted_at is null;
create index idx_jobs_assignee on public.jobs (assignee_id) where deleted_at is null;
create index idx_jobs_client on public.jobs (client_id) where deleted_at is null;
create index idx_jobs_priority on public.jobs (organization_id, priority) where deleted_at is null;
create index idx_jobs_due on public.jobs (organization_id, due_date) where deleted_at is null;
create index idx_jobs_display_id on public.jobs (organization_id, display_id);

create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute function public.update_updated_at();

-- Subtasks
create table public.job_subtasks (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs on delete cascade,
  title       text not null,
  completed   boolean default false,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

create index idx_job_subtasks_job on public.job_subtasks (job_id);

-- Activity timeline
create type public.activity_type as enum (
  'status_change', 'comment', 'photo', 'invoice', 'creation', 'assignment', 'note'
);

create table public.job_activity (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs on delete cascade,
  type        public.activity_type not null,
  text        text not null,
  user_id     uuid references public.profiles on delete set null,
  user_name   text,
  photos      text[],
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

create index idx_job_activity_job on public.job_activity (job_id);
create index idx_job_activity_time on public.job_activity (job_id, created_at desc);

-- RLS
alter table public.jobs enable row level security;
alter table public.job_subtasks enable row level security;
alter table public.job_activity enable row level security;

create policy "Members can read org jobs"
  on public.jobs for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can create org jobs"
  on public.jobs for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can update org jobs"
  on public.jobs for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can read job subtasks"
  on public.job_subtasks for select
  using (
    job_id in (
      select j.id from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where om.user_id = auth.uid() and om.status = 'active'
    )
  );

create policy "Members can manage job subtasks"
  on public.job_subtasks for all
  using (
    job_id in (
      select j.id from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where om.user_id = auth.uid() and om.status = 'active'
    )
  );

create policy "Members can read job activity"
  on public.job_activity for select
  using (
    job_id in (
      select j.id from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where om.user_id = auth.uid() and om.status = 'active'
    )
  );

create policy "Members can create job activity"
  on public.job_activity for insert
  with check (
    job_id in (
      select j.id from public.jobs j
      join public.organization_members om on om.organization_id = j.organization_id
      where om.user_id = auth.uid() and om.status = 'active'
    )
  );
