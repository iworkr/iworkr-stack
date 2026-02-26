-- ============================================================
-- Migration 047: Client Activity Logs (Project Helix §2)
-- Polymorphic activity timeline + Postgres triggers
-- ============================================================

-- ── 1. Create client_activity_logs table ─────────────────
create table if not exists public.client_activity_logs (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  event_type      text not null,         -- 'job_created','job_completed','invoice_sent','invoice_paid','note_updated','status_changed','contact_added'
  actor_id        uuid references auth.users,
  metadata        jsonb default '{}',    -- polymorphic payload per event_type
  created_at      timestamptz default now()
);

create index idx_client_activity_client on public.client_activity_logs (client_id, created_at desc);
create index idx_client_activity_org on public.client_activity_logs (organization_id, created_at desc);

-- RLS
alter table public.client_activity_logs enable row level security;

create policy "Members can read client activity"
  on public.client_activity_logs for select
  using (
    organization_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "System can insert client activity"
  on public.client_activity_logs for insert
  with check (true);

-- ── 2. Trigger: Log when a job is created for a client ───
create or replace function public.log_client_job_created()
returns trigger as $$
begin
  if NEW.client_id is not null then
    insert into public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    values (
      NEW.client_id,
      NEW.organization_id,
      'job_created',
      auth.uid(),
      jsonb_build_object(
        'job_id', NEW.id,
        'title', NEW.title,
        'description', coalesce(NEW.description, '')
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_job_created_log_client on public.jobs;
create trigger on_job_created_log_client
  after insert on public.jobs
  for each row
  when (NEW.client_id is not null and NEW.deleted_at is null)
  execute function public.log_client_job_created();

-- ── 3. Trigger: Log when a job is completed for a client ─
create or replace function public.log_client_job_completed()
returns trigger as $$
begin
  if NEW.status = 'done' and OLD.status is distinct from 'done' and NEW.client_id is not null then
    insert into public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    values (
      NEW.client_id,
      NEW.organization_id,
      'job_completed',
      auth.uid(),
      jsonb_build_object(
        'job_id', NEW.id,
        'title', NEW.title
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_job_completed_log_client on public.jobs;
create trigger on_job_completed_log_client
  after update on public.jobs
  for each row
  when (NEW.status = 'done' and OLD.status is distinct from NEW.status and NEW.client_id is not null)
  execute function public.log_client_job_completed();

-- ── 4. Trigger: Log when an invoice is created/paid ──────
create or replace function public.log_client_invoice_event()
returns trigger as $$
declare
  v_event_type text;
begin
  if NEW.client_id is null then return NEW; end if;

  -- Determine event type
  if TG_OP = 'INSERT' then
    v_event_type := 'invoice_sent';
  elsif TG_OP = 'UPDATE' and NEW.status = 'paid' and OLD.status is distinct from 'paid' then
    v_event_type := 'invoice_paid';
  else
    return NEW;
  end if;

  insert into public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
  values (
    NEW.client_id,
    NEW.organization_id,
    v_event_type,
    auth.uid(),
    jsonb_build_object(
      'invoice_id', NEW.id,
      'total', NEW.total,
      'status', NEW.status,
      'invoice_number', coalesce(NEW.invoice_number, '')
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_invoice_log_client on public.invoices;
create trigger on_invoice_log_client
  after insert or update on public.invoices
  for each row
  when (NEW.client_id is not null)
  execute function public.log_client_invoice_event();

-- ── 5. Trigger: Log client status changes ────────────────
create or replace function public.log_client_status_change()
returns trigger as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    values (
      NEW.id,
      NEW.organization_id,
      'status_changed',
      auth.uid(),
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_client_status_change_log on public.clients;
create trigger on_client_status_change_log
  after update on public.clients
  for each row
  when (OLD.status is distinct from NEW.status)
  execute function public.log_client_status_change();

-- ── 6. Trigger: Log client notes changes ─────────────────
create or replace function public.log_client_notes_change()
returns trigger as $$
begin
  if OLD.notes is distinct from NEW.notes and NEW.notes is not null and NEW.notes != '' then
    insert into public.client_activity_logs (client_id, organization_id, event_type, actor_id, metadata)
    values (
      NEW.id,
      NEW.organization_id,
      'note_updated',
      auth.uid(),
      jsonb_build_object(
        'preview', left(NEW.notes, 120)
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_client_notes_change_log on public.clients;
create trigger on_client_notes_change_log
  after update on public.clients
  for each row
  when (OLD.notes is distinct from NEW.notes)
  execute function public.log_client_notes_change();

-- ── 7. Updated RPC: get_client_details with activity logs ─
create or replace function public.get_client_details(p_client_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select row_to_json(t)
  into v_result
  from (
    select
      c.*,
      coalesce(js.job_count, 0) as job_count,
      coalesce(is2.lifetime_value, 0) as total_spend,
      js.last_job_date,
      (
        select coalesce(json_agg(row_to_json(cc) order by cc.is_primary desc, cc.created_at), '[]'::json)
        from public.client_contacts cc
        where cc.client_id = c.id
      ) as contacts,
      -- New: pull from client_activity_logs instead of job_activity
      (
        select coalesce(json_agg(row_to_json(cal) order by cal.created_at desc), '[]'::json)
        from (
          select
            cal.id,
            cal.event_type,
            cal.actor_id,
            cal.metadata,
            cal.created_at,
            p.full_name as actor_name
          from public.client_activity_logs cal
          left join public.profiles p on p.id = cal.actor_id
          where cal.client_id = c.id
          order by cal.created_at desc
          limit 50
        ) cal
      ) as activity_log,
      -- Keep legacy recent_activity for backward compat
      (
        select coalesce(json_agg(row_to_json(a) order by a.created_at desc), '[]'::json)
        from (
          select ja.*
          from public.job_activity ja
          join public.jobs j on j.id = ja.job_id
          where j.client_id = c.id
            and j.deleted_at is null
          order by ja.created_at desc
          limit 20
        ) a
      ) as recent_activity,
      (
        select coalesce(json_agg(row_to_json(inv) order by inv.created_at desc), '[]'::json)
        from (
          select i.id, i.status, i.total, i.created_at, i.due_date, i.invoice_number
          from public.invoices i
          where i.client_id = c.id
          order by i.created_at desc
          limit 50
        ) inv
      ) as spend_history,
      -- New: inline jobs for the Jobs tab
      (
        select coalesce(json_agg(row_to_json(jb) order by jb.created_at desc), '[]'::json)
        from (
          select j.id, j.title, j.status, j.priority, j.created_at, j.scheduled_start, j.scheduled_end
          from public.jobs j
          where j.client_id = c.id
            and j.deleted_at is null
          order by j.created_at desc
          limit 50
        ) jb
      ) as jobs
    from public.clients c
    left join lateral (
      select count(*)::int as job_count, max(j.created_at) as last_job_date
      from public.jobs j
      where j.client_id = c.id and j.deleted_at is null
    ) js on true
    left join lateral (
      select coalesce(sum(i.total), 0)::numeric as lifetime_value
      from public.invoices i
      where i.client_id = c.id and i.status = 'paid'
    ) is2 on true
    where c.id = p_client_id
      and c.deleted_at is null
  ) t;

  return v_result;
end;
$$;
