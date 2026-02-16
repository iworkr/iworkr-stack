-- ============================================================
-- Migration 019: Dashboard RPC Functions
-- Server-side aggregations for fast dashboard loading
-- ============================================================

-- ── 1. get_dashboard_stats ──────────────────────────────
-- Returns revenue total, growth, and job counts in one call
create or replace function public.get_dashboard_stats(
  p_org_id uuid,
  p_range_start date default (current_date - interval '30 days')::date,
  p_range_end date default current_date
)
returns json
language plpgsql
security definer
as $$
declare
  v_revenue_current numeric;
  v_revenue_previous numeric;
  v_growth_pct numeric;
  v_active_jobs int;
  v_unassigned_jobs int;
  v_total_jobs int;
  v_range_days int;
begin
  v_range_days := (p_range_end - p_range_start);

  -- Current period revenue
  select coalesce(sum(total), 0)
  into v_revenue_current
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= p_range_start
    and paid_date <= p_range_end
    and deleted_at is null;

  -- Previous period revenue (same duration before range_start)
  select coalesce(sum(total), 0)
  into v_revenue_previous
  from public.invoices
  where organization_id = p_org_id
    and status = 'paid'
    and paid_date >= (p_range_start - (v_range_days || ' days')::interval)::date
    and paid_date < p_range_start
    and deleted_at is null;

  -- Growth percentage
  if v_revenue_previous > 0 then
    v_growth_pct := round(((v_revenue_current - v_revenue_previous) / v_revenue_previous * 100)::numeric, 1);
  else
    v_growth_pct := case when v_revenue_current > 0 then 100 else 0 end;
  end if;

  -- Active jobs (not done/cancelled)
  select count(*)
  into v_active_jobs
  from public.jobs
  where organization_id = p_org_id
    and status in ('todo', 'in_progress', 'backlog')
    and deleted_at is null;

  -- Unassigned jobs
  select count(*)
  into v_unassigned_jobs
  from public.jobs
  where organization_id = p_org_id
    and assignee_id is null
    and status in ('todo', 'in_progress', 'backlog')
    and deleted_at is null;

  -- Total jobs
  select count(*)
  into v_total_jobs
  from public.jobs
  where organization_id = p_org_id
    and deleted_at is null;

  return json_build_object(
    'revenue_current', v_revenue_current,
    'revenue_previous', v_revenue_previous,
    'revenue_growth_pct', v_growth_pct,
    'active_jobs_count', v_active_jobs,
    'unassigned_jobs_count', v_unassigned_jobs,
    'total_jobs_count', v_total_jobs
  );
end;
$$;

