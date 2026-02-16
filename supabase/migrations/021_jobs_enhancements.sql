-- ============================================================
-- Migration 021: Jobs Module Enhancements
-- Line items table, display ID trigger, auto-activity trigger,
-- and create_job_with_estimate RPC
-- ============================================================

-- ── 1. Job Line Items table ─────────────────────────────
create table if not exists public.job_line_items (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs on delete cascade,
  description     text not null,
  quantity        int not null default 1,
  unit_price_cents int not null default 0,
  sort_order      int not null default 0,
  created_at      timestamptz default now()
);

create index idx_job_line_items_job on public.job_line_items (job_id);

-- RLS
alter table public.job_line_items enable row level security;

create policy "Members can read job line items"
  on public.job_line_items for select
  using (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy "Members can create job line items"
  on public.job_line_items for insert
  with check (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy "Members can update job line items"
  on public.job_line_items for update
  using (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

create policy "Members can delete job line items"
  on public.job_line_items for delete
  using (
    job_id in (
      select id from public.jobs where organization_id in (
        select organization_id from public.organization_members
        where user_id = auth.uid() and status = 'active'
      )
    )
  );

-- ── 2. Display ID auto-generation trigger ───────────────
-- Uses per-organization sequence via a counter stored in metadata
create or replace function public.set_job_display_id()
returns trigger as $$
declare
  v_next_num int;
begin
  -- Only generate if display_id is null or empty
  if NEW.display_id is null or NEW.display_id = '' then
    -- Get next number for this org
    select coalesce(max(
      case
        when display_id ~ '^JOB-\d+$'
        then substring(display_id from 'JOB-(\d+)')::int
        else 0
      end
    ), 0) + 1
    into v_next_num
    from public.jobs
    where organization_id = NEW.organization_id;

    NEW.display_id := 'JOB-' || lpad(v_next_num::text, 3, '0');
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Drop if exists to avoid conflicts
drop trigger if exists before_insert_job_display_id on public.jobs;
create trigger before_insert_job_display_id
  before insert on public.jobs
  for each row
  execute function public.set_job_display_id();

-- ── 3. Auto-activity logging trigger ────────────────────
-- Automatically logs status changes, priority changes, and assignment changes
create or replace function public.log_job_activity()
returns trigger as $$
declare
  v_user_name text;
begin
  -- Get user name
  select coalesce(p.full_name, 'System')
  into v_user_name
  from public.profiles p
  where p.id = auth.uid();

  -- Status change
  if OLD.status is distinct from NEW.status then
    insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
    values (
      NEW.id,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      auth.uid(),
      v_user_name,
      '{}',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  end if;

  -- Priority change
  if OLD.priority is distinct from NEW.priority then
    insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
    values (
      NEW.id,
      'update',
      'Priority changed from ' || OLD.priority || ' to ' || NEW.priority,
      auth.uid(),
      v_user_name,
      '{}',
      jsonb_build_object('field', 'priority', 'old_value', OLD.priority, 'new_value', NEW.priority)
    );
  end if;

  -- Assignment change
  if OLD.assignee_id is distinct from NEW.assignee_id then
    if NEW.assignee_id is not null then
      declare
        v_assignee_name text;
      begin
        select coalesce(p.full_name, 'Unknown')
        into v_assignee_name
        from public.profiles p
        where p.id = NEW.assignee_id;

        insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
        values (
          NEW.id,
          'assignment',
          'Job assigned to ' || v_assignee_name,
          auth.uid(),
          v_user_name,
          '{}',
          jsonb_build_object('assignee_id', NEW.assignee_id, 'assignee_name', v_assignee_name)
        );
      end;
    else
      insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
      values (
        NEW.id,
        'assignment',
        'Job assignment removed',
        auth.uid(),
        v_user_name,
        '{}',
        jsonb_build_object('assignee_id', null)
      );
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_job_update_log_activity on public.jobs;
create trigger on_job_update_log_activity
  after update on public.jobs
  for each row
  execute function public.log_job_activity();

-- ── 4. RPC: Create job with estimate (transactional) ────
create or replace function public.create_job_with_estimate(
  p_org_id uuid,
  p_title text,
  p_description text default null,
  p_status text default 'backlog',
  p_priority text default 'none',
  p_client_id uuid default null,
  p_assignee_id uuid default null,
  p_due_date timestamptz default null,
  p_location text default null,
  p_location_lat double precision default null,
  p_location_lng double precision default null,
  p_labels text[] default '{}',
  p_revenue numeric default 0,
  p_line_items jsonb default '[]'
)
returns json
language plpgsql
security definer
as $$
declare
  v_job_id uuid;
  v_display_id text;
  v_line_item jsonb;
  v_sort int := 0;
  v_total_cents int := 0;
begin
  -- Calculate total from line items
  for v_line_item in select * from jsonb_array_elements(p_line_items)
  loop
    v_total_cents := v_total_cents + coalesce((v_line_item->>'unit_price_cents')::int, 0) * coalesce((v_line_item->>'quantity')::int, 1);
  end loop;

  -- Insert the job (display_id will be auto-generated by trigger)
  insert into public.jobs (
    organization_id, title, description, status, priority,
    client_id, assignee_id, due_date, location,
    location_lat, location_lng, labels,
    revenue, created_by
  ) values (
    p_org_id, p_title, p_description,
    p_status::public.job_status, p_priority::public.job_priority,
    p_client_id, p_assignee_id, p_due_date, p_location,
    p_location_lat, p_location_lng, p_labels,
    case when v_total_cents > 0 then v_total_cents / 100.0 else p_revenue end,
    auth.uid()
  )
  returning id, display_id into v_job_id, v_display_id;

  -- Insert line items
  if jsonb_array_length(p_line_items) > 0 then
    for v_line_item in select * from jsonb_array_elements(p_line_items)
    loop
      insert into public.job_line_items (
        job_id, description, quantity, unit_price_cents, sort_order
      ) values (
        v_job_id,
        v_line_item->>'description',
        coalesce((v_line_item->>'quantity')::int, 1),
        coalesce((v_line_item->>'unit_price_cents')::int, 0),
        v_sort
      );
      v_sort := v_sort + 1;
    end loop;
  end if;

  -- Log creation activity
  insert into public.job_activity (job_id, type, text, user_id, user_name, photos, metadata)
  values (
    v_job_id,
    'creation',
    'Job "' || p_title || '" was created' || case when jsonb_array_length(p_line_items) > 0 then ' with estimate ($' || (v_total_cents / 100)::text || ')' else '' end,
    auth.uid(),
    coalesce((select full_name from public.profiles where id = auth.uid()), 'System'),
    '{}',
    jsonb_build_object('line_items_count', jsonb_array_length(p_line_items), 'total_cents', v_total_cents)
  );

  return json_build_object(
    'id', v_job_id,
    'display_id', v_display_id,
    'total_cents', v_total_cents,
    'line_items_count', jsonb_array_length(p_line_items)
  );
end;
$$;

-- ── 5. RPC: Get filtered jobs with advanced filtering ───
create or replace function public.get_filtered_jobs(
  p_org_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assignee_id uuid default null,
  p_search text default null,
  p_labels text[] default null,
  p_limit int default 100,
  p_offset int default 0
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t))
  into v_result
  from (
    select
      j.*,
      c.name as client_name,
      p.full_name as assignee_name,
      (select count(*) from public.job_subtasks st where st.job_id = j.id) as subtask_count,
      (select count(*) from public.job_line_items li where li.job_id = j.id) as line_item_count,
      (select coalesce(sum(li.unit_price_cents * li.quantity), 0) from public.job_line_items li where li.job_id = j.id) as estimate_total_cents
    from public.jobs j
    left join public.clients c on c.id = j.client_id
    left join public.profiles p on p.id = j.assignee_id
    where j.organization_id = p_org_id
      and j.deleted_at is null
      and (p_status is null or j.status = p_status::public.job_status)
      and (p_priority is null or j.priority = p_priority::public.job_priority)
      and (p_assignee_id is null or j.assignee_id = p_assignee_id)
      and (p_search is null or j.title ilike '%' || p_search || '%' or j.description ilike '%' || p_search || '%' or j.display_id ilike '%' || p_search || '%')
      and (p_labels is null or j.labels && p_labels)
    order by j.created_at desc
    limit p_limit
    offset p_offset
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 6. RPC: Get job with full details ───────────────────
create or replace function public.get_job_details(p_job_id uuid)
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
      j.*,
      c.name as client_name,
      p.full_name as assignee_name,
      (
        select coalesce(json_agg(row_to_json(st) order by st.sort_order), '[]'::json)
        from public.job_subtasks st
        where st.job_id = j.id
      ) as subtasks,
      (
        select coalesce(json_agg(row_to_json(a) order by a.created_at desc), '[]'::json)
        from public.job_activity a
        where a.job_id = j.id
      ) as activity,
      (
        select coalesce(json_agg(row_to_json(li) order by li.sort_order), '[]'::json)
        from public.job_line_items li
        where li.job_id = j.id
      ) as line_items,
      (
        select coalesce(sum(li.unit_price_cents * li.quantity), 0)
        from public.job_line_items li
        where li.job_id = j.id
      ) as estimate_total_cents
    from public.jobs j
    left join public.clients c on c.id = j.client_id
    left join public.profiles p on p.id = j.assignee_id
    where j.id = p_job_id
      and j.deleted_at is null
  ) t;

  return v_result;
end;
$$;
