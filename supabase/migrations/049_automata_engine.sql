-- ============================================================
-- Migration 049: Project Automata — Core Execution Engine
-- SAFE: All statements idempotent with existence checks.
-- ============================================================

-- ── 1. Extend automation_flows with versioning & JSON Logic ──
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_flows') THEN
    ALTER TABLE public.automation_flows
      ADD COLUMN IF NOT EXISTS version int DEFAULT 1,
      ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;
  ELSE
    RAISE NOTICE '[049] automation_flows table not found — skipping column additions.';
  END IF;
END $$;

-- ── 2. Extend automation_queue for Automata ──────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_queue') THEN
    ALTER TABLE public.automation_queue
      ADD COLUMN IF NOT EXISTS trigger_event_id text,
      ADD COLUMN IF NOT EXISTS flow_version int,
      ADD COLUMN IF NOT EXISTS context_payload jsonb DEFAULT '{}';

    CREATE INDEX IF NOT EXISTS idx_automation_queue_event_id
      ON public.automation_queue (trigger_event_id)
      WHERE trigger_event_id IS NOT NULL;
  ELSE
    RAISE NOTICE '[049] automation_queue table not found — skipping column additions.';
  END IF;
END $$;

-- ── 3. Create the Idempotency Ledger (automation_runs) ───────
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id     uuid,
  trigger_event_id  text NOT NULL,
  workspace_id      uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  execution_status  text NOT NULL DEFAULT 'success',
  execution_time_ms int,
  error_details     text,
  trace             jsonb DEFAULT '[]',
  created_at        timestamptz DEFAULT now()
);

-- Add FK to automation_flows if it exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_flows')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'automation_runs_automation_id_fkey' AND table_name = 'automation_runs'
     ) THEN
    ALTER TABLE public.automation_runs
      ADD CONSTRAINT automation_runs_automation_id_fkey
      FOREIGN KEY (automation_id) REFERENCES public.automation_flows ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Unique constraint for idempotency
