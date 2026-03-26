-- ============================================================================
-- @migration AlexandriaStoreSchema
-- @status COMPLETE
-- @description Global template catalog + cloning RPC for workspace forms
-- @tables global_form_templates
-- @lastAudit 2026-03-26
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'template_sector_enum'
  ) then
    create type public.template_sector_enum as enum ('TRADES', 'CARE', 'ALL');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'template_category_enum'
  ) then
    create type public.template_category_enum as enum ('SAFETY', 'COMPLIANCE', 'CLINICAL', 'INSPECTION');
  end if;
end $$;

create table if not exists public.global_form_templates (
  id uuid primary key default gen_random_uuid(),
  title varchar(255) not null,
  description text not null,
  sector public.template_sector_enum not null default 'ALL',
  category public.template_category_enum not null,
  schema_jsonb jsonb not null default '[]'::jsonb,
  is_premium boolean not null default false,
  clone_count int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_global_form_templates_sector
  on public.global_form_templates (sector, category, is_premium);

alter table public.global_form_templates enable row level security;

drop policy if exists "Global templates readable by authenticated users" on public.global_form_templates;
create policy "Global templates readable by authenticated users"
  on public.global_form_templates
  for select
  to authenticated
  using (true);

drop policy if exists "Only super admins can mutate global templates" on public.global_form_templates;
create policy "Only super admins can mutate global templates"
  on public.global_form_templates
  for all
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'is_super_admin', 'false') = 'true'
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'is_super_admin', 'false') = 'true'
  );

create or replace function public.clone_global_template_to_workspace(
  p_global_template_id uuid,
  p_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_global public.global_form_templates%rowtype;
  v_new_form_id uuid;
begin
  -- Verify caller is an active member of target organization.
  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  ) then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  select *
  into v_global
  from public.global_form_templates
  where id = p_global_template_id;

  if not found then
    raise exception 'Global template not found'
      using errcode = 'P0002';
  end if;

  insert into public.forms (
    organization_id,
    title,
    description,
    category,
    status,
    blocks,
    settings,
    created_by,
    is_library
  )
  values (
    p_organization_id,
    v_global.title,
    v_global.description,
    lower(v_global.category::text),
    'draft',
    v_global.schema_jsonb,
    '{}'::jsonb,
    auth.uid(),
    false
  )
  returning id into v_new_form_id;

  update public.global_form_templates
  set clone_count = clone_count + 1
  where id = p_global_template_id;

  return v_new_form_id;
end;
$$;
