-- ============================================================
-- Migration 049: Project Automata — Core Execution Engine
-- SKIP LOCKED queue, idempotency ledger, circuit breakers,
-- JSON Logic conditions, versioned flows, log pruning
-- ============================================================

-- ── 1. Extend automation_flows with versioning & JSON Logic ──
alter table public.automation_flows
  add column if not exists version int default 1,
  add column if not exists conditions jsonb default null,
  add column if not exists is_published boolean default false;

comment on column public.automation_flows.version is
  'Monotonically increasing version; each Publish bumps it.';
comment on column public.automation_flows.conditions is
  'JSON Logic AST for condition evaluation (replaces block-level conditions).';
comment on column public.automation_flows.is_published is
  'True = live execution; false = draft. Users edit draft, Publish overwrites live.';

-- ── 2. Extend automation_queue for Automata ──────────────────
alter table public.automation_queue
  add column if not exists trigger_event_id text,
  add column if not exists flow_version int,
  add column if not exists context_payload jsonb default '{}';

create index if not exists idx_automation_queue_event_id
  on public.automation_queue (trigger_event_id)
  where trigger_event_id is not null;

comment on column public.automation_queue.trigger_event_id is
  'Unique event identifier for idempotency (e.g. evt_01HGW...).';
comment on column public.automation_queue.flow_version is
  'Snapshot of the automation version at the time the event was enqueued.';
comment on column public.automation_queue.context_payload is
  'Full hydrated payload for the worker (entity data, workspace settings, etc).';

-- ── 3. Create the Idempotency Ledger (automation_runs) ───────
create table if not exists public.automation_runs (
  id                uuid primary key default gen_random_uuid(),
  automation_id     uuid not null references public.automation_flows on delete cascade,
  trigger_event_id  text not null,
  workspace_id      uuid not null references public.organizations on delete cascade,
  execution_status  text not null default 'success',   -- success | failed | skipped
  execution_time_ms int,
  error_details     text,
  trace             jsonb default '[]',                 -- detailed step-by-step trace
  created_at        timestamptz default now()
);

-- THE IRONCLAD LOCK — prevents duplicate execution of same event
alter table public.automation_runs
  add constraint uq_automation_runs_idempotency
  unique (automation_id, trigger_event_id);

create index idx_automation_runs_workspace
  on public.automation_runs (workspace_id, created_at desc);

create index idx_automation_runs_circuit
  on public.automation_runs (workspace_id, created_at)
  where created_at > now() - interval '1 minute';

-- RLS
alter table public.automation_runs enable row level security;

create policy "Members can read automation runs"
  on public.automation_runs for select
  using (
    workspace_id in (
      select organization_id from public.organization_members
      where user_id = auth.uid() and status = 'active'
    )
  );

create policy "System can insert automation runs"
  on public.automation_runs for insert
  with check (true);

-- ── 4. Extend automation_logs with execution telemetry ───────
alter table public.automation_logs
  add column if not exists execution_time_ms int,
  add column if not exists trace jsonb default '[]';

comment on column public.automation_logs.execution_time_ms is
  'Wall-clock execution time in milliseconds.';
comment on column public.automation_logs.trace is
  'JSON array of step-by-step execution trace (trigger/condition/action steps).';

-- ── 5. SKIP LOCKED Queue Claim Function ──────────────────────
-- The heart of Automata's concurrency model. Multiple workers can
-- poll simultaneously; Postgres guarantees no row is claimed twice.
create or replace function public.claim_queue_item()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_item public.automation_queue%rowtype;
  v_flow record;
