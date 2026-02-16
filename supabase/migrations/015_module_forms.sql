-- ============================================================
-- Migration 015: Forms (Compliance & Custom Forms)
-- Form templates, submissions, blocks
-- ============================================================

create type public.form_status as enum ('draft', 'published', 'archived');
create type public.submission_status as enum ('pending', 'signed', 'expired', 'rejected');

create table public.forms (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  title           text not null,
  description     text,
  category        text default 'custom',
  status          public.form_status default 'draft',
  is_library      boolean default false,
  blocks          jsonb default '[]',  -- form field definitions
  settings        jsonb default '{}',
  submissions_count int default 0,
  created_by      uuid references public.profiles on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create index idx_forms_org on public.forms (organization_id) where deleted_at is null;
create index idx_forms_status on public.forms (organization_id, status) where deleted_at is null;

create trigger set_forms_updated_at
  before update on public.forms
  for each row execute function public.update_updated_at();

create table public.form_submissions (
  id          uuid primary key default gen_random_uuid(),
  form_id     uuid not null references public.forms on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  job_id      uuid references public.jobs on delete set null,
  client_id   uuid references public.clients on delete set null,
  submitted_by uuid references public.profiles on delete set null,
  submitter_name text,
  status      public.submission_status default 'pending',
  data        jsonb default '{}',
  signature   text,
  signed_at   timestamptz,
  expires_at  timestamptz,
  metadata    jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index idx_form_submissions_form on public.form_submissions (form_id);
create index idx_form_submissions_org on public.form_submissions (organization_id);
create index idx_form_submissions_job on public.form_submissions (job_id);

create trigger set_form_submissions_updated_at
  before update on public.form_submissions
  for each row execute function public.update_updated_at();

-- RLS
alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;

create policy "Members can read org forms"
  on public.forms for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can manage org forms"
  on public.forms for all
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can read org submissions"
  on public.form_submissions for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can manage org submissions"
  on public.form_submissions for all
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));
