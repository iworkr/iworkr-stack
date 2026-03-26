-- ============================================================================
-- @migration NexusBranchSchema
-- @description Project Nexus-Branch branch schema + RPC + branch-level isolation
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE IF EXISTS public.branches
  ADD COLUMN IF NOT EXISTS workspace_id UUID,
  ADD COLUMN IF NOT EXISTS location_geom GEOGRAPHY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE public.branches
SET workspace_id = COALESCE(workspace_id, organization_id)
WHERE workspace_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'branches_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.branches
      ADD CONSTRAINT branches_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_branches_workspace_name
  ON public.branches(workspace_id, name);

CREATE INDEX IF NOT EXISTS idx_branches_location_geom
  ON public.branches USING GIST(location_geom);

ALTER TABLE IF EXISTS public.jobs ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE IF EXISTS public.assets ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE IF EXISTS public.organization_members ADD COLUMN IF NOT EXISTS branch_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_branch_id_fkey') THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_branch_id_fkey') THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_branch_id_fkey') THEN
    ALTER TABLE public.organization_members
      ADD CONSTRAINT organization_members_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_org_branch ON public.jobs(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_assets_org_branch ON public.assets(organization_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_branch ON public.organization_members(organization_id, branch_id);

CREATE OR REPLACE FUNCTION public.current_user_branch_id(p_org_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
  SELECT om.branch_id
  FROM public.organization_members om
  WHERE om.organization_id = p_org_id
    AND om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;
$func$;

CREATE OR REPLACE FUNCTION public.current_user_is_branch_admin(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $func$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND lower(om.role::text) IN ('owner', 'admin')
  );
$func$;

CREATE OR REPLACE FUNCTION public.create_branch(
  p_workspace_id UUID,
  p_name TEXT,
  p_city TEXT DEFAULT NULL,
  p_timezone TEXT DEFAULT 'Australia/Sydney',
  p_tax_rate NUMERIC DEFAULT 10,
  p_location_lat DOUBLE PRECISION DEFAULT NULL,
  p_location_lng DOUBLE PRECISION DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_postal_code TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
DECLARE
  v_branch_id UUID;
  v_is_allowed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_workspace_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
      AND lower(om.role::text) IN ('owner', 'admin', 'manager')
  ) INTO v_is_allowed;

  IF NOT v_is_allowed THEN
    RAISE EXCEPTION 'Insufficient permissions to create branch';
  END IF;

  INSERT INTO public.branches (
    organization_id,
    workspace_id,
    name,
    city,
    timezone,
    tax_rate,
    address,
    state,
    postal_code,
    phone,
    email,
    location_geom,
    is_active,
    status
  )
  VALUES (
    p_workspace_id,
    p_workspace_id,
    trim(p_name),
    NULLIF(trim(COALESCE(p_city, '')), ''),
    COALESCE(NULLIF(trim(COALESCE(p_timezone, '')), ''), 'Australia/Sydney'),
    COALESCE(p_tax_rate, 10),
    NULLIF(trim(COALESCE(p_address, '')), ''),
    NULLIF(trim(COALESCE(p_state, '')), ''),
    NULLIF(trim(COALESCE(p_postal_code, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    CASE
      WHEN p_location_lat IS NOT NULL AND p_location_lng IS NOT NULL
      THEN ST_GeographyFromText('SRID=4326;POINT(' || p_location_lng || ' ' || p_location_lat || ')')
      ELSE NULL
    END,
    TRUE,
    'active'
  )
  RETURNING id INTO v_branch_id;

  RETURN v_branch_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.create_branch(
  UUID, TEXT, TEXT, TEXT, NUMERIC, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'jobs'
      AND policyname = 'Branch isolation for jobs'
  ) THEN
    CREATE POLICY "Branch isolation for jobs"
      ON public.jobs
      AS RESTRICTIVE
      FOR SELECT
      USING (
        public.current_user_is_branch_admin(organization_id)
        OR branch_id IS NULL
        OR branch_id = public.current_user_branch_id(organization_id)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'assets'
      AND policyname = 'Branch isolation for assets'
  ) THEN
    CREATE POLICY "Branch isolation for assets"
      ON public.assets
      AS RESTRICTIVE
      FOR SELECT
      USING (
        public.current_user_is_branch_admin(organization_id)
        OR branch_id IS NULL
        OR branch_id = public.current_user_branch_id(organization_id)
      );
  END IF;
END $$;
