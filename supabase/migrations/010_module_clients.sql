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
