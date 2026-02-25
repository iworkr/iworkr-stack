
-- ============================================================
-- File: 001_extensions.sql
-- ============================================================
-- ============================================================
-- Migration 001: Extensions
-- Enable required Postgres extensions
-- ============================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- ============================================================
-- File: 002_enums.sql
-- ============================================================
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
-- File: 003_core_profiles.sql
-- ============================================================
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
-- File: 004_core_organizations.sql
-- ============================================================
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
-- File: 005_core_subscriptions.sql
-- ============================================================
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
-- File: 006_core_audit_log.sql
-- ============================================================
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
-- File: 007_core_rls_helpers.sql
-- ============================================================
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
-- File: 008_core_rls_policies.sql
-- ============================================================
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

-- ============================================================
-- File: 010_module_clients.sql
-- ============================================================
-- ============================================================
-- Migration 010: Clients (CRM)
-- Core client management — contacts, activity, spend tracking
-- ============================================================

-- Enum for client status
create type public.client_status as enum ('active', 'lead', 'churned', 'inactive');
create type public.client_type as enum ('residential', 'commercial');

create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  email           text,
  phone           text,
  status          public.client_status default 'lead',
  type            public.client_type default 'residential',
  address         text,
  address_lat     double precision,
  address_lng     double precision,
  tags            text[] default '{}',
  notes           text,
  since           timestamptz default now(),
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create index idx_clients_org on public.clients (organization_id) where deleted_at is null;
create index idx_clients_status on public.clients (organization_id, status) where deleted_at is null;
create index idx_clients_name on public.clients using gin (name gin_trgm_ops);

create trigger set_clients_updated_at
  before update on public.clients
  for each row execute function public.update_updated_at();

-- Client contacts (multiple per client)
create table public.client_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients on delete cascade,
  name        text not null,
  role        text,
  email       text,
  phone       text,
  is_primary  boolean default false,
  created_at  timestamptz default now()
);

create index idx_client_contacts_client on public.client_contacts (client_id);

-- RLS
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;

create policy "Members can read org clients"
  on public.clients for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can create org clients"
  on public.clients for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can update org clients"
  on public.clients for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can read client contacts"
  on public.client_contacts for select
  using (
    client_id in (
      select c.id from public.clients c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid() and om.status = 'active'
    )
  );

create policy "Members can manage client contacts"
  on public.client_contacts for all
  using (
    client_id in (
      select c.id from public.clients c
      join public.organization_members om on om.organization_id = c.organization_id
      where om.user_id = auth.uid() and om.status = 'active'
    )
  );

-- ============================================================
-- File: 011_module_jobs.sql
-- ============================================================
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

-- ============================================================
-- File: 012_module_schedule.sql
-- ============================================================
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

-- ============================================================
-- File: 013_module_finance.sql
-- ============================================================
-- ============================================================
-- Migration 013: Finance (Invoices & Payouts)
-- Invoice management, line items, events, payouts
-- ============================================================

create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'voided');
create type public.payout_status as enum ('completed', 'pending', 'processing');

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  display_id      text not null,  -- e.g. "INV-1250"
  client_id       uuid references public.clients on delete set null,
  job_id          uuid references public.jobs on delete set null,
  client_name     text,
  client_email    text,
  client_address  text,
  status          public.invoice_status default 'draft',
  issue_date      date not null default current_date,
  due_date        date not null,
  paid_date       date,
  subtotal        numeric(12,2) default 0,
  tax_rate        numeric(5,2) default 10.00,  -- Australian GST
  tax             numeric(12,2) default 0,
  total           numeric(12,2) default 0,
  payment_link    text,
  notes           text,
  metadata        jsonb default '{}',
  created_by      uuid references public.profiles on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create sequence public.invoice_display_seq start with 1251;

create index idx_invoices_org on public.invoices (organization_id) where deleted_at is null;
create index idx_invoices_status on public.invoices (organization_id, status) where deleted_at is null;
create index idx_invoices_client on public.invoices (client_id) where deleted_at is null;
create index idx_invoices_display_id on public.invoices (organization_id, display_id);

create trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute function public.update_updated_at();

-- Line items
create table public.invoice_line_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices on delete cascade,
  description text not null,
  quantity    numeric(10,2) default 1,
  unit_price  numeric(12,2) default 0,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

create index idx_invoice_line_items on public.invoice_line_items (invoice_id);

-- Invoice events (timeline)
create type public.invoice_event_type as enum ('created', 'sent', 'viewed', 'paid', 'voided', 'reminder');

create table public.invoice_events (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices on delete cascade,
  type        public.invoice_event_type not null,
  text        text not null,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

create index idx_invoice_events on public.invoice_events (invoice_id);

-- Payouts
create table public.payouts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  amount          numeric(12,2) not null,
  payout_date     date not null,
  bank            text,
  invoice_ids     uuid[] default '{}',
  status          public.payout_status default 'pending',
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

create index idx_payouts_org on public.payouts (organization_id);

-- RLS
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.invoice_events enable row level security;
alter table public.payouts enable row level security;

create policy "Members can read org invoices"
  on public.invoices for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can create org invoices"
  on public.invoices for insert
  with check (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can update org invoices"
  on public.invoices for update
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can read invoice line items"
  on public.invoice_line_items for select
  using (invoice_id in (
    select i.id from public.invoices i
    join public.organization_members om on om.organization_id = i.organization_id
    where om.user_id = auth.uid() and om.status = 'active'
  ));

create policy "Members can manage invoice line items"
  on public.invoice_line_items for all
  using (invoice_id in (
    select i.id from public.invoices i
    join public.organization_members om on om.organization_id = i.organization_id
    where om.user_id = auth.uid() and om.status = 'active'
  ));

create policy "Members can read invoice events"
  on public.invoice_events for select
  using (invoice_id in (
    select i.id from public.invoices i
    join public.organization_members om on om.organization_id = i.organization_id
    where om.user_id = auth.uid() and om.status = 'active'
  ));

create policy "Members can create invoice events"
  on public.invoice_events for insert
  with check (invoice_id in (
    select i.id from public.invoices i
    join public.organization_members om on om.organization_id = i.organization_id
    where om.user_id = auth.uid() and om.status = 'active'
  ));

create policy "Members can read org payouts"
  on public.payouts for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

-- ============================================================
-- File: 014_module_assets.sql
-- ============================================================
-- ============================================================
-- Migration 014: Assets (Fleet, Inventory, Audits)
-- Asset tracking, inventory management, audit log
-- ============================================================

create type public.asset_status as enum ('available', 'assigned', 'maintenance', 'retired');
create type public.asset_category as enum ('vehicle', 'tool', 'equipment', 'other');
create type public.stock_level as enum ('ok', 'low', 'critical');

create table public.assets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  category        public.asset_category default 'other',
  status          public.asset_status default 'available',
  assigned_to     uuid references public.profiles on delete set null,
  serial_number   text,
  make            text,
  model           text,
  year            int,
  location        text,
  location_lat    double precision,
  location_lng    double precision,
  purchase_date   date,
  purchase_cost   numeric(12,2),
  last_service    date,
  next_service    date,
  notes           text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);

create index idx_assets_org on public.assets (organization_id) where deleted_at is null;
create index idx_assets_status on public.assets (organization_id, status) where deleted_at is null;
create index idx_assets_assigned on public.assets (assigned_to) where deleted_at is null;
create index idx_assets_category on public.assets (organization_id, category) where deleted_at is null;

create trigger set_assets_updated_at
  before update on public.assets
  for each row execute function public.update_updated_at();

-- Inventory / Stock items
create table public.inventory_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  sku             text,
  category        text,
  quantity        int default 0,
  min_quantity    int default 5,
  unit_cost       numeric(12,2) default 0,
  location        text,
  stock_level     public.stock_level default 'ok',
  supplier        text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_inventory_org on public.inventory_items (organization_id);
create index idx_inventory_level on public.inventory_items (organization_id, stock_level);

create trigger set_inventory_updated_at
  before update on public.inventory_items
  for each row execute function public.update_updated_at();

-- Asset audit entries
create table public.asset_audits (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  asset_id        uuid references public.assets on delete set null,
  inventory_id    uuid references public.inventory_items on delete set null,
  action          text not null,
  notes           text,
  user_id         uuid references public.profiles on delete set null,
  user_name       text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

create index idx_asset_audits_org on public.asset_audits (organization_id);

-- RLS
alter table public.assets enable row level security;
alter table public.inventory_items enable row level security;
alter table public.asset_audits enable row level security;

create policy "Members can read org assets"
  on public.assets for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can manage org assets"
  on public.assets for all
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can read org inventory"
  on public.inventory_items for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can manage org inventory"
  on public.inventory_items for all
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can read org asset audits"
  on public.asset_audits for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Members can create org asset audits"
  on public.asset_audits for insert
  with check (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

-- ============================================================
-- File: 015_module_forms.sql
-- ============================================================
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

-- ============================================================
-- File: 016_module_notifications.sql
-- ============================================================
-- ============================================================
-- Migration 016: Notifications (Inbox)
-- In-app notification system
-- ============================================================

create type public.notification_type as enum (
  'job_assigned', 'quote_approved', 'mention', 'system', 'review',
  'invoice_paid', 'schedule_conflict', 'form_signed', 'team_invite'
);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  type            public.notification_type not null,
  title           text not null,
  body            text,
  sender_id       uuid references public.profiles on delete set null,
  sender_name     text,
  context         text,
  read            boolean default false,
  archived        boolean default false,
  snoozed_until   timestamptz,
  related_job_id  uuid references public.jobs on delete set null,
  related_client_id uuid references public.clients on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  metadata        jsonb default '{}',
  created_at      timestamptz default now()
);

create index idx_notifications_user on public.notifications (user_id, read, archived);
create index idx_notifications_org on public.notifications (organization_id);
create index idx_notifications_time on public.notifications (user_id, created_at desc);
create index idx_notifications_unread on public.notifications (user_id) where read = false and archived = false;

-- RLS
alter table public.notifications enable row level security;

create policy "Users can read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

create policy "System can create notifications"
  on public.notifications for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
    )
  );

-- ============================================================
-- File: 017_module_integrations.sql
-- ============================================================
-- ============================================================
-- Migration 017: Integrations & Automations
-- Integration configs and automation flows
-- ============================================================

-- Integration connections
create type public.integration_status as enum ('connected', 'disconnected', 'error', 'syncing');

create table public.integrations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  provider        text not null,  -- e.g. 'xero', 'stripe', 'google_calendar'
  status          public.integration_status default 'disconnected',
  config          jsonb default '{}',
  credentials     jsonb default '{}',
  last_sync       timestamptz,
  error_message   text,
  metadata        jsonb default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create unique index idx_integrations_org_provider on public.integrations (organization_id, provider);

create trigger set_integrations_updated_at
  before update on public.integrations
  for each row execute function public.update_updated_at();

-- Automation flows
create type public.flow_status as enum ('active', 'paused', 'draft', 'archived');

create table public.automation_flows (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  name            text not null,
  description     text,
  category        text default 'operations',
  status          public.flow_status default 'draft',
  trigger_config  jsonb default '{}',
  blocks          jsonb default '[]',
  run_count       int default 0,
  last_run        timestamptz,
  created_by      uuid references public.profiles on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_automation_flows_org on public.automation_flows (organization_id);

create trigger set_automation_flows_updated_at
  before update on public.automation_flows
  for each row execute function public.update_updated_at();

-- Automation execution log
create table public.automation_logs (
  id          uuid primary key default gen_random_uuid(),
  flow_id     uuid not null references public.automation_flows on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  status      text not null default 'running',
  trigger_data jsonb default '{}',
  result      jsonb default '{}',
  error       text,
  started_at  timestamptz default now(),
  completed_at timestamptz
);

create index idx_automation_logs_flow on public.automation_logs (flow_id);
create index idx_automation_logs_org on public.automation_logs (organization_id);

-- RLS
alter table public.integrations enable row level security;
alter table public.automation_flows enable row level security;
alter table public.automation_logs enable row level security;

create policy "Members can read org integrations"
  on public.integrations for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Admins can manage org integrations"
  on public.integrations for all
  using (organization_id in (
    select organization_id from public.organization_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  ));

create policy "Members can read org automation flows"
  on public.automation_flows for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

create policy "Admins can manage org automation flows"
  on public.automation_flows for all
  using (organization_id in (
    select organization_id from public.organization_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  ));

create policy "Members can read org automation logs"
  on public.automation_logs for select
  using (organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid() and status = 'active'
  ));

-- ============================================================
-- File: 018_automation_scheduling.sql
-- ============================================================
-- ============================================================
-- Migration 018: Automation Scheduling
-- Deferred action queue and scheduled trigger support
-- ============================================================

-- Queue for deferred automation actions (delays)
create table public.automation_queue (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  flow_id         uuid not null references public.automation_flows on delete cascade,
  event_data      jsonb not null,
  block_index     int not null default 0,
  execute_at      timestamptz not null,
  status          text default 'pending',  -- pending, processing, completed, failed
  attempts        int default 0,
  max_attempts    int default 3,
  error           text,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);

create index idx_automation_queue_pending 
  on public.automation_queue (execute_at) 
  where status = 'pending';

create index idx_automation_queue_org 
  on public.automation_queue (organization_id);

-- RLS
alter table public.automation_queue enable row level security;

create policy "Members can read org queue"
  on public.automation_queue for select
  using (organization_id in (
    select organization_id from public.organization_members 
    where user_id = auth.uid() and status = 'active'
  ));

-- Function to find overdue invoices (for cron triggers)
create or replace function public.check_overdue_invoices()
returns setof public.invoices as $$
  select * from public.invoices
  where status = 'sent'
    and due_date < current_date
    and deleted_at is null;
$$ language sql security definer;

-- Function to find upcoming schedule reminders (24h before)
create or replace function public.check_upcoming_schedule()
returns setof public.schedule_blocks as $$
  select * from public.schedule_blocks
  where status = 'scheduled'
    and start_time between now() and now() + interval '24 hours';
$$ language sql security definer;

-- ============================================================
-- File: 019_dashboard_rpc.sql
-- ============================================================
-- ============================================================
-- Migration 019: Dashboard RPC Functions
-- Server-side aggregations for fast dashboard loading
-- ============================================================

-- ── 1. get_dashboard_stats ──────────────────────────────
-- Returns revenue total, growth, and job counts in one call
create or replace function public.get_dashboard_stats(
  p_org_id uuid,
  p_range_start date default (current_date - interval '30 days')::date,
  p_range_end date default current_date
)
returns json
language plpgsql
security definer
as $$
declare
  v_revenue_current numeric;
  v_revenue_previous numeric;
  v_growth_pct numeric;
  v_active_jobs int;
  v_unassigned_jobs int;
  v_total_jobs int;
  v_range_days int;
begin
  v_range_days := (p_range_end - p_range_start);

  -- Current period revenue
  select coalesce(sum(total), 0)
  into v_revenue_current
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= p_range_start
    and paid_date <= p_range_end
    and deleted_at is null;

  -- Previous period revenue (same duration before range_start)
  select coalesce(sum(total), 0)
  into v_revenue_previous
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= (p_range_start - (v_range_days || ' days')::interval)::date
    and paid_date < p_range_start
    and deleted_at is null;

  -- Growth percentage
  if v_revenue_previous > 0 then
    v_growth_pct := round(((v_revenue_current - v_revenue_previous) / v_revenue_previous * 100)::numeric, 1);
  else
    v_growth_pct := case when v_revenue_current > 0 then 100 else 0 end;
  end if;

  -- Active jobs (not done/cancelled)
  select count(*)
  into v_active_jobs
  from public.jobs
  where organization_id = p_org_id
    and status in ('todo', 'in_progress', 'backlog')
    and deleted_at is null;

  -- Unassigned jobs
  select count(*)
  into v_unassigned_jobs
  from public.jobs
  where organization_id = p_org_id
    and assignee_id is null
    and status in ('todo', 'in_progress', 'backlog')
    and deleted_at is null;

  -- Total jobs
  select count(*)
  into v_total_jobs
  from public.jobs
  where organization_id = p_org_id
    and deleted_at is null;

  return json_build_object(
    'revenue_current', v_revenue_current,
    'revenue_previous', v_revenue_previous,
    'revenue_growth_pct', v_growth_pct,
    'active_jobs_count', v_active_jobs,
    'unassigned_jobs_count', v_unassigned_jobs,
    'total_jobs_count', v_total_jobs
  );
end;
$$;

