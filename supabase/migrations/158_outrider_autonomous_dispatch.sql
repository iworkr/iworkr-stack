-- ============================================================
-- Migration 158: Project Outrider-Autonomous — Self-Healing
--   Roster & Agentic Dispatch Engine
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART 1: ENUMs
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anomaly_type') THEN
    CREATE TYPE public.anomaly_type AS ENUM (
      'VEHICLE_BREAKDOWN', 'MEDICAL_EMERGENCY', 'JOB_OVERRUN',
      'TRAFFIC_SEVERE', 'NO_SHOW', 'WEATHER_EMERGENCY'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anomaly_status') THEN
    CREATE TYPE public.anomaly_status AS ENUM (
      'DETECTED', 'ANALYZING_SPATIAL', 'EXECUTING_ARBITRATION',
      'NEGOTIATING_CLIENT', 'RESOLVED', 'MANUAL_OVERRIDE', 'FAILED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'negotiation_status') THEN
    CREATE TYPE public.negotiation_status AS ENUM (
      'SMS_DISPATCHED', 'AWAITING_CLIENT', 'NEGOTIATING',
      'SUCCESSFULLY_MOVED', 'FAILED_ESCALATED', 'CANCELLED'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Fleet Anomalies (The Chaos Ledger)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fleet_anomalies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id           UUID NOT NULL REFERENCES public.profiles(id),
  worker_name         TEXT,
  anomaly_type        public.anomaly_type NOT NULL,
  delay_minutes       INT NOT NULL DEFAULT 0,
  reported_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  impacted_job_ids    UUID[] DEFAULT '{}',
  impacted_job_count  INT DEFAULT 0,
  resolved_job_ids    UUID[] DEFAULT '{}',
  arbitration_log     JSONB DEFAULT '[]',
  status              public.anomaly_status NOT NULL DEFAULT 'DETECTED',
  resolved_at         TIMESTAMPTZ,
  resolved_by         VARCHAR(50),
  autopilot_active    BOOLEAN DEFAULT true,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fleet_anomalies_org
  ON public.fleet_anomalies(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fleet_anomalies_status
  ON public.fleet_anomalies(organization_id, status)
  WHERE status NOT IN ('RESOLVED', 'FAILED');
CREATE INDEX IF NOT EXISTS idx_fleet_anomalies_worker
  ON public.fleet_anomalies(worker_id);

ALTER TABLE public.fleet_anomalies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_anomalies"
  ON public.fleet_anomalies FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_anomalies"
  ON public.fleet_anomalies FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Autonomous Negotiations (SMS State Machine)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.autonomous_negotiations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anomaly_id            UUID NOT NULL REFERENCES public.fleet_anomalies(id) ON DELETE CASCADE,
  job_id                UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_id             UUID,
  client_name           TEXT,
  client_phone          TEXT,
  twilio_thread_id      VARCHAR(100),
  agent_context         JSONB DEFAULT '{}',
  conversation_history  JSONB DEFAULT '[]',
  turn_count            INT DEFAULT 0,
  max_turns             INT DEFAULT 3,
  client_sentiment      NUMERIC(3,2) DEFAULT 0.50,
  original_datetime     TIMESTAMPTZ,
  proposed_datetime     TIMESTAMPTZ,
  accepted_datetime     TIMESTAMPTZ,
  status                public.negotiation_status NOT NULL DEFAULT 'SMS_DISPATCHED',
  escalation_reason     TEXT,
  llm_model_used        VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_negotiations_org
  ON public.autonomous_negotiations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_negotiations_anomaly
  ON public.autonomous_negotiations(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_twilio
  ON public.autonomous_negotiations(twilio_thread_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_status
  ON public.autonomous_negotiations(organization_id, status)
  WHERE status IN ('AWAITING_CLIENT', 'NEGOTIATING');

ALTER TABLE public.autonomous_negotiations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_negotiations"
  ON public.autonomous_negotiations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_negotiations"
  ON public.autonomous_negotiations FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 4: Arbitration Event Log (Terminal Feed)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.arbitration_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anomaly_id        UUID REFERENCES public.fleet_anomalies(id) ON DELETE CASCADE,
  event_type        VARCHAR(50) NOT NULL,
  severity          VARCHAR(20) DEFAULT 'info',
  message           TEXT NOT NULL,
  job_id            UUID,
  worker_id         UUID,
  target_worker_id  UUID,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arb_events_org
  ON public.arbitration_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arb_events_anomaly
  ON public.arbitration_events(anomaly_id);

ALTER TABLE public.arbitration_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_arb_events"
  ON public.arbitration_events FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_arb_events"
  ON public.arbitration_events FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 5: Autopilot config on organizations
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopilot_max_radius_km INT DEFAULT 15,
  ADD COLUMN IF NOT EXISTS autopilot_care_mode BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopilot_halted_at TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════
-- PART 6: Spatial Arbitration RPC
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.find_eligible_workers_spatial(
  p_org_id          UUID,
  p_excluded_worker UUID,
  p_job_lat         DOUBLE PRECISION,
  p_job_lng         DOUBLE PRECISION,
  p_radius_meters   INT DEFAULT 15000,
  p_required_skills TEXT[] DEFAULT '{}',
  p_job_start       TIMESTAMPTZ DEFAULT NOW(),
  p_job_end         TIMESTAMPTZ DEFAULT NOW() + INTERVAL '2 hours',
  p_care_mode       BOOLEAN DEFAULT false,
  p_participant_id  UUID DEFAULT NULL
)
RETURNS TABLE (
  worker_id         UUID,
  worker_name       TEXT,
  distance_meters   DOUBLE PRECISION,
  skills            TEXT[],
  available_from    TIMESTAMPTZ,
  available_until   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH worker_positions AS (
    SELECT
      fp.user_id AS w_id,
      p.full_name AS w_name,
      om.skills AS w_skills,
      ST_DistanceSphere(
        ST_MakePoint(fp.lng, fp.lat),
        ST_MakePoint(p_job_lng, p_job_lat)
      ) AS dist_m
    FROM public.fleet_positions fp
    JOIN public.profiles p ON p.id = fp.user_id
    JOIN public.organization_members om ON om.user_id = fp.user_id AND om.organization_id = p_org_id
    WHERE fp.organization_id = p_org_id
      AND fp.user_id != p_excluded_worker
      AND ST_DWithin(
        ST_MakePoint(fp.lng, fp.lat)::geography,
        ST_MakePoint(p_job_lng, p_job_lat)::geography,
        p_radius_meters
      )
  ),
  skill_filtered AS (
    SELECT wp.*
    FROM worker_positions wp
    WHERE (
      array_length(p_required_skills, 1) IS NULL
      OR wp.w_skills @> p_required_skills
    )
  ),
  temporal_available AS (
    SELECT
      sf.w_id,
      sf.w_name,
      sf.dist_m,
      sf.w_skills,
      COALESCE(
        (SELECT MAX(sb.end_time)
         FROM public.schedule_blocks sb
         WHERE sb.technician_id = sf.w_id
           AND sb.organization_id = p_org_id
           AND sb.status NOT IN ('cancelled')
           AND sb.end_time <= p_job_start
           AND sb.start_time >= p_job_start - INTERVAL '12 hours'
        ),
        p_job_start - INTERVAL '1 hour'
      ) AS avail_from,
      COALESCE(
        (SELECT MIN(sb.start_time)
         FROM public.schedule_blocks sb
         WHERE sb.technician_id = sf.w_id
           AND sb.organization_id = p_org_id
           AND sb.status NOT IN ('cancelled')
           AND sb.start_time >= p_job_end
           AND sb.start_time <= p_job_end + INTERVAL '12 hours'
        ),
        p_job_end + INTERVAL '4 hours'
      ) AS avail_until
    FROM skill_filtered sf
    WHERE NOT EXISTS (
      SELECT 1 FROM public.schedule_blocks sb
      WHERE sb.technician_id = sf.w_id
        AND sb.organization_id = p_org_id
        AND sb.status NOT IN ('cancelled')
        AND sb.start_time < p_job_end
        AND sb.end_time > p_job_start
    )
  )
  SELECT
    ta.w_id,
    ta.w_name,
    ta.dist_m,
    ta.w_skills,
    ta.avail_from,
    ta.avail_until
  FROM temporal_available ta
  ORDER BY ta.dist_m ASC
  LIMIT 10;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 7: Blast Radius Calculator RPC
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calculate_blast_radius(
  p_org_id        UUID,
  p_worker_id     UUID,
  p_delay_minutes INT,
  p_from_time     TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  job_id          UUID,
  job_title       TEXT,
  client_name     TEXT,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  new_eta         TIMESTAMPTZ,
  delay_overflow  INT,
  location        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sb.job_id,
    sb.title,
    sb.client_name,
    sb.start_time,
    sb.end_time,
    sb.start_time + (p_delay_minutes || ' minutes')::INTERVAL AS new_eta,
    GREATEST(0, EXTRACT(EPOCH FROM (
      (sb.start_time + (p_delay_minutes || ' minutes')::INTERVAL) - sb.start_time
    ))::INT / 60) AS delay_overflow,
    sb.location
  FROM public.schedule_blocks sb
  WHERE sb.technician_id = p_worker_id
    AND sb.organization_id = p_org_id
    AND sb.start_time >= p_from_time
    AND sb.start_time <= p_from_time + INTERVAL '24 hours'
    AND sb.status NOT IN ('cancelled', 'complete')
  ORDER BY sb.start_time ASC;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 8: Enable Realtime on key tables
-- ═══════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.fleet_anomalies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.arbitration_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.autonomous_negotiations;
