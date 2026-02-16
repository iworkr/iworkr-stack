-- ============================================================
-- Migration 007: RLS Helper Functions
-- Reusable security functions for Row Level Security policies
-- ============================================================

-- Returns all organization IDs the authenticated user belongs to
create or replace function public.get_user_org_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and status = 'active';
$$;

-- Returns the user's role in a specific organization
create or replace function public.get_user_role(org_id uuid)
returns public.org_role
language sql
security definer
stable
as $$
  select role
  from public.organization_members
  where user_id = auth.uid()
    and organization_id = org_id
    and status = 'active';
$$;

-- Checks if user is at least the given role level in the org
create or replace function public.user_has_role(org_id uuid, min_role public.org_role)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  role_order constant text[] := array[
    'owner', 'admin', 'manager', 'senior_tech',
    'technician', 'apprentice', 'subcontractor', 'office_admin'
  ];
  user_role public.org_role;
begin
  select role into user_role
  from public.organization_members
  where user_id = auth.uid()
    and organization_id = org_id
    and status = 'active';

  if user_role is null then return false; end if;

  return array_position(role_order, user_role::text)
      <= array_position(role_order, min_role::text);
end;
$$;

-- Checks if the current subscription is active (for feature gating)
create or replace function public.org_has_active_subscription(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.subscriptions
    where organization_id = org_id
      and status in ('active', 'trialing')
      and current_period_end > now()
  );
$$;

-- Returns the plan key for an organization
create or replace function public.get_org_plan(org_id uuid)
returns text
language sql
security definer
stable
as $$
  select plan_key from public.subscriptions
  where organization_id = org_id
    and status in ('active', 'trialing')
  limit 1;
$$;
