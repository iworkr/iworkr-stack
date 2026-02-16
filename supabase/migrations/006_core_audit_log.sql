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
