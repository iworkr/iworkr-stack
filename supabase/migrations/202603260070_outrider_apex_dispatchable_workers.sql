-- ============================================================================
-- @migration OutriderApexDispatchableWorkers
-- @description Branch-scoped worker RPC for route optimizer technician selector
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dispatchable_workers(
  p_workspace_id UUID,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_workspace_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    split_part(COALESCE(p.full_name, ''), ' ', 1) AS first_name,
    CASE
      WHEN strpos(COALESCE(p.full_name, ''), ' ') > 0
      THEN btrim(substring(p.full_name from strpos(p.full_name, ' ') + 1))
      ELSE ''
    END AS last_name,
    COALESCE(NULLIF(p.full_name, ''), p.email, 'Unnamed worker') AS full_name,
    om.role::text AS role
  FROM public.organization_members om
  JOIN public.profiles p ON p.id = om.user_id
  WHERE om.organization_id = p_workspace_id
    AND om.status = 'active'
    AND (
      p_branch_id IS NULL
      OR om.branch_id IS NULL
      OR om.branch_id = p_branch_id
    )
    AND lower(om.role::text) NOT IN ('owner', 'office_admin')
  ORDER BY COALESCE(NULLIF(p.full_name, ''), p.email) ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dispatchable_workers(UUID, UUID) TO authenticated;
