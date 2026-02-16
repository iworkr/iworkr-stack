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
