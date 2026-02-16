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
