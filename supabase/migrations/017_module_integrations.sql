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
