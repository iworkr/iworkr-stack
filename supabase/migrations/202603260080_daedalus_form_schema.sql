-- ============================================================================
-- @migration DaedalusFormSchema
-- @description Add form_templates model and align form_submissions JSONB fields
-- @created 2026-03-26
-- ============================================================================

create table if not exists public.form_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations on delete cascade,
  title text not null,
  description text,
  status public.form_status not null default 'draft',
  category text default 'custom',
  schema_jsonb jsonb not null default '[]'::jsonb,
  version int not null default 1,
  is_library boolean default false,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_form_templates_workspace
  on public.form_templates (workspace_id)
  where deleted_at is null;

create index if not exists idx_form_templates_workspace_status
  on public.form_templates (workspace_id, status)
  where deleted_at is null;

create trigger set_form_templates_updated_at
  before update on public.form_templates
  for each row execute function public.update_updated_at();

alter table public.form_templates enable row level security;

drop policy if exists "Members can read workspace form templates" on public.form_templates;
create policy "Members can read workspace form templates"
  on public.form_templates for select
  using (workspace_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

drop policy if exists "Members can manage workspace form templates" on public.form_templates;
create policy "Members can manage workspace form templates"
  on public.form_templates for all
  using (workspace_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

-- Backfill templates from legacy forms table.
insert into public.form_templates (
  id, workspace_id, title, description, status, category, schema_jsonb,
  version, is_library, created_by, created_at, updated_at, deleted_at
)
select
  f.id,
  f.organization_id,
  f.title,
  f.description,
  f.status,
  f.category,
  coalesce(f.blocks, '[]'::jsonb),
  1,
  f.is_library,
  f.created_by,
  f.created_at,
  f.updated_at,
  f.deleted_at
from public.forms f
on conflict (id) do update
set
  workspace_id = excluded.workspace_id,
  title = excluded.title,
  description = excluded.description,
  status = excluded.status,
  category = excluded.category,
  schema_jsonb = excluded.schema_jsonb,
  version = excluded.version,
  is_library = excluded.is_library,
  created_by = excluded.created_by,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at;

-- Keep forms <-> form_templates aligned during rollout.
create or replace function public.sync_form_templates_to_forms()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  insert into public.forms (
    id, organization_id, title, description, category, status, is_library,
    blocks, created_by, created_at, updated_at, deleted_at
  )
  values (
    new.id, new.workspace_id, new.title, new.description, new.category, new.status, new.is_library,
    new.schema_jsonb, new.created_by, new.created_at, new.updated_at, new.deleted_at
  )
  on conflict (id) do update
  set
    organization_id = excluded.organization_id,
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    status = excluded.status,
    is_library = excluded.is_library,
    blocks = excluded.blocks,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at;

  return new;
end;
$$;

create or replace function public.sync_forms_to_form_templates()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  insert into public.form_templates (
    id, workspace_id, title, description, category, status, is_library,
    schema_jsonb, created_by, created_at, updated_at, deleted_at
  )
  values (
    new.id, new.organization_id, new.title, new.description, new.category, new.status, new.is_library,
    new.blocks, new.created_by, new.created_at, new.updated_at, new.deleted_at
  )
  on conflict (id) do update
  set
    workspace_id = excluded.workspace_id,
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    status = excluded.status,
    is_library = excluded.is_library,
    schema_jsonb = excluded.schema_jsonb,
    created_by = excluded.created_by,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at;

  return new;
end;
$$;

drop trigger if exists trg_form_templates_sync_to_forms on public.form_templates;
create trigger trg_form_templates_sync_to_forms
  after insert or update on public.form_templates
  for each row execute function public.sync_form_templates_to_forms();

drop trigger if exists trg_forms_sync_to_form_templates on public.forms;
create trigger trg_forms_sync_to_form_templates
  after insert or update on public.forms
  for each row execute function public.sync_forms_to_form_templates();

-- Submissions alignment for template-centric payload names.
alter table public.form_submissions
  add column if not exists template_id uuid,
  add column if not exists submission_data_jsonb jsonb default '{}'::jsonb,
  add column if not exists worker_id uuid references public.profiles on delete set null,
  add column if not exists submitted_at timestamptz;

update public.form_submissions
set
  template_id = coalesce(template_id, form_id),
  submission_data_jsonb = coalesce(submission_data_jsonb, data, '{}'::jsonb),
  worker_id = coalesce(worker_id, submitted_by),
  submitted_at = coalesce(submitted_at, created_at)
where template_id is null
   or submission_data_jsonb = '{}'::jsonb
   or worker_id is null
   or submitted_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'form_submissions_template_id_fkey'
  ) then
    alter table public.form_submissions
      add constraint form_submissions_template_id_fkey
      foreign key (template_id) references public.form_templates(id) on delete cascade;
  end if;
end
$$;

create index if not exists idx_form_submissions_template_id
  on public.form_submissions(template_id);

create or replace function public.sync_form_submissions_alias_columns()
returns trigger
language plpgsql
as $$
begin
  new.template_id := coalesce(new.template_id, new.form_id);
  new.form_id := coalesce(new.form_id, new.template_id);
  new.submission_data_jsonb := coalesce(new.submission_data_jsonb, new.data, '{}'::jsonb);
  new.data := coalesce(new.data, new.submission_data_jsonb, '{}'::jsonb);
  new.worker_id := coalesce(new.worker_id, new.submitted_by);
  new.submitted_by := coalesce(new.submitted_by, new.worker_id);
  new.submitted_at := coalesce(new.submitted_at, new.created_at);
  return new;
end;
$$;

drop trigger if exists trg_form_submissions_alias_columns on public.form_submissions;
create trigger trg_form_submissions_alias_columns
  before insert or update on public.form_submissions
  for each row execute function public.sync_form_submissions_alias_columns();

