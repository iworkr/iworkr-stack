-- ============================================================
-- Migration 027: Team Module — RBAC & User Management
-- organization_roles table, has_permission(), get_member_stats(),
-- get_team_overview(), invite_member(), Realtime
-- ============================================================

-- ── 1. Organization Roles table ─────────────────────────
create table if not exists public.organization_roles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations on delete cascade,
  name             text not null,
  color            text not null default '#06B6D4',
  is_system_role   boolean default false,
  permissions      jsonb not null default '{}',
  scopes           jsonb not null default '{}',
  created_at       timestamptz default now()
);

create index if not exists idx_org_roles_org
  on public.organization_roles (organization_id);

-- ── 2. Add role_id FK to organization_members ───────────
alter table public.organization_members
  add column if not exists role_id uuid references public.organization_roles(id);

alter table public.organization_members
  add column if not exists last_active_at timestamptz;

-- ── 3. RLS for organization_roles ───────────────────────
alter table public.organization_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'organization_roles' and policyname = 'Org members can view roles'
  ) then
    create policy "Org members can view roles"
      on public.organization_roles for select
      using (organization_id in (select public.get_user_org_ids()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'organization_roles' and policyname = 'Admins can manage roles'
  ) then
    create policy "Admins can manage roles"
      on public.organization_roles for all
      using (public.user_has_role(organization_id, 'admin'));
  end if;
end $$;

-- ── 4. has_permission() — RBAC authorization function ───
create or replace function public.has_permission(
  p_org_id uuid,
  p_module text,
  p_action text
)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  v_perms jsonb;
  v_role public.org_role;
  v_module_perms jsonb;
begin
  -- Get user's role and role_id
  select om.role, coalesce(
    orr.permissions,
    '{}'::jsonb
  ) into v_role, v_perms
  from public.organization_members om
  left join public.organization_roles orr on orr.id = om.role_id
  where om.user_id = auth.uid()
    and om.organization_id = p_org_id
    and om.status = 'active';

  if v_role is null then
    return false;
  end if;

  -- Owner always has full access
  if v_role = 'owner' then
    return true;
  end if;

  -- Check JSONB permissions from organization_roles
  v_module_perms := v_perms->p_module;
  if v_module_perms is null then
    return false;
  end if;

  -- Check if the action exists and is true/allowed
  if jsonb_typeof(v_module_perms->p_action) = 'boolean' then
    return (v_module_perms->>p_action)::boolean;
  end if;

  -- For 'view' which can be 'all', 'assigned_only', 'none'
  if v_module_perms->>p_action is not null
     and v_module_perms->>p_action != 'none' then
    return true;
  end if;

  return false;
end;
$$;

-- ── 5. get_member_stats() — per-member operational stats ─
create or replace function public.get_member_stats(
  p_org_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_jobs_done int;
  v_avg_rating numeric;
begin
  -- Count completed jobs
  select count(*) into v_jobs_done
  from public.jobs
  where organization_id = p_org_id
    and assigned_to = p_user_id
    and status = 'completed';

  -- For now, avg_rating is a placeholder (reviews table may not exist)
  v_avg_rating := 0;

  return json_build_object(
    'jobs_done', coalesce(v_jobs_done, 0),
    'avg_rating', coalesce(v_avg_rating, 0)
  );
end;
$$;

-- ── 6. get_team_overview() — aggregated team stats ──────
create or replace function public.get_team_overview(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  return json_build_object(
    'active_members', (
      select count(*) from public.organization_members
      where organization_id = p_org_id and status = 'active'
    ),
    'pending_invites', (
      select count(*) from public.organization_invites
      where organization_id = p_org_id and status = 'pending'
    ),
    'suspended_members', (
      select count(*) from public.organization_members
      where organization_id = p_org_id and status = 'suspended'
    ),
    'total_roles', (
      select count(*) from public.organization_roles
      where organization_id = p_org_id
    ),
    'branches', (
      select coalesce(json_agg(distinct branch), '[]'::json)
      from public.organization_members
      where organization_id = p_org_id and status = 'active'
    )
  );
end;
$$;

-- ── 7. get_roles_with_counts() — roles + member count ───
create or replace function public.get_roles_with_counts(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  return (
    select coalesce(json_agg(row_to_json(r)), '[]'::json)
    from (
      select
        orr.id,
        orr.name,
        orr.color,
        orr.is_system_role,
        orr.permissions,
        orr.scopes,
        count(om.user_id) as member_count
      from public.organization_roles orr
      left join public.organization_members om
        on om.role_id = orr.id
        and om.organization_id = p_org_id
        and om.status = 'active'
      where orr.organization_id = p_org_id
      group by orr.id
      order by orr.is_system_role desc, orr.name
    ) r
  );
end;
$$;

-- ── 8. update_role_permissions() — save permission matrix ─
create or replace function public.update_role_permissions(
  p_role_id uuid,
  p_permissions jsonb,
  p_scopes jsonb default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_role record;
begin
  select * into v_role
  from public.organization_roles
  where id = p_role_id;

  if not found then
    return json_build_object('error', 'Role not found');
  end if;

  if v_role.is_system_role and v_role.name = 'Owner' then
    return json_build_object('error', 'Cannot modify Owner role permissions');
  end if;

  update public.organization_roles
  set permissions = p_permissions,
      scopes = case when p_scopes is not null then p_scopes else scopes end
  where id = p_role_id;

  return json_build_object('success', true);
end;
$$;

-- ── 9. invite_member() — create invite + member record ──
create or replace function public.invite_member(
  p_org_id uuid,
  p_email text,
  p_role text,
  p_role_id uuid default null,
  p_branch text default 'HQ',
  p_actor_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_existing_invite record;
  v_invite_id uuid;
begin
  -- Check for existing pending invite
  select * into v_existing_invite
  from public.organization_invites
  where organization_id = p_org_id
    and email = p_email
    and status = 'pending';

  if found then
    return json_build_object('error', 'An invite is already pending for this email');
  end if;

  -- Create invite
  insert into public.organization_invites (
    organization_id, email, role, invited_by
  ) values (
    p_org_id, p_email, p_role::public.org_role,
    coalesce(p_actor_id, auth.uid())
  )
  returning id into v_invite_id;

  return json_build_object(
    'success', true,
    'invite_id', v_invite_id
  );
end;
$$;

-- ── 10. Enable Realtime ─────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'organization_members'
  ) then
    alter publication supabase_realtime add table public.organization_members;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'organization_roles'
  ) then
    alter publication supabase_realtime add table public.organization_roles;
  end if;
end $$;
