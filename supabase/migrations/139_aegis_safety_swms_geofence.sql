-- ============================================================
-- Migration 139: Project Aegis-Safety — Dynamic SWMS,
-- Geofenced Compliance, Risk Matrix, Digital Signatures
-- Version 141.0 — "Impenetrable Compliance & Spatial Integrity"
-- ============================================================

-- ── 1. SWMS status enums ────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.swms_template_status AS ENUM ('DRAFT','PUBLISHED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.swms_record_status AS ENUM ('IN_PROGRESS','STOP_WORK_TRIGGERED','COMPLETED','SIGNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. SWMS Templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.swms_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  trade_category  TEXT,
  description     TEXT,
  status          public.swms_template_status DEFAULT 'DRAFT',
  default_hazards JSONB DEFAULT '[]',
  required_ppe    JSONB DEFAULT '[]',
  site_conditions JSONB DEFAULT '[]',
  version         INT DEFAULT 1,
  created_by      UUID REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.swms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage swms templates" ON public.swms_templates FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX IF NOT EXISTS idx_swms_tpl_org ON public.swms_templates(organization_id);

-- ── 3. Risk Matrices ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.risk_matrices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT DEFAULT '5x5 Standard',
  matrix_config   JSONB NOT NULL DEFAULT '{
    "likelihood": {"1":"Rare","2":"Unlikely","3":"Possible","4":"Likely","5":"Almost Certain"},
    "consequence": {"1":"Insignificant","2":"Minor","3":"Moderate","4":"Major","5":"Catastrophic"},
    "scoring": {"1-4":"LOW","5-12":"MEDIUM","13-19":"HIGH","20-25":"EXTREME"}
  }',
  is_default      BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.risk_matrices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage risk matrices" ON public.risk_matrices FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 4. Job SWMS Records (The Immutable Audit Trail) ────────
CREATE TABLE IF NOT EXISTS public.job_swms_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id                    UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  template_id               UUID REFERENCES public.swms_templates(id),
  worker_id                 UUID NOT NULL REFERENCES public.profiles(id),
  -- Geofence verification
  lat_lng_captured          geography(POINT, 4326),
  job_lat_lng               geography(POINT, 4326),
  distance_from_site_meters NUMERIC(10,2),
  geofence_passed           BOOLEAN DEFAULT false,
  -- PPE & site conditions
  ppe_confirmed             JSONB DEFAULT '[]',
  site_conditions_assessed  JSONB DEFAULT '{}',
  -- Hazard assessment
  assessed_hazards          JSONB DEFAULT '[]',
  initial_risk_scores       JSONB DEFAULT '[]',
  mitigations_applied       JSONB DEFAULT '[]',
  residual_risk_scores      JSONB DEFAULT '[]',
  final_risk_score          INT,
  highest_residual_risk     TEXT,
  stop_work_triggered       BOOLEAN DEFAULT false,
  stop_work_reason          TEXT,
  -- Status & audit
  status                    public.swms_record_status DEFAULT 'IN_PROGRESS',
  completed_at              TIMESTAMPTZ,
  pdf_url                   TEXT,
  pdf_storage_path          TEXT,
  public_access_token       TEXT DEFAULT encode(gen_random_bytes(24), 'hex'),
  -- Device info
  device_model              TEXT,
  device_os                 TEXT,
  app_version               TEXT,
  -- Audit
  notes                     TEXT,
  metadata                  JSONB DEFAULT '{}',
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.job_swms_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage swms records" ON public.job_swms_records FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));
CREATE INDEX IF NOT EXISTS idx_swms_rec_job ON public.job_swms_records(job_id);
CREATE INDEX IF NOT EXISTS idx_swms_rec_org ON public.job_swms_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_swms_rec_status ON public.job_swms_records(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_swms_rec_worker ON public.job_swms_records(worker_id);

-- ── 5. Digital Signatures ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_swms_signatures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id     UUID NOT NULL REFERENCES public.job_swms_records(id) ON DELETE CASCADE,
  worker_id     UUID NOT NULL REFERENCES public.profiles(id),
  worker_name   TEXT,
  signature_svg TEXT NOT NULL,
  signed_at     TIMESTAMPTZ DEFAULT now(),
  device_ip     TEXT,
  lat_lng       geography(POINT, 4326),
  metadata      JSONB DEFAULT '{}'
);

