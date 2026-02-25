-- ═══════════════════════════════════════════════════════════
-- Migration 036: Role-Granular RLS Enforcement
-- Project Cerberus — The Iron Matrix
-- ═══════════════════════════════════════════════════════════

-- Helper: extract role from organization_members for current user
CREATE OR REPLACE FUNCTION get_user_org_role(p_org_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = auth.uid()
    AND organization_id = p_org_id
    AND status = 'active'
  LIMIT 1;
$$;

-- ── Jobs: Technicians see only assigned, Admins/Dispatchers see all ──

DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
CREATE POLICY "jobs_select_policy" ON public.jobs
FOR SELECT USING (
  CASE get_user_org_role(organization_id)
    WHEN 'owner'       THEN true
    WHEN 'admin'        THEN true
    WHEN 'manager'      THEN true
    WHEN 'office_admin'  THEN true
    WHEN 'senior_tech'   THEN true
    WHEN 'technician'    THEN assigned_tech_id = auth.uid()
    WHEN 'apprentice'    THEN assigned_tech_id = auth.uid()
    WHEN 'subcontractor' THEN assigned_tech_id = auth.uid()
    ELSE false
  END
);

DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;
CREATE POLICY "jobs_insert_policy" ON public.jobs
FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin', 'senior_tech')
);

DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
CREATE POLICY "jobs_update_policy" ON public.jobs
FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin', 'senior_tech')
  OR assigned_tech_id = auth.uid()
);

DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;
CREATE POLICY "jobs_delete_policy" ON public.jobs
FOR DELETE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager')
);

-- ── Clients: Techs read-only, No subcontractor access ──

DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
FOR SELECT USING (
  get_user_org_role(organization_id) IN (
    'owner', 'admin', 'manager', 'office_admin', 'senior_tech', 'technician'
  )
);

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
FOR DELETE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager')
);

-- ── Finance: Strictly Admins and Owners ──

DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
CREATE POLICY "invoices_select_policy" ON public.invoices
FOR SELECT USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
CREATE POLICY "invoices_insert_policy" ON public.invoices
FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
CREATE POLICY "invoices_update_policy" ON public.invoices
FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin', 'manager', 'office_admin')
);

DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
CREATE POLICY "invoices_delete_policy" ON public.invoices
FOR DELETE USING (
  get_user_org_role(organization_id) IN ('owner', 'admin')
);

-- ── Organization Members: Prevent self-role-change, protect owners ──

DROP POLICY IF EXISTS "members_update_no_self_escalation" ON public.organization_members;
CREATE POLICY "members_update_no_self_escalation" ON public.organization_members
FOR UPDATE USING (
  user_id != auth.uid()
  AND get_user_org_role(organization_id) IN ('owner', 'admin')
);

DROP POLICY IF EXISTS "members_delete_protected" ON public.organization_members;
CREATE POLICY "members_delete_protected" ON public.organization_members
FOR DELETE USING (
  user_id != auth.uid()
  AND get_user_org_role(organization_id) IN ('owner', 'admin')
  AND role != 'owner'
);

-- ── Prevent orphaned workspace (trigger) ──

CREATE OR REPLACE FUNCTION prevent_last_owner_removal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  owner_count int;
BEGIN
  IF OLD.role = 'owner' THEN
    SELECT count(*) INTO owner_count
    FROM organization_members
    WHERE organization_id = OLD.organization_id
      AND role = 'owner'
      AND status = 'active'
      AND user_id != OLD.user_id;

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove the final owner. Transfer ownership first.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_owner ON public.organization_members;
CREATE TRIGGER trg_prevent_last_owner
  BEFORE DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION prevent_last_owner_removal();

-- ── Validate Invite RPC (public-facing, no auth needed for lookup) ──

CREATE OR REPLACE FUNCTION validate_invite_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_invite record;
BEGIN
  SELECT i.*, o.name AS org_name, o.slug AS org_slug,
         p.full_name AS inviter_name
  INTO v_invite
  FROM organization_invites i
  JOIN organizations o ON o.id = i.organization_id
  LEFT JOIN profiles p ON p.id = i.invited_by
  WHERE i.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has already been used');
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'role', v_invite.role,
    'organization_name', v_invite.org_name,
    'organization_slug', v_invite.org_slug,
    'inviter_name', v_invite.inviter_name,
    'expires_at', v_invite.expires_at
  );
END;
$$;
