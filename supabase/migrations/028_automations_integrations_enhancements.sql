-- ============================================================
-- Migration 028: Automations & Integrations Enhancements
-- connection_id, get_automation_stats, get_integrations_overview,
-- toggle_flow_status RPC, Realtime
-- ============================================================

-- ── 1. Add missing columns ──────────────────────────────
alter table public.integrations
  add column if not exists connection_id text;

alter table public.integrations
  add column if not exists settings jsonb default '{}';

-- ── 2. RPC: Get automation stats (sparkline data) ───────
create or replace function public.get_automation_stats(
  p_org_id uuid,
  p_flow_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_hourly json;
begin
  -- Hourly run counts for the last 24 hours (sparkline data)
  select coalesce(json_agg(row_to_json(h)), '[]'::json)
  into v_hourly
  from (
    select
      date_trunc('hour', started_at) as hour,
      count(*) as runs,
      count(*) filter (where status = 'success') as successes,
      count(*) filter (where status = 'failed') as failures
    from public.automation_logs
    where organization_id = p_org_id
      and started_at >= now() - interval '24 hours'
      and (p_flow_id is null or flow_id = p_flow_id)
    group by date_trunc('hour', started_at)
    order by hour
  ) h;

  return json_build_object(
    'total_runs_24h', (
      select count(*) from public.automation_logs
      where organization_id = p_org_id
        and started_at >= now() - interval '24 hours'
        and (p_flow_id is null or flow_id = p_flow_id)
    ),
    'success_rate', (
      select case
        when count(*) = 0 then 100
        else round(count(*) filter (where status = 'success')::numeric / count(*)::numeric * 100)
      end
      from public.automation_logs
      where organization_id = p_org_id
        and started_at >= now() - interval '24 hours'
        and (p_flow_id is null or flow_id = p_flow_id)
    ),
    'active_flows', (
      select count(*) from public.automation_flows
      where organization_id = p_org_id and status = 'active'
    ),
    'paused_flows', (
      select count(*) from public.automation_flows
      where organization_id = p_org_id and status = 'paused'
    ),
    'hourly', v_hourly
  );
end;
$$;

-- ── 3. RPC: Get integrations overview ───────────────────
create or replace function public.get_integrations_overview(p_org_id uuid)
returns json
language plpgsql
security definer
as $$
begin
  return json_build_object(
    'total_integrations', (
      select count(*) from public.integrations
      where organization_id = p_org_id
    ),
    'connected', (
      select count(*) from public.integrations
      where organization_id = p_org_id and status = 'connected'
    ),
    'error_count', (
      select count(*) from public.integrations
      where organization_id = p_org_id and status = 'error'
    ),
    'disconnected', (
      select count(*) from public.integrations
      where organization_id = p_org_id and status = 'disconnected'
    ),
    'last_sync', (
      select max(last_sync) from public.integrations
      where organization_id = p_org_id and status = 'connected'
    )
  );
end;
$$;

-- ── 4. RPC: Toggle flow status (atomic) ─────────────────
create or replace function public.toggle_flow_status(p_flow_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_current text;
  v_new text;
begin
  select status::text into v_current
  from public.automation_flows
  where id = p_flow_id;

  if not found then
    return json_build_object('error', 'Flow not found');
  end if;

  v_new := case when v_current = 'active' then 'paused' else 'active' end;

  update public.automation_flows
  set status = v_new::public.flow_status,
      updated_at = now()
  where id = p_flow_id;

  return json_build_object(
    'success', true,
    'new_status', v_new
  );
end;
$$;

-- ── 5. RPC: Master pause/resume all flows ───────────────
create or replace function public.set_all_flows_status(
  p_org_id uuid,
  p_pause boolean
)
returns json
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  if p_pause then
    update public.automation_flows
    set status = 'paused',
        updated_at = now()
    where organization_id = p_org_id
      and status = 'active';
  else
    update public.automation_flows
    set status = 'active',
        updated_at = now()
    where organization_id = p_org_id
      and status = 'paused';
  end if;

  get diagnostics v_count = row_count;

  return json_build_object(
    'success', true,
    'affected', v_count
  );
end;
$$;

-- ── 6. RPC: Update integration settings ─────────────────
create or replace function public.update_integration_settings(
  p_integration_id uuid,
  p_settings jsonb
)
returns json
language plpgsql
security definer
as $$
begin
  update public.integrations
  set settings = p_settings,
      updated_at = now()
  where id = p_integration_id;

  if not found then
    return json_build_object('error', 'Integration not found');
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 7. RPC: Connect/disconnect integration ──────────────
create or replace function public.toggle_integration_status(
  p_integration_id uuid,
  p_connect boolean,
  p_connection_id text default null
)
returns json
language plpgsql
security definer
as $$
begin
  if p_connect then
    update public.integrations
    set status = 'connected',
        connection_id = coalesce(p_connection_id, connection_id),
        last_sync = now(),
        error_message = null,
        updated_at = now()
    where id = p_integration_id;
  else
    update public.integrations
    set status = 'disconnected',
        connection_id = null,
        error_message = null,
        updated_at = now()
    where id = p_integration_id;
  end if;

  if not found then
    return json_build_object('error', 'Integration not found');
  end if;

  return json_build_object('success', true);
end;
$$;

-- ── 8. Enable Realtime ──────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'automation_flows'
  ) then
    alter publication supabase_realtime add table public.automation_flows;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'integrations'
  ) then
    alter publication supabase_realtime add table public.integrations;
  end if;
end $$;
