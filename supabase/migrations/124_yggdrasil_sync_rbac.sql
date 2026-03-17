-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 124: Project Yggdrasil-Sync — Multi-Tenant RBAC Hardening
-- Adds the user_belongs_to_workspace helper, upgrades RLS policies to
-- enforce active workspace header, and adds RBAC guard on approve_timesheet.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Helper: safe active workspace extraction ──────────────────────────
-- Returns the x-active-workspace-id header value as UUID, or NULL if absent/malformed.
CREATE OR REPLACE FUNCTION public.get_active_workspace_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  raw TEXT;
  headers JSONB;
BEGIN
  BEGIN
    raw := current_setting('request.headers', true);
    IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
    headers := raw::JSONB;
    RETURN (headers->>'x-active-workspace-id')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

-- ── 2. Helper: membership verification (fast indexed lookup) ─────────────
CREATE OR REPLACE FUNCTION public.user_belongs_to_workspace(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_workspace_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- ── 3. Helper: get user's role in active workspace ───────────────────────
CREATE OR REPLACE FUNCTION public.get_user_workspace_role(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::text FROM public.organization_members
  WHERE organization_id = p_workspace_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- ── 4. Helper: unified active workspace membership check ─────────────────
-- Returns TRUE if the authenticated user is a member of the workspace
-- currently specified in the x-active-workspace-id request header.
-- Falls back to ANY workspace membership if no header is present
-- (preserves backward compatibility with server actions that pass org_id explicitly).
CREATE OR REPLACE FUNCTION public.is_active_workspace_member(p_row_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  active_ws UUID;
BEGIN
  active_ws := public.get_active_workspace_id();

  IF active_ws IS NOT NULL THEN
    -- Header is present: strictly enforce that the row belongs to the active workspace
    -- AND the user is a member of it.
    RETURN p_row_org_id = active_ws AND public.user_belongs_to_workspace(active_ws);
  ELSE
    -- No header (server-side actions, server components): fall back to membership check only.
    -- This preserves all existing server action behaviour where org_id is passed explicitly.
    RETURN public.user_belongs_to_workspace(p_row_org_id);
  END IF;
END;
$$;

-- ── 5. Upgrade RLS: schedule_blocks ─────────────────────────────────────
-- Replace the "any org membership" SELECT policy with the active-workspace-aware version.
DROP POLICY IF EXISTS "Members can read org schedule" ON public.schedule_blocks;
CREATE POLICY "Members can read org schedule"
ON public.schedule_blocks FOR SELECT
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can create schedule blocks" ON public.schedule_blocks;
CREATE POLICY "Members can create schedule blocks"
ON public.schedule_blocks FOR INSERT
WITH CHECK (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can update schedule blocks" ON public.schedule_blocks;
CREATE POLICY "Members can update schedule blocks"
ON public.schedule_blocks FOR UPDATE
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can delete schedule blocks" ON public.schedule_blocks;
CREATE POLICY "Members can delete schedule blocks"
ON public.schedule_blocks FOR DELETE
USING (public.is_active_workspace_member(organization_id));

-- ── 6. Upgrade RLS: jobs ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can read org jobs" ON public.jobs;
CREATE POLICY "Members can read org jobs"
ON public.jobs FOR SELECT
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can create org jobs" ON public.jobs;
CREATE POLICY "Members can create org jobs"
ON public.jobs FOR INSERT
WITH CHECK (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can update org jobs" ON public.jobs;
CREATE POLICY "Members can update org jobs"
ON public.jobs FOR UPDATE
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can delete org jobs" ON public.jobs;
CREATE POLICY "Members can delete org jobs"
ON public.jobs FOR DELETE
USING (public.is_active_workspace_member(organization_id));

-- ── 7. Upgrade RLS: clients ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can read org clients" ON public.clients;
CREATE POLICY "Members can read org clients"
ON public.clients FOR SELECT
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can create org clients" ON public.clients;
CREATE POLICY "Members can create org clients"
ON public.clients FOR INSERT
WITH CHECK (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can update org clients" ON public.clients;
CREATE POLICY "Members can update org clients"
ON public.clients FOR UPDATE
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Members can delete org clients" ON public.clients;
CREATE POLICY "Members can delete org clients"
ON public.clients FOR DELETE
USING (public.is_active_workspace_member(organization_id));

-- ── 8. Upgrade RLS: care_plans ──────────────────────────────────────────
DROP POLICY IF EXISTS "Org members can view care plans" ON public.care_plans;
CREATE POLICY "Org members can view care plans"
ON public.care_plans FOR SELECT
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage care plans" ON public.care_plans;
CREATE POLICY "Admins can manage care plans"
ON public.care_plans FOR ALL
USING (
  public.is_active_workspace_member(organization_id)
  AND public.get_user_workspace_role(organization_id) IN ('owner', 'admin')
);

-- ── 9. Upgrade RLS: participant_profiles ────────────────────────────────
DROP POLICY IF EXISTS "Scoped users can view participant profiles" ON public.participant_profiles;
CREATE POLICY "Scoped users can view participant profiles"
ON public.participant_profiles FOR SELECT
USING (public.is_active_workspace_member(organization_id));

DROP POLICY IF EXISTS "Admins can manage participant profiles" ON public.participant_profiles;
CREATE POLICY "Admins can manage participant profiles"
ON public.participant_profiles FOR ALL
USING (
  public.is_active_workspace_member(organization_id)
  AND public.get_user_workspace_role(organization_id) IN ('owner', 'admin')
);

-- ── 10. RBAC Guard: approve_timesheet RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_timesheet(p_timesheet_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_role   TEXT;
BEGIN
  -- Identify which org this timesheet belongs to
  SELECT organization_id INTO v_org_id
  FROM public.timesheets
  WHERE id = p_timesheet_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'RBAC_VIOLATION: Timesheet not found.';
  END IF;

  -- Enforce: only OWNER or ADMIN can approve
  v_role := public.get_user_workspace_role(v_org_id);
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'RBAC_VIOLATION: User is not authorized to approve timesheets in this workspace. Required: owner or admin. Actual: %', v_role;
  END IF;

  -- Execute the approval
  UPDATE public.timesheets
  SET status = 'approved', approved_at = NOW(), approved_by = auth.uid()
  WHERE id = p_timesheet_id;
END;
$$;

-- ── 11. Index: speed up the membership checks ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_members_uid_org_status
  ON public.organization_members (user_id, organization_id, status);

-- ── 12. Branches: ensure FK to organizations exists ─────────────────────
-- branches table already has organization_id — just make sure it has an index
CREATE INDEX IF NOT EXISTS idx_branches_organization_id
  ON public.branches (organization_id);
