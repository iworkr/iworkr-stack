-- ============================================================================
-- @migration AegisRBACEngine
-- @status COMPLETE
-- @description Project Aegis — JWT auth hook, zero-query RLS helpers, RBAC grants
-- @tables (none — auth hook function, RLS helpers: jwt_is_admin, jwt_is_worker, etc.)
-- @lastAudit 2026-03-22
-- ============================================================================
--
-- Role priority (highest → lowest):
--   owner > admin > manager > office_admin > senior_tech > technician
--   > apprentice > subcontractor
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Custom Access Token Hook
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase calls this on every token refresh. It injects app_metadata claims
-- so that RLS helpers can read them from the JWT without hitting the DB.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id      uuid;
  v_claims       jsonb;
  v_org_id       uuid;
  v_role         text;
  v_is_super     boolean := false;
  v_participant  uuid;
BEGIN
  -- 1. Extract the user id from the event payload
  v_user_id := (event ->> 'user_id')::uuid;

  -- 2. Check super-admin flag
  SELECT COALESCE(p.is_super_admin, false)
    INTO v_is_super
    FROM public.profiles p
   WHERE p.id = v_user_id;

  -- 3. Check if user is in the participant network (external / family)
  SELECT pnm.participant_id
    INTO v_participant
    FROM public.participant_network_members pnm
   WHERE pnm.user_id = v_user_id
   LIMIT 1;

  IF v_participant IS NOT NULL AND NOT v_is_super THEN
    -- Participant / family portal user — no org membership
    v_claims := jsonb_build_object(
      'role',           'participant',
      'org_id',         NULL,
      'participant_id', v_participant,
      'is_super_admin', v_is_super
    );
    event := jsonb_set(event, '{claims,app_metadata}', v_claims);
    RETURN event;
  END IF;

  -- 4. Get the user's highest-priority active org membership
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

  -- 5. Build the claims payload
  v_claims := jsonb_build_object(
    'role',           COALESCE(v_role, 'technician'),
    'org_id',         v_org_id,
    'is_super_admin', v_is_super
  );

  -- If the user also has a participant link, include it
  IF v_participant IS NOT NULL THEN
    v_claims := v_claims || jsonb_build_object('participant_id', v_participant);
  END IF;

  -- 6. Inject into event → claims → app_metadata
  event := jsonb_set(event, '{claims,app_metadata}', v_claims);

  RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Aegis access-token hook: injects role, org_id, is_super_admin, and optional participant_id into JWT app_metadata.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §2  Fast JWT-Based RLS Helper Functions
-- ─────────────────────────────────────────────────────────────────────────────
-- These read claims straight from the JWT — no DB round-trip per row.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.jwt_org_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'org_id'),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role',
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role', ''
  ) IN ('owner', 'admin', 'manager', 'office_admin');
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_owner()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role', ''
  ) = 'owner';
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_worker()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role', ''
  ) IN ('technician', 'apprentice', 'senior_tech', 'subcontractor');
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_external()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role', ''
  ) IN ('participant', 'carer');
$$;

CREATE OR REPLACE FUNCTION public.jwt_participant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'participant_id'),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_super_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Grants & Revokes
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

GRANT EXECUTE ON FUNCTION public.jwt_org_id           TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_role             TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_admin         TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_owner         TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_worker        TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_external      TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_participant_id   TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_super_admin   TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Auth Hook Registration (Manual Step)
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase auth hooks are registered via the Dashboard, NOT via SQL.
--
-- Go to: Dashboard → Authentication → Hooks → Custom access token
--   enabled = true
--   schema  = public
--   function = custom_access_token_hook
--
-- After enabling, every token refresh will call custom_access_token_hook()
-- and the JWT will carry app_metadata.{role, org_id, is_super_admin}.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  Performance Index
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_org_members_user_status_role
  ON public.organization_members (user_id, status, role)
  WHERE status = 'active';


-- ═══════════════════════════════════════════════════════════════════════════════
-- End of Migration 120: Project Aegis — Global RBAC Engine
-- ═══════════════════════════════════════════════════════════════════════════════
