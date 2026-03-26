-- ============================================================================
-- @migration EchoTriageSchema
-- @status COMPLETE
-- @description Notification triage schema upgrades with deep-linking fields
-- @lastAudit 2026-03-26
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'echo_notification_type') then
    create type public.echo_notification_type as enum ('SYSTEM', 'JOB', 'FINANCE', 'COMPLIANCE', 'MESSAGE');
  end if;
end $$;

alter table if exists public.notifications
  add column if not exists workspace_id uuid references public.organizations(id) on delete cascade,
  add column if not exists reference_id uuid,
  add column if not exists is_read boolean default false,
  add column if not exists triage_type public.echo_notification_type,
  add column if not exists action_url text;

update public.notifications
set workspace_id = organization_id
where workspace_id is null;

update public.notifications
set reference_id = coalesce(reference_id, related_entity_id, related_job_id, related_client_id)
where reference_id is null;

update public.notifications
set is_read = coalesce(read, false)
where is_read is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'notifications'
      and column_name = 'workspace_id'
      and is_nullable = 'YES'
  ) then
    alter table public.notifications alter column workspace_id set not null;
  end if;
exception
  when others then
    -- Keep migration resilient in environments with legacy null rows.
    null;
end $$;

create index if not exists idx_notifications_workspace_user_created
  on public.notifications (workspace_id, user_id, created_at desc);

create index if not exists idx_notifications_reference
  on public.notifications (reference_id)
  where reference_id is not null;

create index if not exists idx_notifications_action_url
  on public.notifications (action_url)
  where action_url is not null;

create index if not exists idx_notifications_is_read
  on public.notifications (user_id, is_read)
  where is_read = false;

create or replace function public.sync_notifications_read_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.read := coalesce(new.read, new.is_read, false);
    new.is_read := coalesce(new.is_read, new.read, false);
    return new;
  end if;

  if new.read is distinct from old.read then
    new.is_read := new.read;
  elsif new.is_read is distinct from old.is_read then
    new.read := new.is_read;
  else
    new.read := coalesce(new.read, old.read, false);
    new.is_read := coalesce(new.is_read, old.is_read, false);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_notifications_read_columns on public.notifications;
create trigger trg_sync_notifications_read_columns
before insert or update on public.notifications
for each row execute function public.sync_notifications_read_columns();
