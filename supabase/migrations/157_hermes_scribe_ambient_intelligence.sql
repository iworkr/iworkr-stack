-- ============================================================
-- Migration 157: Project Hermes-Scribe — Voice-to-Ledger &
--   Multimodal Video Scanning Ambient Intelligence Engine
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART 1: ENUMs
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audio_debrief_status') THEN
    CREATE TYPE public.audio_debrief_status AS ENUM (
      'UPLOADING',
      'TRANSCRIBING',
      'ROUTING',
      'PENDING_REVIEW',
      'COMMITTED',
      'FAILED',
      'REJECTED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debrief_action_type') THEN
    CREATE TYPE public.debrief_action_type AS ENUM (
      'shift_note',
      'medication',
      'incident',
      'goal_progress',
      'purchase_order',
      'hazard_report'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vision_scan_status') THEN
    CREATE TYPE public.vision_scan_status AS ENUM (
      'SCANNING',
      'PROCESSING',
      'PENDING_REVIEW',
      'COMMITTED',
      'FAILED'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Audio Debriefs (Voice-to-Ledger core table)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audio_debriefs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id                UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  worker_id             UUID NOT NULL REFERENCES public.profiles(id),
  participant_id        UUID,
  client_id             UUID,
  audio_url             TEXT NOT NULL,
  audio_duration_sec    NUMERIC(8,2),
  audio_format          VARCHAR(20) DEFAULT 'm4a',
  raw_transcript        TEXT,
  sanitized_transcript  TEXT,
  whisper_confidence    NUMERIC(5,4),
  whisper_language      VARCHAR(10),
  llm_model_used        VARCHAR(100),
  llm_routing_result    JSONB,
  proposed_actions      JSONB DEFAULT '[]',
  committed_actions     JSONB,
  overall_confidence    NUMERIC(5,4),
  status                public.audio_debrief_status NOT NULL DEFAULT 'UPLOADING',
  error_message         TEXT,
  reviewed_by           UUID REFERENCES public.profiles(id),
  reviewed_at           TIMESTAMPTZ,
  committed_at          TIMESTAMPTZ,
  sector                VARCHAR(20) DEFAULT 'care',
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audio_debriefs_org
  ON public.audio_debriefs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_debriefs_worker
  ON public.audio_debriefs(worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audio_debriefs_status
  ON public.audio_debriefs(organization_id, status)
  WHERE status IN ('PENDING_REVIEW', 'ROUTING');
CREATE INDEX IF NOT EXISTS idx_audio_debriefs_job
  ON public.audio_debriefs(job_id);

ALTER TABLE public.audio_debriefs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_debriefs"
  ON public.audio_debriefs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_debriefs"
  ON public.audio_debriefs FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Vision Hazard Scans (Multimodal SWMS)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.vision_hazard_scans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id              UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  worker_id           UUID NOT NULL REFERENCES public.profiles(id),
  frame_urls          JSONB DEFAULT '[]',
  frame_count         INT DEFAULT 0,
  scan_duration_sec   NUMERIC(6,2),
  local_detections    JSONB DEFAULT '[]',
  cloud_analysis      JSONB,
  risk_matrix         JSONB,
  proposed_hazards    JSONB DEFAULT '[]',
  swms_record_id      UUID,
  status              public.vision_scan_status NOT NULL DEFAULT 'SCANNING',
  llm_model_used      VARCHAR(100),
  overall_confidence  NUMERIC(5,4),
  error_message       TEXT,
  reviewed_by         UUID REFERENCES public.profiles(id),
  committed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vision_scans_org
  ON public.vision_hazard_scans(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vision_scans_job
  ON public.vision_hazard_scans(job_id);

ALTER TABLE public.vision_hazard_scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_vision_scans"
  ON public.vision_hazard_scans FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_vision_scans"
  ON public.vision_hazard_scans FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 4: AI metadata columns on core operational tables
-- ═══════════════════════════════════════════════════════════

-- progress_notes
ALTER TABLE public.progress_notes
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS source_debrief_id UUID REFERENCES public.audio_debriefs(id) ON DELETE SET NULL;

-- medication_administration_records (the actual eMAR table)
ALTER TABLE public.medication_administration_records
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS source_debrief_id UUID REFERENCES public.audio_debriefs(id) ON DELETE SET NULL;

-- incident_reports
ALTER TABLE public.incident_reports
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS source_debrief_id UUID REFERENCES public.audio_debriefs(id) ON DELETE SET NULL;

-- shift_goal_linkages
ALTER TABLE public.shift_goal_linkages
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS source_debrief_id UUID REFERENCES public.audio_debriefs(id) ON DELETE SET NULL;

-- job_swms_records (for vision AI SWMS)
ALTER TABLE public.job_swms_records
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS source_scan_id UUID REFERENCES public.vision_hazard_scans(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════
-- PART 5: Atomic Commit RPC (HITL Approval Transaction)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.commit_audio_debrief(
  p_debrief_id    UUID,
  p_org_id        UUID,
  p_worker_id     UUID,
  p_actions       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action        JSONB;
  v_action_type   TEXT;
  v_inserted_ids  JSONB := '[]';
  v_note_id       UUID;
  v_mar_id        UUID;
  v_incident_id   UUID;
  v_goal_id       UUID;
BEGIN
  FOR v_action IN SELECT * FROM jsonb_array_elements(p_actions) LOOP
    v_action_type := v_action->>'action_type';

    IF v_action_type = 'shift_note' THEN
      INSERT INTO public.progress_notes (
        organization_id, worker_id, participant_id, job_id,
        context_of_support, outcomes_achieved, risks_identified,
        ai_generated, confidence_score, source_debrief_id
      ) VALUES (
        p_org_id, p_worker_id,
        (v_action->>'participant_id')::UUID,
        (v_action->>'job_id')::UUID,
        v_action->>'context_of_support',
        v_action->>'outcomes_achieved',
        v_action->>'risks_identified',
        true,
        (v_action->>'confidence')::NUMERIC,
        p_debrief_id
      ) RETURNING id INTO v_note_id;

      v_inserted_ids := v_inserted_ids || jsonb_build_object(
        'type', 'shift_note', 'id', v_note_id
      );

    ELSIF v_action_type = 'medication' THEN
      INSERT INTO public.medication_administration_records (
        organization_id, medication_id, participant_id, worker_id,
        shift_id, outcome, administered_at, notes,
        ai_generated, confidence_score, source_debrief_id
      ) VALUES (
        p_org_id,
        (v_action->>'medication_id')::UUID,
        (v_action->>'participant_id')::UUID,
        p_worker_id,
        (v_action->>'shift_id')::UUID,
        COALESCE(v_action->>'outcome', 'administered')::public.mar_outcome,
        COALESCE((v_action->>'administered_at')::TIMESTAMPTZ, NOW()),
        v_action->>'notes',
        true,
        (v_action->>'confidence')::NUMERIC,
        p_debrief_id
      ) RETURNING id INTO v_mar_id;

      v_inserted_ids := v_inserted_ids || jsonb_build_object(
        'type', 'medication', 'id', v_mar_id
      );

    ELSIF v_action_type = 'incident' THEN
      INSERT INTO public.incident_reports (
        organization_id, reported_by, participant_id,
        title, description, severity, category,
        is_sirs_reportable,
        ai_generated, confidence_score, source_debrief_id
      ) VALUES (
        p_org_id, p_worker_id,
        (v_action->>'participant_id')::UUID,
        v_action->>'title',
        v_action->>'description',
        COALESCE(v_action->>'severity', 'medium')::public.incident_severity,
        COALESCE(v_action->>'category', 'other')::public.incident_category,
        COALESCE((v_action->>'is_sirs_reportable')::BOOLEAN, false),
        true,
        (v_action->>'confidence')::NUMERIC,
        p_debrief_id
      ) RETURNING id INTO v_incident_id;

      v_inserted_ids := v_inserted_ids || jsonb_build_object(
        'type', 'incident', 'id', v_incident_id
      );

    ELSIF v_action_type = 'goal_progress' THEN
      INSERT INTO public.shift_goal_linkages (
        organization_id, goal_id, worker_id, participant_id,
        progress_rating, worker_observation,
        ai_generated, confidence_score, source_debrief_id
      ) VALUES (
        p_org_id,
        (v_action->>'goal_id')::UUID,
        p_worker_id,
        (v_action->>'participant_id')::UUID,
        COALESCE(v_action->>'progress_rating', 'MAINTAINED')::public.progress_rating,
        v_action->>'observation',
        true,
        (v_action->>'confidence')::NUMERIC,
        p_debrief_id
      ) RETURNING id INTO v_goal_id;

      v_inserted_ids := v_inserted_ids || jsonb_build_object(
        'type', 'goal_progress', 'id', v_goal_id
      );

    END IF;
  END LOOP;

  -- Mark debrief as committed
  UPDATE public.audio_debriefs
  SET status = 'COMMITTED',
      committed_actions = p_actions,
      committed_at = NOW(),
      reviewed_by = p_worker_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_debrief_id AND organization_id = p_org_id;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted_ids,
    'count', jsonb_array_length(v_inserted_ids)
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 6: Storage bucket for audio debriefs
-- ═══════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-debriefs', 'audio-debriefs', false, 52428800,
  ARRAY['audio/mp4', 'audio/m4a', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/aac']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vision-frames', 'vision-frames', false, 20971520,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;
