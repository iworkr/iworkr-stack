-- ============================================================================
-- @migration OracleIntake
-- @status COMPLETE
-- @description Project Oracle-Intake: AI Staging Vault for multimodal document
--   extraction. Zero-touch onboarding pipeline with HITL verification workbench.
-- @tables intake_sessions
-- @enums intake_status_enum, intake_document_type
-- @lastAudit 2026-03-24
-- ============================================================================

-- ─── 1. Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intake_status_enum') THEN
    CREATE TYPE public.intake_status_enum AS ENUM (
      'UPLOADING',
      'ANALYZING',
      'PENDING_REVIEW',
      'COMMITTED',
      'REJECTED',
      'FAILED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'intake_document_type') THEN
    CREATE TYPE public.intake_document_type AS ENUM (
      'NDIS_PLAN',
      'TRADE_WORK_ORDER',
      'SUPPLIER_INVOICE',
      'FLOOR_PLAN',
      'OTHER'
    );
  END IF;
END $$;

-- ─── 2. Intake Sessions Table ────────────────────────────────────────────────
-- The AI Staging Vault: AI NEVER writes directly to production tables.
-- All extracted data is quarantined here for human verification.

CREATE TABLE IF NOT EXISTS public.intake_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  document_type         public.intake_document_type NOT NULL DEFAULT 'NDIS_PLAN',
  file_path             TEXT NOT NULL,
  original_filename     VARCHAR(500) NOT NULL,
  file_size_bytes       BIGINT,
  mime_type             VARCHAR(100) DEFAULT 'application/pdf',

  status                public.intake_status_enum NOT NULL DEFAULT 'UPLOADING',
  extracted_data        JSONB,
  confidence_score      NUMERIC(5,2),
  validation_warnings   JSONB DEFAULT '[]'::jsonb,
  error_log             TEXT,

  ai_model_used         VARCHAR(100),
  ai_processing_ms      INTEGER,

  reviewed_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  review_notes          TEXT,

  committed_participant_id UUID REFERENCES public.participant_profiles(id) ON DELETE SET NULL,
  committed_care_plan_id   UUID REFERENCES public.care_plans(id) ON DELETE SET NULL,
  committed_agreement_id   UUID REFERENCES public.service_agreements(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_intake_sessions_org
  ON public.intake_sessions (organization_id);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_status
  ON public.intake_sessions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_uploader
  ON public.intake_sessions (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_intake_sessions_created
  ON public.intake_sessions (created_at DESC);

-- Auto-update timestamp trigger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_intake_sessions_updated_at') THEN
    CREATE TRIGGER set_intake_sessions_updated_at
      BEFORE UPDATE ON public.intake_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.intake_sessions ENABLE ROW LEVEL SECURITY;

-- Org members can view intake sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'intake_sessions' AND policyname = 'Org members can view intake sessions') THEN
    CREATE POLICY "Org members can view intake sessions"
      ON public.intake_sessions FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

-- Admins/managers can manage intake sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'intake_sessions' AND policyname = 'Admins can manage intake sessions') THEN
    CREATE POLICY "Admins can manage intake sessions"
      ON public.intake_sessions FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = intake_sessions.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 4. Realtime ─────────────────────────────────────────────────────────────
-- Broadcast status changes so the UI updates when AI finishes processing

ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_sessions;

-- ─── 5. Storage Bucket ───────────────────────────────────────────────────────
-- Secure bucket for uploaded NDIS plans and other intake documents

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'intake-documents',
  'intake-documents',
  false,
  52428800,  -- 50MB limit for large PDFs
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: org members can upload, admins can read all
CREATE POLICY "Authenticated users can upload intake documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'intake-documents');

CREATE POLICY "Authenticated users can read intake documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'intake-documents');

-- ─── 6. Commit RPC ──────────────────────────────────────────────────────────
-- Transactional scatter: atomically creates participant + care plan + goals +
-- service agreement + budget allocations from verified extracted_data.

CREATE OR REPLACE FUNCTION public.commit_intake_session(
  p_session_id UUID,
  p_organization_id UUID,
  p_reviewed_by UUID,
  p_extracted_data JSONB,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_client_id UUID;
  v_participant_id UUID;
  v_care_plan_id UUID;
  v_agreement_id UUID;
  v_budget JSONB;
  v_goal TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_ndis_number TEXT;
  v_plan_start DATE;
  v_plan_end DATE;
  v_primary_disability TEXT;
  v_management_type TEXT;
  v_total_budget NUMERIC(12,2) := 0;
BEGIN
  -- Extract core fields from the verified JSON
  v_first_name := p_extracted_data->>'participant_first_name';
  v_last_name := p_extracted_data->>'participant_last_name';
  v_ndis_number := p_extracted_data->>'ndis_number';
  v_plan_start := (p_extracted_data->>'plan_start_date')::DATE;
  v_plan_end := (p_extracted_data->>'plan_end_date')::DATE;
  v_primary_disability := p_extracted_data->>'primary_disability';

  -- Derive management type from the first budget entry
  SELECT b->>'management_type' INTO v_management_type
  FROM jsonb_array_elements(p_extracted_data->'budgets') AS b
  LIMIT 1;

  -- 1) Create the client record
  INSERT INTO public.clients (organization_id, name, type)
  VALUES (p_organization_id, v_first_name || ' ' || v_last_name, 'residential')
  RETURNING id INTO v_client_id;

  -- 2) Create participant_profile
  INSERT INTO public.participant_profiles (
    client_id, organization_id, ndis_number, primary_diagnosis,
    management_type, intake_status, status, date_of_birth
  )
  VALUES (
    v_client_id, p_organization_id, v_ndis_number, v_primary_disability,
    COALESCE(v_management_type, 'NDIA'), 'complete', 'active',
    (p_extracted_data->>'date_of_birth')::DATE
  )
  RETURNING id INTO v_participant_id;

  -- 3) Create care plan
  INSERT INTO public.care_plans (
    organization_id, participant_id, title, status, start_date,
    next_review_date
  )
  VALUES (
    p_organization_id, v_participant_id,
    'NDIS Plan – ' || v_first_name || ' ' || v_last_name,
    'active', v_plan_start, v_plan_end
  )
  RETURNING id INTO v_care_plan_id;

  -- 4) Create care goals from the goals array (objects with goal_text, support_category)
  IF p_extracted_data->'goals' IS NOT NULL AND jsonb_array_length(p_extracted_data->'goals') > 0 THEN
    FOR v_budget IN SELECT * FROM jsonb_array_elements(p_extracted_data->'goals')
    LOOP
      INSERT INTO public.care_goals (
        organization_id, participant_id, care_plan_id,
        title, status, support_category
      )
      VALUES (
        p_organization_id, v_participant_id, v_care_plan_id,
        COALESCE(v_budget->>'goal_text', v_budget #>> '{}'),
        'not_started',
        COALESCE(LOWER(v_budget->>'support_category'), 'core')
      );
    END LOOP;
  END IF;

  -- 5) Calculate total budget from all categories
  FOR v_budget IN SELECT * FROM jsonb_array_elements(p_extracted_data->'budgets')
  LOOP
    v_total_budget := v_total_budget + COALESCE((v_budget->>'total_amount')::NUMERIC, 0);
  END LOOP;

  -- 6) Create service agreement
  INSERT INTO public.service_agreements (
    organization_id, participant_id, title, status,
    start_date, end_date, total_budget,
    funding_management_type
  )
  VALUES (
    p_organization_id, v_participant_id,
    'NDIS Service Agreement – ' || v_first_name || ' ' || v_last_name,
    'active', v_plan_start, v_plan_end, v_total_budget,
    COALESCE(v_management_type, 'NDIA')
  )
  RETURNING id INTO v_agreement_id;

  -- 7) Create budget allocations per category
  FOR v_budget IN SELECT * FROM jsonb_array_elements(p_extracted_data->'budgets')
  LOOP
    INSERT INTO public.budget_allocations (
      organization_id, service_agreement_id, participant_id,
      category, total_budget
    )
    VALUES (
      p_organization_id, v_agreement_id, v_participant_id,
      LOWER(v_budget->>'category'),
      COALESCE((v_budget->>'total_amount')::NUMERIC, 0)
    );
  END LOOP;

  -- 8) Mark the intake session as committed
  UPDATE public.intake_sessions
  SET status = 'COMMITTED',
      reviewed_by = p_reviewed_by,
      reviewed_at = now(),
      review_notes = p_review_notes,
      committed_participant_id = v_participant_id,
      committed_care_plan_id = v_care_plan_id,
      committed_agreement_id = v_agreement_id,
      extracted_data = p_extracted_data
  WHERE id = p_session_id
    AND organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'success', true,
    'client_id', v_client_id,
    'participant_id', v_participant_id,
    'care_plan_id', v_care_plan_id,
    'agreement_id', v_agreement_id,
    'total_budget', v_total_budget,
    'goals_created', COALESCE(jsonb_array_length(p_extracted_data->'goals'), 0),
    'budgets_created', COALESCE(jsonb_array_length(p_extracted_data->'budgets'), 0)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- ─── 7. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.intake_sessions IS
  'Project Oracle-Intake: AI Staging Vault for multimodal document extraction. '
  'AI writes extracted data here; human verifies before committing to production tables.';

COMMENT ON FUNCTION public.commit_intake_session IS
  'Transactional scatter: atomically creates client, participant_profile, care_plan, '
  'care_goals, service_agreement, and budget_allocations from verified extracted_data.';
