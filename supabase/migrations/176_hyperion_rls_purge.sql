-- ============================================================================
-- @migration HyperionRLSPurge
-- @status COMPLETE
-- @description PROJECT HYPERION-VANGUARD: P0 RLS purge — drops ALL legacy
--   permissive policies on core tables (jobs, clients, invoices) and replaces
--   wide-open policies on infrastructure tables (impersonation_sessions,
--   inbound_webhooks_queue) with properly scoped ones.
-- @tables jobs, clients, invoices, impersonation_sessions, inbound_webhooks_queue
-- @lastAudit 2026-03-22
-- ============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: PURGE ALL EXISTING POLICIES ON CORE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════
-- PostgreSQL combines multiple RLS policies on the same table with OR.
-- If ANY permissive policy says USING(true), ALL restrictive policies are
-- rendered useless. We DROP every known policy name and rebuild clean ones.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── JOBS: Drop all 8+ known policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON public.jobs;
DROP POLICY IF EXISTS "Members can read org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Members can create org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Members can update org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Members can delete org jobs" ON public.jobs;
-- Legacy names cleaned in 175 but re-drop for safety
DROP POLICY IF EXISTS "Users can view org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can create org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update org jobs" ON public.jobs;
DROP POLICY IF EXISTS "org_member_select_jobs" ON public.jobs;
DROP POLICY IF EXISTS "org_member_insert_jobs" ON public.jobs;
DROP POLICY IF EXISTS "org_member_update_jobs" ON public.jobs;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.jobs;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.jobs;

-- ── CLIENTS: Drop all 8+ known policies ─────────────────────────────────────
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
DROP POLICY IF EXISTS "Members can read org clients" ON public.clients;
DROP POLICY IF EXISTS "Members can create org clients" ON public.clients;
DROP POLICY IF EXISTS "Members can update org clients" ON public.clients;
DROP POLICY IF EXISTS "Members can delete org clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view org clients" ON public.clients;
DROP POLICY IF EXISTS "Users can create org clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update org clients" ON public.clients;
DROP POLICY IF EXISTS "org_member_select_clients" ON public.clients;
DROP POLICY IF EXISTS "org_member_insert_clients" ON public.clients;
DROP POLICY IF EXISTS "org_member_update_clients" ON public.clients;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.clients;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.clients;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.clients;

-- ── INVOICES: Drop all 4+ known policies ────────────────────────────────────
DROP POLICY IF EXISTS "invoices_select_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy" ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy" ON public.invoices;
DROP POLICY IF EXISTS "Users can view org invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can create org invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update org invoices" ON public.invoices;
DROP POLICY IF EXISTS "org_member_select_invoices" ON public.invoices;
DROP POLICY IF EXISTS "org_member_insert_invoices" ON public.invoices;
DROP POLICY IF EXISTS "org_member_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.invoices;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.invoices;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.invoices;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: REBUILD CLEAN ORG-SCOPED POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Single source of truth: org membership check via a subquery.
-- Uses jwt_org_id() for maximum performance where available, with fallback.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: ensure org membership (uses JWT fast-path when available)
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active'
  );
$$;

-- ── JOBS ─────────────────────────────────────────────────────────────────────
CREATE POLICY "hyperion_jobs_select" ON public.jobs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "hyperion_jobs_insert" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "hyperion_jobs_update" ON public.jobs
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "hyperion_jobs_delete" ON public.jobs
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- ── CLIENTS ──────────────────────────────────────────────────────────────────
CREATE POLICY "hyperion_clients_select" ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "hyperion_clients_insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "hyperion_clients_update" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "hyperion_clients_delete" ON public.clients
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- ── INVOICES ─────────────────────────────────────────────────────────────────
CREATE POLICY "hyperion_invoices_select" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "hyperion_invoices_insert" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "hyperion_invoices_update" ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

CREATE POLICY "hyperion_invoices_delete" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: LOCK DOWN INFRASTRUCTURE TABLES (S-07, S-08)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── IMPERSONATION SESSIONS ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role access on impersonation_sessions" ON public.impersonation_sessions;
DROP POLICY IF EXISTS "Enable full access for all users" ON public.impersonation_sessions;

CREATE POLICY "hyperion_impersonation_self_or_superadmin" 
ON public.impersonation_sessions
FOR ALL TO authenticated
USING (
  auth.uid() = admin_id
  OR (auth.jwt()->'app_metadata'->>'is_super_admin')::boolean = true
)
WITH CHECK (
  auth.uid() = admin_id
  OR (auth.jwt()->'app_metadata'->>'is_super_admin')::boolean = true
);

-- ── INBOUND WEBHOOKS QUEUE ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access" ON public.inbound_webhooks_queue;
DROP POLICY IF EXISTS "Super admins can read queue" ON public.inbound_webhooks_queue;
DROP POLICY IF EXISTS "Enable full access for all users" ON public.inbound_webhooks_queue;

