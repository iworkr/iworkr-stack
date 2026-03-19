-- ============================================================
-- Migration 141: Project Aegis-SIRS — Serious Incident Response
-- Version 143.0 — "Statutory Determinism & Liability Sanitization"
-- ============================================================

-- ── 1. ENUMs ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.incident_severity AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.incident_category AS ENUM (
    'INJURY','ABUSE','NEGLECT','UNAUTHORIZED_RESTRICTIVE_PRACTICE',
    'PROPERTY_DAMAGE','MEDICATION_ERROR','MISSING_PERSON','DEATH','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sirs_priority AS ENUM ('P1_24HR','P2_5DAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sirs_submission_status AS ENUM (
    'PENDING_TRIAGE','IN_SANITIZATION','READY_FOR_EXPORT',
    'SUBMITTED_TO_COMMISSION','COMMISSION_ACKNOWLEDGED','CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Incident Reports (Core Table) ────────────────────────
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Who & Where
  reported_by           UUID REFERENCES public.profiles(id),
  participant_id        UUID REFERENCES public.participant_profiles(id),
  client_id             UUID REFERENCES public.clients(id),
  location              TEXT,
  -- What happened
  title                 VARCHAR NOT NULL,
  description           TEXT NOT NULL,
  severity              public.incident_severity NOT NULL DEFAULT 'medium',
  category              public.incident_category NOT NULL DEFAULT 'other',
  injuries_observed     TEXT,
  witnesses             JSONB DEFAULT '[]',
  -- SIRS auto-calculated fields (populated by trigger)
  is_sirs_reportable    BOOLEAN DEFAULT false,
  sirs_priority         public.sirs_priority,
  statutory_deadline    TIMESTAMPTZ,
  -- Escalation tracking
  escalation_12h_sent   BOOLEAN DEFAULT false,
  escalation_4h_sent    BOOLEAN DEFAULT false,
  escalation_1h_sent    BOOLEAN DEFAULT false,
  -- Status
  status                VARCHAR DEFAULT 'OPEN',
  resolved_at           TIMESTAMPTZ,
  resolution_notes      TEXT,
  -- Metadata
  device_timestamp      TIMESTAMPTZ,
  attachments           JSONB DEFAULT '[]',
  metadata              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage incidents" ON public.incident_reports FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX IF NOT EXISTS idx_incidents_org ON public.incident_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_incidents_sirs ON public.incident_reports(organization_id, is_sirs_reportable, statutory_deadline);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incident_reports(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_deadline ON public.incident_reports(statutory_deadline) WHERE is_sirs_reportable = true;

-- ── 3. SIRS Submissions (Legal Vault) ───────────────────────
CREATE TABLE IF NOT EXISTS public.sirs_submissions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id             UUID NOT NULL UNIQUE REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  compliance_officer_id   UUID REFERENCES public.profiles(id),
  -- Raw vs Sanitized
  raw_worker_notes        TEXT NOT NULL,
  ai_sanitized_draft      TEXT,
  final_commission_notes  TEXT,
  -- Statutory fields
  immediate_actions_taken TEXT,
  police_notified         BOOLEAN DEFAULT false,
  police_reference_number VARCHAR,
  family_notified         BOOLEAN DEFAULT false,
  family_notification_details TEXT,
  -- Participant details snapshot
  participant_ndis_number VARCHAR,
  participant_name        VARCHAR,
  participant_dob         DATE,
  -- Worker details snapshot
  worker_name             VARCHAR,
  worker_role             VARCHAR,
  -- Timeline
  incident_datetime       TIMESTAMPTZ,
  reported_datetime       TIMESTAMPTZ,
  -- Status
  status                  public.sirs_submission_status DEFAULT 'PENDING_TRIAGE',
  ndis_sirs_reference     VARCHAR,
  submitted_at            TIMESTAMPTZ,
  acknowledged_at         TIMESTAMPTZ,
  -- AI metadata
  sanitization_model      VARCHAR,
  sanitization_prompt_version VARCHAR,
  sanitization_ran_at     TIMESTAMPTZ,
  -- Export
  export_json             JSONB,
  export_pdf_url          TEXT,
  -- Audit
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sirs_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage sirs submissions" ON public.sirs_submissions FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

CREATE INDEX IF NOT EXISTS idx_sirs_sub_org ON public.sirs_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sirs_sub_incident ON public.sirs_submissions(incident_id);
CREATE INDEX IF NOT EXISTS idx_sirs_sub_status ON public.sirs_submissions(organization_id, status);

-- ── 4. SIRS Escalation Log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sirs_escalation_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id           UUID NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  escalation_type       VARCHAR NOT NULL, -- '12H_PUSH', '4H_SMS', '1H_EMERGENCY'
  recipient_id          UUID REFERENCES public.profiles(id),
  recipient_contact     TEXT,
  channel               VARCHAR NOT NULL, -- 'FCM', 'SMS', 'EMAIL'
  message               TEXT,
  sent_at               TIMESTAMPTZ DEFAULT now(),
  delivered             BOOLEAN DEFAULT false,
  error                 TEXT
);

ALTER TABLE public.sirs_escalation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view escalation log" ON public.sirs_escalation_log FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 5. Trigger: Auto-calculate SIRS criteria on INSERT/UPDATE ─
CREATE OR REPLACE FUNCTION public.evaluate_sirs_criteria()
RETURNS TRIGGER AS $$
BEGIN
  -- Priority 1: CRITICAL severity OR specific abuse/neglect categories
  IF NEW.severity = 'critical'
     OR NEW.category IN ('abuse_allegation', 'neglect', 'restrictive_practice', 'death') THEN
    NEW.is_sirs_reportable := TRUE;
    NEW.sirs_priority := 'P1_24HR';
    -- Clock starts when the server receives the row
    IF NEW.statutory_deadline IS NULL THEN
      NEW.statutory_deadline := COALESCE(NEW.created_at, now()) + INTERVAL '24 hours';
    END IF;

  -- Priority 2: HIGH severity
  ELSIF NEW.severity = 'high' THEN
    NEW.is_sirs_reportable := TRUE;
    NEW.sirs_priority := 'P2_5DAY';
    IF NEW.statutory_deadline IS NULL THEN
      NEW.statutory_deadline := COALESCE(NEW.created_at, now()) + INTERVAL '5 days';
    END IF;

  -- Not SIRS reportable
  ELSE
    NEW.is_sirs_reportable := FALSE;
    NEW.sirs_priority := NULL;
    NEW.statutory_deadline := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evaluate_sirs ON public.incident_reports;
CREATE TRIGGER trg_evaluate_sirs
  BEFORE INSERT OR UPDATE OF severity, category
  ON public.incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluate_sirs_criteria();

-- ── 6. Trigger: Auto-create SIRS submission on reportable incident ─
CREATE OR REPLACE FUNCTION public.auto_create_sirs_submission()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_sirs_reportable = TRUE THEN
    INSERT INTO public.sirs_submissions (
      incident_id, organization_id, raw_worker_notes,
      incident_datetime, reported_datetime, status
    ) VALUES (
      NEW.id, NEW.organization_id, NEW.description,
      COALESCE(NEW.device_timestamp, NEW.created_at),
      NEW.created_at,
      'PENDING_TRIAGE'
    )
    ON CONFLICT (incident_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_sirs_submission ON public.incident_reports;
CREATE TRIGGER trg_auto_sirs_submission
  AFTER INSERT OR UPDATE OF is_sirs_reportable
  ON public.incident_reports
  FOR EACH ROW
  WHEN (NEW.is_sirs_reportable = TRUE)
  EXECUTE FUNCTION public.auto_create_sirs_submission();

-- ── 7. RPC: Get SIRS triage dashboard data ──────────────────
CREATE OR REPLACE FUNCTION public.get_sirs_triage_data(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_reportable INT;
  v_pending_triage INT;
  v_in_sanitization INT;
  v_ready_export INT;
  v_submitted INT;
  v_breached INT;
  v_critical_4h INT;
  v_p1_count INT;
  v_p2_count INT;
BEGIN
  SELECT COUNT(*) INTO v_total_reportable
  FROM public.incident_reports
  WHERE organization_id = p_org_id AND is_sirs_reportable = true;

  SELECT COUNT(*) INTO v_pending_triage
  FROM public.sirs_submissions
  WHERE organization_id = p_org_id AND status = 'PENDING_TRIAGE';

  SELECT COUNT(*) INTO v_in_sanitization
  FROM public.sirs_submissions
  WHERE organization_id = p_org_id AND status = 'IN_SANITIZATION';

  SELECT COUNT(*) INTO v_ready_export
  FROM public.sirs_submissions
  WHERE organization_id = p_org_id AND status = 'READY_FOR_EXPORT';

  SELECT COUNT(*) INTO v_submitted
  FROM public.sirs_submissions
  WHERE organization_id = p_org_id AND status IN ('SUBMITTED_TO_COMMISSION', 'COMMISSION_ACKNOWLEDGED', 'CLOSED');

  -- Breached = deadline has passed and not yet submitted
  SELECT COUNT(*) INTO v_breached
  FROM public.incident_reports ir
  JOIN public.sirs_submissions ss ON ss.incident_id = ir.id
  WHERE ir.organization_id = p_org_id
    AND ir.is_sirs_reportable = true
    AND ir.statutory_deadline < now()
    AND ss.status NOT IN ('SUBMITTED_TO_COMMISSION', 'COMMISSION_ACKNOWLEDGED', 'CLOSED');

  -- Critical 4h = within 4 hours of deadline
  SELECT COUNT(*) INTO v_critical_4h
  FROM public.incident_reports ir
  JOIN public.sirs_submissions ss ON ss.incident_id = ir.id
  WHERE ir.organization_id = p_org_id
    AND ir.is_sirs_reportable = true
    AND ir.statutory_deadline > now()
    AND ir.statutory_deadline <= now() + INTERVAL '4 hours'
    AND ss.status NOT IN ('SUBMITTED_TO_COMMISSION', 'COMMISSION_ACKNOWLEDGED', 'CLOSED');

  SELECT COUNT(*) INTO v_p1_count
  FROM public.incident_reports
  WHERE organization_id = p_org_id AND sirs_priority = 'P1_24HR'
    AND is_sirs_reportable = true;

  SELECT COUNT(*) INTO v_p2_count
  FROM public.incident_reports
  WHERE organization_id = p_org_id AND sirs_priority = 'P2_5DAY'
    AND is_sirs_reportable = true;

  RETURN json_build_object(
    'total_reportable', v_total_reportable,
    'pending_triage', v_pending_triage,
    'in_sanitization', v_in_sanitization,
    'ready_for_export', v_ready_export,
    'submitted', v_submitted,
    'breached', v_breached,
    'critical_4h', v_critical_4h,
    'p1_count', v_p1_count,
    'p2_count', v_p2_count
  );
END;
$$;

-- ── 8. Realtime ──────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.incident_reports;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sirs_submissions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