-- ── 2. get_daily_revenue_chart ──────────────────────────
-- Returns daily revenue data for charting
create or replace function public.get_daily_revenue_chart(
  p_org_id uuid,
  p_days int default 30
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t) order by t.date)
  into v_result
  from (
    select
      d.date::text as date,
      coalesce(sum(i.total), 0) as amount,
      count(i.id) as invoice_count
    from generate_series(
      current_date - (p_days || ' days')::interval,
      current_date,
      '1 day'::interval
    ) d(date)
    left join public.invoices i
      on i.organization_id = p_org_id
      and i.status = 'paid'
      and i.paid_date = d.date::date
      and i.deleted_at is null
    group by d.date
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 3. get_my_schedule ──────────────────────────────────
-- Returns upcoming schedule blocks for a specific user
create or replace function public.get_my_schedule(
  p_user_id uuid,
  p_limit int default 5
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      sb.id,
      sb.job_id,
      sb.title,
      sb.client_name,
      sb.location,
      sb.start_time,
      sb.end_time,
      sb.status,
      sb.travel_minutes,
      sb.notes
    from public.schedule_blocks sb
    where sb.technician_id = p_user_id
      and sb.start_time >= now() - interval '2 hours'
      and sb.status != 'cancelled'
    order by sb.start_time asc
    limit p_limit
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 4. get_ai_insights ──────────────────────────────────
-- Rule-based insights for the AI widget
create or replace function public.get_ai_insights(
  p_org_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_unassigned_tomorrow int;
  v_overdue_invoices int;
  v_idle_technicians int;
  v_total_technicians int;
  v_result json;
  v_insights json[];
begin
  -- Unassigned jobs for tomorrow
  select count(*)
  into v_unassigned_tomorrow
  from public.jobs
  where organization_id = p_org_id
    and assignee_id is null
    and status in ('todo', 'backlog')
    and due_date::date = (current_date + 1)
    and deleted_at is null;

  -- Overdue invoices
  select count(*)
  into v_overdue_invoices
  from public.invoices
  where organization_id = p_org_id
    and status in ('sent', 'overdue')
    and due_date < current_date
    and deleted_at is null;

  -- Technician utilization
  select count(distinct om.user_id)
  into v_total_technicians
  from public.organization_members om
  where om.organization_id = p_org_id
    and om.status = 'active';

  select count(distinct sb.technician_id)
  into v_idle_technicians
  from public.organization_members om
  left join public.schedule_blocks sb
    on sb.technician_id = om.user_id
    and sb.start_time >= now()
    and sb.start_time <= now() + interval '24 hours'
    and sb.status != 'cancelled'
  where om.organization_id = p_org_id
    and om.status = 'active'
    and sb.id is null;

  -- Build insights array
  v_insights := array[]::json[];

  if v_unassigned_tomorrow > 0 then
    v_insights := v_insights || json_build_object(
      'type', 'warning',
      'title', v_unassigned_tomorrow || ' job' || case when v_unassigned_tomorrow > 1 then 's' else '' end || ' unassigned for tomorrow',
      'body', 'Tomorrow has ' || v_unassigned_tomorrow || ' open job' || case when v_unassigned_tomorrow > 1 then 's' else '' end || ' with no technician assigned. Consider batch-assigning to reduce gap time.',
      'action', 'Fix Schedule',
      'action_route', '/dashboard/schedule',
      'priority', 1
    )::json;
  end if;

  if v_overdue_invoices > 0 then
    v_insights := v_insights || json_build_object(
      'type', 'alert',
      'title', v_overdue_invoices || ' overdue invoice' || case when v_overdue_invoices > 1 then 's' else '' end || ' need attention',
      'body', 'You have ' || v_overdue_invoices || ' invoice' || case when v_overdue_invoices > 1 then 's' else '' end || ' past their due date. Send reminders to improve cash flow.',
      'action', 'View Invoices',
      'action_route', '/dashboard/finance',
      'priority', 2
    )::json;
  end if;

  if v_idle_technicians > 0 and v_total_technicians > 0 then
    v_insights := v_insights || json_build_object(
      'type', 'info',
      'title', v_idle_technicians || ' team member' || case when v_idle_technicians > 1 then 's' else '' end || ' available tomorrow',
      'body', v_idle_technicians || ' of ' || v_total_technicians || ' technicians have no scheduled work for the next 24 hours.',
      'action', 'View Schedule',
      'action_route', '/dashboard/schedule',
      'priority', 3
    )::json;
  end if;

  -- Fallback if no insights
  if array_length(v_insights, 1) is null then
    v_insights := array[json_build_object(
      'type', 'success',
      'title', 'Schedule looks optimized',
      'body', 'All jobs are assigned and invoices are up to date. Your operations are running smoothly.',
      'action', null,
      'action_route', null,
      'priority', 99
    )::json];
  end if;

  return json_build_array(variadic v_insights);
end;
$$;

-- ── 5. get_team_status ──────────────────────────────────
-- Returns team members with their current work status
create or replace function public.get_team_status(
  p_org_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t) order by t.status_order, t.name)
  into v_result
  from (
    select
      p.id as user_id,
      p.full_name as name,
      coalesce(substring(p.full_name from 1 for 1), '') ||
        coalesce(substring(p.full_name from '.*\s(.)\S*$'), '') as initials,
      p.avatar_url,
      case
        when j_active.id is not null and j_active.status = 'in_progress' then 'on_job'
        when sb_active.id is not null and sb_active.status = 'en_route' then 'en_route'
        when sb_active.id is not null then 'on_job'
        else 'idle'
      end as status,
      case
        when j_active.id is not null then j_active.title
        when sb_active.id is not null then sb_active.title
        else null
      end as current_task,
      case
        when j_active.id is not null then 1
        when sb_active.id is not null then 2
        else 3
      end as status_order
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    left join lateral (
      select j.id, j.title, j.status
      from public.jobs j
      where j.assignee_id = om.user_id
        and j.status in ('in_progress')
        and j.deleted_at is null
      order by j.updated_at desc
      limit 1
    ) j_active on true
    left join lateral (
      select sb.id, sb.title, sb.status
      from public.schedule_blocks sb
      where sb.technician_id = om.user_id
        and sb.start_time <= now() + interval '30 minutes'
        and sb.end_time >= now()
        and sb.status in ('scheduled', 'en_route', 'in_progress')
      order by sb.start_time asc
      limit 1
    ) sb_active on true
    where om.organization_id = p_org_id
      and om.status = 'active'
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 6. get_live_dispatch ────────────────────────────────
-- Returns active job locations for map view
create or replace function public.get_live_dispatch(
  p_org_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      j.id,
      j.title as task,
      j.status,
      j.location,
      j.location_lat,
      j.location_lng,
      p.full_name as name,
      p.id as technician_id,
      case
        when j.status = 'in_progress' then 'on_job'
        else 'en_route'
      end as dispatch_status
    from public.jobs j
    left join public.profiles p on p.id = j.assignee_id
    where j.organization_id = p_org_id
      and j.status in ('in_progress', 'todo', 'backlog')
      and j.deleted_at is null
      and (j.location_lat is not null or j.assignee_id is not null)
    order by
      case j.status when 'in_progress' then 1 when 'todo' then 2 else 3 end,
      j.updated_at desc
    limit 20
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ============================================================
-- File: 020_inbox_realtime.sql
-- ============================================================
-- ============================================================
-- Migration 020: Inbox Realtime & Automation
-- Postgres triggers, RPC functions, and Realtime for the Inbox
-- ============================================================

-- ── 1. Enable Realtime for notifications ────────────────
-- notifications already in supabase_realtime publication
-- alter publication supabase_realtime add table public.notifications;

-- ── 2. Trigger: Auto-notify on job assignment ───────────
create or replace function public.notify_on_job_assignment()
returns trigger as $$
begin
  -- Only fire when assignee changes and new assignee is not null
  if (NEW.assignee_id is distinct from OLD.assignee_id)
     and (NEW.assignee_id is not null) then
    insert into public.notifications (
      organization_id,
      user_id,
      type,
      title,
      body,
      sender_name,
      related_job_id,
      related_entity_type,
      related_entity_id,
      context,
      metadata
    ) values (
      NEW.organization_id,
      NEW.assignee_id,
      'job_assigned',
      'New job assigned to you',
      NEW.display_id || ': ' || NEW.title || ' has been assigned to you.',
      'iWorkr',
      NEW.id,
      'job',
      NEW.id,
      NEW.location,
      jsonb_build_object(
        'job_id', NEW.id,
        'job_title', NEW.title,
        'job_status', NEW.status,
        'display_id', NEW.display_id,
        'location', NEW.location
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_job_assignment
  after update on public.jobs
  for each row
  execute function public.notify_on_job_assignment();

-- ── 3. Trigger: Auto-notify on new job creation with assignee ─
create or replace function public.notify_on_job_created_with_assignee()
returns trigger as $$
begin
  if NEW.assignee_id is not null then
    insert into public.notifications (
      organization_id,
      user_id,
      type,
      title,
      body,
      sender_name,
      related_job_id,
      related_entity_type,
      related_entity_id,
      context,
      metadata
    ) values (
      NEW.organization_id,
      NEW.assignee_id,
      'job_assigned',
      'New job assigned to you',
      NEW.display_id || ': ' || NEW.title || ' has been assigned to you.',
      'iWorkr',
      NEW.id,
      'job',
      NEW.id,
      NEW.location,
      jsonb_build_object(
        'job_id', NEW.id,
        'job_title', NEW.title,
        'job_status', NEW.status,
        'display_id', NEW.display_id
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_job_created_assigned
  after insert on public.jobs
  for each row
  execute function public.notify_on_job_created_with_assignee();

-- ── 4. Trigger: Auto-notify on invoice paid ─────────────
create or replace function public.notify_on_invoice_paid()
returns trigger as $$
begin
  if (NEW.status = 'paid') and (OLD.status is distinct from 'paid') then
    -- Notify org members (we'll notify the creator/owner)
    insert into public.notifications (
      organization_id,
      user_id,
      type,
      title,
      body,
      sender_name,
      related_entity_type,
      related_entity_id,
      metadata
    )
    select
      NEW.organization_id,
      om.user_id,
      'invoice_paid',
      'Invoice ' || NEW.display_id || ' has been paid',
      coalesce(NEW.client_name, 'A client') || ' paid invoice ' || NEW.display_id || ' ($' || (NEW.total::numeric / 100)::text || ').',
      'iWorkr',
      'invoice',
      NEW.id,
      jsonb_build_object(
        'invoice_id', NEW.id,
        'display_id', NEW.display_id,
        'amount', NEW.total,
        'client_name', NEW.client_name
      )
    from public.organization_members om
    where om.organization_id = NEW.organization_id
      and om.status = 'active'
    limit 5;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_invoice_paid
  after update on public.invoices
  for each row
  execute function public.notify_on_invoice_paid();

-- ── 5. Trigger: Auto-notify on schedule conflict ────────
create or replace function public.notify_on_schedule_conflict()
returns trigger as $$
declare
  v_conflict_count int;
begin
  if NEW.is_conflict = true and (OLD.is_conflict is distinct from true) then
    insert into public.notifications (
      organization_id,
      user_id,
      type,
      title,
      body,
      sender_name,
      related_entity_type,
      related_entity_id,
      metadata
    ) values (
      NEW.organization_id,
      NEW.technician_id,
      'schedule_conflict',
      'Schedule Conflict Detected',
      'You have overlapping schedule blocks for "' || NEW.title || '". Please review your schedule.',
      'iWorkr',
      'schedule_block',
      NEW.id,
      jsonb_build_object(
        'block_id', NEW.id,
        'block_title', NEW.title
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_schedule_conflict
  after update on public.schedule_blocks
  for each row
  execute function public.notify_on_schedule_conflict();

-- ── 6. RPC: Bulk mark as read ───────────────────────────
create or replace function public.mark_inbox_read(p_ids uuid[])
returns void
language plpgsql
security definer
as $$
begin
  update public.notifications
  set read = true
  where id = any(p_ids)
    and user_id = auth.uid();
end;
$$;

-- ── 7. RPC: Snooze item ────────────────────────────────
create or replace function public.snooze_inbox_item(
  p_id uuid,
  p_until timestamptz
)
returns void
language plpgsql
security definer
as $$
begin
  update public.notifications
  set snoozed_until = p_until
  where id = p_id
    and user_id = auth.uid();
end;
$$;

-- ── 8. RPC: Unsnooze expired items (for cron) ──────────
create or replace function public.unsnooze_expired_notifications()
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  update public.notifications
  set snoozed_until = null
  where snoozed_until is not null
    and snoozed_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- File: 021_jobs_enhancements.sql
-- ============================================================
-- ============================================================
-- Migration 021: Jobs Module Enhancements
-- Line items table, display ID trigger, auto-activity trigger,
-- and create_job_with_estimate RPC
-- ============================================================

-- ── 1. Job Line Items table ─────────────────────────────
create table if not exists public.job_line_items (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs on delete cascade,
  description     text not null,
  quantity        int not null default 1,
  unit_price_cents int not null default 0,
  sort_order      int not null default 0,
  created_at      timestamptz default now()
);

create index idx_job_line_items_job on public.job_line_items (job_id);

-- RLS
alter table public.job_line_items enable row level security;

create policy "Members can read job line items"
  on public.job_line_items for select
  using (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy "Members can create job line items"
  on public.job_line_items for insert
  with check (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy "Members can update job line items"
  on public.job_line_items for update
  using (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy "Members can delete job line items"
  on public.job_line_items for delete
  using (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- ── 2. Display ID auto-generation trigger ───────────────
-- Uses per-organization sequence via a counter stored in metadata
create or replace function public.set_job_display_id()
returns trigger as $$
declare
  v_next_num int;
begin
  -- Only generate if display_id is null or empty
  if NEW.display_id is null or NEW.display_id = '' then
    -- Get next number for this org
    select coalesce(max(
      case
        when display_id ~ '^JOB-\d+$'
        then substring(display_id from 'JOB-(\d+)')::int
        else 0
      end
    ), 0) + 1
    into v_next_num
    from public.jobs
    where organization_id = NEW.organization_id;

    NEW.display_id := 'JOB-' || lpad(v_next_num::text, 3, '0');
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Drop if exists to avoid conflicts
drop trigger if exists before_insert_job_display_id on public.jobs;
create trigger before_insert_job_display_id
  before insert on public.jobs
  for each row
  execute function public.set_job_display_id();

-- ── 3. Auto-activity logging trigger ────────────────────
-- Automatically logs status changes, priority changes, and assignment changes
create or replace function public.log_job_activity()
returns trigger as $$
declare
  v_user_name text;
begin
  -- Get user name
  select coalesce(p.full_name, 'System')
  into v_user_name
  from public.profiles p
  where p.id = auth.uid();

  -- Status change
  if OLD.status is distinct from NEW.status then
    insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
    values (
      NEW.id,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      auth.uid(),
      v_user_name,
      '{}',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  end if;

  -- Priority change
  if OLD.priority is distinct from NEW.priority then
    insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
    values (
      NEW.id,
      'update',
      'Priority changed from ' || OLD.priority || ' to ' || NEW.priority,
      auth.uid(),
      v_user_name,
      '{}',
      jsonb_build_object('field', 'priority', 'old_value', OLD.priority, 'new_value', NEW.priority)
    );
  end if;

  -- Assignment change
  if OLD.assignee_id is distinct from NEW.assignee_id then
    if NEW.assignee_id is not null then
      declare
        v_assignee_name text;
      begin
        select coalesce(p.full_name, 'Unknown')
        into v_assignee_name
        from public.profiles p
        where p.id = NEW.assignee_id;

        insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
        values (
          NEW.id,
          'assignment',
          'Job assigned to ' || v_assignee_name,
          auth.uid(),
          v_user_name,
          '{}',
          jsonb_build_object('assignee_id', NEW.assignee_id, 'assignee_name', v_assignee_name)
        );
      end;
    else
      insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
      values (
        NEW.id,
        'assignment',
        'Job assignment removed',
        auth.uid(),
        v_user_name,
        '{}',
        jsonb_build_object('assignee_id', null)
      );
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_job_update_log_activity on public.jobs;
create trigger on_job_update_log_activity
  after update on public.jobs
  for each row
  execute function public.log_job_activity();

-- ── 4. RPC: Create job with estimate (transactional) ────
create or replace function public.create_job_with_estimate(
  p_org_id uuid,
  p_title text,
  p_description text default null,
  p_status text default 'backlog',
  p_priority text default 'none',
  p_client_id uuid default null,
  p_assignee_id uuid default null,
  p_due_date timestamptz default null,
  p_location text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_labels text[] default '{}',
  p_revenue numeric default 0,
  p_line_items jsonb default '[]'
)
returns json
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
  v_display_id text;
  v_line_item jsonb;
  v_sort int := 0;
  v_total_cents int := 0;
begin
  -- Calculate total from line items
  for v_line_item in select * from jsonb_array_elements(p_line_items)
  loop
    v_total_cents := v_total_cents + coalesce((v_line_item->>'unit_price_cents')::int, 0) * coalesce((v_line_item->>'quantity')::int, 1);
  end loop;

  -- Insert the job (display_id will be auto-generated by trigger)
  insert into public.jobs (
    organization_id, title, description, status, priority,
    client_id, assignee_id, due_date, location,
    location_lat, location_lng, labels,
    revenue, created_by
  ) values (
    p_org_id, p_title, p_description,
    p_status::public.job_status, p_priority::public.job_priority,
    p_client_id, p_assignee_id, p_due_date, p_location,
    p_location_lat, p_location_lng, p_labels,
    case when v_total_cents > 0 then v_total_cents / 100.0 else p_revenue end,
    auth.uid()
  )
  returning id, display_id into v_job_id, v_display_id;

  -- Insert line items
  if jsonb_array_length(p_line_items) > 0 then
    for v_line_item in select * from jsonb_array_elements(p_line_items)
    loop
      insert into public.job_line_items (
        job_id, description, quantity, unit_price_cents, sort_order
      ) values (
        v_job_id,
        v_line_item->>'description',
        coalesce((v_line_item->>'quantity')::int, 1),
        coalesce((v_line_item->>'unit_price_cents')::int, 0),
        v_sort
      );
      v_sort := v_sort + 1;
    end loop;
  end if;

  -- Log creation activity
  insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
  values (
    v_job_id,
    'creation',
    'Job "' || p_title || '" was created' || case when jsonb_array_length(p_line_items) > 0 then ' with estimate ($' || (v_total_cents / 100)::text || ')' else '' end,
    auth.uid(),
    coalesce((select full_name from public.profiles where id = auth.uid()), 'System'),
    '{}',
    jsonb_build_object('line_items_count', jsonb_array_length(p_line_items), 'total_cents', v_total_cents)
  );

  return json_build_object(
    'id', v_job_id,
    'display_id', v_display_id,
    'total_cents', v_total_cents,
    'line_items_count', jsonb_array_length(p_line_items)
  );
end;
$$;

-- ── 5. RPC: Get filtered jobs with advanced filtering ───
create or replace function public.get_filtered_jobs(
  p_org_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assignee_id uuid default null,
  p_search text default null,
  p_labels text[] default null,
  p_limit int default 100,
  p_offset int default 0
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      j.*,
      c.name as client_name,
      p.full_name as assignee_name,
      (select count(*) from public.job_subtasks st where st.job_id = j.id) as subtask_count,
      (select count(*) from public.job_line_items li where li.job_id = j.id) as line_item_count,
      (select coalesce(sum(li.unit_price_cents * li.quantity), 0) from public.job_line_items li where li.job_id = j.id) as estimate_total_cents
    from public.jobs j
    left join public.clients c on c.id = j.client_id
    left join public.profiles p on p.id = j.assignee_id
    where j.organization_id = p_org_id
      and j.deleted_at is null
      and (p_status is null or j.status = p_status::public.job_status)
      and (p_priority is null or j.priority = p_priority::public.job_priority)
      and (p_assignee_id is null or j.assignee_id = p_assignee_id)
      and (p_search is null or j.title ilike '%' || p_search || '%' or j.description ilike '%' || p_search || '%' or j.display_id ilike '%' || p_search || '%')
      and (p_labels is null or j.labels && p_labels)
    order by j.created_at desc
    limit p_limit
    offset p_offset
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 6. RPC: Get job with full details ───────────────────
create or replace function public.get_job_details(p_job_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select row_to_json(t)
  into v_result
  from (
    select
      j.*,
      c.name as client_name,
      p.full_name as assignee_name,
      (
        select coalesce(json_agg(row_to_json(st) order by st.sort_order), '[]'::json)
        from public.job_subtasks st
        where st.job_id = j.id
      ) as subtasks,
      (
        select coalesce(json_agg(row_to_json(a) order by a.created_at desc), '[]'::json)
        from public.job_activity a
        where a.job_id = j.id
      ) as activity,
      (
        select coalesce(json_agg(row_to_json(li) order by li.sort_order), '[]'::json)
        from public.job_line_items li
        where li.job_id = j.id
      ) as line_items,
      (
        select coalesce(sum(li.unit_price_cents * li.quantity), 0)
        from public.job_line_items li
        where li.job_id = j.id
      ) as estimate_total_cents
    from public.jobs j
    left join public.clients c on c.id = j.client_id
    left join public.profiles p on p.id = j.assignee_id
    where j.id = p_job_id
      and j.deleted_at is null
  ) t;

  return v_result;
end;
$$;

-- ============================================================
-- File: 022_schedule_enhancements.sql
-- ============================================================
-- ============================================================
-- Migration 022: Schedule Module Enhancements
-- schedule_events table, estimated_duration_minutes on jobs,
-- conflict detection RPC, schedule view RPC, realtime
-- ============================================================

-- ── 1. Add estimated_duration_minutes to jobs ───────────
alter table public.jobs
  add column if not exists estimated_duration_minutes int default 60;

-- ── 2. Schedule Events table (non-job blocks) ──────────
do $$ begin
  create type public.schedule_event_type as enum ('break', 'meeting', 'personal', 'unavailable');
exception when duplicate_object then null;
end $$;

create table if not exists public.schedule_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references public.profiles on delete cascade,
  type            public.schedule_event_type not null default 'break',
  title           text not null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_schedule_events_org
  on public.schedule_events (organization_id);

create index if not exists idx_schedule_events_user_time
  on public.schedule_events (user_id, start_time);

-- RLS
alter table public.schedule_events enable row level security;

create policy "Members can read org schedule events"
  on public.schedule_events for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can create org schedule events"
  on public.schedule_events for insert
  with check (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can update org schedule events"
  on public.schedule_events for update
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "Members can delete org schedule events"
  on public.schedule_events for delete
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

-- ── 3. RPC: Check schedule conflicts ────────────────────
create or replace function public.check_schedule_conflicts(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      a.id as block_a_id,
      b.id as block_b_id,
      a.technician_id,
      a.title as block_a_title,
      b.title as block_b_title,
      a.start_time as block_a_start,
      a.end_time as block_a_end,
      b.start_time as block_b_start,
      b.end_time as block_b_end
    from public.schedule_blocks a
    join public.schedule_blocks b
      on a.technician_id = b.technician_id
      and a.id < b.id
      and a.start_time < b.end_time
      and a.end_time > b.start_time
    where a.organization_id = p_org_id
      and a.status != 'cancelled'
      and b.status != 'cancelled'
      and a.start_time::date = current_date
      and b.start_time::date = current_date
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 4. RPC: Full schedule view (technicians + blocks + events) ─
create or replace function public.get_schedule_view(
  p_org_id uuid,
  p_date date default current_date
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
  v_start timestamptz;
  v_end timestamptz;
begin
  v_start := p_date::timestamptz;
  v_end := (p_date + 1)::timestamptz;

  select json_build_object(
    'technicians', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json)
      from (
        select
          p.id,
          p.full_name,
          p.email,
          om.role,
          (
            select coalesce(
              sum(extract(epoch from (least(sb.end_time, v_end) - greatest(sb.start_time, v_start))) / 3600),
              0
            )
            from public.schedule_blocks sb
            where sb.technician_id = p.id
              and sb.start_time < v_end
              and sb.end_time > v_start
              and sb.status != 'cancelled'
          ) as hours_booked
        from public.organization_members om
        join public.profiles p on p.id = om.user_id
        where om.organization_id = p_org_id
          and om.status = 'active'
        order by p.full_name
      ) t
    ),
    'blocks', (
      select coalesce(json_agg(row_to_json(b) order by b.start_time), '[]'::json)
      from (
        select
          sb.*,
          p.full_name as technician_name
        from public.schedule_blocks sb
        left join public.profiles p on p.id = sb.technician_id
        where sb.organization_id = p_org_id
          and sb.start_time < v_end
          and sb.end_time > v_start
      ) b
    ),
    'events', (
      select coalesce(json_agg(row_to_json(e) order by e.start_time), '[]'::json)
      from (
        select
          se.*,
          p.full_name as user_name
        from public.schedule_events se
        left join public.profiles p on p.id = se.user_id
        where se.organization_id = p_org_id
          and se.start_time < v_end
          and se.end_time > v_start
      ) e
    ),
    'backlog', (
      select coalesce(json_agg(row_to_json(j) order by j.created_at desc), '[]'::json)
      from (
        select
          j.id,
          j.display_id,
          j.title,
          j.priority,
          j.location,
          j.estimated_duration_minutes,
          c.name as client_name
        from public.jobs j
        left join public.clients c on c.id = j.client_id
        where j.organization_id = p_org_id
          and j.deleted_at is null
          and (j.status = 'backlog' or j.status = 'todo')
          and j.assignee_id is null
          and not exists (
            select 1 from public.schedule_blocks sb
            where sb.job_id = j.id
              and sb.status != 'cancelled'
          )
      ) j
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ── 5. RPC: Move/reschedule a block (the "snap" mutation) ──
create or replace function public.move_schedule_block(
  p_block_id uuid,
  p_technician_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_block record;
  v_conflict_count int;
begin
  -- Get current block
  select * into v_block
  from public.schedule_blocks
  where id = p_block_id;

  if v_block is null then
    return json_build_object('error', 'Block not found');
  end if;

  -- Check for conflicts at new position
  select count(*) into v_conflict_count
  from public.schedule_blocks
  where technician_id = p_technician_id
    and id != p_block_id
    and status != 'cancelled'
    and start_time < p_end_time
    and end_time > p_start_time;

  -- Update the block
  update public.schedule_blocks
  set
    technician_id = p_technician_id,
    start_time = p_start_time,
    end_time = p_end_time,
    is_conflict = (v_conflict_count > 0),
    updated_at = now()
  where id = p_block_id;

  -- If there are conflicts, also flag the overlapping blocks
  if v_conflict_count > 0 then
    update public.schedule_blocks
    set is_conflict = true, updated_at = now()
    where technician_id = p_technician_id
      and id != p_block_id
      and status != 'cancelled'
      and start_time < p_end_time
      and end_time > p_start_time;
  end if;

  -- Clear conflict flag on blocks that no longer overlap (at old position)
  if v_block.technician_id is distinct from p_technician_id then
    update public.schedule_blocks sb
    set is_conflict = false, updated_at = now()
    where sb.technician_id = v_block.technician_id
      and sb.id != p_block_id
      and sb.is_conflict = true
      and sb.status != 'cancelled'
      and not exists (
        select 1 from public.schedule_blocks other
        where other.technician_id = sb.technician_id
          and other.id != sb.id
          and other.id != p_block_id
          and other.status != 'cancelled'
          and other.start_time < sb.end_time
          and other.end_time > sb.start_time
      );
  end if;

  -- Also update the linked job's assignee if the tech changed
  if v_block.job_id is not null and v_block.technician_id is distinct from p_technician_id then
    update public.jobs
    set assignee_id = p_technician_id
    where id = v_block.job_id;
  end if;

  return json_build_object(
    'success', true,
    'conflict', v_conflict_count > 0,
    'block_id', p_block_id
  );
end;
$$;

-- ── 6. RPC: Assign a backlog job to the schedule ────────
create or replace function public.assign_job_to_schedule(
  p_org_id uuid,
  p_job_id uuid,
  p_technician_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz
)
returns json
language plpgsql
security definer
as $$
declare
  v_job record;
  v_block_id uuid;
  v_conflict_count int;
begin
  -- Get job details
  select j.*, c.name as client_name
  into v_job
  from public.jobs j
  left join public.clients c on c.id = j.client_id
  where j.id = p_job_id and j.deleted_at is null;

  if v_job is null then
    return json_build_object('error', 'Job not found');
  end if;

  -- Check for conflicts
  select count(*) into v_conflict_count
  from public.schedule_blocks
  where technician_id = p_technician_id
    and status != 'cancelled'
    and start_time < p_end_time
    and end_time > p_start_time;

  -- Create schedule block
  insert into public.schedule_blocks (
    organization_id, job_id, technician_id, title,
    client_name, location, start_time, end_time,
    status, is_conflict
  ) values (
    p_org_id, p_job_id, p_technician_id, v_job.title,
    v_job.client_name, v_job.location, p_start_time, p_end_time,
    'scheduled', v_conflict_count > 0
  )
  returning id into v_block_id;

  -- Update job: set assignee and move from backlog to todo
  update public.jobs
  set
    assignee_id = p_technician_id,
    status = case when status = 'backlog' then 'todo'::public.job_status else status end
  where id = p_job_id;

  return json_build_object(
    'success', true,
    'block_id', v_block_id,
    'conflict', v_conflict_count > 0
  );
end;
$$;

-- ── 7. Enable realtime on schedule_blocks ───────────────
-- Check if already in publication before adding
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'schedule_blocks'
  ) then
    alter publication supabase_realtime add table public.schedule_blocks;
  end if;
end $$;

-- ============================================================
-- File: 023_clients_enhancements.sql
-- ============================================================
-- ============================================================
-- Migration 023: Clients Module Enhancements
-- get_clients_with_stats RPC, create_client_full RPC,
-- VIP auto-tag trigger, last_active_at trigger, billing_terms
-- ============================================================

-- ── 1. Add billing_terms and last_active_at to clients ──
alter table public.clients
  add column if not exists billing_terms text default 'due_on_receipt';

alter table public.clients
  add column if not exists last_active_at timestamptz;

-- ── 2. RPC: Get clients with aggregated stats ──────────
create or replace function public.get_clients_with_stats(
  p_org_id uuid,
  p_search text default null,
  p_status text default null,
  p_type text default null,
  p_sort_by text default 'name',
  p_sort_asc boolean default true,
  p_limit int default 200,
  p_offset int default 0
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      c.*,
      coalesce(js.job_count, 0) as job_count,
      coalesce(is2.lifetime_value, 0) as total_spend,
      js.last_job_date,
      (
        select json_agg(row_to_json(cc) order by cc.is_primary desc, cc.created_at)
        from public.client_contacts cc
        where cc.client_id = c.id
      ) as contacts
    from public.clients c
    left join lateral (
      select
        count(*)::int as job_count,
        max(j.created_at) as last_job_date
      from public.jobs j
      where j.client_id = c.id
        and j.deleted_at is null
    ) js on true
    left join lateral (
      select coalesce(sum(i.total), 0)::numeric as lifetime_value
      from public.invoices i
      where i.client_id = c.id
        and i.status = 'paid'
    ) is2 on true
    where c.organization_id = p_org_id
      and c.deleted_at is null
      and (p_search is null
        or c.name ilike '%' || p_search || '%'
        or c.email ilike '%' || p_search || '%'
        or exists (
          select 1 from unnest(c.tags) tag where tag ilike '%' || p_search || '%'
        )
      )
      and (p_status is null or c.status = p_status::public.client_status)
      and (p_type is null or c.type = p_type::public.client_type)
    order by
      case when p_sort_by = 'name' and p_sort_asc then c.name end asc,
      case when p_sort_by = 'name' and not p_sort_asc then c.name end desc,
      case when p_sort_by = 'ltv' and p_sort_asc then coalesce(is2.lifetime_value, 0) end asc,
      case when p_sort_by = 'ltv' and not p_sort_asc then coalesce(is2.lifetime_value, 0) end desc,
      case when p_sort_by = 'jobs' and p_sort_asc then coalesce(js.job_count, 0) end asc,
      case when p_sort_by = 'jobs' and not p_sort_asc then coalesce(js.job_count, 0) end desc,
      case when p_sort_by = 'last_active' and p_sort_asc then c.last_active_at end asc nulls last,
      case when p_sort_by = 'last_active' and not p_sort_asc then c.last_active_at end desc nulls last,
      c.created_at desc
    limit p_limit
    offset p_offset
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 3. RPC: Create client with contact (transactional) ──
create or replace function public.create_client_full(
  p_org_id uuid,
  p_name text,
  p_type text default 'residential',
  p_status text default 'active',
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_address_lat double precision default null,
  p_address_lng double precision default null,
  p_tags text[] default '{}',
  p_notes text default null,
  p_billing_terms text default 'due_on_receipt',
  p_contact_name text default null,
  p_contact_role text default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_client_id uuid;
  v_contact_id uuid;
begin
  -- Insert client
  insert into public.clients (
    organization_id, name, type, status, email, phone,
    address, address_lat, address_lng, tags, notes,
    billing_terms, since
  ) values (
    p_org_id, p_name,
    p_type::public.client_type,
    p_status::public.client_status,
    p_email, p_phone,
    p_address, p_address_lat, p_address_lng,
    p_tags, p_notes,
    p_billing_terms, now()
  )
  returning id into v_client_id;

  -- Insert primary contact if provided
  if p_contact_name is not null and p_contact_name != '' then
    insert into public.client_contacts (
      client_id, name, role, email, phone, is_primary
    ) values (
      v_client_id, p_contact_name,
      coalesce(p_contact_role, 'Primary Contact'),
      coalesce(p_contact_email, p_email),
      coalesce(p_contact_phone, p_phone),
      true
    )
    returning id into v_contact_id;
  end if;

  return json_build_object(
    'client_id', v_client_id,
    'contact_id', v_contact_id
  );
end;
$$;

-- ── 4. RPC: Get single client with full details ─────────
create or replace function public.get_client_details(p_client_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select row_to_json(t)
  into v_result
  from (
    select
      c.*,
      coalesce(js.job_count, 0) as job_count,
      coalesce(is2.lifetime_value, 0) as total_spend,
      js.last_job_date,
      (
        select coalesce(json_agg(row_to_json(cc) order by cc.is_primary desc, cc.created_at), '[]'::json)
        from public.client_contacts cc
        where cc.client_id = c.id
      ) as contacts,
      (
        select coalesce(json_agg(row_to_json(a) order by a.created_at desc), '[]'::json)
        from (
          select ja.*
          from public.job_activity ja
          join public.jobs j on j.id = ja.job_id
          where j.client_id = c.id
            and j.deleted_at is null
          order by ja.created_at desc
          limit 20
        ) a
      ) as recent_activity,
      (
        select coalesce(json_agg(row_to_json(inv) order by inv.created_at desc), '[]'::json)
        from (
          select i.id, i.status, i.total, i.created_at, i.due_date
          from public.invoices i
          where i.client_id = c.id
          order by i.created_at desc
          limit 50
        ) inv
      ) as spend_history
    from public.clients c
    left join lateral (
      select count(*)::int as job_count, max(j.created_at) as last_job_date
      from public.jobs j
      where j.client_id = c.id and j.deleted_at is null
    ) js on true
    left join lateral (
      select coalesce(sum(i.total), 0)::numeric as lifetime_value
      from public.invoices i
      where i.client_id = c.id and i.status = 'paid'
    ) is2 on true
    where c.id = p_client_id
      and c.deleted_at is null
  ) t;

  return v_result;
end;
$$;

-- ── 5. Trigger: Auto-tag VIP when LTV > $10,000 ────────
create or replace function public.auto_tag_vip_client()
returns trigger as $$
declare
  v_lifetime_value numeric;
  v_current_tags text[];
begin
  -- Calculate LTV for the client of the paid invoice
  select coalesce(sum(total), 0)
  into v_lifetime_value
  from public.invoices
  where client_id = NEW.client_id
    and status = 'paid';

  -- If LTV > $10,000 and VIP tag not already present
  if v_lifetime_value >= 10000 then
    select tags into v_current_tags
    from public.clients
    where id = NEW.client_id;

    if not ('VIP' = any(coalesce(v_current_tags, '{}'))) then
      update public.clients
      set tags = array_append(coalesce(tags, '{}'), 'VIP'),
          updated_at = now()
      where id = NEW.client_id;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_invoice_paid_vip_check on public.invoices;
create trigger on_invoice_paid_vip_check
  after insert or update on public.invoices
  for each row
  when (NEW.status = 'paid')
  execute function public.auto_tag_vip_client();

-- ── 6. Trigger: Update last_active_at on job completion ─
create or replace function public.update_client_last_active()
returns trigger as $$
begin
  if NEW.status = 'done' and NEW.client_id is not null then
    update public.clients
    set last_active_at = now(),
        updated_at = now()
    where id = NEW.client_id;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_job_done_update_client on public.jobs;
create trigger on_job_done_update_client
  after update on public.jobs
  for each row
  when (NEW.status = 'done' and (OLD.status is distinct from NEW.status))
  execute function public.update_client_last_active();

-- ============================================================
-- File: 024_finance_enhancements.sql
-- ============================================================
-- ============================================================
-- Migration 024: Finance Module Enhancements
-- get_finance_overview RPC, create_invoice_full RPC,
-- overdue watchdog, realtime for invoices
-- ============================================================

-- ── 1. RPC: Finance Overview (dashboard aggregations) ───
create or replace function public.get_finance_overview(
  p_org_id uuid,
  p_month_start date default null,
  p_month_end date default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_month_start date;
  v_month_end date;
  v_revenue_mtd numeric;
  v_revenue_prev numeric;
  v_revenue_growth numeric;
  v_overdue_amount numeric;
  v_overdue_count int;
  v_avg_payout_days numeric;
  v_unpaid_balance numeric;
  v_total_paid_all_time numeric;
  v_invoices_sent int;
  v_invoices_paid int;
begin
  v_month_start := coalesce(p_month_start, date_trunc('month', current_date)::date);
  v_month_end := coalesce(p_month_end, (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date);

  -- Revenue MTD: sum of paid invoices this month
  select coalesce(sum(total), 0)
  into v_revenue_mtd
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= v_month_start
    and paid_date <= v_month_end
    and deleted_at is null;

  -- Revenue previous month for growth %
  select coalesce(sum(total), 0)
  into v_revenue_prev
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= (v_month_start - interval '1 month')::date
    and paid_date < v_month_start
    and deleted_at is null;

  -- Growth percentage
  if v_revenue_prev > 0 then
    v_revenue_growth := round(((v_revenue_mtd - v_revenue_prev) / v_revenue_prev) * 100);
  elsif v_revenue_mtd > 0 then
    v_revenue_growth := 100;
  else
    v_revenue_growth := 0;
  end if;

  -- Overdue: sum and count of overdue invoices
  select coalesce(sum(total), 0), count(*)
  into v_overdue_amount, v_overdue_count
  from public.invoices
  where organization_id = p_org_id
    and status = 'overdue'
    and deleted_at is null;

  -- Also include sent invoices past due date
  select v_overdue_amount + coalesce(sum(total), 0),
         v_overdue_count + count(*)
  into v_overdue_amount, v_overdue_count
  from public.invoices
  where organization_id = p_org_id
    and status = 'sent'
    and due_date < current_date
    and deleted_at is null;

  -- Average payout days (time from paid_date to payout arrival)
  select coalesce(avg(p.payout_date - i.paid_date), 2.4)
  into v_avg_payout_days
  from public.payouts p
  cross join lateral unnest(p.invoice_ids) as inv_id
  join public.invoices i on i.id = inv_id
  where p.organization_id = p_org_id
    and p.status = 'completed'
    and i.paid_date is not null;

  -- Unpaid balance: paid invoices not yet in a completed payout
  select coalesce(sum(total), 0)
  into v_unpaid_balance
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and deleted_at is null
    and id not in (
      select unnest(invoice_ids)
      from public.payouts
      where organization_id = p_org_id
        and status = 'completed'
    );

  -- Total paid all time
  select coalesce(sum(total), 0)
  into v_total_paid_all_time
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and deleted_at is null;

  -- Counts
  select count(*) into v_invoices_sent
  from public.invoices
  where organization_id = p_org_id
    and status = 'sent'
    and deleted_at is null;

  select count(*) into v_invoices_paid
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and deleted_at is null;

  return json_build_object(
    'revenue_mtd', v_revenue_mtd,
    'revenue_growth', v_revenue_growth,
    'overdue_amount', v_overdue_amount,
    'overdue_count', v_overdue_count,
    'avg_payout_days', round(v_avg_payout_days::numeric, 1),
    'stripe_balance', v_unpaid_balance,
    'total_paid_all_time', v_total_paid_all_time,
    'invoices_sent', v_invoices_sent,
    'invoices_paid', v_invoices_paid
  );
end;
$$;

-- ── 2. RPC: Create invoice with line items (transactional) ─
create or replace function public.create_invoice_full(
  p_org_id uuid,
  p_client_id uuid default null,
  p_client_name text default null,
  p_client_email text default null,
  p_client_address text default null,
  p_status text default 'draft',
  p_issue_date date default current_date,
  p_due_date date default null,
  p_tax_rate numeric default 10,
  p_notes text default null,
  p_payment_link text default null,
  p_items json default '[]',
  p_created_by uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_invoice_id uuid;
  v_display_id text;
  v_next_num int;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_item json;
  v_sort int := 0;
  v_due date;
begin
  -- Generate display_id
  select coalesce(
    (select max(
      case when display_id ~ '^INV-\d+$'
        then substring(display_id from 5)::int
        else 0
      end
    ) from public.invoices where organization_id = p_org_id),
    1250
  ) + 1
  into v_next_num;

  v_display_id := 'INV-' || lpad(v_next_num::text, 4, '0');

  -- Calculate totals from items
  for v_item in select * from json_array_elements(p_items)
  loop
    v_subtotal := v_subtotal + (
      coalesce((v_item->>'quantity')::numeric, 1) *
      coalesce((v_item->>'unit_price')::numeric, 0)
    );
  end loop;

  v_tax := round(v_subtotal * (p_tax_rate / 100), 2);
  v_total := v_subtotal + v_tax;

  -- Default due date = issue + 7 days
  v_due := coalesce(p_due_date, p_issue_date + interval '7 days');

  -- Insert invoice
  insert into public.invoices (
    organization_id, display_id, client_id,
    client_name, client_email, client_address,
    status, issue_date, due_date,
    subtotal, tax_rate, tax, total,
    payment_link, notes, created_by
  ) values (
    p_org_id, v_display_id, p_client_id,
    p_client_name, p_client_email, p_client_address,
    p_status::public.invoice_status, p_issue_date, v_due,
    v_subtotal, p_tax_rate, v_tax, v_total,
    p_payment_link, p_notes, p_created_by
  )
  returning id into v_invoice_id;

  -- Insert line items
  for v_item in select * from json_array_elements(p_items)
  loop
    insert into public.invoice_line_items (
      invoice_id, description, quantity, unit_price, sort_order
    ) values (
      v_invoice_id,
      coalesce(v_item->>'description', ''),
      coalesce((v_item->>'quantity')::numeric, 1),
      coalesce((v_item->>'unit_price')::numeric, 0),
      v_sort
    );
    v_sort := v_sort + 1;
  end loop;

  -- Create "created" event
  insert into public.invoice_events (invoice_id, type, text)
  values (v_invoice_id, 'created', 'Invoice ' || v_display_id || ' was created');

  -- If status is 'sent', also create a "sent" event
  if p_status = 'sent' then
    insert into public.invoice_events (invoice_id, type, text)
    values (v_invoice_id, 'sent', 'Invoice ' || v_display_id || ' was sent to ' || coalesce(p_client_email, 'client'));
  end if;

  return json_build_object(
    'invoice_id', v_invoice_id,
    'display_id', v_display_id,
    'total', v_total
  );
end;
$$;

-- ── 3. Overdue Watchdog: Auto-mark sent invoices as overdue ─
create or replace function public.mark_overdue_invoices(p_org_id uuid default null)
returns json
language plpgsql
security definer
as $$
declare
  v_count int;
  v_ids uuid[];
begin
  -- Update sent invoices past due date to overdue
  with updated as (
    update public.invoices
    set status = 'overdue',
        updated_at = now()
    where status = 'sent'
      and due_date < current_date
      and deleted_at is null
      and (p_org_id is null or organization_id = p_org_id)
    returning id, display_id, organization_id, client_name, total
  )
  select count(*), array_agg(id)
  into v_count, v_ids
  from updated;

  -- Create events for each newly overdue invoice
  if v_count > 0 then
    insert into public.invoice_events (invoice_id, type, text)
    select id, 'reminder', 'Invoice ' || display_id || ' is now overdue'
    from public.invoices
    where id = any(v_ids);
  end if;

  return json_build_object(
    'marked_overdue', v_count,
    'invoice_ids', coalesce(v_ids, '{}')
  );
end;
$$;

-- ── 4. RPC: Get full invoice detail (single query) ─────
create or replace function public.get_invoice_detail(p_invoice_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select row_to_json(t)
  into v_result
  from (
    select
      i.*,
      (
        select coalesce(json_agg(row_to_json(li) order by li.sort_order), '[]'::json)
        from public.invoice_line_items li
        where li.invoice_id = i.id
      ) as line_items,
      (
        select coalesce(json_agg(row_to_json(ev) order by ev.created_at desc), '[]'::json)
        from public.invoice_events ev
        where ev.invoice_id = i.id
      ) as events,
      (
        select row_to_json(c)
        from public.clients c
        where c.id = i.client_id
      ) as client_details
    from public.invoices i
    where i.id = p_invoice_id
      and i.deleted_at is null
  ) t;

  return v_result;
end;
$$;

-- ── 5. Enable Realtime for invoices ─────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'invoices'
  ) then
    alter publication supabase_realtime add table public.invoices;
  end if;
end $$;

-- ============================================================
-- File: 025_assets_enhancements.sql
-- ============================================================
-- ============================================================
-- Migration 025: Assets & Inventory Module Enhancements
-- toggle_asset_custody RPC, consume_inventory RPC,
-- get_assets_overview RPC, low-stock trigger, service due
-- ============================================================

-- ── 1. Add columns for PRD compatibility ────────────────
alter table public.assets
  add column if not exists service_interval_days int default 180;

alter table public.assets
  add column if not exists image_url text;

alter table public.inventory_items
  add column if not exists max_quantity int default 100;

alter table public.inventory_items
  add column if not exists bin_location text;

-- ── 2. RPC: Toggle asset custody (check-in / check-out) ─
create or replace function public.toggle_asset_custody(
  p_asset_id uuid,
  p_target_user_id uuid default null,
  p_actor_id uuid default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_asset record;
  v_action text;
  v_new_status text;
  v_user_name text;
begin
  -- Get current asset
  select * into v_asset
  from public.assets
  where id = p_asset_id and deleted_at is null;

  if not found then
    return json_build_object('error', 'Asset not found');
  end if;

  -- Get actor name
  select full_name into v_user_name
  from public.profiles
  where id = coalesce(p_actor_id, p_target_user_id);

  if p_target_user_id is null then
    -- Check-in: clear assignment
    v_action := 'check_in';
    v_new_status := 'available';

    update public.assets
    set assigned_to = null,
        status = 'available',
        updated_at = now()
    where id = p_asset_id;
  else
    -- Check-out: assign to target
    v_action := 'check_out';
    v_new_status := 'assigned';

    update public.assets
    set assigned_to = p_target_user_id,
        status = 'assigned',
        updated_at = now()
    where id = p_asset_id;
  end if;

  -- Create audit log entry
  insert into public.asset_audits (
    organization_id, asset_id, inventory_id,
    action, notes, user_id, user_name, metadata
  ) values (
    v_asset.organization_id, p_asset_id, null,
    v_action,
    coalesce(p_notes, v_action || ' ' || v_asset.name || ' by ' || coalesce(v_user_name, 'unknown')),
    coalesce(p_actor_id, p_target_user_id),
    v_user_name,
    json_build_object(
      'previous_status', v_asset.status,
      'new_status', v_new_status,
      'previous_assignee', v_asset.assigned_to,
      'new_assignee', p_target_user_id
    )::jsonb
  );

  return json_build_object(
    'success', true,
    'action', v_action,
    'asset_id', p_asset_id,
    'new_status', v_new_status
  );
end;
$$;

-- ── 3. RPC: Consume inventory on a job ──────────────────
create or replace function public.consume_inventory(
  p_inventory_id uuid,
  p_quantity int,
  p_job_id uuid default null,
  p_actor_id uuid default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_item record;
  v_new_qty int;
  v_new_level text;
  v_user_name text;
  v_job_display text;
begin
  -- Get current item
  select * into v_item
  from public.inventory_items
  where id = p_inventory_id;

  if not found then
    return json_build_object('error', 'Inventory item not found');
  end if;

  -- Calculate new quantity
  v_new_qty := greatest(0, v_item.quantity - p_quantity);

  -- Calculate new stock level
  if v_new_qty <= 0 then
    v_new_level := 'critical';
  elsif v_new_qty <= v_item.min_quantity then
    v_new_level := 'low';
  else
    v_new_level := 'ok';
  end if;

  -- Update inventory
  update public.inventory_items
  set quantity = v_new_qty,
      stock_level = v_new_level::public.stock_level,
      updated_at = now()
  where id = p_inventory_id;

  -- Get actor name
  select full_name into v_user_name
  from public.profiles
  where id = p_actor_id;

  -- Get job display_id if applicable
  if p_job_id is not null then
    select display_id into v_job_display
    from public.jobs
    where id = p_job_id;
  end if;

  -- Create audit log entry
  insert into public.asset_audits (
    organization_id, asset_id, inventory_id,
    action, notes, user_id, user_name, metadata
  ) values (
    v_item.organization_id, null, p_inventory_id,
    'consumed',
    coalesce(p_notes,
      'Used ' || p_quantity || 'x ' || v_item.name ||
      case when v_job_display is not null then ' on ' || v_job_display else '' end
    ),
    p_actor_id, v_user_name,
    json_build_object(
      'quantity_consumed', p_quantity,
      'previous_qty', v_item.quantity,
      'new_qty', v_new_qty,
      'job_id', p_job_id,
      'job_display_id', v_job_display
    )::jsonb
  );

  return json_build_object(
    'success', true,
    'new_quantity', v_new_qty,
    'stock_level', v_new_level,
    'low_stock_alert', v_new_qty <= v_item.min_quantity
  );
end;
$$;

-- ── 4. RPC: Get assets overview (dashboard stats) ───────
create or replace function public.get_assets_overview(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_build_object(
    'total_assets', (
      select count(*) from public.assets
      where organization_id = p_org_id and deleted_at is null
    ),
    'total_asset_value', (
      select coalesce(sum(purchase_cost), 0)
      from public.assets
      where organization_id = p_org_id and deleted_at is null
    ),
    'vehicles_active', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and category = 'vehicle'
        and status in ('available', 'assigned')
    ),
    'assets_assigned', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and status = 'assigned'
    ),
    'assets_maintenance', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and status = 'maintenance'
    ),
    'service_due_count', (
      select count(*) from public.assets
      where organization_id = p_org_id
        and deleted_at is null
        and next_service is not null
        and next_service <= (current_date + interval '7 days')
    ),
    'low_stock_count', (
      select count(*) from public.inventory_items
      where organization_id = p_org_id
        and stock_level in ('low', 'critical')
    ),
    'critical_stock_count', (
      select count(*) from public.inventory_items
      where organization_id = p_org_id
        and stock_level = 'critical'
    ),
    'total_inventory_value', (
      select coalesce(sum(quantity * unit_cost), 0)
      from public.inventory_items
      where organization_id = p_org_id
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ── 5. RPC: Log service for an asset ────────────────────
create or replace function public.log_asset_service(
  p_asset_id uuid,
  p_actor_id uuid default null,
  p_notes text default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_asset record;
  v_user_name text;
  v_next_service date;
begin
  select * into v_asset
  from public.assets
  where id = p_asset_id and deleted_at is null;

  if not found then
    return json_build_object('error', 'Asset not found');
  end if;

  -- Calculate next service date
  v_next_service := current_date + (coalesce(v_asset.service_interval_days, 180) * interval '1 day');

  -- Update asset
  update public.assets
  set last_service = current_date,
      next_service = v_next_service,
      status = case when status = 'maintenance' then 'available' else status end,
      updated_at = now()
  where id = p_asset_id;

  -- Get actor name
  select full_name into v_user_name
  from public.profiles where id = p_actor_id;

  -- Create audit log
  insert into public.asset_audits (
    organization_id, asset_id, action, notes, user_id, user_name, metadata
  ) values (
    v_asset.organization_id, p_asset_id, 'service',
    coalesce(p_notes, 'Service completed for ' || v_asset.name),
    p_actor_id, v_user_name,
    json_build_object('next_service', v_next_service)::jsonb
  );

  return json_build_object(
    'success', true,
    'last_service', current_date,
    'next_service', v_next_service
  );
end;
$$;

-- ── 6. Trigger: Auto low-stock notification ─────────────
create or replace function public.check_low_stock_trigger()
returns trigger as $$
begin
  -- Only fire when crossing below reorder point
  if NEW.quantity <= NEW.min_quantity
    and (OLD.quantity > OLD.min_quantity or OLD.quantity is null)
  then
    -- Insert system notification for org admins
    insert into public.notifications (
      user_id, type, title, body, metadata
    )
    select
      om.user_id,
      'system',
      'Low Stock Alert',
      NEW.name || ' is below reorder point (' || NEW.quantity || ' remaining)',
      json_build_object(
        'inventory_id', NEW.id,
        'item_name', NEW.name,
        'quantity', NEW.quantity,
        'min_quantity', NEW.min_quantity,
        'stock_level', NEW.stock_level
      )::jsonb
    from public.organization_members om
    where om.organization_id = NEW.organization_id
      and om.role in ('owner', 'admin');
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_inventory_low_stock on public.inventory_items;
create trigger on_inventory_low_stock
  after update on public.inventory_items
  for each row
  when (NEW.stock_level in ('low', 'critical'))
  execute function public.check_low_stock_trigger();

-- ── 7. Enable Realtime for assets & inventory ───────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'assets'
  ) then
    alter publication supabase_realtime add table public.assets;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_items'
  ) then
    alter publication supabase_realtime add table public.inventory_items;
  end if;
end $$;

-- ============================================================
-- File: 026_forms_enhancements.sql
-- ============================================================
-- ============================================================
-- Migration 026: Forms & Compliance Module Enhancements
-- increment_form_submissions, sign_and_lock_submission RPC,
-- save_form_draft RPC, document_hash, verify hash, realtime
-- ============================================================

-- ── 1. Add missing columns ──────────────────────────────
alter table public.form_submissions
  add column if not exists document_hash text;

alter table public.form_submissions
  add column if not exists pdf_url text;

alter table public.forms
  add column if not exists version int default 1;

alter table public.forms
  add column if not exists layout_config jsonb default '{}';

alter table public.forms
  add column if not exists is_verified boolean default false;

-- ── 2. RPC: Increment form submissions count ────────────
create or replace function public.increment_form_submissions(form_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.forms
  set submissions_count = submissions_count + 1,
      updated_at = now()
  where id = form_id;
end;
$$;

-- ── 3. RPC: Save form draft (autosave) ──────────────────
create or replace function public.save_form_draft(
  p_submission_id uuid,
  p_data jsonb
)
returns json
language plpgsql
security definer
as $$
begin
  update public.form_submissions
  set data = p_data,
      updated_at = now()
  where id = p_submission_id
    and status = 'pending';

  if not found then
    return json_build_object('error', 'Submission not found or already signed');
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 4. RPC: Sign and lock submission ────────────────────
create or replace function public.sign_and_lock_submission(
  p_submission_id uuid,
  p_signature text,
  p_document_hash text,
  p_metadata jsonb default '{}'
)
returns json
language plpgsql
security definer
as $$
declare
  v_sub record;
  v_form record;
  v_block record;
  v_missing text[];
begin
  -- Get submission
  select * into v_sub
  from public.form_submissions
  where id = p_submission_id;

  if not found then
    return json_build_object('error', 'Submission not found');
  end if;

  if v_sub.status = 'signed' then
    return json_build_object('error', 'Submission already signed and locked');
  end if;

  -- Get form template for required field validation
  select * into v_form
  from public.forms
  where id = v_sub.form_id;

  if not found then
    return json_build_object('error', 'Form template not found');
  end if;

  -- Validate required fields
  if v_form.blocks is not null and jsonb_array_length(v_form.blocks) > 0 then
    select array_agg(b->>'label')
    into v_missing
    from jsonb_array_elements(v_form.blocks) as b
    where (b->>'required')::boolean = true
      and (
        v_sub.data->(b->>'id') is null
        or v_sub.data->>(b->>'id') = ''
      );

    if v_missing is not null and array_length(v_missing, 1) > 0 then
      return json_build_object(
        'error', 'Missing required fields',
        'missing_fields', to_json(v_missing)
      );
    end if;
  end if;

  -- Lock the submission
  update public.form_submissions
  set status = 'signed',
      signature = p_signature,
      document_hash = p_document_hash,
      signed_at = now(),
      metadata = coalesce(v_sub.metadata, '{}'::jsonb) || p_metadata,
      updated_at = now()
  where id = p_submission_id;

  return json_build_object(
    'success', true,
    'signed_at', now(),
    'document_hash', p_document_hash
  );
end;
$$;

-- ── 5. RPC: Verify document hash ────────────────────────
create or replace function public.verify_document_hash(p_hash text)
returns json
language plpgsql
security definer
as $$
declare
  v_sub record;
begin
  select
    fs.id,
    fs.form_id,
    fs.status,
    fs.signed_at,
    fs.document_hash,
    fs.submitter_name,
    f.title as form_title,
    fs.organization_id
  into v_sub
  from public.form_submissions fs
  join public.forms f on f.id = fs.form_id
  where fs.document_hash = p_hash
    and fs.status = 'signed';

  if not found then
    return json_build_object(
      'verified', false,
      'message', 'No matching signed document found for this hash'
    );
  end if;

  return json_build_object(
    'verified', true,
    'submission_id', v_sub.id,
    'form_title', v_sub.form_title,
    'signed_at', v_sub.signed_at,
    'signed_by', v_sub.submitter_name,
    'document_hash', v_sub.document_hash
  );
end;
$$;

-- ── 6. RPC: Get forms overview (stats) ──────────────────
create or replace function public.get_forms_overview(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  return json_build_object(
    'total_templates', (
      select count(*) from public.forms
      where organization_id = p_org_id and deleted_at is null
    ),
    'published_templates', (
      select count(*) from public.forms
      where organization_id = p_org_id and deleted_at is null and status = 'published'
    ),
    'total_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id
    ),
    'signed_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id and status = 'signed'
    ),
    'pending_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id and status = 'pending'
    ),
    'expired_submissions', (
      select count(*) from public.form_submissions
      where organization_id = p_org_id and status = 'expired'
    )
  );
end;
$$;

-- ── 7. RPC: Publish form (version bump) ─────────────────
create or replace function public.publish_form(p_form_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_new_version int;
begin
  update public.forms
  set status = 'published',
      version = version + 1,
      updated_at = now()
  where id = p_form_id
    and deleted_at is null
  returning version into v_new_version;

  if not found then
    return json_build_object('error', 'Form not found');
  end if;

  return json_build_object(
    'success', true,
    'version', v_new_version
  );
end;
$$;

-- ── 8. Enable Realtime for forms & submissions ──────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'form_submissions'
  ) then
    alter publication supabase_realtime add table public.form_submissions;
  end if;
end $$;

-- ============================================================
-- File: 027_team_rbac_enhancements.sql
-- ============================================================
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

-- ============================================================
-- File: 028_automations_integrations_enhancements.sql
-- ============================================================
-- ============================================================
-- Migration 028: Automations & Integrations Enhancements
-- connection_id, get_automation_stats, get_integrations_overview,
-- toggle_flow_status RPC, Realtime
-- ============================================================

-- ── 1. Add missing columns ──────────────────────────────
alter table public.integrations
  add column if not exists connection_id text;

alter table public.integrations
  add column if not exists settings jsonb default '{}';

-- ── 2. RPC: Get automation stats (sparkline data) ───────
create or replace function public.get_automation_stats(
  p_org_id uuid,
  p_flow_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_hourly json;
begin
  -- Hourly run counts for the last 24 hours (sparkline data)
  select coalesce(json_agg(row_to_json(h)), '[]'::json)
  into v_hourly
  from (
    select
      date_trunc('hour', started_at) as hour,
      count(*) as runs,
      count(*) filter (where status = 'success') as successes,
      count(*) filter (where status = 'failed') as failures
    from public.automation_logs
    where organization_id = p_org_id
      and started_at >= now() - interval '24 hours'
      and (p_flow_id is null or flow_id = p_flow_id)
    group by date_trunc('hour', started_at)
    order by hour
  ) h;

  return json_build_object(
    'total_runs_24h', (
      select count(*) from public.automation_logs
      where organization_id = p_org_id
        and started_at >= now() - interval '24 hours'
        and (p_flow_id is null or flow_id = p_flow_id)
    ),
    'success_rate', (
      select case
        when count(*) = 0 then 100
        else round(count(*) filter (where status = 'success')::numeric / count(*)::numeric * 100)
      end
      from public.automation_logs
      where organization_id = p_org_id
        and started_at >= now() - interval '24 hours'
        and (p_flow_id is null or flow_id = p_flow_id)
    ),
    'active_flows', (
      select count(*) from public.automation_flows
      where organization_id = p_org_id and status = 'active'
    ),
    'paused_flows', (
      select count(*) from public.automation_flows
      where organization_id = p_org_id and status = 'paused'
    ),
    'hourly', v_hourly
  );
end;
$$;

-- ── 3. RPC: Get integrations overview ───────────────────
create or replace function public.get_integrations_overview(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  return json_build_object(
    'total_integrations', (
      select count(*) from public.integrations
      where organization_id = p_org_id
    ),
    'connected', (
      select count(*) from public.integrations
      where organization_id = p_org_id and status = 'connected'
    ),
    'error_count', (
      select count(*) from public.integrations
      where organization_id = p_org_id and status = 'error'
    ),
    'disconnected', (
      select count(*) from public.integrations
      where organization_id = p_org_id and status = 'disconnected'
    ),
    'last_sync', (
      select max(last_sync) from public.integrations
      where organization_id = p_org_id and status = 'connected'
    )
  );
end;
$$;

-- ── 4. RPC: Toggle flow status (atomic) ─────────────────
create or replace function public.toggle_flow_status(p_flow_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_current text;
  v_new text;
begin
  select status::text into v_current
  from public.automation_flows
  where id = p_flow_id;

  if not found then
    return json_build_object('error', 'Flow not found');
  end if;

  v_new := case when v_current = 'active' then 'paused' else 'active' end;

  update public.automation_flows
  set status = v_new::public.flow_status,
      updated_at = now()
  where id = p_flow_id;

  return json_build_object(
    'success', true,
    'new_status', v_new
  );
end;
$$;

-- ── 5. RPC: Master pause/resume all flows ───────────────
create or replace function public.set_all_flows_status(
  p_org_id uuid,
  p_pause boolean
)
returns json
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  if p_pause then
    update public.automation_flows
    set status = 'paused',
        updated_at = now()
    where organization_id = p_org_id
      and status = 'active';
  else
    update public.automation_flows
    set status = 'active',
        updated_at = now()
    where organization_id = p_org_id
      and status = 'paused';
  end if;

  get diagnostics v_count = row_count;

  return json_build_object(
    'success', true,
    'affected', v_count
  );
end;
$$;

-- ── 6. RPC: Update integration settings ─────────────────
create or replace function public.update_integration_settings(
  p_integration_id uuid,
  p_settings jsonb
)
returns json
language plpgsql
security definer
as $$
begin
  update public.integrations
  set settings = p_settings,
      updated_at = now()
  where id = p_integration_id;

  if not found then
    return json_build_object('error', 'Integration not found');
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 7. RPC: Connect/disconnect integration ──────────────
create or replace function public.toggle_integration_status(
  p_integration_id uuid,
  p_connect boolean,
  p_connection_id text default null
)
returns json
language plpgsql
security definer
as $$
begin
  if p_connect then
    update public.integrations
    set status = 'connected',
        connection_id = coalesce(p_connection_id, connection_id),
        last_sync = now(),
        error_message = null,
        updated_at = now()
    where id = p_integration_id;
  else
    update public.integrations
    set status = 'disconnected',
        connection_id = null,
        error_message = null,
        updated_at = now()
    where id = p_integration_id;
  end if;

  if not found then
    return json_build_object('error', 'Integration not found');
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 8. Enable Realtime ──────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'automation_flows'
  ) then
    alter publication supabase_realtime add table public.automation_flows;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'integrations'
  ) then
    alter publication supabase_realtime add table public.integrations;
  end if;
end $$;

-- ============================================================
-- File: 029_notification_replies.sql
-- ============================================================
-- ============================================================
-- 029: Notification Replies
-- Allows users to reply to inbox notifications.
-- ============================================================

create table if not exists public.notification_replies (
  id            uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now()
);

comment on table public.notification_replies is 'Replies to inbox notifications';

-- Index for fast lookup by notification
create index if not exists idx_notification_replies_notification
  on public.notification_replies (notification_id, created_at desc);

-- RLS
alter table public.notification_replies enable row level security;

-- Users can insert replies for themselves
create policy "Users can reply to own notifications"
  on public.notification_replies for insert
  with check (auth.uid() = user_id);

-- Users can read their own replies
create policy "Users can read own replies"
  on public.notification_replies for select
  using (auth.uid() = user_id);

-- ============================================================
-- File: 030_storage_buckets.sql
-- ============================================================
-- ============================================================
-- 030: Storage Buckets
-- Creates the required storage buckets with RLS policies.
-- ============================================================

-- Create buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('logos', 'logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('job-photos', 'job-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('forms', 'forms', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('assets', 'assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ── Avatars: public read, authenticated upload own ──────────
create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Logos: public read, org members upload ──────────────────
create policy "Anyone can view logos"
  on storage.objects for select
  using (bucket_id = 'logos');

create policy "Org members can upload logos"
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
        and role in ('owner', 'admin', 'manager')
    )
  );

create policy "Org admins can update logos"
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
        and role in ('owner', 'admin', 'manager')
    )
  );

create policy "Org admins can delete logos"
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
        and role in ('owner', 'admin')
    )
  );

-- ── Job Photos: org members read/write ──────────────────────
create policy "Org members can view job photos"
  on storage.objects for select
  using (
    bucket_id = 'job-photos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can upload job photos"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can delete job photos"
  on storage.objects for delete
  using (
    bucket_id = 'job-photos'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

-- ── Forms: org members read/write ───────────────────────────
create policy "Org members can view form files"
  on storage.objects for select
  using (
    bucket_id = 'forms'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can upload form files"
  on storage.objects for insert
  with check (
    bucket_id = 'forms'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can delete form files"
  on storage.objects for delete
  using (
    bucket_id = 'forms'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

-- ── Assets: org members read/write ──────────────────────────
create policy "Org members can view asset files"
  on storage.objects for select
  using (
    bucket_id = 'assets'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can upload asset files"
  on storage.objects for insert
  with check (
    bucket_id = 'assets'
    and auth.uid() is not null
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

create policy "Org members can delete asset files"
  on storage.objects for delete
  using (
    bucket_id = 'assets'
    and exists (
      select 1 from public.organization_members
      where user_id = auth.uid()
        and organization_id = (storage.foldername(name))[1]::uuid
        and status = 'active'
    )
  );

-- ============================================================
-- File: 031_cron_jobs.sql
-- ============================================================
-- ============================================================
-- 031: Cron Job Registration
-- Registers scheduled jobs using pg_cron extension.
-- These call the Next.js API automation endpoint.
-- ============================================================

-- Ensure pg_cron and pg_net are available
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Grant usage to postgres role (required for pg_cron)
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ── Invoice overdue watchdog — runs daily at 8am UTC ────────
select cron.schedule(
  'invoice-overdue-watchdog',
  '0 8 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "invoice-overdue-watchdog"}'::jsonb
  );
  $$
);

-- ── Daily digest emails — runs daily at 7am UTC ────────────
select cron.schedule(
  'daily-digest-emails',
  '0 7 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "daily-digest-emails"}'::jsonb
  );
  $$
);

-- ── Asset service reminders — runs daily at 6am UTC ────────
select cron.schedule(
  'asset-service-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "asset-service-reminders"}'::jsonb
  );
  $$
);

-- ── Subscription sync with Polar — runs every 6 hours ──────
select cron.schedule(
  'sync-polar-subscriptions',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "sync-polar-subscriptions"}'::jsonb
  );
  $$
);

-- ── Automation scheduler — runs every 15 minutes ───────────
select cron.schedule(
  'run-scheduled-automations',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "run-scheduled-automations"}'::jsonb
  );
  $$
);

-- ── Stale job cleanup — runs weekly on Sundays at 3am UTC ──
select cron.schedule(
  'stale-job-cleanup',
  '0 3 * * 0',
  $$
  select net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "stale-job-cleanup"}'::jsonb
  );
  $$
);

-- ── Expired invite cleanup — runs daily at 2am UTC ─────────
select cron.schedule(
  'expired-invite-cleanup',
  '0 2 * * *',
  $$
  delete from public.organization_invites
  where status = 'pending'
    and expires_at < now();
  $$
);

-- ============================================================
-- File: 032_stripe_billing.sql
-- ============================================================
-- ═══════════════════════════════════════════════════════════
-- Migration 032: Stripe Billing Columns
-- ═══════════════════════════════════════════════════════════
-- Adds Stripe identifiers to the organizations and subscriptions
-- tables so the Stripe webhook can map events to workspaces.

-- 1. Add Stripe customer ID to organizations (one customer per workspace)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'starter', 'pro', 'business'));

-- 2. Add Stripe subscription ID to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 3. Index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
  ON public.organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- 4. RLS: allow service_role to update billing columns (webhook)
--    Normal users can only read their own org's plan_tier.
CREATE POLICY IF NOT EXISTS "Users can read own org plan_tier"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================================
-- File: 033_workspace_branding.sql
-- ============================================================
-- ═══════════════════════════════════════════════════════════
-- Migration 033: Workspace Branding
-- ═══════════════════════════════════════════════════════════
-- Adds brand customization columns to organizations for
-- multi-tenant white-labeling (dynamic theme colors + logos).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_color_hex varchar(7) DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS brand_logo_url text;

-- ============================================================
-- File: 034_chat_last_messages_rpc.sql
-- ============================================================
-- ═══════════════════════════════════════════════════════════
-- Migration 034: Chat Last Messages RPC
-- ═══════════════════════════════════════════════════════════
-- Returns the last message content, sender name, and unread count
-- for a batch of channel IDs. Used by the mobile Channels screen
-- to hydrate message previews without N+1 queries.

CREATE OR REPLACE FUNCTION get_last_messages_for_channels(p_channel_ids uuid[])
RETURNS TABLE (
  channel_id uuid,
  content text,
  sender_name text,
  unread_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (m.channel_id)
    m.channel_id,
    m.content,
    p.full_name AS sender_name,
    COALESCE(u.cnt, 0) AS unread_count
  FROM messages m
  LEFT JOIN profiles p ON p.id = m.sender_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt
    FROM messages m2
    JOIN channel_members cm ON cm.channel_id = m2.channel_id
      AND cm.user_id = auth.uid()
    WHERE m2.channel_id = m.channel_id
      AND m2.created_at > COALESCE(cm.last_read_at, '1970-01-01'::timestamptz)
      AND m2.sender_id != auth.uid()
  ) u ON true
  WHERE m.channel_id = ANY(p_channel_ids)
  ORDER BY m.channel_id, m.created_at DESC;
$$;

-- ============================================================
-- File: 035_billing_provider.sql
-- ============================================================
-- ═══════════════════════════════════════════════════════════
-- Migration 035: Multi-Provider Billing Support
-- ═══════════════════════════════════════════════════════════
-- Adds billing_provider tracking so the system knows whether
-- a workspace pays via Stripe (web), Apple IAP, or Google IAP.
-- RevenueCat webhooks populate these fields alongside Stripe.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'free'
    CHECK (billing_provider IN ('free', 'stripe', 'apple', 'google')),
  ADD COLUMN IF NOT EXISTS rc_original_app_user_id text,
  ADD COLUMN IF NOT EXISTS subscription_active_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_organizations_rc_user
  ON public.organizations (rc_original_app_user_id)
  WHERE rc_original_app_user_id IS NOT NULL;

-- ============================================================
-- File: 036_rbac_enforcement.sql
-- ============================================================
-- ═══════════════════════════════════════════════════════════
-- Migration 036: Role-Granular RLS Enforcement
-- Project Cerberus — The Iron Matrix
-- ═══════════════════════════════════════════════════════════

-- Helper: extract role from organization_members for current user
CREATE OR REPLACE FUNCTION get_user_org_role(p_org_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND status = 'active'
  LIMIT 1;
$$;

-- ── Jobs: Technicians see only assigned, Admins/Dispatchers see all ──

DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
CREATE POLICY "jobs_select_policy" ON public.jobs
FOR SELECT USING (
  CASE get_user_org_role(organization_id)
    WHEN 'owner'       THEN true
    WHEN 'admin'        THEN true
    WHEN 'manager'      THEN true
    WHEN 'office_admin'  THEN true
    WHEN 'senior_tech'   THEN true
    WHEN 'technician'    THEN assigned_tech_id = auth.uid()
    WHEN 'apprentice'    THEN assigned_tech_id = auth.uid()
    WHEN 'subcontractor' THEN assigned_tech_id = auth.uid()
    ELSE false
  END
);

DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;
CREATE POLICY "jobs_insert_policy" ON public.jobs
FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin', 'senior_tech')
);

DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
CREATE POLICY "jobs_update_policy" ON public.jobs
FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin', 'senior_tech')
  OR assigned_tech_id = auth.uid()
);

DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;
CREATE POLICY "jobs_delete_policy" ON public.jobs
FOR DELETE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager')
);

-- ── Clients: Techs read-only, No subcontractor access ──

DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
FOR SELECT USING (
  get_user_org_role(organization_id) IN (
    'owner', 'admin', 'manager', 'office_admin', 'senior_tech', 'technician'
  )
);

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
FOR DELETE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager')
);

-- ── Finance: Strictly Admins and Owners ──

DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
CREATE POLICY "invoices_select_policy" ON public.invoices
FOR SELECT USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
CREATE POLICY "invoices_insert_policy" ON public.invoices
FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
CREATE POLICY "invoices_update_policy" ON public.invoices
FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
CREATE POLICY "invoices_delete_policy" ON public.invoices
FOR DELETE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin')
);

-- ── Organization Members: Prevent self-role-change, protect owners ──

DROP POLICY IF EXISTS "members_update_no_self_escalation" ON public.organization_members;
CREATE POLICY "members_update_no_self_escalation" ON public.organization_members
FOR UPDATE USING (
  user_id != auth.uid()
  AND get_user_org_role(organization_id) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "members_delete_protected" ON public.organization_members;
CREATE POLICY "members_delete_protected" ON public.organization_members
FOR DELETE USING (
  user_id != auth.uid()
  AND get_user_org_role(organization_id) IN ('owner', 'admin')
  AND role != 'owner'
);

-- ── Prevent orphaned workspace (trigger) ──

CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  owner_count int;
BEGIN
  IF OLD.role = 'owner' THEN
    SELECT count(*) INTO owner_count
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'owner'
      AND status = 'active'
      AND user_id != OLD.user_id;

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the final owner. Transfer ownership first.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner ON public.organization_members;
CREATE TRIGGER trg_prevent_last_owner
  BEFORE DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();

-- ── Validate Invite RPC (public-facing, no auth needed for lookup) ──

CREATE OR REPLACE FUNCTION validate_invite_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_invite record;
BEGIN
  SELECT i.*, o.name AS org_name, o.slug AS org_slug,
         p.full_name AS inviter_name
  INTO v_invite
  FROM organization_invites i
  JOIN organizations o ON o.id = i.organization_id
  LEFT JOIN profiles p ON p.id = i.invited_by
  WHERE i.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has already been used');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'role', v_invite.role,
    'organization_name', v_invite.org_name,
    'organization_slug', v_invite.org_slug,
    'inviter_name', v_invite.inviter_name,
    'expires_at', v_invite.expires_at
  );
END;
$$;

-- ============================================================
-- File: 037_stripe_connect.sql
-- ============================================================
-- ═══════════════════════════════════════════════════════════
-- Migration 037: Stripe Connect — iWorkr Pay Infrastructure
-- Project Treasury — The Engine of Commerce
-- ═══════════════════════════════════════════════════════════

-- ── Stripe Connect fields on organizations ───────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_account_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS connect_onboarded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_account
  ON public.organizations (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- ── Platform fee configuration ───────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) NOT NULL DEFAULT 1.00;

-- ── Payment records table ────────────────────────────────
-- Tracks all payments collected via iWorkr Pay (web invoices + Tap-to-Pay)

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  platform_fee_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  payment_method text NOT NULL DEFAULT 'card'
    CHECK (payment_method IN ('card', 'tap_to_pay', 'bank_transfer', 'link')),
  client_name text,
  client_email text,
  collected_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments
FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
      AND role IN ('owner', 'admin', 'manager', 'office_admin')
  )
);

CREATE POLICY "payments_insert" ON public.payments
FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE INDEX idx_payments_org ON public.payments (organization_id, created_at DESC);
CREATE INDEX idx_payments_invoice ON public.payments (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX idx_payments_stripe_pi ON public.payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ── Connection tokens table (for Stripe Terminal) ────────

CREATE TABLE IF NOT EXISTS public.terminal_connection_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.terminal_connection_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terminal_tokens_select" ON public.terminal_connection_tokens
FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- ============================================================
-- File: 038_hermes_email_engine.sql
-- ============================================================
-- ═══════════════════════════════════════════════════════════
-- Migration 038: Project Hermes — Dynamic Workspace Email Engine
--
-- Introduces a multi-tenant, queue-driven email system:
--   • mail_queue       – outbound email job queue (drained by cron)
--   • email_logs       – delivery audit trail per organization
--   • workspace_email_templates – per-org customizable templates
--   • sweep_upcoming_jobs()    – pg_cron function that scans jobs
--                                 and enqueues reminder emails
--
-- Dependencies: 001 (pg_cron/pg_net), 002 (enums),
--               007 (RLS helpers), 011 (jobs), 031 (cron)
-- ═══════════════════════════════════════════════════════════

-- ── 1. ENUMs ─────────────────────────────────────────────

CREATE TYPE public.email_status AS ENUM (
  'queued', 'sent', 'delivered', 'bounced', 'complained', 'failed'
);

CREATE TYPE public.mail_queue_status AS ENUM (
  'pending', 'processing', 'failed', 'failed_fatal'
);

-- ── 2. mail_queue ────────────────────────────────────────

CREATE TABLE public.mail_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      varchar(100) NOT NULL,
  recipient_email varchar(255) NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  status          public.mail_queue_status DEFAULT 'pending',
  retry_count     int DEFAULT 0,
  error_message   text,
  created_at      timestamptz DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX idx_mail_queue_drain ON public.mail_queue (status, created_at);
CREATE INDEX idx_mail_queue_org   ON public.mail_queue (organization_id);

-- ── 3. email_logs ────────────────────────────────────────

CREATE TABLE public.email_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      varchar(100) NOT NULL,
  recipient_email varchar(255) NOT NULL,
  subject         text,
  resend_id       varchar(255),
  job_id          uuid REFERENCES public.jobs ON DELETE SET NULL,
  status          public.email_status DEFAULT 'sent',
  metadata        jsonb DEFAULT '{}',
  sent_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_email_logs_org_event ON public.email_logs (organization_id, event_type);
CREATE INDEX idx_email_logs_resend    ON public.email_logs (resend_id);
CREATE INDEX idx_email_logs_job       ON public.email_logs (job_id);

-- ── 4. workspace_email_templates ─────────────────────────

CREATE TABLE public.workspace_email_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      varchar(100) NOT NULL,
  subject_line    text NOT NULL,
  body_html       text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  CONSTRAINT uq_org_event_type UNIQUE (organization_id, event_type)
);

CREATE TRIGGER set_workspace_email_templates_updated_at
  BEFORE UPDATE ON public.workspace_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 5. Profiles: bounce flag ─────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_bounced boolean DEFAULT false;

-- ── 6. Sweep function — enqueue job reminders ────────────

CREATE OR REPLACE FUNCTION public.sweep_upcoming_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _now      timestamptz := now();
  _tomorrow date := (now() AT TIME ZONE 'UTC')::date + 1;
  _today    date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  -- 24-hour reminders: jobs due tomorrow that haven't been reminded yet
  INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
  SELECT
    j.organization_id,
    'job_reminder_24h',
    p.email,
    jsonb_build_object(
      'job_id',          j.id,
      'job_title',       j.title,
      'job_location',    j.location,
      'due_date',        j.due_date,
      'tech_name',       p.full_name,
      'organization_id', j.organization_id
    )
  FROM public.jobs j
  JOIN public.profiles p ON j.assignee_id = p.id
  WHERE j.due_date = _tomorrow
    AND j.status IN ('todo', 'scheduled')
    AND j.deleted_at IS NULL
    AND p.email_bounced IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.job_id = j.id
        AND el.event_type = 'job_reminder_24h'
    );

  -- Day-of reminders: jobs due today that haven't had a same-day reminder
  INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
  SELECT
    j.organization_id,
    'job_reminder_1h',
    p.email,
    jsonb_build_object(
      'job_id',          j.id,
      'job_title',       j.title,
      'job_location',    j.location,
      'due_date',        j.due_date,
      'tech_name',       p.full_name,
      'organization_id', j.organization_id
    )
  FROM public.jobs j
  JOIN public.profiles p ON j.assignee_id = p.id
  WHERE j.due_date = _today
    AND j.status IN ('todo', 'scheduled')
    AND j.deleted_at IS NULL
    AND p.email_bounced IS NOT TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.job_id = j.id
        AND el.event_type = 'job_reminder_1h'
    );
END;
$$;

-- ── 7. Cron: job-reminder sweep (every 15 min) ──────────

SELECT cron.schedule(
  'hermes-job-reminder-sweep',
  '*/15 * * * *',
  'SELECT public.sweep_upcoming_jobs()'
);

-- ── 8. Cron: mail-queue drainer (every 2 min) ───────────

SELECT cron.schedule(
  'hermes-process-mail-queue',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.app_url', true) || '/api/automation/cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"job": "process-mail-queue"}'::jsonb
  );
  $$
);

-- ── 9. Row Level Security ────────────────────────────────

ALTER TABLE public.mail_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_email_templates ENABLE ROW LEVEL SECURITY;

-- mail_queue: org members can read (queue is system-managed)
CREATE POLICY "org_member_read" ON public.mail_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = mail_queue.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- email_logs: org members can read
CREATE POLICY "org_member_read" ON public.email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = email_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- workspace_email_templates: admins/owners full CRUD
CREATE POLICY "org_admin_select" ON public.workspace_email_templates
  FOR SELECT USING (
    public.user_has_role(organization_id, 'admin')
  );

CREATE POLICY "org_admin_insert" ON public.workspace_email_templates
  FOR INSERT WITH CHECK (
    public.user_has_role(organization_id, 'admin')
  );

CREATE POLICY "org_admin_update" ON public.workspace_email_templates
  FOR UPDATE USING (
    public.user_has_role(organization_id, 'admin')
  ) WITH CHECK (
    public.user_has_role(organization_id, 'admin')
  );

CREATE POLICY "org_admin_delete" ON public.workspace_email_templates
  FOR DELETE USING (
    public.user_has_role(organization_id, 'admin')
  );

-- ── 10. Event-driven triggers ──────────────────────────────

-- Trigger: job_assigned — fires when assignee_id changes from NULL to a user
CREATE OR REPLACE FUNCTION public.notify_job_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tech_email text;
  _tech_name  text;
  _client_name text;
  _org_name   text;
BEGIN
  -- Only fire when assignee changes to a non-null value
  IF NEW.assignee_id IS NOT NULL AND (OLD.assignee_id IS NULL OR OLD.assignee_id != NEW.assignee_id) THEN
    SELECT email, full_name INTO _tech_email, _tech_name
    FROM public.profiles WHERE id = NEW.assignee_id;

    SELECT name INTO _client_name FROM public.clients WHERE id = NEW.client_id;
    SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

    IF _tech_email IS NOT NULL THEN
      INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
      VALUES (
        NEW.organization_id,
        'job_assigned',
        _tech_email,
        jsonb_build_object(
          'job_id', NEW.id,
          'job', jsonb_build_object('title', NEW.title, 'date', NEW.due_date, 'location', NEW.location),
          'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Technician')),
          'client', jsonb_build_object('name', COALESCE(_client_name, 'Client'), 'address', COALESCE(NEW.location, '')),
          'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_assigned
  AFTER UPDATE OF assignee_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_assigned();

-- Trigger: job_cancelled — fires when status changes to 'cancelled'
CREATE OR REPLACE FUNCTION public.notify_job_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tech_email text;
  _tech_name  text;
  _org_name   text;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' AND NEW.assignee_id IS NOT NULL THEN
    SELECT email, full_name INTO _tech_email, _tech_name
    FROM public.profiles WHERE id = NEW.assignee_id;
    SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

    IF _tech_email IS NOT NULL THEN
      INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
      VALUES (
        NEW.organization_id,
        'job_cancelled',
        _tech_email,
        jsonb_build_object(
          'job_id', NEW.id,
          'job', jsonb_build_object('title', NEW.title, 'date', NEW.due_date, 'location', NEW.location),
          'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Technician')),
          'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_cancelled
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_cancelled();

-- Trigger: job_rescheduled — fires when due_date changes and there's an assignee
CREATE OR REPLACE FUNCTION public.notify_job_rescheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tech_email text;
  _tech_name  text;
  _org_name   text;
BEGIN
  IF NEW.due_date IS DISTINCT FROM OLD.due_date AND NEW.assignee_id IS NOT NULL THEN
    SELECT email, full_name INTO _tech_email, _tech_name
    FROM public.profiles WHERE id = NEW.assignee_id;
    SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

    IF _tech_email IS NOT NULL THEN
      INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
      VALUES (
        NEW.organization_id,
        'job_rescheduled',
        _tech_email,
        jsonb_build_object(
          'job_id', NEW.id,
          'job', jsonb_build_object('title', NEW.title, 'date', NEW.due_date, 'location', NEW.location),
          'old_date', OLD.due_date,
          'new_date', NEW.due_date,
          'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Technician')),
          'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_rescheduled
  AFTER UPDATE OF due_date ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_job_rescheduled();

-- Trigger: compliance_warning_swms — fires when job moves to in_progress without SWMS
CREATE OR REPLACE FUNCTION public.notify_compliance_swms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _admin record;
  _org_name text;
  _tech_name text;
  _swms_present boolean;
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
    -- Check if SWMS exists in metadata
    _swms_present := (NEW.metadata->>'swms_signed')::boolean IS TRUE;

    IF NOT _swms_present THEN
      SELECT full_name INTO _tech_name FROM public.profiles WHERE id = NEW.assignee_id;
      SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

      FOR _admin IN
        SELECT p.email, p.full_name
        FROM public.organization_members om
        JOIN public.profiles p ON om.user_id = p.id
        WHERE om.organization_id = NEW.organization_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'manager')
          AND p.email_bounced IS NOT TRUE
      LOOP
        INSERT INTO public.mail_queue (organization_id, event_type, recipient_email, payload)
        VALUES (
          NEW.organization_id,
          'compliance_warning_swms',
          _admin.email,
          jsonb_build_object(
            'job_id', NEW.id,
            'job', jsonb_build_object('id', NEW.display_id, 'title', NEW.title),
            'tech', jsonb_build_object('name', COALESCE(_tech_name, 'Unknown')),
            'workspace', jsonb_build_object('name', COALESCE(_org_name, 'Workspace'))
          )
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_compliance_swms
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_compliance_swms();

-- ============================================================
-- File: 039_grandmaster_pipelines.sql
-- ============================================================
-- ============================================================================
-- Migration 039: Project Grandmaster — Operational Pipelines
-- ============================================================================
-- Wires the full lifecycle across iWorkr's operational surface:
--   Quote → Job → Schedule → Invoice → Archive
--
-- Sections:
--   1. Expand job_status enum (en_route, on_site, completed, archived)
--   2. Expand schedule_block_status enum (on_site)
--   3. Create quote_status enum & convert quotes.status from TEXT
--   4. CRM pipeline columns on clients
--   5. Job state-transition enforcement trigger
--   6. Quote-to-Job auto-conversion (accepted → job + draft invoice)
--   7. Nightly job archival cron
--   8. Job ↔ schedule_block status sync
--   9. Auto-invoice on job completion
--  10. Realtime for quotes
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Expand job_status enum
-- --------------------------------------------------------------------------
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'en_route'  AFTER 'scheduled';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'on_site'   AFTER 'en_route';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'completed' AFTER 'done';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'archived'  AFTER 'invoiced';

-- --------------------------------------------------------------------------
-- 2. Expand schedule_block_status enum
-- --------------------------------------------------------------------------
ALTER TYPE public.schedule_block_status ADD VALUE IF NOT EXISTS 'on_site' AFTER 'en_route';

-- --------------------------------------------------------------------------
-- 3. Create quote_status enum & convert quotes.status
-- --------------------------------------------------------------------------
CREATE TYPE public.quote_status AS ENUM (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
);

ALTER TABLE public.quotes
  ALTER COLUMN status TYPE public.quote_status
  USING status::public.quote_status;

ALTER TABLE public.quotes ALTER COLUMN status SET DEFAULT 'draft';

-- --------------------------------------------------------------------------
-- 4. CRM pipeline columns on clients
-- --------------------------------------------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pipeline_status    text         DEFAULT 'new_lead';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS pipeline_updated_at timestamptz;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lead_source        text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS estimated_value    numeric(12,2) DEFAULT 0;

-- --------------------------------------------------------------------------
-- 5. Job state-transition enforcement
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_job_transition()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  _valid boolean := false;
  _old   text := OLD.status::text;
  _new   text := NEW.status::text;
BEGIN
  IF _old = _new THEN RETURN NEW; END IF;

  IF _new = 'cancelled' AND _old NOT IN ('completed', 'invoiced', 'archived') THEN
    RETURN NEW;
  END IF;

  CASE _old
    WHEN 'backlog'     THEN _valid := _new IN ('todo', 'scheduled', 'cancelled');
    WHEN 'todo'        THEN _valid := _new IN ('scheduled', 'backlog', 'cancelled');
    WHEN 'scheduled'   THEN _valid := _new IN ('en_route', 'in_progress', 'cancelled');
    WHEN 'en_route'    THEN _valid := _new IN ('on_site', 'in_progress', 'scheduled', 'cancelled');
    WHEN 'on_site'     THEN _valid := _new IN ('in_progress', 'cancelled');
    WHEN 'in_progress' THEN _valid := _new IN ('done', 'completed', 'cancelled');
    WHEN 'done'        THEN _valid := _new IN ('invoiced', 'completed', 'archived');
    WHEN 'completed'   THEN _valid := _new IN ('invoiced', 'archived');
    WHEN 'invoiced'    THEN _valid := _new IN ('archived');
    WHEN 'archived'    THEN _valid := false;
    WHEN 'cancelled'   THEN _valid := _new IN ('backlog', 'todo');
    ELSE _valid := false;
  END CASE;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid job transition: % -> %', _old, _new;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_job_transition
  BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_transition();

-- --------------------------------------------------------------------------
-- 6. Quote-to-Job auto-conversion
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _job_id              uuid;
  _invoice_id          uuid;
  _job_display_id      text;
  _invoice_display_id  text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    IF NEW.job_id IS NOT NULL THEN RETURN NEW; END IF;

    SELECT 'JOB-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'JOB-', ''), '')::int, 0)) + 1)::text, 3, '0')
    INTO _job_display_id
    FROM public.jobs WHERE organization_id = NEW.organization_id;

    SELECT 'INV-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'INV-', ''), '')::int, 0)) + 1)::text, 4, '0')
    INTO _invoice_display_id
    FROM public.invoices WHERE organization_id = NEW.organization_id;

    INSERT INTO public.jobs (
      organization_id, display_id, title, description, status,
      client_id, location, revenue, created_by
    ) VALUES (
      NEW.organization_id,
      _job_display_id,
      COALESCE(NEW.title, 'Job from Quote ' || NEW.display_id),
      'Auto-generated from accepted quote ' || NEW.display_id,
      'backlog',
      NEW.client_id,
      NEW.client_address,
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _job_id;

    INSERT INTO public.invoices (
      organization_id, display_id, client_id, job_id, quote_id,
      client_name, client_email, client_address,
      status, issue_date, due_date,
      subtotal, tax_rate, tax, total,
      created_by
    ) VALUES (
      NEW.organization_id,
      _invoice_display_id,
      NEW.client_id,
      _job_id,
      NEW.id,
      NEW.client_name,
      NEW.client_email,
      NEW.client_address,
      'draft',
      CURRENT_DATE,
      CURRENT_DATE + 14,
      COALESCE(NEW.subtotal, 0),
      COALESCE(NEW.tax_rate, 10),
      COALESCE(NEW.tax, 0),
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _invoice_id;

    INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, sort_order)
    SELECT _invoice_id, description, quantity, unit_price, sort_order
    FROM public.quote_line_items
    WHERE quote_id = NEW.id;

    NEW.job_id     := _job_id;
    NEW.invoice_id := _invoice_id;

    UPDATE public.clients
    SET pipeline_status = 'won', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.clients
    SET pipeline_status = 'lost', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_convert_accepted_quote
  BEFORE UPDATE OF status ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.convert_accepted_quote();

-- --------------------------------------------------------------------------
-- 7. Nightly job archival
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.archive_completed_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  UPDATE public.jobs j
  SET status = 'archived', updated_at = now()
  WHERE j.status IN ('done', 'completed', 'invoiced')
    AND j.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.job_id = j.id AND i.status = 'paid'
    )
    AND j.updated_at < now() - INTERVAL '48 hours';
END;
$$;

SELECT cron.schedule(
  'grandmaster-job-archival',
  '0 2 * * *',
  'SELECT public.archive_completed_jobs()'
);

-- --------------------------------------------------------------------------
-- 8. Sync job status → schedule_block status
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_job_to_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _block_status public.schedule_block_status;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  CASE NEW.status::text
    WHEN 'en_route'    THEN _block_status := 'en_route';
    WHEN 'on_site'     THEN _block_status := 'on_site';
    WHEN 'in_progress' THEN _block_status := 'in_progress';
    WHEN 'done', 'completed', 'invoiced', 'archived'
                       THEN _block_status := 'complete';
    WHEN 'cancelled'   THEN _block_status := 'cancelled';
    ELSE RETURN NEW;
  END CASE;

  UPDATE public.schedule_blocks
  SET status = _block_status, updated_at = now()
  WHERE job_id = NEW.id
    AND status != 'complete'
    AND status != 'cancelled';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_job_to_schedule
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_job_to_schedule();

-- --------------------------------------------------------------------------
-- 9. Auto-invoice on job completion (when no invoice exists)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_invoice_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _has_invoice         boolean;
  _invoice_display_id  text;
BEGIN
  IF NEW.status IN ('done', 'completed')
     AND OLD.status NOT IN ('done', 'completed', 'invoiced', 'archived') THEN

    SELECT EXISTS(
      SELECT 1 FROM public.invoices WHERE job_id = NEW.id AND deleted_at IS NULL
    ) INTO _has_invoice;

    IF NOT _has_invoice AND NEW.revenue > 0 THEN
      SELECT 'INV-' || LPAD(
        (COALESCE(MAX(NULLIF(REPLACE(display_id, 'INV-', ''), '')::int, 0)) + 1)::text, 4, '0')
      INTO _invoice_display_id
      FROM public.invoices WHERE organization_id = NEW.organization_id;

      INSERT INTO public.invoices (
        organization_id, display_id, client_id, job_id,
        client_name, status, issue_date, due_date,
        subtotal, tax_rate, tax, total
      )
      SELECT
        NEW.organization_id, _invoice_display_id, NEW.client_id, NEW.id,
        c.name, 'draft', CURRENT_DATE, CURRENT_DATE + 14,
        NEW.revenue, 10, NEW.revenue * 0.1, NEW.revenue * 1.1
      FROM public.clients c WHERE c.id = NEW.client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_invoice_on_completion
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.auto_invoice_on_completion();

-- --------------------------------------------------------------------------
-- 10. Enable realtime on quotes
-- --------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;

-- ============================================================
-- File: 040_grandmaster_schedule_dispatch.sql
-- ============================================================
-- ============================================================================
-- Migration 040: Project Grandmaster — Schedule Dispatch Enhancements
-- ============================================================================
-- Adds:
--   1. validate_schedule_drop() RPC — conflict + travel gap analysis
--   2. Job assignment notification trigger (INSERT to notifications)
--   3. Cascading delay detection helper
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Schedule drop validation RPC
-- --------------------------------------------------------------------------
-- Called by the web dispatch board before persisting a drag-and-drop action.
-- Returns a JSON object with conflict and travel analysis.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_schedule_drop(
  p_org_id        uuid,
  p_technician_id uuid,
  p_start_time    timestamptz,
  p_end_time      timestamptz,
  p_exclude_block uuid DEFAULT NULL,
  p_location_lat  double precision DEFAULT NULL,
  p_location_lng  double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _date          date := p_start_time::date;
  _conflicts     jsonb := '[]'::jsonb;
  _prev_block    record;
  _travel        jsonb := 'null'::jsonb;
  _gap_minutes   integer;
  _dist_km       double precision;
  _est_minutes   integer;
  _warnings      jsonb := '[]'::jsonb;
BEGIN
  -- 1a. Find overlapping blocks
  SELECT jsonb_agg(jsonb_build_object(
    'block_id', sb.id,
    'title', sb.title,
    'start_time', sb.start_time,
    'end_time', sb.end_time
  ))
  INTO _conflicts
  FROM public.schedule_blocks sb
  WHERE sb.organization_id = p_org_id
    AND sb.technician_id = p_technician_id
    AND sb.start_time::date = _date
    AND sb.status != 'cancelled'
    AND (p_exclude_block IS NULL OR sb.id != p_exclude_block)
    AND sb.start_time < p_end_time
    AND sb.end_time > p_start_time;

  IF _conflicts IS NULL THEN _conflicts := '[]'::jsonb; END IF;

  -- 1b. Find the immediately preceding block
  SELECT sb.id, sb.title, sb.end_time, sb.location,
         j.location_lat AS prev_lat, j.location_lng AS prev_lng
  INTO _prev_block
  FROM public.schedule_blocks sb
  LEFT JOIN public.jobs j ON j.id = sb.job_id
  WHERE sb.organization_id = p_org_id
    AND sb.technician_id = p_technician_id
    AND sb.start_time::date = _date
    AND sb.status != 'cancelled'
    AND (p_exclude_block IS NULL OR sb.id != p_exclude_block)
    AND sb.end_time <= p_start_time
  ORDER BY sb.end_time DESC
  LIMIT 1;

  IF _prev_block IS NOT NULL THEN
    _gap_minutes := EXTRACT(EPOCH FROM (p_start_time - _prev_block.end_time)) / 60;
    _est_minutes := NULL;

    -- Haversine distance if both sides have coords
    IF p_location_lat IS NOT NULL AND p_location_lng IS NOT NULL
       AND _prev_block.prev_lat IS NOT NULL AND _prev_block.prev_lng IS NOT NULL THEN
      _dist_km := 6371 * 2 * ASIN(SQRT(
        POWER(SIN(RADIANS(p_location_lat - _prev_block.prev_lat) / 2), 2) +
        COS(RADIANS(_prev_block.prev_lat)) * COS(RADIANS(p_location_lat)) *
        POWER(SIN(RADIANS(p_location_lng - _prev_block.prev_lng) / 2), 2)
      ));
      _est_minutes := CEIL((_dist_km / 40.0) * 60);
    END IF;

    -- Fallback: 15 min if locations differ by text
    IF _est_minutes IS NULL THEN
      _est_minutes := 15;
    END IF;

    _travel := jsonb_build_object(
      'previous_block', jsonb_build_object(
        'id', _prev_block.id,
        'title', _prev_block.title,
        'end_time', _prev_block.end_time
      ),
      'estimated_minutes', _est_minutes,
      'gap_minutes', _gap_minutes,
      'sufficient', (_gap_minutes >= _est_minutes)
    );

    IF _gap_minutes < _est_minutes THEN
      _warnings := _warnings || jsonb_build_array(
        format('Travel Warning: ~%smin drive from "%s" but only %smin gap',
               _est_minutes, _prev_block.title, _gap_minutes)
      );
    END IF;
  END IF;

  IF jsonb_array_length(_conflicts) > 0 THEN
    _warnings := _warnings || jsonb_build_array(
      format('Overlaps with %s existing block(s)', jsonb_array_length(_conflicts))
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', (jsonb_array_length(_conflicts) = 0),
    'conflicts', _conflicts,
    'travel', _travel,
    'warnings', _warnings
  );
END;
$$;

-- --------------------------------------------------------------------------
-- 2. Auto-notification on job assignment
-- --------------------------------------------------------------------------
-- When jobs.assigned_tech_id changes from NULL to a user, insert a notification.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_job_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  IF NEW.assigned_tech_id IS NOT NULL
     AND (OLD.assigned_tech_id IS NULL OR OLD.assigned_tech_id IS DISTINCT FROM NEW.assigned_tech_id) THEN
    INSERT INTO public.notifications (
      organization_id, user_id, type, title, body,
      related_job_id, action_link, action_type
    ) VALUES (
      NEW.organization_id,
      NEW.assigned_tech_id,
      'job_assigned',
      'New Job Assigned',
      format('%s: %s has been added to your schedule.',
             COALESCE(NEW.display_id, 'Job'), COALESCE(NEW.title, 'Untitled')),
      NEW.id,
      '/dashboard/jobs/' || NEW.id,
      'view'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_job_assignment
  AFTER UPDATE OF assigned_tech_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_job_assignment();

-- --------------------------------------------------------------------------
-- 3. Cascading delay detection
-- --------------------------------------------------------------------------
-- Returns blocks for a technician on a given date that are "at risk" due to
-- a preceding block overrunning its scheduled end_time (status still active).
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cascading_delays(
  p_org_id        uuid,
  p_technician_id uuid,
  p_date          date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  block_id          uuid,
  title             text,
  scheduled_start   timestamptz,
  scheduled_end     timestamptz,
  delay_minutes     integer,
  caused_by_block   uuid
)
LANGUAGE sql
STABLE
AS $$
  WITH active_overruns AS (
    SELECT sb.id, sb.title, sb.end_time,
           EXTRACT(EPOCH FROM (now() - sb.end_time)) / 60 AS overrun_minutes
    FROM public.schedule_blocks sb
    WHERE sb.organization_id = p_org_id
      AND sb.technician_id = p_technician_id
      AND sb.start_time::date = p_date
      AND sb.status IN ('in_progress', 'en_route', 'on_site')
      AND sb.end_time < now()
  )
  SELECT
    downstream.id AS block_id,
    downstream.title,
    downstream.start_time AS scheduled_start,
    downstream.end_time AS scheduled_end,
    CEIL(ao.overrun_minutes)::integer AS delay_minutes,
    ao.id AS caused_by_block
  FROM active_overruns ao
  JOIN public.schedule_blocks downstream
    ON downstream.organization_id = p_org_id
   AND downstream.technician_id = p_technician_id
   AND downstream.start_time::date = p_date
   AND downstream.start_time >= ao.end_time
   AND downstream.status = 'scheduled'
  ORDER BY downstream.start_time;
$$;

-- ============================================================
-- File: 041_provision_workspace_rpc.sql
-- ============================================================
-- ============================================================================
-- Migration 041: Workspace Provisioning RPC
-- ============================================================================
-- Atomic workspace creation: org + owner membership + Stripe stub + seed data.
-- Used by both Next.js /signup and Flutter onboarding.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. create_organization_with_owner()
-- --------------------------------------------------------------------------
-- Atomically provisions a new workspace with the calling user as OWNER.
-- Returns the new organization row as JSONB.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name  text,
  org_slug  text,
  org_trade text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _org_id  uuid;
  _org     jsonb;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the organization
  INSERT INTO public.organizations (name, slug, trade, settings)
  VALUES (
    org_name,
    org_slug,
    org_trade,
    jsonb_build_object(
      'industry', COALESCE(org_trade, 'General'),
      'provisioned_at', now()::text
    )
  )
  RETURNING id INTO _org_id;

  -- Create owner membership
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (_org_id, _user_id, 'owner', 'active');

  -- Mark profile onboarding complete
  UPDATE public.profiles
  SET onboarding_completed = true
  WHERE id = _user_id;

  -- Seed industry defaults
  PERFORM public.seed_industry_defaults(_org_id, COALESCE(org_trade, 'General'));

  -- Return the new org
  SELECT to_jsonb(o) INTO _org
  FROM public.organizations o
  WHERE o.id = _org_id;

  RETURN _org;
END;
$$;

-- --------------------------------------------------------------------------
-- 2. seed_industry_defaults()
-- --------------------------------------------------------------------------
-- Injects starter SWMS templates and common job type tags based on trade.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_industry_defaults(
  p_org_id uuid,
  p_trade  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _swms_schema jsonb;
BEGIN
  -- Universal Site Safety SWMS (all trades)
  _swms_schema := jsonb_build_object(
    'sections', jsonb_build_array(
      jsonb_build_object(
        'title', 'Site Assessment',
        'fields', jsonb_build_array(
          jsonb_build_object('id', 'hazards', 'label', 'Identify site hazards', 'type', 'text', 'required', true),
          jsonb_build_object('id', 'ppe', 'label', 'PPE worn', 'type', 'checkbox_group', 'required', true,
            'options', jsonb_build_array('Hard Hat', 'Safety Glasses', 'Steel Caps', 'Hi-Vis', 'Gloves', 'Ear Protection')),
          jsonb_build_object('id', 'safe_to_proceed', 'label', 'Is it safe to proceed?', 'type', 'boolean', 'required', true)
        )
      )
    )
  );

  INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
  VALUES (p_org_id, 'Site Safety Assessment', 'Universal pre-job safety checklist', 'pre_job', _swms_schema, true, true);

  -- Trade-specific SWMS
  IF p_trade = 'HVAC' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Refrigerant Handling SWMS', 'Safe handling of refrigerant gases', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Refrigerant Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'gas_type', 'label', 'Refrigerant type', 'type', 'select', 'required', true,
            'options', jsonb_build_array('R410A', 'R32', 'R134a', 'R22', 'Other')),
          jsonb_build_object('id', 'leak_test', 'label', 'Leak detector available?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'recovery_unit', 'label', 'Recovery unit on truck?', 'type', 'boolean', 'required', true)
        ))
      )), true, true),
    (p_org_id, 'Working at Heights SWMS', 'Roof unit access protocol', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Height Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'access_method', 'label', 'Access method', 'type', 'select', 'required', true,
            'options', jsonb_build_array('Ladder', 'Scaffolding', 'EWP', 'Fixed Access')),
          jsonb_build_object('id', 'harness_check', 'label', 'Harness inspected?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'fall_zone', 'label', 'Fall zone clear?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Electrical' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Electrical Isolation SWMS', 'Lock-out/tag-out procedure', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Isolation Protocol', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'isolation_point', 'label', 'Isolation point identified?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'lockout_applied', 'label', 'Lock-out/tag-out applied?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'voltage_test', 'label', 'Dead test performed?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'voltage_reading', 'label', 'Voltage reading (V)', 'type', 'number', 'required', true)
        ))
      )), true, true),
    (p_org_id, 'Asbestos Awareness SWMS', 'Pre-1990 building check', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Asbestos Check', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'building_age', 'label', 'Building constructed before 1990?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'register_checked', 'label', 'Asbestos register reviewed?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'safe_to_proceed', 'label', 'Safe to proceed without specialist?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Plumbing' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Confined Space Entry SWMS', 'Sewer and tank access protocol', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Confined Space', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'gas_monitor', 'label', 'Gas monitor reading clear?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'ventilation', 'label', 'Ventilation adequate?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'spotter', 'label', 'Spotter present?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'rescue_plan', 'label', 'Rescue plan briefed?', 'type', 'boolean', 'required', true)
        ))
      )), true, true),
    (p_org_id, 'Hot Water System SWMS', 'Tempering valve and scalding prevention', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Hot Water Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'isolation_valve', 'label', 'Water supply isolated?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'temp_reading', 'label', 'Outlet temperature (°C)', 'type', 'number', 'required', true),
          jsonb_build_object('id', 'tmv_compliant', 'label', 'TMV/tempering valve compliant?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Fire' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'Fire Panel Inspection SWMS', 'Fire indicator panel service procedure', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Panel Inspection', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'panel_isolated', 'label', 'Fire panel in test mode?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'monitoring_notified', 'label', 'Monitoring company notified?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'brigade_notified', 'label', 'Fire brigade notified (if required)?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);

  ELSIF p_trade = 'Security' THEN
    INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
    VALUES (p_org_id, 'CCTV Installation SWMS', 'Camera installation safety', 'pre_job',
      jsonb_build_object('sections', jsonb_build_array(
        jsonb_build_object('title', 'Installation Safety', 'fields', jsonb_build_array(
          jsonb_build_object('id', 'cable_route', 'label', 'Cable route surveyed?', 'type', 'boolean', 'required', true),
          jsonb_build_object('id', 'power_source', 'label', 'PoE or separate power confirmed?', 'type', 'select', 'required', true,
            'options', jsonb_build_array('PoE', 'Separate 12V', 'Separate 24V')),
          jsonb_build_object('id', 'network_access', 'label', 'Network access confirmed?', 'type', 'boolean', 'required', true)
        ))
      )), true, true);
  END IF;

  -- Post-job quality checklist (universal)
  INSERT INTO public.form_templates (organization_id, title, description, stage, schema, requires_signature, is_active)
  VALUES (p_org_id, 'Job Completion Quality Check', 'Post-job quality and cleanup verification', 'post_job',
    jsonb_build_object('sections', jsonb_build_array(
      jsonb_build_object('title', 'Completion Check', 'fields', jsonb_build_array(
        jsonb_build_object('id', 'work_tested', 'label', 'Work tested and operational?', 'type', 'boolean', 'required', true),
        jsonb_build_object('id', 'site_clean', 'label', 'Site left clean?', 'type', 'boolean', 'required', true),
        jsonb_build_object('id', 'client_briefed', 'label', 'Client briefed on work completed?', 'type', 'boolean', 'required', true),
        jsonb_build_object('id', 'notes', 'label', 'Additional notes', 'type', 'text', 'required', false)
      ))
    )), false, true);
END;
$$;

-- ============================================================
-- File: 042_pipeline_events_log.sql
-- ============================================================
-- ============================================================================
-- Migration 042: Pipeline Events Log
-- ============================================================================
-- Tracks webhook/automation executions for idempotency and audit.
-- Prevents duplicate processing when webhooks retry on timeout.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type       text NOT NULL,
  entity_type      text NOT NULL,
  entity_id        uuid NOT NULL,
  idempotency_key  text NOT NULL,
  status           text NOT NULL DEFAULT 'completed',
  payload          jsonb DEFAULT '{}',
  error            text,
  created_at       timestamptz DEFAULT now(),

  CONSTRAINT uq_pipeline_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_pipeline_events_org ON public.pipeline_events (organization_id);
CREATE INDEX idx_pipeline_events_entity ON public.pipeline_events (entity_type, entity_id);
CREATE INDEX idx_pipeline_events_type ON public.pipeline_events (event_type);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view pipeline events"
  ON public.pipeline_events FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- Enhance convert_accepted_quote with event logging
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _job_id              uuid;
  _invoice_id          uuid;
  _job_display_id      text;
  _invoice_display_id  text;
  _idem_key            text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    -- Idempotency guard: skip if already converted
    IF NEW.job_id IS NOT NULL THEN RETURN NEW; END IF;

    -- Double-check via pipeline_events log
    _idem_key := 'quote_accept_' || NEW.id::text;
    IF EXISTS (SELECT 1 FROM public.pipeline_events WHERE idempotency_key = _idem_key) THEN
      RETURN NEW;
    END IF;

    SELECT 'JOB-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'JOB-', ''), '')::int, 0)) + 1)::text, 3, '0')
    INTO _job_display_id
    FROM public.jobs WHERE organization_id = NEW.organization_id;

    SELECT 'INV-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'INV-', ''), '')::int, 0)) + 1)::text, 4, '0')
    INTO _invoice_display_id
    FROM public.invoices WHERE organization_id = NEW.organization_id;

    INSERT INTO public.jobs (
      organization_id, display_id, title, description, status,
      client_id, location, revenue, created_by
    ) VALUES (
      NEW.organization_id,
      _job_display_id,
      COALESCE(NEW.title, 'Job from Quote ' || NEW.display_id),
      'Auto-generated from accepted quote ' || NEW.display_id,
      'backlog',
      NEW.client_id,
      NEW.client_address,
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _job_id;

    INSERT INTO public.invoices (
      organization_id, display_id, client_id, job_id, quote_id,
      client_name, client_email, client_address,
      status, issue_date, due_date,
      subtotal, tax_rate, tax, total,
      created_by
    ) VALUES (
      NEW.organization_id,
      _invoice_display_id,
      NEW.client_id,
      _job_id,
      NEW.id,
      NEW.client_name,
      NEW.client_email,
      NEW.client_address,
      'draft',
      CURRENT_DATE,
      CURRENT_DATE + 14,
      COALESCE(NEW.subtotal, 0),
      COALESCE(NEW.tax_rate, 10),
      COALESCE(NEW.tax, 0),
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _invoice_id;

    INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, sort_order)
    SELECT _invoice_id, description, quantity, unit_price, sort_order
    FROM public.quote_line_items
    WHERE quote_id = NEW.id;

    NEW.job_id     := _job_id;
    NEW.invoice_id := _invoice_id;

    -- Log the event for idempotency tracking
    INSERT INTO public.pipeline_events (organization_id, event_type, entity_type, entity_id, idempotency_key, payload)
    VALUES (
      NEW.organization_id,
      'quote_accepted_conversion',
      'quote',
      NEW.id,
      _idem_key,
      jsonb_build_object('job_id', _job_id, 'invoice_id', _invoice_id, 'quote_display_id', NEW.display_id)
    );

    UPDATE public.clients
    SET pipeline_status = 'won', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.clients
    SET pipeline_status = 'lost', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- File: 042_pipeline_resilience.sql
-- ============================================================
-- ============================================================================
-- Migration 042: Pipeline Resilience Infrastructure
-- ============================================================================
-- Adds:
--   1. pipeline_events table — audit log for all pipeline automations
--   2. mark_invoice_sent_with_link() RPC — sends invoice via link when POS fails
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. pipeline_events — system-level pipeline automation tracking
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  event_type      text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,
  source          text NOT NULL DEFAULT 'trigger',
  idempotency_key text,
  payload         jsonb DEFAULT '{}',
  status          text NOT NULL DEFAULT 'completed',
  error           text,
  created_at      timestamptz DEFAULT now(),
  
  CONSTRAINT uq_pipeline_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_pipeline_events_org ON public.pipeline_events (organization_id, event_type);
CREATE INDEX idx_pipeline_events_entity ON public.pipeline_events (entity_type, entity_id);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read pipeline events"
  ON public.pipeline_events FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- 2. Log pipeline events from convert_accepted_quote trigger
-- --------------------------------------------------------------------------
-- Replace the existing trigger function to add event logging
CREATE OR REPLACE FUNCTION public.convert_accepted_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _job_id              uuid;
  _invoice_id          uuid;
  _job_display_id      text;
  _invoice_display_id  text;
  _idemp_key           text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    -- Idempotency: skip if job already linked
    IF NEW.job_id IS NOT NULL THEN RETURN NEW; END IF;

    -- Idempotency: check pipeline_events
    _idemp_key := 'quote_accepted:' || NEW.id::text;
    IF EXISTS (SELECT 1 FROM public.pipeline_events WHERE idempotency_key = _idemp_key) THEN
      RETURN NEW;
    END IF;

    SELECT 'JOB-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'JOB-', ''), '')::int, 0)) + 1)::text, 3, '0')
    INTO _job_display_id
    FROM public.jobs WHERE organization_id = NEW.organization_id;

    SELECT 'INV-' || LPAD(
      (COALESCE(MAX(NULLIF(REPLACE(display_id, 'INV-', ''), '')::int, 0)) + 1)::text, 4, '0')
    INTO _invoice_display_id
    FROM public.invoices WHERE organization_id = NEW.organization_id;

    INSERT INTO public.jobs (
      organization_id, display_id, title, description, status,
      client_id, location, revenue, created_by
    ) VALUES (
      NEW.organization_id,
      _job_display_id,
      COALESCE(NEW.title, 'Job from Quote ' || NEW.display_id),
      'Auto-generated from accepted quote ' || NEW.display_id,
      'backlog',
      NEW.client_id,
      NEW.client_address,
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _job_id;

    INSERT INTO public.invoices (
      organization_id, display_id, client_id, job_id, quote_id,
      client_name, client_email, client_address,
      status, issue_date, due_date,
      subtotal, tax_rate, tax, total,
      created_by
    ) VALUES (
      NEW.organization_id,
      _invoice_display_id,
      NEW.client_id,
      _job_id,
      NEW.id,
      NEW.client_name,
      NEW.client_email,
      NEW.client_address,
      'draft',
      CURRENT_DATE,
      CURRENT_DATE + 14,
      COALESCE(NEW.subtotal, 0),
      COALESCE(NEW.tax_rate, 10),
      COALESCE(NEW.tax, 0),
      COALESCE(NEW.total, 0),
      NEW.created_by
    ) RETURNING id INTO _invoice_id;

    INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, sort_order)
    SELECT _invoice_id, description, quantity, unit_price, sort_order
    FROM public.quote_line_items
    WHERE quote_id = NEW.id;

    NEW.job_id     := _job_id;
    NEW.invoice_id := _invoice_id;

    UPDATE public.clients
    SET pipeline_status = 'won', pipeline_updated_at = now()
    WHERE id = NEW.client_id;

    -- Log the pipeline event for audit + idempotency
    INSERT INTO public.pipeline_events (
      organization_id, event_type, entity_type, entity_id,
      source, idempotency_key, payload
    ) VALUES (
      NEW.organization_id,
      'quote_to_job_conversion',
      'quote',
      NEW.id,
      'trigger',
      _idemp_key,
      jsonb_build_object(
        'quote_id', NEW.id,
        'job_id', _job_id,
        'invoice_id', _invoice_id,
        'total', NEW.total
      )
    );
  END IF;

  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.clients
    SET pipeline_status = 'lost', pipeline_updated_at = now()
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- 3. mark_invoice_sent_with_link() — POS failure pivot
-- --------------------------------------------------------------------------
-- When Stripe Terminal payment is declined, the tech can pivot to sending
-- an invoice payment link. This RPC marks the invoice as 'sent' and
-- generates a portal URL.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_invoice_sent_with_link(
  p_invoice_id uuid,
  p_base_url   text DEFAULT 'https://iworkrapp.com'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv      record;
  _link     text;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = p_invoice_id;
  
  IF _inv IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Generate a payment link using invoice ID as the token
  _link := p_base_url || '/pay/' || p_invoice_id::text;

  UPDATE public.invoices
  SET status = CASE
        WHEN status = 'draft' THEN 'sent'::public.invoice_status
        ELSE status
      END,
      payment_link = _link,
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Log the pivot event
  INSERT INTO public.pipeline_events (
    organization_id, event_type, entity_type, entity_id,
    source, payload
  ) VALUES (
    _inv.organization_id,
    'pos_decline_invoice_pivot',
    'invoice',
    p_invoice_id,
    'mobile_app',
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'total', _inv.total,
      'payment_link', _link
    )
  );

  RETURN jsonb_build_object(
    'payment_link', _link,
    'invoice_id', p_invoice_id,
    'status', 'sent'
  );
END;
$$;

-- ============================================================
-- File: 043_push_notification_trigger.sql
-- ============================================================
-- ============================================================================
-- Migration 043: Push Notification FCM Trigger
-- ============================================================================
-- pg_net already enabled in 001_extensions.sql

-- Add FCM token storage to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT true;

-- Fires the send-push Edge Function via pg_net when a notification is inserted
CREATE OR REPLACE FUNCTION public.fire_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
  _base_url text;
  _anon_key text;
BEGIN
  IF NEW.type NOT IN (
    'job_assigned', 'job_cancelled', 'job_rescheduled',
    'message_received', 'invoice_paid', 'schedule_conflict',
    'compliance_warning', 'mention'
  ) THEN
    RETURN NEW;
  END IF;

  _base_url := current_setting('app.settings.supabase_url', true);
  _anon_key := current_setting('app.settings.supabase_anon_key', true);

  IF _base_url IS NOT NULL AND _anon_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := _base_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fire_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.fire_push_notification();
