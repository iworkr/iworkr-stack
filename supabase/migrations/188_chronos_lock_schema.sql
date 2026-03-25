-- ============================================================================
-- @migration ChronosLock
-- @status COMPLETE
-- @description Project Chronos-Lock: Geofenced Time & Attendance engine.
--   Adds PostGIS spatial columns to time_entries, creates timesheet_anomalies
--   ledger, and server-side distance verification RPC.
-- @tables time_entries (ALTER), timesheet_anomalies (NEW)
-- @lastAudit 2026-03-24
-- ============================================================================

-- ─── 0. Ensure PostGIS ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── 1. Spatial Columns on time_entries ──────────────────────────────────────

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS clock_in_geo GEOGRAPHY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS clock_out_geo GEOGRAPHY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS clock_in_distance_meters INTEGER,
  ADD COLUMN IF NOT EXISTS clock_out_distance_meters INTEGER,
  ADD COLUMN IF NOT EXISTS is_spatial_violation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_clock_offset_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS server_verified_distance INTEGER;

CREATE INDEX IF NOT EXISTS idx_time_entries_spatial_violation
  ON public.time_entries (organization_id, is_spatial_violation) WHERE is_spatial_violation = true;

-- ─── 2. Anomaly Enums ───────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anomaly_status_enum') THEN
    CREATE TYPE public.anomaly_status_enum AS ENUM (
      'PENDING', 'APPROVED', 'REJECTED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anomaly_type_enum') THEN
    CREATE TYPE public.anomaly_type_enum AS ENUM (
      'GEOFENCE_BREACH', 'GPS_UNAVAILABLE', 'TEMPORAL_SPOOFING', 'MOCK_LOCATION'
    );
  END IF;
END $$;

-- ─── 3. Timesheet Anomalies Table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.timesheet_anomalies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  time_entry_id         UUID REFERENCES public.time_entries(id) ON DELETE CASCADE,
  timesheet_id          UUID REFERENCES public.timesheets(id) ON DELETE SET NULL,
  worker_id             UUID NOT NULL REFERENCES public.profiles(id),
  job_id                UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  shift_id              UUID,

  anomaly_type          public.anomaly_type_enum NOT NULL,
  recorded_distance_meters INTEGER,
  recorded_location     GEOGRAPHY(POINT, 4326),
  job_location          GEOGRAPHY(POINT, 4326),
  worker_justification  TEXT,
  device_accuracy_meters REAL,

  status                public.anomaly_status_enum NOT NULL DEFAULT 'PENDING',
  resolved_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  resolution_notes      TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_org_pending
  ON public.timesheet_anomalies (organization_id, status) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_anomalies_worker
  ON public.timesheet_anomalies (worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_time_entry
  ON public.timesheet_anomalies (time_entry_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timesheet_anomalies_updated_at') THEN
    CREATE TRIGGER set_timesheet_anomalies_updated_at
      BEFORE UPDATE ON public.timesheet_anomalies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 4. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.timesheet_anomalies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'timesheet_anomalies' AND policyname = 'Org members can view anomalies') THEN
    CREATE POLICY "Org members can view anomalies"
      ON public.timesheet_anomalies FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'timesheet_anomalies' AND policyname = 'Admins can manage anomalies') THEN
    CREATE POLICY "Admins can manage anomalies"
      ON public.timesheet_anomalies FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = timesheet_anomalies.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 5. Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.timesheet_anomalies;

-- ─── 6. Server-Side Distance Verification RPC ───────────────────────────────

CREATE OR REPLACE FUNCTION public.verify_clock_distance(
  p_job_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_job_lat DOUBLE PRECISION;
  v_job_lng DOUBLE PRECISION;
  v_distance INTEGER;
BEGIN
  SELECT
    COALESCE(site_lat::double precision, location_lat),
    COALESCE(site_lng::double precision, location_lng)
  INTO v_job_lat, v_job_lng
  FROM public.jobs
  WHERE id = p_job_id;

  IF v_job_lat IS NULL OR v_job_lng IS NULL THEN
    RETURN -1;
  END IF;

  v_distance := ROUND(ST_Distance(
    ST_SetSRID(ST_MakePoint(v_job_lng, v_job_lat), 4326)::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  ));

  RETURN v_distance;
END;
$$;

-- ─── 7. Bulk Approve Clean Time Entries RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.bulk_approve_clean_timesheets(
  p_organization_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_count INTEGER;
  v_anomaly_count INTEGER;
BEGIN
  -- Approve timesheets where ALL time entries are spatially clean
  UPDATE public.timesheets
  SET status = 'approved',
      approved_by = auth.uid(),
      approved_at = now()
  WHERE organization_id = p_organization_id
    AND period_start >= p_period_start
    AND period_end <= p_period_end
    AND status = 'submitted'
    AND id NOT IN (
      SELECT DISTINCT te.timesheet_id
      FROM public.time_entries te
      WHERE te.organization_id = p_organization_id
        AND te.is_spatial_violation = true
        AND te.timesheet_id IS NOT NULL
    )
    AND id NOT IN (
      SELECT DISTINCT ta.timesheet_id
      FROM public.timesheet_anomalies ta
      WHERE ta.organization_id = p_organization_id
        AND ta.status = 'PENDING'
        AND ta.timesheet_id IS NOT NULL
    );

  GET DIAGNOSTICS v_clean_count = ROW_COUNT;

  SELECT COUNT(DISTINCT t.id) INTO v_anomaly_count
  FROM public.timesheets t
  WHERE t.organization_id = p_organization_id
    AND t.period_start >= p_period_start
    AND t.period_end <= p_period_end
    AND t.status = 'submitted'
    AND (
      t.id IN (
        SELECT DISTINCT te.timesheet_id
        FROM public.time_entries te
        WHERE te.is_spatial_violation = true AND te.timesheet_id IS NOT NULL
      )
      OR t.id IN (
        SELECT DISTINCT ta.timesheet_id
        FROM public.timesheet_anomalies ta
        WHERE ta.status = 'PENDING' AND ta.timesheet_id IS NOT NULL
      )
    );

  RETURN jsonb_build_object(
    'approved_count', v_clean_count,
    'quarantined_count', v_anomaly_count
  );
END;
$$;

-- ─── 8. Anomaly Stats RPC ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_anomaly_stats(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'pending', (SELECT COUNT(*) FROM public.timesheet_anomalies WHERE organization_id = p_organization_id AND status = 'PENDING'),
    'approved', (SELECT COUNT(*) FROM public.timesheet_anomalies WHERE organization_id = p_organization_id AND status = 'APPROVED'),
    'rejected', (SELECT COUNT(*) FROM public.timesheet_anomalies WHERE organization_id = p_organization_id AND status = 'REJECTED'),
    'total_breaches_7d', (SELECT COUNT(*) FROM public.timesheet_anomalies WHERE organization_id = p_organization_id AND created_at > now() - interval '7 days'),
    'avg_distance', (SELECT ROUND(AVG(recorded_distance_meters)) FROM public.timesheet_anomalies WHERE organization_id = p_organization_id AND recorded_distance_meters IS NOT NULL)
  );
END;
$$;

COMMENT ON TABLE public.timesheet_anomalies IS
  'Project Chronos-Lock: Geofence breach and temporal spoofing anomalies for dispatcher review.';
