-- ============================================================================
-- @migration GenesisBranchIdBackfill
-- @description Non-destructive backfill/mirroring between legacy branch text
--              and canonical organization_members.branch_id.
-- ============================================================================

-- Backfill branch_id from existing branch text where possible.
UPDATE public.organization_members om
SET branch_id = b.id
FROM public.branches b
WHERE om.organization_id = b.organization_id
  AND om.branch_id IS NULL
  AND om.branch IS NOT NULL
  AND lower(trim(om.branch)) = lower(trim(b.name));

-- Mirror branch name from branch_id when text column is empty.
UPDATE public.organization_members om
SET branch = b.name
FROM public.branches b
WHERE om.branch_id = b.id
  AND (om.branch IS NULL OR trim(om.branch) = '');
