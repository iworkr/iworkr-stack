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
