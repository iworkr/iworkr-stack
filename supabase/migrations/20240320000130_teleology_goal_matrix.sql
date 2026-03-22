-- ============================================================================
-- @migration TeleologyGoalMatrix
-- @status COMPLETE
-- @description Project Teleology — NDIS goal progression matrix with domain tracking
-- @tables ndis_goals, goal_progress_entries, goal_evidence
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── ENUMs ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ndis_goal_domain') THEN
    CREATE TYPE public.ndis_goal_domain AS ENUM (
      'DAILY_LIVING',
      'SOCIAL_COMMUNITY',
      'HEALTH_WELLBEING',
      'EMPLOYMENT',
      'LIFELONG_LEARNING',
      'HOME_LIVING',
      'CHOICE_CONTROL'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_status') THEN
    CREATE TYPE public.goal_status AS ENUM ('ACTIVE', 'ACHIEVED', 'STAGNANT', 'ARCHIVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_rating') THEN
    CREATE TYPE public.progress_rating AS ENUM ('REGRESSED', 'MAINTAINED', 'PROGRESSED');
  END IF;
END $$;

-- ── Alter existing participant_goals to match PRD schema ──
ALTER TABLE public.participant_goals
  ADD COLUMN IF NOT EXISTS domain ndis_goal_domain DEFAULT 'DAILY_LIVING',
  ADD COLUMN IF NOT EXISTS title VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS goal_status goal_status DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill title from goal_statement if it exists
UPDATE public.participant_goals
SET title = COALESCE(title, goal_statement, 'Untitled Goal')
WHERE title IS NULL;

-- Make title NOT NULL after backfill
ALTER TABLE public.participant_goals ALTER COLUMN title SET NOT NULL;

-- ── shift_goal_linkages ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shift_goal_linkages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  time_log_id        UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
  shift_id           UUID REFERENCES public.schedule_blocks(id) ON DELETE SET NULL,
  goal_id            UUID NOT NULL REFERENCES public.participant_goals(id) ON DELETE CASCADE,
  worker_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_rating    progress_rating NOT NULL DEFAULT 'MAINTAINED',
  worker_observation TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_goal_id
  ON public.shift_goal_linkages(goal_id);
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_worker_id
  ON public.shift_goal_linkages(worker_id);
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_participant_id
  ON public.shift_goal_linkages(participant_id);
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_created_at
  ON public.shift_goal_linkages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participant_goals_participant_id
  ON public.participant_goals(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_goals_status
  ON public.participant_goals(goal_status);

-- ── RLS ──────────────────────────────────────────────────
ALTER TABLE public.shift_goal_linkages ENABLE ROW LEVEL SECURITY;

-- Org members can read
CREATE POLICY "org members read goal linkages"
  ON public.shift_goal_linkages FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Workers can insert their own
CREATE POLICY "workers insert own goal linkages"
  ON public.shift_goal_linkages FOR INSERT
  WITH CHECK (
    worker_id = auth.uid() AND
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins/managers can update
CREATE POLICY "admins update goal linkages"
  ON public.shift_goal_linkages FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner','admin','manager')
    )
  );

-- ── RPC: get_active_goals_for_participant ───────────────
CREATE OR REPLACE FUNCTION public.get_active_goals_for_participant(
  p_participant_id UUID
)
RETURNS TABLE (
  id           UUID,
  title        VARCHAR,
  description  TEXT,
  domain       ndis_goal_domain,
  start_date   DATE,
  end_date     DATE,
  goal_status  goal_status,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, title, description, domain, start_date, end_date, goal_status, created_at
  FROM public.participant_goals
  WHERE participant_id = p_participant_id
    AND goal_status = 'in_progress'
  ORDER BY created_at ASC;
$$;

-- ── RPC: submit_timesheet_with_goals (atomic) ───────────
CREATE OR REPLACE FUNCTION public.submit_timesheet_with_goals(
  p_organization_id  UUID,
  p_shift_id         UUID,
  p_worker_id        UUID,
  p_participant_id   UUID,
  p_time_entry_id    UUID DEFAULT NULL,
  p_goal_linkages    JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linkage     JSONB;
  v_inserted    INT := 0;
BEGIN
  -- Atomically insert goal linkages
  FOR v_linkage IN SELECT * FROM jsonb_array_elements(p_goal_linkages)
  LOOP
    INSERT INTO public.shift_goal_linkages (
      organization_id,
      time_log_id,
      shift_id,
      goal_id,
      worker_id,
      participant_id,
      progress_rating,
      worker_observation
    )
    VALUES (
      p_organization_id,
      p_time_entry_id,
      p_shift_id,
      (v_linkage->>'goal_id')::UUID,
      p_worker_id,
      p_participant_id,
      (v_linkage->>'progress_rating')::progress_rating,
      v_linkage->>'worker_observation'
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  -- Auto-update goal status to on_hold if < 2 linkages in last 14 days
  UPDATE public.participant_goals pg
  SET goal_status = 'on_hold', updated_at = now()
  WHERE pg.participant_id = p_participant_id
    AND pg.goal_status = 'in_progress'
    AND (
      SELECT COUNT(*) FROM public.shift_goal_linkages sgl
      WHERE sgl.goal_id = pg.id
        AND sgl.created_at >= now() - INTERVAL '14 days'
    ) < 2;

  RETURN jsonb_build_object(
    'ok', true,
    'goal_linkages_inserted', v_inserted,
    'shift_id', p_shift_id
  );
END;
$$;

-- ── RPC: get_goal_matrix_for_org ───────────────────────
CREATE OR REPLACE FUNCTION public.get_goal_matrix_for_org(
  p_organization_id  UUID,
  p_participant_id   UUID DEFAULT NULL
)
RETURNS TABLE (
  goal_id             UUID,
  participant_id      UUID,
  participant_name    TEXT,
  title               VARCHAR,
  domain              ndis_goal_domain,
  goal_status         goal_status,
  start_date          DATE,
  end_date            DATE,
  observation_count   BIGINT,
  observations_30d    BIGINT,
  is_stagnant         BOOLEAN,
  last_observation_at TIMESTAMPTZ,
  trajectory          JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pg.id AS goal_id,
    pg.participant_id,
    COALESCE(pr.full_name, pr.email, 'Unknown') AS participant_name,
    pg.title,
    pg.domain,
    pg.goal_status,
    pg.start_date,
    pg.end_date,
    COUNT(sgl.id) AS observation_count,
    COUNT(sgl.id) FILTER (WHERE sgl.created_at >= now() - INTERVAL '30 days') AS observations_30d,
    COUNT(sgl.id) FILTER (WHERE sgl.created_at >= now() - INTERVAL '14 days') < 2 AS is_stagnant,
    MAX(sgl.created_at) AS last_observation_at,
    -- Last 10 trajectory points as JSON array [{ts, rating}]
    (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'ts', t.created_at,
          'rating', CASE t.progress_rating::text
            WHEN 'PROGRESSED' THEN 1
            WHEN 'MAINTAINED' THEN 0
            WHEN 'REGRESSED' THEN -1
            WHEN '1' THEN 1
            WHEN '0' THEN 0
            WHEN '-1' THEN -1
            WHEN '1.00' THEN 1
            WHEN '0.00' THEN 0
            WHEN '-1.00' THEN -1
          END
        ) ORDER BY t.created_at ASC
      ), '[]'::JSONB)
      FROM (
        SELECT created_at, progress_rating
        FROM public.shift_goal_linkages
        WHERE goal_id = pg.id
        ORDER BY created_at DESC
        LIMIT 10
      ) t
    ) AS trajectory
  FROM public.participant_goals pg
  LEFT JOIN public.profiles pr ON pr.id = pg.participant_id
  LEFT JOIN public.shift_goal_linkages sgl ON sgl.goal_id = pg.id
  WHERE pg.organization_id = p_organization_id
    AND (p_participant_id IS NULL OR pg.participant_id = p_participant_id)
  GROUP BY pg.id, pr.full_name, pr.email
  ORDER BY is_stagnant DESC, observation_count ASC;
$$;

-- ── RPC: get_goal_evidence_feed ────────────────────────
CREATE OR REPLACE FUNCTION public.get_goal_evidence_feed(
  p_goal_id          UUID,
  p_organization_id  UUID,
  p_limit            INT DEFAULT 50,
  p_offset           INT DEFAULT 0
)
RETURNS TABLE (
  linkage_id          UUID,
  progress_rating     TEXT,
  worker_observation  TEXT,
  created_at          TIMESTAMPTZ,
  worker_name         TEXT,
  worker_avatar_url   TEXT,
  shift_date          DATE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sgl.id AS linkage_id,
    sgl.progress_rating::text,
    sgl.worker_observation,
    sgl.created_at,
    COALESCE(pr.full_name, pr.email, 'Worker') AS worker_name,
    pr.avatar_url AS worker_avatar_url,
    sgl.created_at::DATE AS shift_date
  FROM public.shift_goal_linkages sgl
  LEFT JOIN public.profiles pr ON pr.id = sgl.worker_id
  WHERE sgl.goal_id = p_goal_id
    AND sgl.organization_id = p_organization_id
  ORDER BY sgl.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- ── RPC: get_goal_matrix_telemetry ─────────────────────
CREATE OR REPLACE FUNCTION public.get_goal_matrix_telemetry(
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_goals',
    (SELECT COUNT(*) FROM public.participant_goals WHERE organization_id = p_organization_id AND goal_status = 'in_progress'),
    'observations_30d',
    (SELECT COUNT(*) FROM public.shift_goal_linkages WHERE organization_id = p_organization_id AND created_at >= now() - INTERVAL '30 days'),
    'stagnant_goals',
    (SELECT COUNT(*) FROM public.participant_goals pg WHERE pg.organization_id = p_organization_id AND pg.goal_status = 'in_progress'
      AND (SELECT COUNT(*) FROM public.shift_goal_linkages sgl WHERE sgl.goal_id = pg.id AND sgl.created_at >= now() - INTERVAL '14 days') < 2),
    'upcoming_reviews',
    (SELECT COUNT(*) FROM public.participant_goals WHERE organization_id = p_organization_id AND goal_status = 'in_progress' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days')
  );
$$;

-- ── RPC: get_plan_report_data ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_plan_report_data(
  p_organization_id UUID,
  p_participant_id  UUID,
  p_from_date       DATE,
  p_to_date         DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant       JSONB;
  v_org               JSONB;
  v_goals             JSONB;
  v_shift_stats       JSONB;
BEGIN
  -- Participant info
  SELECT jsonb_build_object(
    'id', id,
    'name', COALESCE(full_name, email),
    'ndis_number', ndis_number,
    'date_of_birth', date_of_birth
  ) INTO v_participant
  FROM public.profiles WHERE id = p_participant_id;

  -- Org info
  SELECT jsonb_build_object(
    'name', name,
    'logo_url', logo_url,
    'abn', abn
  ) INTO v_org
  FROM public.organizations WHERE id = p_organization_id;

  -- Shift stats
  SELECT jsonb_build_object(
    'total_shifts', COUNT(*),
    'total_hours', ROUND(COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out, now()) - clock_in)) / 3600), 0)::NUMERIC, 1)
  ) INTO v_shift_stats
  FROM public.time_entries
  WHERE shift_id IN (
    SELECT id FROM public.schedule_blocks
    WHERE participant_id = p_participant_id
      AND start_time::DATE >= p_from_date
      AND start_time::DATE <= p_to_date
  );

  -- Goals with linkages
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'goal_id', pg.id,
      'title', pg.title,
      'domain', pg.domain,
      'description', pg.description,
      'status', pg.goal_status,
      'stats', jsonb_build_object(
        'total', COUNT(sgl.id),
        'progressed', COUNT(sgl.id) FILTER (WHERE sgl.progress_rating = 'PROGRESSED'),
        'maintained', COUNT(sgl.id) FILTER (WHERE sgl.progress_rating = 'MAINTAINED'),
        'regressed', COUNT(sgl.id) FILTER (WHERE sgl.progress_rating = 'REGRESSED')
      ),
      'evidence', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'date', e.created_at,
            'rating', e.progress_rating,
            'observation', e.worker_observation,
            'worker_name', COALESCE(wp.full_name, wp.email)
          ) ORDER BY e.created_at DESC
        ), '[]'::JSONB)
        FROM public.shift_goal_linkages e
        LEFT JOIN public.profiles wp ON wp.id = e.worker_id
        WHERE e.goal_id = pg.id
          AND e.created_at::DATE >= p_from_date
          AND e.created_at::DATE <= p_to_date
          AND (e.worker_observation IS NOT NULL AND e.worker_observation != '')
      )
    )
  ), '[]'::JSONB) INTO v_goals
  FROM public.participant_goals pg
  LEFT JOIN public.shift_goal_linkages sgl
    ON sgl.goal_id = pg.id
    AND sgl.created_at::DATE >= p_from_date
    AND sgl.created_at::DATE <= p_to_date
  WHERE pg.participant_id = p_participant_id
    AND pg.organization_id = p_organization_id
  GROUP BY pg.id;

  RETURN jsonb_build_object(
    'participant', v_participant,
    'organization', v_org,
    'date_range', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'shift_stats', v_shift_stats,
    'goals', v_goals,
    'generated_at', now()
  );
END;
$$;

-- ── Update trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_participant_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participant_goals_updated_at ON public.participant_goals;
CREATE TRIGGER trg_participant_goals_updated_at
  BEFORE UPDATE ON public.participant_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_participant_goals_updated_at();
