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
