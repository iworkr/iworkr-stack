-- ============================================================================
-- @migration OrionTransitSchema
-- @description Project Orion-Transit schema normalization for travel ledger auditing
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orion_travel_status') THEN
    CREATE TYPE public.orion_travel_status AS ENUM (
      'PENDING',
      'FLAGGED',
      'APPROVED',
      'BILLED'
    );
  END IF;
END $$;

ALTER TABLE public.travel_claims
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS job_id UUID,
  ADD COLUMN IF NOT EXISTS start_geom GEOGRAPHY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS end_geom GEOGRAPHY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS claimed_distance_km DECIMAL(10, 3),
  ADD COLUMN IF NOT EXISTS calculated_distance_km DECIMAL(10, 3),
  ADD COLUMN IF NOT EXISTS variance_percentage DECIMAL(8, 3),
  ADD COLUMN IF NOT EXISTS orion_status public.orion_travel_status DEFAULT 'PENDING';

-- Backfill spatial columns and workspace pointer from travel logs.
UPDATE public.travel_claims tc
SET
  workspace_id = COALESCE(tc.workspace_id, tc.organization_id),
  start_geom = COALESCE(tc.start_geom, tl.start_geom),
  end_geom = COALESCE(tc.end_geom, tl.end_geom),
  calculated_distance_km = COALESCE(
    tc.calculated_distance_km,
    CASE
      WHEN tc.api_verified_distance_meters IS NULL THEN NULL
      ELSE ROUND((tc.api_verified_distance_meters::numeric / 1000.0), 3)
    END
  )
FROM public.travel_logs tl
WHERE tl.id = tc.travel_log_id;

UPDATE public.travel_claims
SET orion_status = CASE
  WHEN status IN ('PENDING_API', 'VERIFIED_CLEAN') THEN 'PENDING'::public.orion_travel_status
  WHEN status = 'FLAGGED_VARIANCE' THEN 'FLAGGED'::public.orion_travel_status
  WHEN status IN ('APPROVED', 'OVERRIDDEN') THEN 'APPROVED'::public.orion_travel_status
  WHEN status = 'BILLED' THEN 'BILLED'::public.orion_travel_status
  ELSE orion_status
END
WHERE orion_status IS NULL
   OR status IN ('PENDING_API', 'VERIFIED_CLEAN', 'FLAGGED_VARIANCE', 'APPROVED', 'OVERRIDDEN', 'BILLED');

CREATE INDEX IF NOT EXISTS idx_travel_claims_workspace_orion_status
  ON public.travel_claims(workspace_id, orion_status);

CREATE INDEX IF NOT EXISTS idx_travel_claims_start_geom
  ON public.travel_claims USING GIST(start_geom);

CREATE INDEX IF NOT EXISTS idx_travel_claims_end_geom
  ON public.travel_claims USING GIST(end_geom);
