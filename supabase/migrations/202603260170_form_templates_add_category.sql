-- ============================================================================
-- @migration FormTemplatesSchemaAlignment
-- @description Align form_templates with Daedalus-era expectations.
--   The original table was created with (organization_id, schema, stage, is_active)
--   but code expects (workspace_id, schema_jsonb, status, category, deleted_at, is_library).
--   The Daedalus migration (202603260080) used CREATE TABLE IF NOT EXISTS so
--   it skipped entirely when the table already existed with the old schema.
-- ============================================================================

-- 1. Add missing columns
alter table public.form_templates
  add column if not exists workspace_id uuid,
  add column if not exists category text default 'custom',
  add column if not exists schema_jsonb jsonb not null default '[]'::jsonb,
  add column if not exists status public.form_status not null default 'draft',
  add column if not exists is_library boolean default false,
  add column if not exists deleted_at timestamptz;

-- 2. Backfill workspace_id from organization_id
update public.form_templates
set workspace_id = organization_id
where workspace_id is null and organization_id is not null;

-- 3. Backfill schema_jsonb from legacy schema column
update public.form_templates
set schema_jsonb = coalesce(schema, '[]'::jsonb)
where schema_jsonb = '[]'::jsonb and schema is not null and schema != '[]'::jsonb;

-- 4. Backfill status from is_active
update public.form_templates
set status = case when is_active = true then 'published'::public.form_status else 'draft'::public.form_status end
where is_active is not null;

-- 5. Sync trigger: keep workspace_id <-> organization_id and schema_jsonb <-> schema aligned
create or replace function public.sync_form_templates_workspace_org()
returns trigger
language plpgsql
as $$
begin
  if new.workspace_id is not null and new.organization_id is null then
    new.organization_id := new.workspace_id;
  elsif new.organization_id is not null and new.workspace_id is null then
    new.workspace_id := new.organization_id;
  end if;
  if TG_OP = 'INSERT' then
    new.schema_jsonb := coalesce(new.schema_jsonb, new.schema, '[]'::jsonb);
    new.schema := coalesce(new.schema, new.schema_jsonb, '{"sections": []}'::jsonb);
  else
    if new.schema_jsonb is distinct from old.schema_jsonb then
      new.schema := new.schema_jsonb;
    elsif new.schema is distinct from old.schema then
      new.schema_jsonb := new.schema;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_form_templates_sync_workspace_org on public.form_templates;
create trigger trg_form_templates_sync_workspace_org
  before insert or update on public.form_templates
  for each row execute function public.sync_form_templates_workspace_org();

-- 6. Indexes
create index if not exists idx_form_templates_workspace
  on public.form_templates (workspace_id)
  where deleted_at is null;

create index if not exists idx_form_templates_workspace_status
  on public.form_templates (workspace_id, status)
  where deleted_at is null;