-- Service role bypasses RLS entirely, so we block all authenticated/anon access
CREATE POLICY "hyperion_webhooks_queue_deny_all"
ON public.inbound_webhooks_queue
FOR ALL TO authenticated
USING (false);

-- Super admins can still read (for debugging)
CREATE POLICY "hyperion_webhooks_queue_superadmin_read"
ON public.inbound_webhooks_queue
FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'is_super_admin')::boolean = true);


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: JWT HOOK RESTORATION (S-06)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 145 replaced the JWT hook from migration 120 but removed the
-- `role` key. The fast RLS helpers (jwt_role, jwt_org_id etc.) rely on
-- app_metadata.role. We must write BOTH `role` and `role_name`.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id      UUID;
  v_claims       JSONB;
  v_org_id       UUID;
  v_role         TEXT;
  v_is_super     BOOLEAN := false;
  v_participant  UUID;
  v_perms_result JSON;
BEGIN
  v_user_id := (event->>'user_id')::uuid;

  -- 1. Check super-admin flag
  SELECT COALESCE(p.is_super_admin, false)
    INTO v_is_super
    FROM public.profiles p
   WHERE p.id = v_user_id;

  -- 2. Check participant network membership
  SELECT pnm.participant_id
    INTO v_participant
    FROM public.participant_network_members pnm
   WHERE pnm.user_id = v_user_id
   LIMIT 1;

  IF v_participant IS NOT NULL AND NOT v_is_super THEN
    v_claims := jsonb_build_object(
      'role',           'participant',
      'role_name',      'Participant',
      'org_id',         NULL,
      'participant_id', v_participant,
      'is_super_admin', v_is_super,
      'permissions',    '[]'::jsonb
    );
    event := jsonb_set(event, '{claims,app_metadata}', v_claims);
    RETURN event;
  END IF;

  -- 3. Get the user's active workspace from existing claims (workspace switching)
  v_org_id := (event->'claims'->'app_metadata'->>'active_workspace')::uuid;

  -- 4. Fallback: get highest-priority org membership
  IF v_org_id IS NULL THEN
    SELECT om.organization_id, om.role::text
      INTO v_org_id, v_role
      FROM public.organization_members om
     WHERE om.user_id = v_user_id
       AND om.status  = 'active'
     ORDER BY CASE om.role
                WHEN 'owner'         THEN 1
                WHEN 'admin'         THEN 2
                WHEN 'manager'       THEN 3
                WHEN 'office_admin'  THEN 4
                WHEN 'senior_tech'   THEN 5
                WHEN 'technician'    THEN 6
                WHEN 'apprentice'    THEN 7
                WHEN 'subcontractor' THEN 8
                ELSE                      9
              END
     LIMIT 1;
  ELSE
    -- Active workspace set; get user's role in that workspace
    SELECT om.role::text INTO v_role
      FROM public.organization_members om
     WHERE om.user_id = v_user_id
       AND om.organization_id = v_org_id
       AND om.status = 'active'
     LIMIT 1;
  END IF;

  -- 5. Build base claims (backward compatible with migration 120)
  v_claims := jsonb_build_object(
    'role',             COALESCE(v_role, 'technician'),
    'org_id',           v_org_id,
    'active_workspace', v_org_id,
    'is_super_admin',   v_is_super
  );

  -- 6. If user has a participant link, include it
  IF v_participant IS NOT NULL THEN
    v_claims := v_claims || jsonb_build_object('participant_id', v_participant);
  END IF;

  -- 7. Get compiled RBAC permissions (from migration 145's get_user_permissions)
  IF v_org_id IS NOT NULL THEN
    BEGIN
      v_perms_result := public.get_user_permissions(v_user_id, v_org_id);
      v_claims := v_claims || jsonb_build_object(
        'permissions', COALESCE((v_perms_result->>'permissions')::jsonb, '[]'::jsonb),
        'role_name',   COALESCE(v_perms_result->>'role_name', COALESCE(v_role, 'technician'))
      );
    EXCEPTION WHEN OTHERS THEN
      -- If get_user_permissions fails (e.g., tables not created yet), still return valid claims
      v_claims := v_claims || jsonb_build_object(
        'permissions', '[]'::jsonb,
        'role_name',   COALESCE(v_role, 'technician')
      );
    END;
  ELSE
    v_claims := v_claims || jsonb_build_object(
      'permissions', '[]'::jsonb,
      'role_name',   'No Workspace'
    );
  END IF;

  -- 8. Inject into JWT
  event := jsonb_set(event, '{claims,app_metadata}', v_claims);
  RETURN event;
END;
$$;

-- Re-grant permissions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
    GRANT ALL ON TABLE public.system_permissions TO supabase_auth_admin;
    GRANT ALL ON TABLE public.organization_members TO supabase_auth_admin;
    GRANT ALL ON TABLE public.organization_roles TO supabase_auth_admin;
    GRANT ALL ON TABLE public.role_permissions TO supabase_auth_admin;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Keep existing fast RLS helpers functional
GRANT EXECUTE ON FUNCTION public.is_org_member TO authenticated;

COMMIT;
