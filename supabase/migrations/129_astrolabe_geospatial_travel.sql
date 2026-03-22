-- ============================================================================
-- @migration AstrolabeGeospatialTravel
-- @status COMPLETE
-- @description Project Astrolabe — PostGIS spatial schema for GPS-verified NDIS travel claims
-- @tables travel_routes, travel_waypoints, travel_claims
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. PostGIS already enabled in migration 095; ensure it's present ─────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 2. Transit Type Enum ──────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transit_type') THEN
    CREATE TYPE public.transit_type AS ENUM (
      'PROVIDER_TRAVEL',      -- Worker driving between participants (billable to NDIS)
      'PARTICIPANT_TRANSPORT' -- Worker driving participant during shift
    );
  END IF;
END $$;

-- ── 3. Travel Claim Status Enum ───────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'travel_claim_status') THEN
    CREATE TYPE public.travel_claim_status AS ENUM (
      'PENDING_API',          -- Submitted, waiting for Google Maps verification
      'VERIFIED_CLEAN',       -- API check passed, duration within tolerance
      'FLAGGED_VARIANCE',     -- Actual time > API time + grace period (fraud risk)
      'APPROVED',             -- Finance manager approved
      'OVERRIDDEN',           -- Admin manually overrode API cap with justification
      'BILLED',               -- Injected into Ledger-Prime invoice
      'REJECTED'              -- Claim rejected
    );
  END IF;
END $$;

-- ── 4. MMM Zone Type Enum ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mmm_zone_class') THEN
    CREATE TYPE public.mmm_zone_class AS ENUM (
      'MMM1', -- Major city (max 30 min travel claim)
      'MMM2', -- Inner regional
      'MMM3', -- Outer regional
      'MMM4', -- Remote (max 60 min travel claim)
      'MMM5', -- Very remote (max 60 min travel claim)
      'MMM6', -- Migratory/maritime
      'MMM7'  -- Unknown
    );
  END IF;
END $$;

-- ── 5. MMM Zones Table (GeoJSON polygons for NDIS zoning caps) ───────────
CREATE TABLE IF NOT EXISTS public.mmm_zones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_class    public.mmm_zone_class NOT NULL,
  zone_name     TEXT,
  geom          GEOGRAPHY(MULTIPOLYGON, 4326) NOT NULL,
  max_travel_minutes INT NOT NULL DEFAULT 30,  -- NDIS cap for this zone
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index for fast point-in-polygon lookups
CREATE INDEX IF NOT EXISTS idx_mmm_zones_geom ON public.mmm_zones USING GIST(geom);

-- Seed with simplified Australian metro/regional boundaries for MMM1 vs MMM4+
-- Real GeoJSON boundaries should be loaded from AIHW MMM 2019 dataset
-- These are representative bounding polygons for major capitals (MMM1)
-- and a national catch-all for rural areas (MMM4+)
INSERT INTO public.mmm_zones (zone_class, zone_name, max_travel_minutes, geom) VALUES
-- Sydney metropolitan
('MMM1', 'Sydney Metro', 30,
  ST_GeographyFromText('SRID=4326;MULTIPOLYGON(((150.5 -34.2, 151.4 -34.2, 151.4 -33.4, 150.5 -33.4, 150.5 -34.2)))')),
-- Melbourne metropolitan
('MMM1', 'Melbourne Metro', 30,
  ST_GeographyFromText('SRID=4326;MULTIPOLYGON(((144.5 -38.2, 145.4 -38.2, 145.4 -37.5, 144.5 -37.5, 144.5 -38.2)))')),
-- Brisbane metropolitan
('MMM1', 'Brisbane Metro', 30,
  ST_GeographyFromText('SRID=4326;MULTIPOLYGON(((152.7 -27.7, 153.3 -27.7, 153.3 -27.2, 152.7 -27.2, 152.7 -27.7)))')),
-- Perth metropolitan
('MMM1', 'Perth Metro', 30,
  ST_GeographyFromText('SRID=4326;MULTIPOLYGON(((115.6 -32.3, 116.2 -32.3, 116.2 -31.6, 115.6 -31.6, 115.6 -32.3)))')),
-- Adelaide metropolitan
('MMM1', 'Adelaide Metro', 30,
  ST_GeographyFromText('SRID=4326;MULTIPOLYGON(((138.4 -35.2, 138.9 -35.2, 138.9 -34.7, 138.4 -34.7, 138.4 -35.2)))')),