DO $$ BEGIN
  ALTER TABLE public.automation_runs
    ADD CONSTRAINT uq_automation_runs_idempotency
    UNIQUE (automation_id, trigger_event_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace
  ON public.automation_runs (workspace_id, created_at DESC);

-- Note: partial index with now() is not allowed (IMMUTABLE required).
-- Using a regular index instead; the circuit breaker function handles the time filter.
CREATE INDEX IF NOT EXISTS idx_automation_runs_circuit
  ON public.automation_runs (workspace_id, created_at DESC);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members can read automation runs"
    ON public.automation_runs FOR SELECT
    USING (
      workspace_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "System can insert automation runs"
    ON public.automation_runs FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Extend automation_logs with execution telemetry ───────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_logs') THEN
    ALTER TABLE public.automation_logs
      ADD COLUMN IF NOT EXISTS execution_time_ms int,
      ADD COLUMN IF NOT EXISTS trace jsonb DEFAULT '[]';
  END IF;
END $$;

-- ── 5. SKIP LOCKED Queue Claim Function ──────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_queue')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_flows') THEN

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.claim_queue_item()
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      DECLARE
        v_item public.automation_queue%rowtype;
        v_flow record;
      BEGIN
        UPDATE public.automation_queue
        SET status = 'processing',
            attempts = attempts + 1
        WHERE id = (
          SELECT id
          FROM public.automation_queue
          WHERE status = 'pending'
            AND execute_at <= now()
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING * INTO v_item;

        IF v_item.id IS NULL THEN
          RETURN jsonb_build_object('claimed', false);
        END IF;

        SELECT id, organization_id, name, blocks, conditions, trigger_config, status, version
        INTO v_flow
        FROM public.automation_flows
        WHERE id = v_item.flow_id;

        IF v_flow.id IS NULL THEN
          UPDATE public.automation_queue
          SET status = 'failed', error = 'Flow not found (deleted)', completed_at = now()
          WHERE id = v_item.id;
          RETURN jsonb_build_object('claimed', false, 'reason', 'flow_deleted');
        END IF;

        RETURN jsonb_build_object(
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
      END;
      $body$;
    $fn$;
  ELSE
    RAISE NOTICE '[049] Skipping claim_queue_item — required tables not found.';
  END IF;
END $$;

-- ── 6. Idempotency Check Function ────────────────────────────
CREATE OR REPLACE FUNCTION public.try_claim_execution(
  p_automation_id uuid,
  p_trigger_event_id text,
  p_workspace_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.automation_runs (automation_id, trigger_event_id, workspace_id, execution_status)
  VALUES (p_automation_id, p_trigger_event_id, p_workspace_id, 'success');
  RETURN true;
EXCEPTION
  WHEN unique_violation THEN
    RETURN false;
END;
$$;

-- ── 7. Circuit Breaker Function ──────────────────────────────
CREATE OR REPLACE FUNCTION public.check_circuit_breaker(
  p_workspace_id uuid,
  p_limit int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*)
  INTO v_count
  FROM public.automation_runs
  WHERE workspace_id = p_workspace_id
    AND created_at > now() - interval '1 minute';

  RETURN jsonb_build_object(
    'tripped', v_count >= p_limit,
    'executions_in_window', v_count,
    'limit', p_limit
  );
END;
$$;

-- ── 8. Complete Queue Item Function ──────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_queue') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.complete_queue_item(
        p_queue_id uuid,
        p_status text,
        p_error text DEFAULT NULL
      )
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      BEGIN
        UPDATE public.automation_queue
        SET status = p_status,
            error = p_error,
            completed_at = now()
        WHERE id = p_queue_id;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 9. Retry or Dead-Letter Function ─────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_queue') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.retry_or_dead_letter(
        p_queue_id uuid,
        p_error text
      )
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      DECLARE
        v_attempts int;
        v_max_attempts int;
        v_new_status text;
      BEGIN
        SELECT attempts, max_attempts
        INTO v_attempts, v_max_attempts
        FROM public.automation_queue
        WHERE id = p_queue_id;

        IF v_attempts >= v_max_attempts THEN
          v_new_status := 'dead_letter';
          UPDATE public.automation_queue
          SET status = 'dead_letter', error = p_error, completed_at = now()
          WHERE id = p_queue_id;
        ELSE
          v_new_status := 'pending';
          UPDATE public.automation_queue
          SET status = 'pending',
              error = p_error,
              execute_at = now() + (v_attempts * v_attempts * 5 || ' minutes')::interval
          WHERE id = p_queue_id;
        END IF;

        RETURN v_new_status;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 10. Enqueue Automation Event Function ────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_queue')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_flows') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.enqueue_automation(
        p_workspace_id uuid,
        p_flow_id uuid,
        p_trigger_event_id text,
        p_event_data jsonb,
        p_context_payload jsonb DEFAULT '{}',
        p_execute_after timestamptz DEFAULT now(),
        p_block_index int DEFAULT 0
      )
      RETURNS uuid
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      DECLARE
        v_version int;
        v_queue_id uuid;
      BEGIN
        SELECT version INTO v_version
        FROM public.automation_flows
        WHERE id = p_flow_id;

        INSERT INTO public.automation_queue (
          organization_id, flow_id, trigger_event_id, event_data,
          context_payload, execute_at, block_index, flow_version, status
        ) VALUES (
          p_workspace_id, p_flow_id, p_trigger_event_id, p_event_data,
          p_context_payload, p_execute_after, p_block_index, COALESCE(v_version, 1), 'pending'
        )
        RETURNING id INTO v_queue_id;

        RETURN v_queue_id;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 11. Publish Flow Function ────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_flows') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.publish_automation_flow(p_flow_id uuid)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      DECLARE
        v_new_version int;
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM public.organization_members om
          JOIN public.automation_flows af ON af.organization_id = om.organization_id
          WHERE af.id = p_flow_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
            AND om.role IN ('owner', 'admin', 'manager')
        ) THEN
          RETURN json_build_object('error', 'Insufficient permissions');
        END IF;

        UPDATE public.automation_flows
        SET version = version + 1,
            is_published = true,
            status = 'active',
            updated_at = now()
        WHERE id = p_flow_id
        RETURNING version INTO v_new_version;

        IF NOT FOUND THEN
          RETURN json_build_object('error', 'Flow not found');
        END IF;

        RETURN json_build_object(
          'success', true,
          'version', v_new_version
        );
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 12. Automation Stats — enhanced with runs data ───────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_logs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_flows') THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_automation_stats(
        p_org_id uuid,
        p_flow_id uuid DEFAULT NULL
      )
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      DECLARE
        v_hourly json;
      BEGIN
        SELECT COALESCE(json_agg(row_to_json(h)), '[]'::json)
        INTO v_hourly
        FROM (
          SELECT
            date_trunc('hour', started_at) AS hour,
            count(*) AS runs,
            count(*) FILTER (WHERE status = 'success' OR status = 'completed') AS successes,
            count(*) FILTER (WHERE status = 'failed') AS failures
          FROM public.automation_logs
          WHERE organization_id = p_org_id
            AND started_at >= now() - interval '24 hours'
            AND (p_flow_id IS NULL OR flow_id = p_flow_id)
          GROUP BY date_trunc('hour', started_at)
          ORDER BY hour
        ) h;

        RETURN json_build_object(
          'total_runs_24h', (
            SELECT count(*) FROM public.automation_logs
            WHERE organization_id = p_org_id
              AND started_at >= now() - interval '24 hours'
              AND (p_flow_id IS NULL OR flow_id = p_flow_id)
          ),
          'success_rate', (
            SELECT CASE
              WHEN count(*) = 0 THEN 100
              ELSE round(count(*) FILTER (WHERE status IN ('success','completed'))::numeric / count(*)::numeric * 100)
            END
            FROM public.automation_logs
            WHERE organization_id = p_org_id
              AND started_at >= now() - interval '24 hours'
              AND (p_flow_id IS NULL OR flow_id = p_flow_id)
          ),
          'active_flows', (
            SELECT count(*) FROM public.automation_flows
            WHERE organization_id = p_org_id AND status = 'active'
          ),
          'paused_flows', (
            SELECT count(*) FROM public.automation_flows
            WHERE organization_id = p_org_id AND status = 'paused'
          ),
          'circuit_breaker', (
            SELECT jsonb_build_object(
              'executions_last_min', count(*)
            ) FROM public.automation_runs
            WHERE workspace_id = p_org_id
              AND created_at > now() - interval '1 minute'
          ),
          'dead_letter_count', (
            SELECT count(*) FROM public.automation_queue
            WHERE organization_id = p_org_id AND status = 'dead_letter'
          ),
          'hourly', v_hourly
        );
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- ── 13. Log Pruning — auto-delete logs older than 30 days ────
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'automata-log-pruning',
      '0 4 * * *',
      $cron1$DELETE FROM public.automation_logs WHERE started_at < now() - interval '30 days'$cron1$
    );
    PERFORM cron.schedule(
      'automata-runs-pruning',
      '15 4 * * *',
      $cron2$DELETE FROM public.automation_runs WHERE created_at < now() - interval '90 days'$cron2$
    );
    PERFORM cron.schedule(
      'automata-dead-letter-pruning',
      '30 4 * * *',
      $cron3$DELETE FROM public.automation_queue WHERE status = 'dead_letter' AND completed_at < now() - interval '14 days'$cron3$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[049] pg_cron not available for pruning — skipping.';
END $outer$;

-- ── 14. Enable Realtime for automation_runs ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'automation_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.automation_runs;
  END IF;
END $$;
