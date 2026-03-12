-- ============================================================================
-- Migration 075: Sentinel Alerts (Project Nightingale Phase 4)
-- Automated risk detection and active compliance monitoring.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Enums ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sentinel_severity') THEN
    CREATE TYPE public.sentinel_severity AS ENUM ('info', 'warning', 'critical');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sentinel_status') THEN
    CREATE TYPE public.sentinel_status AS ENUM (
      'active', 'acknowledged', 'escalated', 'dismissed', 'resolved'
    );
  END IF;
END $$;

-- ─── 2. Sentinel Alerts Table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sentinel_alerts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  alert_type            text NOT NULL CHECK (alert_type IN (
    'progress_note_keywords',
    'health_baseline_deviation',
    'medication_non_compliance',
    'credential_expiry_escalation',
    'budget_overrun',
    'care_plan_review_due',
    'restrictive_practice_debrief_overdue'
  )),
  severity              public.sentinel_severity NOT NULL DEFAULT 'warning',
  status                public.sentinel_status NOT NULL DEFAULT 'active',
  title                 text NOT NULL,
  description           text NOT NULL,
  participant_id        uuid REFERENCES public.participant_profiles ON DELETE SET NULL,
  worker_id             uuid REFERENCES public.profiles ON DELETE SET NULL,
  shift_id              uuid REFERENCES public.jobs ON DELETE SET NULL,
  source_table          text,                                  -- 'progress_notes', 'health_observations', etc.
  source_id             uuid,                                  -- ID of the triggering record
  triggered_keywords    text[] DEFAULT '{}',                   -- for NLP alerts
  acknowledged_by       uuid REFERENCES public.profiles ON DELETE SET NULL,
  acknowledged_at       timestamptz,
  resolution_action     text,                                  -- 'incident_created', 'dismissed_false_positive', etc.
  resolution_notes      text,
  resolved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_org_status
  ON public.sentinel_alerts (organization_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sentinel_participant
  ON public.sentinel_alerts (participant_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_severity
  ON public.sentinel_alerts (severity)
  WHERE severity = 'critical';
CREATE INDEX IF NOT EXISTS idx_sentinel_type
  ON public.sentinel_alerts (organization_id, alert_type);
CREATE INDEX IF NOT EXISTS idx_sentinel_created
  ON public.sentinel_alerts (created_at DESC);

-- ─── 3. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.sentinel_alerts ENABLE ROW LEVEL SECURITY;

-- ─── 4. RLS Policies ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentinel_alerts' AND policyname = 'Org members can view sentinel alerts') THEN
    CREATE POLICY "Org members can view sentinel alerts"
      ON public.sentinel_alerts FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentinel_alerts' AND policyname = 'Admins can manage sentinel alerts') THEN
    CREATE POLICY "Admins can manage sentinel alerts"
      ON public.sentinel_alerts FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = sentinel_alerts.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- ─── 5. Sentinel: High-risk keywords for progress note scanning ──────────
-- Stored as a configurable table so orgs can customize their keyword list.

CREATE TABLE IF NOT EXISTS public.sentinel_keywords (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid REFERENCES public.organizations ON DELETE CASCADE,
  keyword               text NOT NULL,
  severity              public.sentinel_severity DEFAULT 'critical',
  category              text DEFAULT 'general',                -- 'injury', 'medication', 'behavior', 'emergency'
  is_system_default     boolean DEFAULT false,                 -- true = global defaults
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_keywords_org
  ON public.sentinel_keywords (organization_id);

ALTER TABLE public.sentinel_keywords ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentinel_keywords' AND policyname = 'Org members can view sentinel keywords') THEN
    CREATE POLICY "Org members can view sentinel keywords"
      ON public.sentinel_keywords FOR SELECT
      USING (
        is_system_default = true
        OR organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sentinel_keywords' AND policyname = 'Admins can manage sentinel keywords') THEN
    CREATE POLICY "Admins can manage sentinel keywords"
      ON public.sentinel_keywords FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = sentinel_keywords.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- ─── 6. Seed default high-risk keywords ──────────────────────────────────

INSERT INTO public.sentinel_keywords (organization_id, keyword, severity, category, is_system_default)
VALUES
  (NULL, 'bruise', 'critical', 'injury', true),
  (NULL, 'bruising', 'critical', 'injury', true),
  (NULL, 'hit', 'critical', 'behavior', true),
  (NULL, 'slap', 'critical', 'behavior', true),
  (NULL, 'punch', 'critical', 'behavior', true),
  (NULL, 'kick', 'critical', 'behavior', true),
  (NULL, 'scratch', 'warning', 'injury', true),
  (NULL, 'bite', 'critical', 'injury', true),
  (NULL, 'fall', 'critical', 'injury', true),
  (NULL, 'fell', 'critical', 'injury', true),
  (NULL, 'trip', 'warning', 'injury', true),
  (NULL, 'refused medication', 'critical', 'medication', true),
  (NULL, 'missed medication', 'critical', 'medication', true),
  (NULL, 'wrong medication', 'critical', 'medication', true),
  (NULL, 'police', 'critical', 'emergency', true),
  (NULL, 'ambulance', 'critical', 'emergency', true),
  (NULL, 'hospital', 'critical', 'emergency', true),
  (NULL, 'emergency', 'critical', 'emergency', true),
  (NULL, 'absconded', 'critical', 'behavior', true),
  (NULL, 'missing', 'critical', 'emergency', true),
  (NULL, 'aggressive', 'warning', 'behavior', true),
  (NULL, 'agitation', 'warning', 'behavior', true),
  (NULL, 'self-harm', 'critical', 'behavior', true),
  (NULL, 'suicidal', 'critical', 'emergency', true),
  (NULL, 'restraint', 'critical', 'behavior', true),
  (NULL, 'seclusion', 'critical', 'behavior', true),
  (NULL, 'choking', 'critical', 'emergency', true),
  (NULL, 'seizure', 'critical', 'emergency', true),
  (NULL, 'unconscious', 'critical', 'emergency', true),
  (NULL, 'wound', 'warning', 'injury', true),
  (NULL, 'bleeding', 'critical', 'injury', true),
  (NULL, 'burn', 'critical', 'injury', true),
  (NULL, 'abuse', 'critical', 'behavior', true),
  (NULL, 'neglect', 'critical', 'behavior', true)
ON CONFLICT DO NOTHING;

-- ─── 7. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.sentinel_alerts IS
  'Automated risk alerts from NLP keyword scanning, health trend deviations, medication non-compliance, and credential expiry escalation.';
COMMENT ON TABLE public.sentinel_keywords IS
  'Configurable high-risk keyword list for progress note NLP scanning. Includes system defaults and org-specific customizations.';