begin
  -- Atomically claim the next pending item using SKIP LOCKED
  update public.automation_queue
  set status = 'processing',
      attempts = attempts + 1
  where id = (
    select id
    from public.automation_queue
    where status = 'pending'
      and execute_at <= now()
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into v_item;

  -- Nothing to process
  if v_item.id is null then
    return jsonb_build_object('claimed', false);
  end if;

  -- Fetch the flow (use versioned snapshot if available)
  select id, organization_id, name, blocks, conditions, trigger_config, status, version
  into v_flow
  from public.automation_flows
  where id = v_item.flow_id;

  if v_flow.id is null then
    -- Orphaned queue item — flow was deleted
    update public.automation_queue
    set status = 'failed', error = 'Flow not found (deleted)', completed_at = now()
    where id = v_item.id;
    return jsonb_build_object('claimed', false, 'reason', 'flow_deleted');
  end if;

  return jsonb_build_object(
    'claimed', true,
    'queue_item', jsonb_build_object(
      'id', v_item.id,
      'flow_id', v_item.flow_id,
      'organization_id', v_item.organization_id,
      'trigger_event_id', v_item.trigger_event_id,
      'event_data', v_item.event_data,
      'context_payload', v_item.context_payload,
      'block_index', v_item.block_index,
      'flow_version', v_item.flow_version,
      'attempts', v_item.attempts
    ),
    'flow', jsonb_build_object(
      'id', v_flow.id,
      'name', v_flow.name,
      'organization_id', v_flow.organization_id,
      'blocks', v_flow.blocks,
      'conditions', v_flow.conditions,
      'trigger_config', v_flow.trigger_config,
      'status', v_flow.status::text,
      'version', v_flow.version
    )
  );
end;
$$;

-- ── 6. Idempotency Check Function ────────────────────────────
-- Try to claim execution rights. Returns false if already executed.
create or replace function public.try_claim_execution(
  p_automation_id uuid,
  p_trigger_event_id text,
  p_workspace_id uuid
)
returns boolean
language plpgsql
security definer
as $$
begin
  insert into public.automation_runs (automation_id, trigger_event_id, workspace_id, execution_status)
  values (p_automation_id, p_trigger_event_id, p_workspace_id, 'success');
  return true;
exception
  when unique_violation then
    -- 23505: Another worker already executed this exact (automation, event) pair
    return false;
end;
$$;

-- ── 7. Circuit Breaker Function ──────────────────────────────
-- Returns true if the workspace has exceeded the rate limit.
create or replace function public.check_circuit_breaker(
  p_workspace_id uuid,
  p_limit int default 100
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  select count(*)
  into v_count
  from public.automation_runs
  where workspace_id = p_workspace_id
    and created_at > now() - interval '1 minute';

  return jsonb_build_object(
    'tripped', v_count >= p_limit,
    'executions_in_window', v_count,
    'limit', p_limit
  );
end;
$$;

-- ── 8. Complete Queue Item Function ──────────────────────────
create or replace function public.complete_queue_item(
  p_queue_id uuid,
  p_status text,   -- 'completed' | 'failed' | 'dead_letter'
  p_error text default null
)
returns void
language plpgsql
security definer
as $$
begin
  update public.automation_queue
  set status = p_status,
      error = p_error,
      completed_at = now()
  where id = p_queue_id;
end;
$$;

-- ── 9. Retry or Dead-Letter Function ─────────────────────────
create or replace function public.retry_or_dead_letter(
  p_queue_id uuid,
  p_error text
)
returns text  -- returns the new status
language plpgsql
security definer
as $$
declare
  v_attempts int;
  v_max_attempts int;
  v_new_status text;
begin
  select attempts, max_attempts
  into v_attempts, v_max_attempts
  from public.automation_queue
  where id = p_queue_id;

  if v_attempts >= v_max_attempts then
    v_new_status := 'dead_letter';
    update public.automation_queue
    set status = 'dead_letter', error = p_error, completed_at = now()
    where id = p_queue_id;
  else
    v_new_status := 'pending';
    -- Exponential backoff: 5min * attempt^2
    update public.automation_queue
    set status = 'pending',
        error = p_error,
        execute_at = now() + (v_attempts * v_attempts * 5 || ' minutes')::interval
    where id = p_queue_id;
  end if;

  return v_new_status;
end;
$$;

-- ── 10. Enqueue Automation Event Function ────────────────────
-- Called by triggers/webhooks to push events into the queue.
create or replace function public.enqueue_automation(
  p_workspace_id uuid,
  p_flow_id uuid,
  p_trigger_event_id text,
  p_event_data jsonb,
  p_context_payload jsonb default '{}',
  p_execute_after timestamptz default now(),
  p_block_index int default 0
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_version int;
  v_queue_id uuid;
begin
  -- Snapshot the current flow version
  select version into v_version
  from public.automation_flows
  where id = p_flow_id;

  insert into public.automation_queue (
    organization_id, flow_id, trigger_event_id, event_data,
    context_payload, execute_at, block_index, flow_version, status
  ) values (
    p_workspace_id, p_flow_id, p_trigger_event_id, p_event_data,
    p_context_payload, p_execute_after, p_block_index, coalesce(v_version, 1), 'pending'
  )
  returning id into v_queue_id;

  return v_queue_id;
end;
$$;

-- ── 11. Publish Flow Function ────────────────────────────────
-- Bumps version and sets is_published = true (makes it live).
create or replace function public.publish_automation_flow(p_flow_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_new_version int;
begin
  -- Verify caller has admin rights on this flow's org
  if not exists (
    select 1 from public.organization_members om
    join public.automation_flows af on af.organization_id = om.organization_id
    where af.id = p_flow_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner', 'admin', 'manager')
  ) then
    return json_build_object('error', 'Insufficient permissions');
  end if;

  update public.automation_flows
  set version = version + 1,
      is_published = true,
      status = 'active',
      updated_at = now()
  where id = p_flow_id
  returning version into v_new_version;

  if not found then
    return json_build_object('error', 'Flow not found');
  end if;

  return json_build_object(
    'success', true,
    'version', v_new_version
  );
end;
$$;

-- ── 12. Automation Stats — enhanced with runs data ───────────
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
  select coalesce(json_agg(row_to_json(h)), '[]'::json)
  into v_hourly
  from (
    select
      date_trunc('hour', started_at) as hour,
      count(*) as runs,
      count(*) filter (where status = 'success' or status = 'completed') as successes,
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
        else round(count(*) filter (where status in ('success','completed'))::numeric / count(*)::numeric * 100)
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
    'circuit_breaker', (
      select jsonb_build_object(
        'executions_last_min', count(*)
      ) from public.automation_runs
      where workspace_id = p_org_id
        and created_at > now() - interval '1 minute'
    ),
    'dead_letter_count', (
      select count(*) from public.automation_queue
      where organization_id = p_org_id and status = 'dead_letter'
    ),
    'hourly', v_hourly
  );
end;
$$;

-- ── 13. Log Pruning — auto-delete logs older than 30 days ────
-- Uses pg_cron if available; graceful fallback otherwise.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Prune automation_logs older than 30 days — daily at 4 AM UTC
    perform cron.schedule(
      'automata-log-pruning',
      '0 4 * * *',
      $$delete from public.automation_logs where started_at < now() - interval '30 days'$$
    );
    -- Prune automation_runs older than 90 days — daily at 4:15 AM UTC
    perform cron.schedule(
      'automata-runs-pruning',
      '15 4 * * *',
      $$delete from public.automation_runs where created_at < now() - interval '90 days'$$
    );
    -- Prune dead-letter queue items older than 14 days — daily at 4:30 AM UTC
    perform cron.schedule(
      'automata-dead-letter-pruning',
      '30 4 * * *',
      $$delete from public.automation_queue where status = 'dead_letter' and completed_at < now() - interval '14 days'$$
    );
    raise notice '[Automata] pg_cron pruning jobs scheduled.';
  else
    raise notice '[Automata] pg_cron not available — skipping pruning schedule.';
  end if;
end $$;

-- ── 14. Enable Realtime for automation_runs ──────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'automation_runs'
  ) then
    alter publication supabase_realtime add table public.automation_runs;
  end if;
end $$;
