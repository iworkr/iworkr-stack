-- ============================================================================
-- @migration RosettaSynthesisPlanReviews
-- @status COMPLETE
-- @description Project Rosetta-Synthesis — AI-powered end-of-plan reviews with goal linkage
-- @tables shift_goal_linkages, plan_review_data (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. ENUMs ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.plan_review_status AS ENUM (
    'GENERATING','DRAFT','PENDING_APPROVAL','FINALIZED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Compatibility shim for environments where goal linkage schema
-- is not present yet but Rosetta needs to reference it.
CREATE TABLE IF NOT EXISTS public.shift_goal_linkages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id      UUID REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  shift_id            UUID,
  goal_id             UUID,
  worker_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  worker_observation  TEXT,
  progress_rating     NUMERIC(5,2),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Plan Reviews (Master Ledger) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.plan_reviews (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id          UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  author_id               UUID REFERENCES public.profiles(id),
  -- Date boundaries
  review_start_date       DATE NOT NULL,
  review_end_date         DATE NOT NULL,
  -- Status
  status                  public.plan_review_status DEFAULT 'DRAFT',
  -- AI content
  ai_generated_markdown   TEXT,
  final_html              TEXT,
  -- Export
  pdf_storage_path        TEXT,
  -- Context stats
  total_notes_ingested    INT DEFAULT 0,
  total_goals_covered     INT DEFAULT 0,
  total_tokens_used       INT DEFAULT 0,
  ai_model_used           VARCHAR,
  generation_duration_ms  INT,
  -- Metadata
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plan_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage plan reviews" ON public.plan_reviews FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX IF NOT EXISTS idx_plan_reviews_org ON public.plan_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_participant ON public.plan_reviews(participant_id);
CREATE INDEX IF NOT EXISTS idx_plan_reviews_status ON public.plan_reviews(organization_id, status);

-- ── 3. Review Citations (Anti-Hallucination Linkage) ────────
CREATE TABLE IF NOT EXISTS public.review_citations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id               UUID NOT NULL REFERENCES public.plan_reviews(id) ON DELETE CASCADE,
  citation_index          INT NOT NULL,
  -- Source links (one of these will be populated)
  progress_note_id        UUID REFERENCES public.progress_notes(id) ON DELETE SET NULL,
  goal_linkage_id         UUID REFERENCES public.shift_goal_linkages(id) ON DELETE SET NULL,
  -- Snapshot for immutability
  source_date             DATE,
  source_text_snapshot    TEXT NOT NULL,
  source_worker_name      VARCHAR,
  -- Ordering
  created_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(review_id, citation_index)
);

ALTER TABLE public.review_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view citations" ON public.review_citations FOR ALL
  USING (review_id IN (
    SELECT id FROM public.plan_reviews
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active')));

CREATE INDEX IF NOT EXISTS idx_citations_review ON public.review_citations(review_id);

-- ── 4. RPC: Get synthesis context data ──────────────────────
CREATE OR REPLACE FUNCTION public.get_synthesis_context(
  p_org_id UUID,
  p_participant_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_notes JSON;
  v_goal_observations JSON;
  v_goals JSON;
  v_participant JSON;
  v_note_count INT;
  v_goal_count INT;
BEGIN
  -- Fetch participant details
  SELECT json_build_object(
    'id', pp.id,
    'full_name', pp.full_name,
    'ndis_number', pp.ndis_number,
    'primary_diagnosis', pp.primary_diagnosis,
    'date_of_birth', pp.date_of_birth
  ) INTO v_participant
  FROM public.participant_profiles pp
  WHERE pp.id = p_participant_id AND pp.organization_id = p_org_id;

  -- Fetch progress notes in date range
  SELECT json_agg(row_to_json(t)) INTO v_notes
  FROM (
    SELECT
      pn.id,
      pn.created_at::date as date,
      pn.content,
      pn.summary,
      pn.observations,
      pn.outcomes_achieved,
      pn.goals_addressed,
      pn.participant_mood,
      pn.context_of_support,
      pn.risks_identified,
      p.full_name as worker_name
    FROM public.progress_notes pn
    LEFT JOIN public.profiles p ON p.id = pn.worker_id
    WHERE pn.organization_id = p_org_id
      AND pn.participant_id = p_participant_id
      AND pn.created_at::date BETWEEN p_start_date AND p_end_date
    ORDER BY pn.created_at ASC
  ) t;

  -- Fetch goal observations
  SELECT json_agg(row_to_json(t)) INTO v_goal_observations
  FROM (
    SELECT
      sgl.id,
      sgl.created_at::date as date,
      sgl.worker_observation,
      sgl.progress_rating,
      pg.title as goal_title,
      pg.goal_statement,
      p.full_name as worker_name
    FROM public.shift_goal_linkages sgl
    LEFT JOIN public.participant_goals pg ON pg.id = sgl.goal_id
    LEFT JOIN public.profiles p ON p.id = sgl.worker_id
    WHERE sgl.organization_id = p_org_id
      AND sgl.participant_id = p_participant_id
      AND sgl.created_at::date BETWEEN p_start_date AND p_end_date
    ORDER BY sgl.created_at ASC
  ) t;

  -- Fetch active goals
  SELECT json_agg(row_to_json(t)) INTO v_goals
  FROM (
    SELECT id, title, goal_statement, domain, status, goal_status,
           start_date, end_date, ndis_goal_category
    FROM public.participant_goals
    WHERE organization_id = p_org_id
      AND participant_id = p_participant_id
    ORDER BY created_at ASC
  ) t;

  -- Counts
  SELECT COUNT(*) INTO v_note_count
  FROM public.progress_notes
  WHERE organization_id = p_org_id
    AND participant_id = p_participant_id
    AND created_at::date BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(DISTINCT sgl.goal_id) INTO v_goal_count
  FROM public.shift_goal_linkages sgl
  WHERE sgl.organization_id = p_org_id
    AND sgl.participant_id = p_participant_id
    AND sgl.created_at::date BETWEEN p_start_date AND p_end_date;

  RETURN json_build_object(
    'participant', v_participant,
    'goals', COALESCE(v_goals, '[]'::json),
    'progress_notes', COALESCE(v_notes, '[]'::json),
    'goal_observations', COALESCE(v_goal_observations, '[]'::json),
    'note_count', v_note_count,
    'goal_count', v_goal_count
  );
END;
$$;

-- ── 5. RPC: Dashboard stats ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_review_dashboard_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total INT; v_generating INT; v_draft INT; v_pending INT; v_finalized INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.plan_reviews WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_generating FROM public.plan_reviews WHERE organization_id = p_org_id AND status = 'GENERATING';
  SELECT COUNT(*) INTO v_draft FROM public.plan_reviews WHERE organization_id = p_org_id AND status = 'DRAFT';
  SELECT COUNT(*) INTO v_pending FROM public.plan_reviews WHERE organization_id = p_org_id AND status = 'PENDING_APPROVAL';
  SELECT COUNT(*) INTO v_finalized FROM public.plan_reviews WHERE organization_id = p_org_id AND status = 'FINALIZED';
  RETURN json_build_object(
    'total', v_total,
    'generating', v_generating,
    'draft', v_draft,
    'pending_approval', v_pending,
    'finalized', v_finalized
  );
END;
$$;

-- ── 6. Realtime ──────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_reviews;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
