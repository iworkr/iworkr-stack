-- ============================================================================
-- @migration SynthesisPlanReviewReporting
-- @status COMPLETE
-- @description Project Synthesis — NDIS plan review and outcome reporting engine
-- @tables plan_review_reports, plan_review_sections
-- @lastAudit 2026-03-22
-- ============================================================================

create table if not exists public.plan_review_reports (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  participant_id uuid not null references public.participant_profiles(id) on delete cascade,
  service_agreement_id uuid references public.service_agreements(id) on delete set null,
  title text not null,
  report_date date not null default current_date,
  data_scope_start date not null,
  data_scope_end date not null,
  status text not null default 'draft' check (status in ('draft', 'aggregating', 'ready_for_review', 'pending_manager_review', 'finalized', 'failed', 'archived')),
  draft_json_payload jsonb not null default '{}'::jsonb,
  final_pdf_url text,
  generation_error text,
  created_by uuid references public.profiles(id) on delete set null,
  finalized_by uuid references public.profiles(id) on delete set null,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plan_review_reports_org
  on public.plan_review_reports (organization_id, created_at desc);
create index if not exists idx_plan_review_reports_participant
  on public.plan_review_reports (participant_id, status, report_date desc);

create table if not exists public.report_data_snapshots (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null unique references public.plan_review_reports(id) on delete cascade,
  raw_shift_notes_json jsonb not null default '[]'::jsonb,
  raw_incidents_json jsonb not null default '[]'::jsonb,
  raw_tasks_json jsonb not null default '[]'::jsonb,
  raw_financial_json jsonb not null default '{}'::jsonb,
  ai_model_version text,
  llm_prompt_tokens integer,
  llm_completion_tokens integer,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_review_jobs (
  id uuid primary key default uuid_generate_v4(),
  report_id uuid not null references public.plan_review_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  stage text,
  error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_plan_review_jobs_report
  on public.plan_review_jobs (report_id, created_at desc);
create index if not exists idx_plan_review_jobs_org_status
  on public.plan_review_jobs (organization_id, status, created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_plan_review_reports_updated_at') then
    create trigger set_plan_review_reports_updated_at
      before update on public.plan_review_reports
      for each row execute function public.update_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_plan_review_jobs_updated_at') then
    create trigger set_plan_review_jobs_updated_at
      before update on public.plan_review_jobs
      for each row execute function public.update_updated_at();
  end if;
end $$;

alter table public.plan_review_reports enable row level security;
alter table public.report_data_snapshots enable row level security;
alter table public.plan_review_jobs enable row level security;

drop policy if exists "Scoped users can view plan review reports" on public.plan_review_reports;
create policy "Scoped users can view plan review reports"
  on public.plan_review_reports
  for select
  using (public.can_worker_view_participant(organization_id, participant_id));

drop policy if exists "Managers can manage plan review reports" on public.plan_review_reports;
create policy "Managers can manage plan review reports"
  on public.plan_review_reports
  for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

drop policy if exists "Scoped users can view report snapshots" on public.report_data_snapshots;
create policy "Scoped users can view report snapshots"
  on public.report_data_snapshots
  for select
  using (
    exists (
      select 1
      from public.plan_review_reports r
      where r.id = report_data_snapshots.report_id
        and public.can_worker_view_participant(r.organization_id, r.participant_id)
    )
  );

drop policy if exists "Managers can manage report snapshots" on public.report_data_snapshots;
create policy "Managers can manage report snapshots"
  on public.report_data_snapshots
  for all
  using (
    exists (
      select 1
      from public.plan_review_reports r
      where r.id = report_data_snapshots.report_id
        and public.user_has_role(r.organization_id, 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.plan_review_reports r
      where r.id = report_data_snapshots.report_id
        and public.user_has_role(r.organization_id, 'manager')
    )
  );

drop policy if exists "Scoped users can view plan review jobs" on public.plan_review_jobs;
create policy "Scoped users can view plan review jobs"
  on public.plan_review_jobs
  for select
  using (
    exists (
      select 1
      from public.plan_review_reports r
      where r.id = plan_review_jobs.report_id
        and public.can_worker_view_participant(r.organization_id, r.participant_id)
    )
  );

drop policy if exists "Managers can manage plan review jobs" on public.plan_review_jobs;
create policy "Managers can manage plan review jobs"
  on public.plan_review_jobs
  for all
  using (public.user_has_role(organization_id, 'manager'))
  with check (public.user_has_role(organization_id, 'manager'));

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'plan_review_reports'
  ) then
    null;
  else
    alter publication supabase_realtime add table public.plan_review_reports;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'plan_review_jobs'
  ) then
    null;
  else
    alter publication supabase_realtime add table public.plan_review_jobs;
  end if;
end $$;
