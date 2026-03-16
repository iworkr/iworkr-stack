-- ============================================================
-- Migration 106: Project Aegis-Core
-- Dead-letter queue for unresolved/failed webhook processing
-- ============================================================

create table if not exists public.webhook_dead_letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  source text not null check (source in ('xero', 'stripe', 'proda', 'resend', 'unknown')),
  event_type text,
  raw_payload jsonb not null,
  headers jsonb,
  failure_reason text not null,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_webhook_dlq_unresolved
  on public.webhook_dead_letters (created_at desc)
  where is_resolved = false;

create index if not exists idx_webhook_dlq_source_event
  on public.webhook_dead_letters (source, event_type, created_at desc);

drop trigger if exists set_webhook_dead_letters_updated_at on public.webhook_dead_letters;
create trigger set_webhook_dead_letters_updated_at
  before update on public.webhook_dead_letters
  for each row execute function public.update_updated_at();

alter table public.webhook_dead_letters enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'webhook_dead_letters'
      and policyname = 'Service role can manage webhook dead letters'
  ) then
    create policy "Service role can manage webhook dead letters"
      on public.webhook_dead_letters
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end $$;