-- ── 2. get_daily_revenue_chart ──────────────────────────
-- Returns daily revenue data for charting
create or replace function public.get_daily_revenue_chart(
  p_org_id uuid,
  p_days int default 30
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t) order by t.date)
  into v_result
  from (
    select
      d.date::text as date,
      coalesce(sum(i.total), 0) as amount,
      count(i.id) as invoice_count
    from generate_series(
      current_date - (p_days || ' days')::interval,
      current_date,
      '1 day'::interval
    ) d(date)
    left join public.invoices i
      on i.organization_id = p_org_id
      and i.status = 'paid'
      and i.paid_date = d.date::date
      and i.deleted_at is null
    group by d.date
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 3. get_my_schedule ──────────────────────────────────
-- Returns upcoming schedule blocks for a specific user
create or replace function public.get_my_schedule(
  p_user_id uuid,
  p_limit int default 5
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
      sb.id,
      sb.job_id,
      sb.title,
      sb.client_name,
      sb.location,
      sb.start_time,
      sb.end_time,
      sb.status,
      sb.travel_minutes,
      sb.notes
    from public.schedule_blocks sb
    where sb.technician_id = p_user_id
      and sb.start_time >= now() - interval '2 hours'
      and sb.status != 'cancelled'
    order by sb.start_time asc
    limit p_limit
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 4. get_ai_insights ──────────────────────────────────
-- Rule-based insights for the AI widget
create or replace function public.get_ai_insights(
  p_org_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_unassigned_tomorrow int;
  v_overdue_invoices int;
  v_idle_technicians int;
  v_total_technicians int;
  v_result json;
  v_insights json[];
begin
  -- Unassigned jobs for tomorrow
  select count(*)
  into v_unassigned_tomorrow
  from public.jobs
  where organization_id = p_org_id
    and assignee_id is null
    and status in ('todo', 'backlog')
    and due_date::date = (current_date + 1)
    and deleted_at is null;

  -- Overdue invoices
  select count(*)
  into v_overdue_invoices
  from public.invoices
  where organization_id = p_org_id
    and status in ('sent', 'overdue')
    and due_date < current_date
    and deleted_at is null;

  -- Technician utilization
  select count(distinct om.user_id)
  into v_total_technicians
  from public.organization_members om
  where om.organization_id = p_org_id
    and om.status = 'active';

  select count(distinct sb.technician_id)
  into v_idle_technicians
  from public.organization_members om
  left join public.schedule_blocks sb
    on sb.technician_id = om.user_id
    and sb.start_time >= now()
    and sb.start_time <= now() + interval '24 hours'
    and sb.status != 'cancelled'
  where om.organization_id = p_org_id
    and om.status = 'active'
    and sb.id is null;

  -- Build insights array
  v_insights := array[]::json[];

  if v_unassigned_tomorrow > 0 then
    v_insights := v_insights || json_build_object(
      'type', 'warning',
      'title', v_unassigned_tomorrow || ' job' || case when v_unassigned_tomorrow > 1 then 's' else '' end || ' unassigned for tomorrow',
      'body', 'Tomorrow has ' || v_unassigned_tomorrow || ' open job' || case when v_unassigned_tomorrow > 1 then 's' else '' end || ' with no technician assigned. Consider batch-assigning to reduce gap time.',
      'action', 'Fix Schedule',
      'action_route', '/dashboard/schedule',
      'priority', 1
    )::json;
  end if;

  if v_overdue_invoices > 0 then
    v_insights := v_insights || json_build_object(
      'type', 'alert',
      'title', v_overdue_invoices || ' overdue invoice' || case when v_overdue_invoices > 1 then 's' else '' end || ' need attention',
      'body', 'You have ' || v_overdue_invoices || ' invoice' || case when v_overdue_invoices > 1 then 's' else '' end || ' past their due date. Send reminders to improve cash flow.',
      'action', 'View Invoices',
      'action_route', '/dashboard/finance',
      'priority', 2
    )::json;
  end if;

  if v_idle_technicians > 0 and v_total_technicians > 0 then
    v_insights := v_insights || json_build_object(
      'type', 'info',
      'title', v_idle_technicians || ' team member' || case when v_idle_technicians > 1 then 's' else '' end || ' available tomorrow',
      'body', v_idle_technicians || ' of ' || v_total_technicians || ' technicians have no scheduled work for the next 24 hours.',
      'action', 'View Schedule',
      'action_route', '/dashboard/schedule',
      'priority', 3
    )::json;
  end if;

  -- Fallback if no insights
  if array_length(v_insights, 1) is null then
    v_insights := array[json_build_object(
      'type', 'success',
      'title', 'Schedule looks optimized',
      'body', 'All jobs are assigned and invoices are up to date. Your operations are running smoothly.',
      'action', null,
      'action_route', null,
      'priority', 99
    )::json];
  end if;

  return json_build_array(variadic v_insights);
end;
$$;

-- ── 5. get_team_status ──────────────────────────────────
-- Returns team members with their current work status
create or replace function public.get_team_status(
  p_org_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_agg(row_to_json(t) order by t.status_order, t.name)
  into v_result
  from (
    select
      p.id as user_id,
      p.full_name as name,
      coalesce(substring(p.full_name from 1 for 1), '') ||
        coalesce(substring(p.full_name from '.*\s(.)\S*$'), '') as initials,
      p.avatar_url,
      case
        when j_active.id is not null and j_active.status = 'in_progress' then 'on_job'
        when sb_active.id is not null and sb_active.status = 'en_route' then 'en_route'
        when sb_active.id is not null then 'on_job'
        else 'idle'
      end as status,
      case
        when j_active.id is not null then j_active.title
        when sb_active.id is not null then sb_active.title
        else null
      end as current_task,
      case
        when j_active.id is not null then 1
        when sb_active.id is not null then 2
        else 3
      end as status_order
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    left join lateral (
      select j.id, j.title, j.status
      from public.jobs j
      where j.assignee_id = om.user_id
        and j.status in ('in_progress')
        and j.deleted_at is null
      order by j.updated_at desc
      limit 1
    ) j_active on true
    left join lateral (
      select sb.id, sb.title, sb.status
      from public.schedule_blocks sb
      where sb.technician_id = om.user_id
        and sb.start_time <= now() + interval '30 minutes'
        and sb.end_time >= now()
        and sb.status in ('scheduled', 'en_route', 'in_progress')
      order by sb.start_time asc
      limit 1
    ) sb_active on true
    where om.organization_id = p_org_id
      and om.status = 'active'
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;

-- ── 6. get_live_dispatch ────────────────────────────────
-- Returns active job locations for map view
create or replace function public.get_live_dispatch(
  p_org_id uuid
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
      j.id,
      j.title as task,
      j.status,
      j.location,
      j.location_lat,
      j.location_lng,
      p.full_name as name,
      p.id as technician_id,
      case
        when j.status = 'in_progress' then 'on_job'
        else 'en_route'
      end as dispatch_status
    from public.jobs j
    left join public.profiles p on p.id = j.assignee_id
    where j.organization_id = p_org_id
      and j.status in ('in_progress', 'todo', 'backlog')
      and j.deleted_at is null
      and (j.location_lat is not null or j.assignee_id is not null)
    order by
      case j.status when 'in_progress' then 1 when 'todo' then 2 else 3 end,
      j.updated_at desc
    limit 20
  ) t;

  return coalesce(v_result, '[]'::json);
end;
$$;
