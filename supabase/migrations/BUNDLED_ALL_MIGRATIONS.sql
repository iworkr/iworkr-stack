-- ============================================================
-- Migration 001: Extensions
-- Enable required Postgres extensions
-- ============================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
-- ============================================================
-- Migration 002: Custom Enums
-- All enum types used across core and modules
-- ============================================================

-- Core enums
create type public.org_role as enum (
  'owner', 'admin', 'manager', 'senior_tech',
  'technician', 'apprentice', 'subcontractor', 'office_admin'
);

create type public.invite_status as enum ('pending', 'accepted', 'expired');

create type public.subscription_status as enum (
  'active', 'past_due', 'canceled', 'incomplete', 'trialing'
);

create type public.member_status as enum (
  'active', 'pending', 'suspended', 'archived'
);
-- ============================================================
-- Migration 003: Profiles
-- Extends auth.users with application-specific data
-- ============================================================

create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  phone           text,
  timezone        text default 'Australia/Brisbane',
  notification_preferences jsonb default '{
    "email_digest": true,
    "push_jobs": true,
    "push_inbox": true,
    "push_schedule": true
  }'::jsonb,
  onboarding_completed boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_profiles_email on public.profiles (email);

-- Auto-update updated_at on any table
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- Auto-create profile when a user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- ============================================================
-- Migration 004: Organizations & Members
-- Multi-tenancy backbone: orgs, members, invites
-- ============================================================

-- Organizations (Workspaces)
create table public.organizations (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  trade             text,
  logo_url          text,
  polar_customer_id text,
  settings          jsonb default '{
    "timezone": "Australia/Brisbane",
    "currency": "AUD",
    "date_format": "DD/MM/YYYY",
    "fiscal_year_start": 7,
    "default_tax_rate": 10,
    "default_payment_terms": 14,
    "branches": ["HQ"]
  }'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create unique index idx_organizations_slug on public.organizations (slug);
create index idx_organizations_polar on public.organizations (polar_customer_id)
  where polar_customer_id is not null;

create trigger set_organizations_updated_at
  before update on public.organizations
  for each row execute function public.update_updated_at();

-- Organization Members (RBAC)
create table public.organization_members (
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  role            public.org_role not null default 'technician',
  status          public.member_status not null default 'active',
  branch          text default 'HQ',
  skills          text[] default '{}',
  hourly_rate     numeric(10, 2),
  invited_by      uuid references public.profiles,
  joined_at       timestamptz default now(),

  primary key (organization_id, user_id)
);

create index idx_org_members_user on public.organization_members (user_id);
create index idx_org_members_org on public.organization_members (organization_id);
create index idx_org_members_role on public.organization_members (organization_id, role);

-- Organization Invites
create table public.organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  email           text not null,
  role            public.org_role not null default 'technician',
  status          public.invite_status not null default 'pending',
  invited_by      uuid not null references public.profiles,
  token           text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz default now(),

  unique (organization_id, email)
);

create index idx_invites_token on public.organization_invites (token) where status = 'pending';
create index idx_invites_email on public.organization_invites (email);
-- ============================================================
-- Migration 005: Subscriptions
-- Local cache of Polar.sh billing state for instant feature gating
-- ============================================================

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations on delete cascade,
  polar_subscription_id  text unique not null,
  polar_product_id       text,
  plan_key               text not null,
  status                 public.subscription_status not null default 'incomplete',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false,
  canceled_at            timestamptz,
  metadata               jsonb default '{}',
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- Only one active subscription per org
create unique index idx_subscriptions_org_active on public.subscriptions (organization_id)
  where status in ('active', 'past_due', 'trialing');
create index idx_subscriptions_polar on public.subscriptions (polar_subscription_id);
create index idx_subscriptions_status on public.subscriptions (status);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at();
-- ============================================================
-- Migration 006: Audit Log
-- Immutable record of all destructive/state-changing operations
-- ============================================================

create table public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations on delete set null,
  user_id         uuid references public.profiles on delete set null,
  action          text not null,
  entity_type     text not null,
  entity_id       text,
  old_data        jsonb,
  new_data        jsonb,
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz default now()
);

create index idx_audit_log_org_time on public.audit_log (organization_id, created_at desc);
create index idx_audit_log_entity on public.audit_log (entity_type, entity_id);
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
-- ============================================================
-- Migration 008: RLS Policies
-- Row Level Security for all core tables
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Org members can read teammate profiles"
  on public.profiles for select
  using (
    id in (
      select om.user_id from public.organization_members om
      where om.organization_id in (select public.get_user_org_ids())
        and om.status = 'active'
    )
  );

-- ── Organizations ─────────────────────────────────────────
alter table public.organizations enable row level security;

create policy "Members can read their orgs"
  on public.organizations for select
  using (id in (select public.get_user_org_ids()));

create policy "Owners and admins can update their org"
  on public.organizations for update
  using (public.user_has_role(id, 'admin'))
  with check (public.user_has_role(id, 'admin'));

create policy "Authenticated users can create orgs"
  on public.organizations for insert
  with check (auth.uid() is not null);

-- ── Organization Members ──────────────────────────────────
alter table public.organization_members enable row level security;

create policy "Members can read fellow members"
  on public.organization_members for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Admins can insert members"
  on public.organization_members for insert
  with check (
    public.user_has_role(organization_id, 'admin')
    or (
      -- Allow a user to insert themselves as owner when creating a new org
      user_id = auth.uid()
      and role = 'owner'
    )
  );

create policy "Admins can update members"
  on public.organization_members for update
  using (public.user_has_role(organization_id, 'admin'));

create policy "Owners can delete members"
  on public.organization_members for delete
  using (public.user_has_role(organization_id, 'owner'));

-- ── Organization Invites ──────────────────────────────────
alter table public.organization_invites enable row level security;

create policy "Members can view org invites"
  on public.organization_invites for select
  using (organization_id in (select public.get_user_org_ids()));

create policy "Admins can create invites"
  on public.organization_invites for insert
  with check (public.user_has_role(organization_id, 'admin'));

-- Allow the invited user to see their own invite (for accepting)
create policy "Invitees can view their own invites"
  on public.organization_invites for select
  using (email = (select email from public.profiles where id = auth.uid()));

-- Allow invite status updates via service_role (Edge Functions)
-- No user-facing update policy needed

-- ── Subscriptions ─────────────────────────────────────────
alter table public.subscriptions enable row level security;

create policy "Members can read their org subscription"
  on public.subscriptions for select
  using (organization_id in (select public.get_user_org_ids()));

-- Write operations only via service_role key (webhook Edge Functions)

-- ── Audit Log ─────────────────────────────────────────────
alter table public.audit_log enable row level security;

create policy "Admins can read audit log"
  on public.audit_log for select
  using (public.user_has_role(organization_id, 'admin'));

-- Insert via service_role or security definer functions only
