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
