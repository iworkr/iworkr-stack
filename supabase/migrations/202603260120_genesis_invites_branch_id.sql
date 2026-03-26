-- ============================================================================
-- @migration GenesisInvitesBranchId
-- @description Persist branch assignment on organization invites and map it
--              during invite acceptance.
-- ============================================================================

ALTER TABLE public.organization_invites
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organization_invites_branch_id
  ON public.organization_invites (branch_id);
