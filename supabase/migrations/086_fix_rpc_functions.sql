-- ============================================================
-- Migration 086: Fix Broken RPC Functions (E2E Audit Fixes)
-- Fixes column reference errors and creates missing RPCs/tables
-- SAFE: All statements use CREATE OR REPLACE / IF NOT EXISTS
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- FIX 1: get_schedule_view — backlog ORDER BY j.created_at
--   The subquery aliases output as "j" but never selects
--   created_at, causing a column reference error.
--   Fix: include j.created_at in the inner SELECT.
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_schedule_view(
  p_org_id uuid,
  p_date date DEFAULT current_date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  v_start := p_date::timestamptz;
  v_end := (p_date + 1)::timestamptz;

  SELECT json_build_object(
    'technicians', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          p.id,
          p.full_name,
          p.email,
          om.role,
          (
            SELECT COALESCE(
              sum(extract(epoch FROM (least(sb.end_time, v_end) - greatest(sb.start_time, v_start))) / 3600),
              0
            )
            FROM public.schedule_blocks sb
            WHERE sb.technician_id = p.id
              AND sb.start_time < v_end
              AND sb.end_time > v_start
              AND sb.status != 'cancelled'
          ) AS hours_booked
        FROM public.organization_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE om.organization_id = p_org_id
          AND om.status = 'active'
        ORDER BY p.full_name
      ) t
    ),
    'blocks', (
      SELECT COALESCE(json_agg(row_to_json(b) ORDER BY b.start_time), '[]'::json)
      FROM (
        SELECT
          sb.*,
          p.full_name AS technician_name
        FROM public.schedule_blocks sb
        LEFT JOIN public.profiles p ON p.id = sb.technician_id
        WHERE sb.organization_id = p_org_id
          AND sb.start_time < v_end
          AND sb.end_time > v_start
      ) b
    ),
    'events', (
      SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.start_time), '[]'::json)
      FROM (
        SELECT
          se.*,
          p.full_name AS user_name
        FROM public.schedule_events se
        LEFT JOIN public.profiles p ON p.id = se.user_id
        WHERE se.organization_id = p_org_id
          AND se.start_time < v_end
          AND se.end_time > v_start
      ) e
    ),
    'backlog', (
      SELECT COALESCE(json_agg(row_to_json(j) ORDER BY j.created_at DESC), '[]'::json)
      FROM (
        SELECT
          j.id,
          j.display_id,
          j.title,
          j.priority,
          j.location,
          j.estimated_duration_minutes,
          j.created_at,                     -- ← FIX: was missing, caused ORDER BY error
          c.name AS client_name
        FROM public.jobs j
        LEFT JOIN public.clients c ON c.id = j.client_id
        WHERE j.organization_id = p_org_id
          AND j.deleted_at IS NULL
          AND (j.status = 'backlog' OR j.status = 'todo')
          AND j.assignee_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.schedule_blocks sb
            WHERE sb.job_id = j.id
              AND sb.status != 'cancelled'
          )
      ) j
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- FIX 2: get_client_details — j.scheduled_start / j.scheduled_end
--   The jobs table has no scheduled_start/scheduled_end columns.
--   Fix: replace with j.due_date (the actual scheduling column).
-- ═══════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='clients')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='jobs')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices') THEN

    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_client_details(p_client_id uuid)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $body$
      DECLARE
        v_result json;
      BEGIN
        SELECT row_to_json(t)
        INTO v_result
        FROM (
          SELECT
            c.*,
            COALESCE(js.job_count, 0) AS job_count,
            COALESCE(is2.lifetime_value, 0) AS total_spend,
            js.last_job_date,
            (
              SELECT COALESCE(json_agg(row_to_json(cal) ORDER BY cal.created_at DESC), '[]'::json)
              FROM (
                SELECT
                  cal2.id,
                  cal2.event_type,
                  cal2.actor_id,
                  cal2.metadata,
                  cal2.created_at,
                  p.full_name AS actor_name
                FROM public.client_activity_logs cal2
                LEFT JOIN public.profiles p ON p.id = cal2.actor_id
                WHERE cal2.client_id = c.id
                ORDER BY cal2.created_at DESC
                LIMIT 50
              ) cal
            ) AS activity_log,
            (
              SELECT COALESCE(json_agg(row_to_json(inv) ORDER BY inv.created_at DESC), '[]'::json)
              FROM (
                SELECT i.id, i.status, i.total, i.created_at, i.due_date
                FROM public.invoices i
                WHERE i.client_id = c.id
                ORDER BY i.created_at DESC
                LIMIT 50
              ) inv
            ) AS spend_history,
            (
              SELECT COALESCE(json_agg(row_to_json(jb) ORDER BY jb.created_at DESC), '[]'::json)
              FROM (
                SELECT j.id, j.title, j.status, j.priority, j.created_at, j.due_date
                FROM public.jobs j                                       -- ← FIX: was j.scheduled_start, j.scheduled_end (don't exist)
                WHERE j.client_id = c.id                                 --   replaced with j.due_date (actual column)
                  AND j.deleted_at IS NULL
                ORDER BY j.created_at DESC
                LIMIT 50
              ) jb
            ) AS jobs
          FROM public.clients c
          LEFT JOIN LATERAL (
            SELECT count(*)::int AS job_count, max(j.created_at) AS last_job_date
            FROM public.jobs j
            WHERE j.client_id = c.id AND j.deleted_at IS NULL
          ) js ON true
          LEFT JOIN LATERAL (
            SELECT COALESCE(sum(i.total), 0)::numeric AS lifetime_value
            FROM public.invoices i
            WHERE i.client_id = c.id AND i.status = 'paid'
          ) is2 ON true
          WHERE c.id = p_client_id
            AND c.deleted_at IS NULL
        ) t;

        RETURN v_result;
      END;
      $body$;
    $fn$;
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════
-- FIX 3: Create missing dashboard RPCs
-- ═══════════════════════════════════════════════════════════

-- ── 3a. dashboard_layouts table ──────────────────────────
-- Stores per-user dashboard widget layout preferences
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  layout          jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own layout"
    ON public.dashboard_layouts FOR SELECT
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own layout"
    ON public.dashboard_layouts FOR INSERT
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own layout"
    ON public.dashboard_layouts FOR UPDATE
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3b. get_dashboard_snapshot RPC ───────────────────────
-- Aggregates stats, schedule, insights, and team status in one call
CREATE OR REPLACE FUNCTION public.get_dashboard_snapshot(p_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats json;
  v_schedule json;
  v_insights json;
  v_team json;
BEGIN
  -- Reuse existing RPCs for each section
  SELECT public.get_dashboard_stats(p_org_id) INTO v_stats;
  SELECT public.get_my_schedule(auth.uid(), 5) INTO v_schedule;
  SELECT public.get_ai_insights(p_org_id) INTO v_insights;
  SELECT public.get_team_status(p_org_id) INTO v_team;

  RETURN json_build_object(
    'stats', v_stats,
    'schedule', v_schedule,
    'insights', v_insights,
    'team', v_team
  );
END;
$$;

-- ── 3c. save_dashboard_layout RPC ────────────────────────
-- Upserts the user's dashboard layout preferences
CREATE OR REPLACE FUNCTION public.save_dashboard_layout(p_layout jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  INSERT INTO public.dashboard_layouts (user_id, layout, updated_at)
  VALUES (v_user_id, p_layout, now())
  ON CONFLICT (user_id)
  DO UPDATE SET layout = p_layout, updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

-- ── 3d. get_dashboard_layout RPC ─────────────────────────
-- Returns the user's saved dashboard layout
CREATE OR REPLACE FUNCTION public.get_dashboard_layout()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_layout jsonb;
BEGIN
  SELECT layout INTO v_layout
  FROM public.dashboard_layouts
  WHERE user_id = auth.uid();

  RETURN COALESCE(v_layout, '{}'::jsonb)::json;
END;
$$;


-- ═══════════════════════════════════════════════════════════
-- FIX 4: Create footprint_trails table
--   Referenced by dashboard.ts getFootprintTrails() but never created.
--   Stores GPS breadcrumb trails per technician for dispatch map.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.footprint_trails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  path            jsonb NOT NULL DEFAULT '[]',
  timestamps      bigint[] DEFAULT NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_footprint_trails_org
  ON public.footprint_trails (organization_id);

CREATE INDEX IF NOT EXISTS idx_footprint_trails_tech
  ON public.footprint_trails (organization_id, technician_id);

ALTER TABLE public.footprint_trails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Members can read org footprint trails"
    ON public.footprint_trails FOR SELECT
    USING (
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can insert footprint trails"
    ON public.footprint_trails FOR INSERT
    WITH CHECK (
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can update own footprint trails"
    ON public.footprint_trails FOR UPDATE
    USING (technician_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enable realtime for footprint trails (dispatch map live updates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'footprint_trails'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.footprint_trails;
  END IF;
END $$;