-- Canberra metropolitan
('MMM1', 'Canberra Metro', 30,
  ST_GeographyFromText('SRID=4326;MULTIPOLYGON(((149.0 -35.5, 149.3 -35.5, 149.3 -35.1, 149.0 -35.1, 149.0 -35.5)))')),
-- Regional/remote fallback (entire Australia minus capital zones = MMM4)
('MMM4', 'Regional Australia', 60,
  ST_GeographyFromText('SRID=4326;MULTIPOLYGON(((112.0 -44.0, 154.0 -44.0, 154.0 -10.0, 112.0 -10.0, 112.0 -44.0)))'))
ON CONFLICT DO NOTHING;

-- ── 6. Raw GPS Travel Log (the PostGIS spatial truth) ─────────────────────
CREATE TABLE IF NOT EXISTS public.travel_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transit_type            public.transit_type NOT NULL DEFAULT 'PROVIDER_TRAVEL',
  origin_shift_id         UUID REFERENCES public.schedule_blocks(id),
  destination_shift_id    UUID REFERENCES public.schedule_blocks(id),
  -- ── Spatial columns (SRID 4326 = WGS 84 — standard GPS datum) ──
  start_geom              GEOGRAPHY(POINT, 4326) NOT NULL,
  end_geom                GEOGRAPHY(POINT, 4326),          -- null if still in transit
  -- ── Device timestamps (raw from device — may include stops) ──
  device_start_time       TIMESTAMPTZ NOT NULL,
  device_end_time         TIMESTAMPTZ,
  actual_duration_seconds INT GENERATED ALWAYS AS (
    CASE WHEN device_end_time IS NOT NULL
         THEN EXTRACT(EPOCH FROM (device_end_time - device_start_time))::INT
         ELSE NULL
    END
  ) STORED,
  -- ── Participant transport polyline (breadcrumb trail) ──
  -- Only populated for PARTICIPANT_TRANSPORT (not Provider Travel — privacy)
  route_polyline          TEXT,         -- encoded polyline string
  -- ── Metadata ──
  device_os               TEXT,
  app_version             TEXT,
  raw_payload             JSONB,        -- full device submission for audit
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_travel_logs_start_geom ON public.travel_logs USING GIST(start_geom);
CREATE INDEX IF NOT EXISTS idx_travel_logs_end_geom ON public.travel_logs USING GIST(end_geom);
CREATE INDEX IF NOT EXISTS idx_travel_logs_worker ON public.travel_logs(worker_id, device_start_time);
CREATE INDEX IF NOT EXISTS idx_travel_logs_org ON public.travel_logs(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_travel_logs_origin_shift ON public.travel_logs(origin_shift_id);

-- ── 7. Verified Financial Claim (Edge Function output) ────────────────────
CREATE TABLE IF NOT EXISTS public.travel_claims (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  travel_log_id               UUID NOT NULL REFERENCES public.travel_logs(id) ON DELETE CASCADE,
  worker_id                   UUID NOT NULL REFERENCES public.profiles(id),
  -- ── Google Maps Verification ──
  api_verified_distance_meters INT,           -- from Google Distance Matrix API
  api_verified_duration_seconds INT,          -- from Google Distance Matrix API
  api_source                  TEXT DEFAULT 'google_maps',  -- 'google_maps' | 'haversine'
  -- ── MMM Zoning ──
  mmm_zone                    public.mmm_zone_class,
  mmm_zone_cap_minutes        INT,            -- NDIS cap for this zone
  -- ── Arbitration Result ──
  actual_duration_seconds     INT,
  variance_seconds            INT,            -- actual - api (negative = ok, positive = flag)
  grace_period_seconds        INT NOT NULL DEFAULT 600, -- 10 minutes
  -- ── Billable Outputs (Finance Engine Result) ──
  billable_labor_minutes      INT,            -- after variance lock + MMM cap
  billable_non_labor_km       DECIMAL(8,3),   -- km for vehicle reimbursement
  -- ── NDIS Line Item Codes ──
  ndis_labor_code             VARCHAR(30),    -- e.g. 01_799_0104_1_1
  ndis_non_labor_code         VARCHAR(30),    -- e.g. 01_799_0104_1_1_KM
  -- ── Financial Values ──
  labor_rate_per_minute       DECIMAL(8,4),   -- $/min from org settings
  non_labor_rate_per_km       DECIMAL(8,4),   -- $/km (NDIS Schedule ~$0.97)
  calculated_labor_cost       DECIMAL(10,2),
  calculated_non_labor_cost   DECIMAL(10,2),
  total_claim_value           DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(calculated_labor_cost, 0) + COALESCE(calculated_non_labor_cost, 0)
  ) STORED,
  -- ── Status & Workflow ──
  status                      public.travel_claim_status NOT NULL DEFAULT 'PENDING_API',
  flagged_reason              TEXT,           -- human-readable flag reason
  override_reason             TEXT,           -- admin override justification
  approved_by                 UUID REFERENCES public.profiles(id),
  approved_at                 TIMESTAMPTZ,
  billed_at                   TIMESTAMPTZ,
  invoice_id                  UUID REFERENCES public.invoices(id),
  payroll_line_id             UUID,           -- FK to timesheet_pay_lines
  -- ── Origin/Destination labels (cached for UI) ──
  origin_label                TEXT,           -- e.g. "Oceanview SIL"
  destination_label           TEXT,           -- e.g. "12 Smith St"
  worker_name                 TEXT,           -- cached for grid display
  -- ── Metadata ──
  engine_version              TEXT DEFAULT 'astrolabe-v1',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_claims_org_status ON public.travel_claims(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_travel_claims_worker ON public.travel_claims(worker_id, created_at);
CREATE INDEX IF NOT EXISTS idx_travel_claims_log ON public.travel_claims(travel_log_id);

-- ── 8. RLS Policies ──────────────────────────────────────────────────────
ALTER TABLE public.travel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mmm_zones ENABLE ROW LEVEL SECURITY;

-- travel_logs: org members can read, workers can insert own logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travel_logs' AND policyname='Org members can read travel logs') THEN
    CREATE POLICY "Org members can read travel logs"
      ON public.travel_logs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = travel_logs.organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travel_logs' AND policyname='Workers can insert own travel logs') THEN
    CREATE POLICY "Workers can insert own travel logs"
      ON public.travel_logs FOR INSERT
      WITH CHECK (worker_id = auth.uid());
  END IF;
END $$;

-- travel_claims: org members can read/update
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travel_claims' AND policyname='Org members can read travel claims') THEN
    CREATE POLICY "Org members can read travel claims"
      ON public.travel_claims FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = travel_claims.organization_id
            AND om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travel_claims' AND policyname='Org admins can update travel claims') THEN
    CREATE POLICY "Org admins can update travel claims"
      ON public.travel_claims FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = travel_claims.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager')
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

-- mmm_zones: readable by all authenticated users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mmm_zones' AND policyname='Authenticated users can read MMM zones') THEN
    CREATE POLICY "Authenticated users can read MMM zones"
      ON public.mmm_zones FOR SELECT
      TO authenticated
      USING (TRUE);
  END IF;
END $$;

-- ── 9. Helper RPC: get_mmm_zone_for_point ────────────────────────────────
-- Determines the NDIS MMM zone for a given lat/lng point
CREATE OR REPLACE FUNCTION public.get_mmm_zone_for_point(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS TABLE (
  zone_class       public.mmm_zone_class,
  zone_name        TEXT,
  max_travel_minutes INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
  SELECT mz.zone_class, mz.zone_name, mz.max_travel_minutes
  FROM public.mmm_zones mz
  WHERE ST_Intersects(
    mz.geom,
    ST_GeographyFromText('SRID=4326;POINT(' || p_lng || ' ' || p_lat || ')')
  )
  ORDER BY mz.zone_class ASC  -- MMM1 wins over MMM4 (more specific)
  LIMIT 1;
$func$;

-- ── 10. Helper RPC: get_straight_line_distance_km ───────────────────────
CREATE OR REPLACE FUNCTION public.get_straight_line_distance_km(
  p_start_lat DOUBLE PRECISION, p_start_lng DOUBLE PRECISION,
  p_end_lat   DOUBLE PRECISION, p_end_lng   DOUBLE PRECISION
)
RETURNS DECIMAL
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
  SELECT ROUND(
    (
      ST_Distance(
      ST_GeographyFromText('SRID=4326;POINT(' || p_start_lng || ' ' || p_start_lat || ')'),
      ST_GeographyFromText('SRID=4326;POINT(' || p_end_lng || ' ' || p_end_lat || ')')
      ) / 1000.0
    )::numeric, 2
  )::DECIMAL;
$func$;

-- ── 11. RPC: get_travel_claims_for_org ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_travel_claims_for_org(
  p_org_id UUID,
  p_status  TEXT DEFAULT NULL,
  p_from    TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_limit   INT DEFAULT 100
)
RETURNS TABLE (
  claim_id                  UUID,
  travel_log_id             UUID,
  worker_id                 UUID,
  worker_name               TEXT,
  transit_type              TEXT,
  start_lat                 DOUBLE PRECISION,
  start_lng                 DOUBLE PRECISION,
  end_lat                   DOUBLE PRECISION,
  end_lng                   DOUBLE PRECISION,
  device_start_time         TIMESTAMPTZ,
  device_end_time           TIMESTAMPTZ,
  actual_duration_seconds   INT,
  api_verified_distance_meters INT,
  api_verified_duration_seconds INT,
  billable_labor_minutes    INT,
  billable_non_labor_km     DECIMAL,
  calculated_labor_cost     DECIMAL,
  calculated_non_labor_cost DECIMAL,
  total_claim_value         DECIMAL,
  ndis_labor_code           VARCHAR,
  ndis_non_labor_code       VARCHAR,
  mmm_zone                  TEXT,
  status                    TEXT,
  flagged_reason            TEXT,
  origin_label              TEXT,
  destination_label         TEXT,
  route_polyline            TEXT,
  created_at                TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
  SELECT
    tc.id,
    tc.travel_log_id,
    tc.worker_id,
    tc.worker_name,
    tl.transit_type::TEXT,
    ST_X(tl.start_geom::GEOMETRY) AS start_lng,
    ST_Y(tl.start_geom::GEOMETRY) AS start_lat,
    CASE WHEN tl.end_geom IS NOT NULL THEN ST_X(tl.end_geom::GEOMETRY) ELSE NULL END,
    CASE WHEN tl.end_geom IS NOT NULL THEN ST_Y(tl.end_geom::GEOMETRY) ELSE NULL END,
    tl.device_start_time,
    tl.device_end_time,
    tl.actual_duration_seconds,
    tc.api_verified_distance_meters,
    tc.api_verified_duration_seconds,
    tc.billable_labor_minutes,
    tc.billable_non_labor_km,
    tc.calculated_labor_cost,
    tc.calculated_non_labor_cost,
    tc.total_claim_value,
    tc.ndis_labor_code,
    tc.ndis_non_labor_code,
    tc.mmm_zone::TEXT,
    tc.status::TEXT,
    tc.flagged_reason,
    tc.origin_label,
    tc.destination_label,
    tl.route_polyline,
    tc.created_at
  FROM public.travel_claims tc
  JOIN public.travel_logs tl ON tl.id = tc.travel_log_id
  WHERE tc.organization_id = p_org_id
    AND (p_status IS NULL OR tc.status::TEXT = p_status)
    AND tc.created_at >= p_from
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = p_org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  ORDER BY tc.created_at DESC
  LIMIT p_limit;
$func$;

-- ── 12. RPC: approve_travel_claim ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_travel_claim(
  p_claim_id     UUID,
  p_org_id       UUID,
  p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_is_admin BOOLEAN;
  v_new_status public.travel_claim_status;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
      AND om.status = 'active'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Insufficient permissions');
  END IF;

  v_new_status := CASE
    WHEN p_override_reason IS NOT NULL THEN 'OVERRIDDEN'::public.travel_claim_status
    ELSE 'APPROVED'::public.travel_claim_status
  END;

  UPDATE public.travel_claims
  SET status = v_new_status,
      approved_by = auth.uid(),
      approved_at = NOW(),
      override_reason = p_override_reason,
      updated_at = NOW()
  WHERE id = p_claim_id
    AND organization_id = p_org_id;

  RETURN jsonb_build_object('ok', TRUE, 'status', v_new_status::TEXT);
END;
$func$;

-- ── 13. RPC: bulk_approve_clean_travel_claims ────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_approve_clean_travel_claims(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_is_admin BOOLEAN;
  v_count INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
      AND om.status = 'active'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Insufficient permissions');
  END IF;

  UPDATE public.travel_claims
  SET status = 'APPROVED',
      approved_by = auth.uid(),
      approved_at = NOW(),
      updated_at = NOW()
  WHERE organization_id = p_org_id
    AND status = 'VERIFIED_CLEAN';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', TRUE, 'approved_count', v_count);
END;
$func$;

-- ── Updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_travel_claims_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER trg_travel_claims_updated_at
  BEFORE UPDATE ON public.travel_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_travel_claims_updated_at();
