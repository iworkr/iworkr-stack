-- ============================================================================
-- Migration 181: Project Outrider-Route — AI Route Optimization & TSP Engine
-- ============================================================================
-- Adds:
--   1. Route optimization columns on schedule_blocks (sequence, pinning, travel metadata, polylines)
--   2. Default start location on staff_profiles for depot/home origin
--   3. route_optimization_runs audit table for tracking optimization history
--   4. RPCs for fetching optimizable blocks and committing optimized sequences
--   5. Composite index for fast worker+date agenda queries
-- ============================================================================

-- ── 1. PostGIS (idempotent, already enabled) ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- ── 2. Schedule Blocks — Route Optimization Columns ──────────────────────
ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS is_time_pinned BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS planned_travel_duration_seconds INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planned_travel_distance_meters INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS route_sequence INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS polyline_geometry TEXT,
  ADD COLUMN IF NOT EXISTS optimization_run_id UUID,
  ADD COLUMN IF NOT EXISTS is_supplier_waypoint BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS waypoint_name TEXT;

-- Note: expression index on DATE(start_time) requires IMMUTABLE function;
-- query-side filtering by date range is used in the RPC instead.

CREATE INDEX IF NOT EXISTS idx_schedule_route_sequence
  ON public.schedule_blocks (technician_id, route_sequence)
  WHERE route_sequence > 0;

-- ── 3. Staff Profiles — Default Start Location ──────────────────────────
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS default_start_location_name TEXT,
  ADD COLUMN IF NOT EXISTS route_mode TEXT DEFAULT 'round_trip';
  -- route_mode: 'round_trip' (return to start), 'one_way' (end at last job)

-- ── 4. Route Optimization Runs — Audit Table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.route_optimization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  status TEXT DEFAULT 'proposed',
  schedule_block_ids UUID[] NOT NULL,
  original_sequence JSONB,
  optimized_sequence JSONB,
  total_travel_before_seconds INT DEFAULT 0,
  total_travel_after_seconds INT DEFAULT 0,
  total_distance_before_meters INT DEFAULT 0,
  total_distance_after_meters INT DEFAULT 0,
  travel_saved_seconds INT DEFAULT 0,
  distance_saved_meters INT DEFAULT 0,
  mapbox_trip_geometry TEXT,
  pinned_block_count INT DEFAULT 0,
  committed_at TIMESTAMPTZ,
  committed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.route_optimization_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_manage_optimization_runs"
  ON public.route_optimization_runs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = route_optimization_runs.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_optimization_runs_worker_date
  ON public.route_optimization_runs (worker_id, run_date);

-- ── 5. RPC: Get Optimizable Blocks for a Worker's Day ───────────────────
CREATE OR REPLACE FUNCTION public.get_optimizable_blocks(
  p_worker_id UUID,
  p_date DATE,
  p_org_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(t) ORDER BY t.start_time)
  INTO v_result
  FROM (
    SELECT
      sb.id,
      sb.title,
      sb.client_name,
      sb.location,
      sb.start_time,
      sb.end_time,
      sb.status,
      sb.job_id,
      sb.is_time_pinned,
      sb.route_sequence,
      sb.is_supplier_waypoint,
      sb.waypoint_name,
      EXTRACT(EPOCH FROM (sb.end_time - sb.start_time))::INT AS duration_seconds,
      COALESCE(j.site_lat, j.location_lat, c.address_lat) AS lat,
      COALESCE(j.site_lng, j.location_lng, c.address_lng) AS lng,
      j.title AS job_title,
      c.name AS resolved_client_name
    FROM public.schedule_blocks sb
    LEFT JOIN public.jobs j ON j.id = sb.job_id
    LEFT JOIN public.clients c ON c.id = j.client_id
    WHERE sb.technician_id = p_worker_id
      AND sb.organization_id = p_org_id
      AND sb.start_time >= p_date::timestamptz
      AND sb.start_time < (p_date + interval '1 day')::timestamptz
      AND sb.status NOT IN ('cancelled', 'complete')
  ) t;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- ── 6. RPC: Commit Optimized Route ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.commit_optimized_route(
  p_run_id UUID,
  p_blocks JSONB,
  p_committed_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block JSONB;
  v_count INT := 0;
BEGIN
  FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    UPDATE public.schedule_blocks
    SET
      start_time = (v_block->>'start_time')::timestamptz,
      end_time = (v_block->>'end_time')::timestamptz,
      route_sequence = (v_block->>'route_sequence')::int,
      planned_travel_duration_seconds = COALESCE((v_block->>'travel_duration_seconds')::int, 0),
      planned_travel_distance_meters = COALESCE((v_block->>'travel_distance_meters')::int, 0),
      polyline_geometry = v_block->>'polyline',
      optimization_run_id = p_run_id,
      updated_at = now()
    WHERE id = (v_block->>'id')::uuid;
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.route_optimization_runs
  SET status = 'committed', committed_at = now(), committed_by = p_committed_by, updated_at = now()
  WHERE id = p_run_id;

  RETURN json_build_object('ok', true, 'updated_count', v_count);
END;
$$;

-- ── 7. RPC: Get Worker Start Coordinates ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_worker_start_location(
  p_worker_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'home_lat', sp.home_lat,
    'home_lng', sp.home_lng,
    'home_address', sp.home_address,
    'start_name', sp.default_start_location_name,
    'route_mode', COALESCE(sp.route_mode, 'round_trip')
  )
  INTO v_result
  FROM public.staff_profiles sp
  WHERE sp.profile_id = p_worker_id;

  RETURN COALESCE(v_result, json_build_object(
    'home_lat', NULL, 'home_lng', NULL,
    'home_address', NULL, 'start_name', NULL,
    'route_mode', 'round_trip'
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_optimizable_blocks TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_optimized_route TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_worker_start_location TO authenticated;