ALTER TABLE public.job_swms_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage swms signatures" ON public.job_swms_signatures FOR ALL
  USING (record_id IN (
    SELECT id FROM public.job_swms_records
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active')));
CREATE INDEX IF NOT EXISTS idx_swms_sig_record ON public.job_swms_signatures(record_id);

-- ── 6. Storage bucket for compliance vault ──────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('compliance-vault', 'compliance-vault', false, 52428800,
  ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;

-- ── 7. Add requires_swms column to jobs if not exists ───────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS requires_swms BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS site_lat NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS site_lng NUMERIC(10,7);

-- ── 8. RPC: Verify geofence distance ───────────────────────
CREATE OR REPLACE FUNCTION public.verify_swms_geofence(
  p_device_lat NUMERIC,
  p_device_lng NUMERIC,
  p_job_id UUID,
  p_max_distance_meters INT DEFAULT 200
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_device_point geography;
  v_job_point geography;
  v_distance NUMERIC;
  v_passed BOOLEAN;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Job not found');
  END IF;

  IF v_job.site_lat IS NULL OR v_job.site_lng IS NULL THEN
    RETURN json_build_object(
      'passed', true,
      'distance_meters', 0,
      'reason', 'Job has no GPS coordinates — geofence bypassed'
    );
  END IF;

  v_device_point := ST_SetSRID(ST_MakePoint(p_device_lng, p_device_lat), 4326)::geography;
  v_job_point := ST_SetSRID(ST_MakePoint(v_job.site_lng, v_job.site_lat), 4326)::geography;
  v_distance := ST_Distance(v_device_point, v_job_point);
  v_passed := v_distance <= p_max_distance_meters;

  RETURN json_build_object(
    'passed', v_passed,
    'distance_meters', ROUND(v_distance, 2),
    'max_allowed_meters', p_max_distance_meters,
    'device_lat', p_device_lat,
    'device_lng', p_device_lng,
    'job_lat', v_job.site_lat,
    'job_lng', v_job.site_lng,
    'job_id', p_job_id
  );
END;
$$;

-- ── 9. RPC: Calculate risk score ────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_risk_score(
  p_likelihood INT,
  p_consequence INT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_score INT;
  v_rating TEXT;
BEGIN
  v_score := p_likelihood * p_consequence;

  v_rating := CASE
    WHEN v_score >= 20 THEN 'EXTREME'
    WHEN v_score >= 13 THEN 'HIGH'
    WHEN v_score >= 5 THEN 'MEDIUM'
    ELSE 'LOW'
  END;

  RETURN json_build_object(
    'likelihood', p_likelihood,
    'consequence', p_consequence,
    'score', v_score,
    'rating', v_rating,
    'requires_stop_work', v_score >= 13,
    'color', CASE
      WHEN v_score >= 20 THEN 'rose'
      WHEN v_score >= 13 THEN 'amber'
      WHEN v_score >= 5 THEN 'yellow'
      ELSE 'emerald'
    END
  );
END;
$$;

-- ── 10. RPC: Compliance radar stats ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_safety_compliance_stats(
  p_org_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_active_jobs INT;
  v_jobs_with_swms INT;
  v_compliance_pct NUMERIC;
  v_stop_work_24h INT;
  v_pending_swms INT;
  v_signed_today INT;
BEGIN
  SELECT COUNT(*) INTO v_active_jobs
  FROM public.jobs
  WHERE organization_id = p_org_id
    AND status IN ('in_progress', 'en_route', 'on_site', 'scheduled');

  SELECT COUNT(DISTINCT j.id) INTO v_jobs_with_swms
  FROM public.jobs j
  JOIN public.job_swms_records r ON r.job_id = j.id
  WHERE j.organization_id = p_org_id
    AND j.status IN ('in_progress', 'en_route', 'on_site')
    AND r.status IN ('COMPLETED', 'SIGNED')
    AND r.created_at >= CURRENT_DATE;

  v_compliance_pct := CASE WHEN v_active_jobs > 0
    THEN ROUND((v_jobs_with_swms::NUMERIC / v_active_jobs) * 100, 1)
    ELSE 100 END;

  SELECT COUNT(*) INTO v_stop_work_24h
  FROM public.job_swms_records
  WHERE organization_id = p_org_id
    AND stop_work_triggered = true
    AND created_at >= now() - INTERVAL '24 hours';

  SELECT COUNT(*) INTO v_pending_swms
  FROM public.job_swms_records
  WHERE organization_id = p_org_id
    AND status = 'IN_PROGRESS';

  SELECT COUNT(*) INTO v_signed_today
  FROM public.job_swms_records
  WHERE organization_id = p_org_id
    AND status IN ('COMPLETED', 'SIGNED')
    AND created_at >= CURRENT_DATE;

  RETURN json_build_object(
    'active_jobs', v_active_jobs,
    'jobs_with_swms', v_jobs_with_swms,
    'compliance_percentage', v_compliance_pct,
    'stop_work_alerts_24h', v_stop_work_24h,
    'pending_assessments', v_pending_swms,
    'signed_today', v_signed_today
  );
END;
$$;

-- ── 11. Realtime ─────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_swms_records;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
