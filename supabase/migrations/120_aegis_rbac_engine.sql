-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 120: Project Aegis — Global RBAC Engine
-- ═══════════════════════════════════════════════════════════════════════════════
-- 100% idempotent: IF NOT EXISTS, CREATE OR REPLACE, DO $$ blocks throughout.
--
-- What this migration does:
--   1. Custom access-token hook (injects org_id, role, is_super_admin into JWT)
--   2. Fast JWT-based RLS helper functions (zero-query claim extraction)
--   3. Rewrites critical RLS policies on high-traffic tables to use JWT claims
--   4. Grants / revokes for the auth hook
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

    -- Inject into the event
    event := jsonb_set(event, '{claims,app_metadata}', v_claims);
    RETURN event;
  END IF;

  -- 4. Get the user's highest-priority active org membership
  --    Priority: owner > admin > manager > office_admin > senior_tech
  --              > technician > apprentice > subcontractor
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
    'role',           COALESCE(v_role, 'anonymous'),
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

-- 2a) Extract org_id from JWT
CREATE OR REPLACE FUNCTION public.jwt_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'org_id'),
    ''
  )::uuid;
$$;

COMMENT ON FUNCTION public.jwt_org_id IS
  'Extracts org_id from JWT app_metadata. Zero-cost per-statement cached read.';


-- 2b) Extract role from JWT
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role',
    'anonymous'
  );
$$;

COMMENT ON FUNCTION public.jwt_role IS
  'Extracts role text from JWT app_metadata.';


-- 2c) Is the user an admin-tier role?
CREATE OR REPLACE FUNCTION public.jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role',
    ''
  ) IN ('owner', 'admin', 'manager', 'office_admin');
$$;

COMMENT ON FUNCTION public.jwt_is_admin IS
  'Returns true when JWT role is owner, admin, manager, or office_admin.';


-- 2d) Is the user specifically an owner?
CREATE OR REPLACE FUNCTION public.jwt_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role',
    ''
  ) = 'owner';
$$;

COMMENT ON FUNCTION public.jwt_is_owner IS
  'Returns true when JWT role is owner.';


-- 2e) Is the user a worker-tier role?
CREATE OR REPLACE FUNCTION public.jwt_is_worker()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role',
    ''
  ) IN ('technician', 'apprentice', 'senior_tech', 'subcontractor');
$$;

COMMENT ON FUNCTION public.jwt_is_worker IS
  'Returns true when JWT role is technician, apprentice, senior_tech, or subcontractor.';


-- 2f) Is the user an external/portal user?
CREATE OR REPLACE FUNCTION public.jwt_is_external()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'role',
    ''
  ) IN ('participant', 'carer');
$$;

COMMENT ON FUNCTION public.jwt_is_external IS
  'Returns true when JWT role is participant or carer (external portal user).';


-- 2g) Convenience: extract participant_id from JWT (for external users)
CREATE OR REPLACE FUNCTION public.jwt_participant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'participant_id'),
    ''
  )::uuid;
$$;

COMMENT ON FUNCTION public.jwt_participant_id IS
  'Extracts participant_id from JWT app_metadata (NULL for non-participant users).';


-- 2h) Convenience: is super admin?
CREATE OR REPLACE FUNCTION public.jwt_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    ((current_setting('request.jwt.claims', true))::jsonb -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false
  );
$$;

COMMENT ON FUNCTION public.jwt_is_super_admin IS
  'Returns true when JWT app_metadata.is_super_admin is true.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §3  Rewrite Critical RLS Policies (JWT-Claim-Based)
-- ─────────────────────────────────────────────────────────────────────────────
-- For each table we:
--   • Wrap in a DO block that checks table existence
--   • DROP old slow policies (IF EXISTS)
--   • CREATE new JWT-based policies
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 3a. schedule_blocks ─────────────────────────────────────────────────────
-- The single most-queried table. Previous policies hit organization_members
-- on every row. New policies read the JWT only.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'schedule_blocks'
  ) THEN

    -- Drop legacy policies
    DROP POLICY IF EXISTS "Members can read org schedule"           ON public.schedule_blocks;
    DROP POLICY IF EXISTS "Members can create schedule blocks"      ON public.schedule_blocks;
    DROP POLICY IF EXISTS "Members can update schedule blocks"      ON public.schedule_blocks;
    DROP POLICY IF EXISTS "Members can delete schedule blocks"      ON public.schedule_blocks;
    DROP POLICY IF EXISTS "aegis_schedule_blocks_select_admin"      ON public.schedule_blocks;
    DROP POLICY IF EXISTS "aegis_schedule_blocks_select_worker"     ON public.schedule_blocks;
    DROP POLICY IF EXISTS "aegis_schedule_blocks_insert"            ON public.schedule_blocks;
    DROP POLICY IF EXISTS "aegis_schedule_blocks_update"            ON public.schedule_blocks;
    DROP POLICY IF EXISTS "aegis_schedule_blocks_delete"            ON public.schedule_blocks;

    -- Note: We preserve the "Family can view linked participant shifts" policy
    -- from migration 088/115 — it is orthogonal and still needed for portal users.

    -- SELECT: Admins see all org blocks
    CREATE POLICY "aegis_schedule_blocks_select_admin"
      ON public.schedule_blocks FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- SELECT: Workers see only their own assigned blocks
    CREATE POLICY "aegis_schedule_blocks_select_worker"
      ON public.schedule_blocks FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_worker()
        AND technician_id = auth.uid()
      );

    -- INSERT: Admin-tier only (within org)
    CREATE POLICY "aegis_schedule_blocks_insert"
      ON public.schedule_blocks FOR INSERT
      WITH CHECK (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- UPDATE: Admin-tier only (within org)
    CREATE POLICY "aegis_schedule_blocks_update"
      ON public.schedule_blocks FOR UPDATE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- DELETE: Admin-tier only (within org)
    CREATE POLICY "aegis_schedule_blocks_delete"
      ON public.schedule_blocks FOR DELETE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    RAISE NOTICE '[120/Aegis] ✓ schedule_blocks RLS policies replaced with JWT claims.';
  ELSE
    RAISE NOTICE '[120/Aegis] ⊘ Skipping schedule_blocks — table not found.';
  END IF;
END $$;


-- ─── 3b. jobs ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'jobs'
  ) THEN

    -- Drop legacy policies from 008 and 036
    DROP POLICY IF EXISTS "jobs_select_policy"   ON public.jobs;
    DROP POLICY IF EXISTS "jobs_insert_policy"   ON public.jobs;
    DROP POLICY IF EXISTS "jobs_update_policy"   ON public.jobs;
    DROP POLICY IF EXISTS "jobs_delete_policy"   ON public.jobs;
    DROP POLICY IF EXISTS "aegis_jobs_select_admin"  ON public.jobs;
    DROP POLICY IF EXISTS "aegis_jobs_select_worker" ON public.jobs;
    DROP POLICY IF EXISTS "aegis_jobs_insert"        ON public.jobs;
    DROP POLICY IF EXISTS "aegis_jobs_update"        ON public.jobs;
    DROP POLICY IF EXISTS "aegis_jobs_delete"        ON public.jobs;

    -- Also drop any old broad policies from 008
    DROP POLICY IF EXISTS "Members can read org jobs"    ON public.jobs;
    DROP POLICY IF EXISTS "Members can create jobs"      ON public.jobs;
    DROP POLICY IF EXISTS "Members can update jobs"      ON public.jobs;
    DROP POLICY IF EXISTS "Members can delete jobs"      ON public.jobs;

    -- SELECT: Admins see all org jobs
    CREATE POLICY "aegis_jobs_select_admin"
      ON public.jobs FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- SELECT: Workers see only their assigned jobs
    CREATE POLICY "aegis_jobs_select_worker"
      ON public.jobs FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_worker()
        AND assignee_id = auth.uid()
      );

    -- INSERT: Admin+ only
    CREATE POLICY "aegis_jobs_insert"
      ON public.jobs FOR INSERT
      WITH CHECK (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- UPDATE: Admin+ only
    CREATE POLICY "aegis_jobs_update"
      ON public.jobs FOR UPDATE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- DELETE: Admin+ only
    CREATE POLICY "aegis_jobs_delete"
      ON public.jobs FOR DELETE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    RAISE NOTICE '[120/Aegis] ✓ jobs RLS policies replaced with JWT claims.';
  ELSE
    RAISE NOTICE '[120/Aegis] ⊘ Skipping jobs — table not found.';
  END IF;
END $$;


-- ─── 3c. clients ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN

    -- Drop legacy policies from 008 and 036
    DROP POLICY IF EXISTS "clients_select_policy"  ON public.clients;
    DROP POLICY IF EXISTS "clients_insert_policy"  ON public.clients;
    DROP POLICY IF EXISTS "clients_update_policy"  ON public.clients;
    DROP POLICY IF EXISTS "clients_delete_policy"  ON public.clients;
    DROP POLICY IF EXISTS "aegis_clients_select_admin"  ON public.clients;
    DROP POLICY IF EXISTS "aegis_clients_select_worker" ON public.clients;
    DROP POLICY IF EXISTS "aegis_clients_insert"        ON public.clients;
    DROP POLICY IF EXISTS "aegis_clients_update"        ON public.clients;
    DROP POLICY IF EXISTS "aegis_clients_delete"        ON public.clients;

    -- Also drop any old broad policies from 008/010
    DROP POLICY IF EXISTS "Members can read org clients"   ON public.clients;
    DROP POLICY IF EXISTS "Members can create clients"     ON public.clients;
    DROP POLICY IF EXISTS "Members can update clients"     ON public.clients;
    DROP POLICY IF EXISTS "Members can delete clients"     ON public.clients;

    -- SELECT: Admin+ sees all org clients
    CREATE POLICY "aegis_clients_select_admin"
      ON public.clients FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- SELECT: Workers see only clients linked to their assigned jobs
    CREATE POLICY "aegis_clients_select_worker"
      ON public.clients FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_worker()
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.client_id = clients.id
            AND j.assignee_id = auth.uid()
            AND j.organization_id = clients.organization_id
        )
      );

    -- INSERT: Admin+ only
    CREATE POLICY "aegis_clients_insert"
      ON public.clients FOR INSERT
      WITH CHECK (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- UPDATE: Admin+ only
    CREATE POLICY "aegis_clients_update"
      ON public.clients FOR UPDATE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- DELETE: Admin+ only
    CREATE POLICY "aegis_clients_delete"
      ON public.clients FOR DELETE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    RAISE NOTICE '[120/Aegis] ✓ clients RLS policies replaced with JWT claims.';
  ELSE
    RAISE NOTICE '[120/Aegis] ⊘ Skipping clients — table not found.';
  END IF;
END $$;


-- ─── 3d. finance_invoices ───────────────────────────────────────────────────
-- Only created if the table exists (it may be named `invoices` instead).

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'finance_invoices'
  ) THEN

    DROP POLICY IF EXISTS "aegis_finance_invoices_select" ON public.finance_invoices;
    DROP POLICY IF EXISTS "aegis_finance_invoices_insert" ON public.finance_invoices;
    DROP POLICY IF EXISTS "aegis_finance_invoices_update" ON public.finance_invoices;
    DROP POLICY IF EXISTS "aegis_finance_invoices_delete" ON public.finance_invoices;

    -- All operations: Admin-tier only. Workers get ZERO access.
    CREATE POLICY "aegis_finance_invoices_select"
      ON public.finance_invoices FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    CREATE POLICY "aegis_finance_invoices_insert"
      ON public.finance_invoices FOR INSERT
      WITH CHECK (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    CREATE POLICY "aegis_finance_invoices_update"
      ON public.finance_invoices FOR UPDATE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    CREATE POLICY "aegis_finance_invoices_delete"
      ON public.finance_invoices FOR DELETE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    RAISE NOTICE '[120/Aegis] ✓ finance_invoices RLS policies set (admin-only).';
  ELSE
    RAISE NOTICE '[120/Aegis] ⊘ Skipping finance_invoices — table not found.';
  END IF;
END $$;

-- Also handle the `invoices` table (the actual table from migration 013)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN

    -- Drop legacy policies from 036
    DROP POLICY IF EXISTS "invoices_select_policy"  ON public.invoices;
    DROP POLICY IF EXISTS "invoices_insert_policy"  ON public.invoices;
    DROP POLICY IF EXISTS "invoices_update_policy"  ON public.invoices;
    DROP POLICY IF EXISTS "invoices_delete_policy"  ON public.invoices;
    DROP POLICY IF EXISTS "aegis_invoices_select"   ON public.invoices;
    DROP POLICY IF EXISTS "aegis_invoices_insert"   ON public.invoices;
    DROP POLICY IF EXISTS "aegis_invoices_update"   ON public.invoices;
    DROP POLICY IF EXISTS "aegis_invoices_delete"   ON public.invoices;

    -- Also drop any old broad policies
    DROP POLICY IF EXISTS "Members can read org invoices"  ON public.invoices;
    DROP POLICY IF EXISTS "Members can create invoices"    ON public.invoices;
    DROP POLICY IF EXISTS "Members can update invoices"    ON public.invoices;
    DROP POLICY IF EXISTS "Members can delete invoices"    ON public.invoices;

    CREATE POLICY "aegis_invoices_select"
      ON public.invoices FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    CREATE POLICY "aegis_invoices_insert"
      ON public.invoices FOR INSERT
      WITH CHECK (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    CREATE POLICY "aegis_invoices_update"
      ON public.invoices FOR UPDATE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    CREATE POLICY "aegis_invoices_delete"
      ON public.invoices FOR DELETE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    RAISE NOTICE '[120/Aegis] ✓ invoices RLS policies replaced with JWT claims (admin-only).';
  ELSE
    RAISE NOTICE '[120/Aegis] ⊘ Skipping invoices — table not found.';
  END IF;
END $$;


-- ─── 3e. participant_profiles ───────────────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'participant_profiles'
  ) THEN

    -- Drop any existing Aegis policies (idempotency)
    DROP POLICY IF EXISTS "aegis_participant_profiles_select_admin"    ON public.participant_profiles;
    DROP POLICY IF EXISTS "aegis_participant_profiles_select_worker"   ON public.participant_profiles;
    DROP POLICY IF EXISTS "aegis_participant_profiles_select_external" ON public.participant_profiles;
    DROP POLICY IF EXISTS "aegis_participant_profiles_insert"          ON public.participant_profiles;
    DROP POLICY IF EXISTS "aegis_participant_profiles_update"          ON public.participant_profiles;
    DROP POLICY IF EXISTS "aegis_participant_profiles_delete"          ON public.participant_profiles;

    -- Drop any previous broad policies
    DROP POLICY IF EXISTS "Members can read org participant profiles"  ON public.participant_profiles;
    DROP POLICY IF EXISTS "participant_profiles_select"                ON public.participant_profiles;

    -- SELECT: Admin+ sees all in org
    CREATE POLICY "aegis_participant_profiles_select_admin"
      ON public.participant_profiles FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- SELECT: Workers see only participants linked to their assigned shifts
    CREATE POLICY "aegis_participant_profiles_select_worker"
      ON public.participant_profiles FOR SELECT
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_worker()
        AND EXISTS (
          SELECT 1 FROM public.schedule_blocks sb
          WHERE sb.participant_id = participant_profiles.id
            AND sb.technician_id = auth.uid()
            AND sb.organization_id = participant_profiles.organization_id
        )
      );

    -- SELECT: External / participant users see only their own profile
    CREATE POLICY "aegis_participant_profiles_select_external"
      ON public.participant_profiles FOR SELECT
      USING (
        jwt_is_external()
        AND EXISTS (
          SELECT 1 FROM public.participant_network_members pnm
          WHERE pnm.participant_id = participant_profiles.id
            AND pnm.user_id = auth.uid()
        )
      );

    -- INSERT: Admin+ only
    CREATE POLICY "aegis_participant_profiles_insert"
      ON public.participant_profiles FOR INSERT
      WITH CHECK (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- UPDATE: Admin+ only
    CREATE POLICY "aegis_participant_profiles_update"
      ON public.participant_profiles FOR UPDATE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    -- DELETE: Admin+ only
    CREATE POLICY "aegis_participant_profiles_delete"
      ON public.participant_profiles FOR DELETE
      USING (
        jwt_org_id() = organization_id
        AND jwt_is_admin()
      );

    RAISE NOTICE '[120/Aegis] ✓ participant_profiles RLS policies set.';
  ELSE
    RAISE NOTICE '[120/Aegis] ⊘ Skipping participant_profiles — table not found.';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- §4  Grants & Revokes for the Auth Hook
-- ─────────────────────────────────────────────────────────────────────────────

-- Supabase's auth service uses supabase_auth_admin role to call the hook.
-- We grant execute to that role and revoke from all others.

DO $$ BEGIN
  -- Only grant if supabase_auth_admin role exists (it does on Supabase-hosted,
  -- but may not exist on bare-metal Postgres for local dev).
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
    GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
    RAISE NOTICE '[120/Aegis] ✓ Granted execute on custom_access_token_hook to supabase_auth_admin.';
  ELSE
    RAISE NOTICE '[120/Aegis] ⊘ supabase_auth_admin role not found — skipping grant (local dev?).';
  END IF;
END $$;

-- Revoke from public-facing roles — the hook must never be callable by users.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Grant JWT helpers to authenticated (they need these for RLS evaluation)
GRANT EXECUTE ON FUNCTION public.jwt_org_id           TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_role             TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_admin         TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_owner         TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_worker        TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_external      TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_participant_id   TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_super_admin   TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- §5  Auth Hook Registration
-- ─────────────────────────────────────────────────────────────────────────────
-- Supabase auth hooks are registered via the Dashboard config or
-- supabase/config.toml, NOT via SQL. Document the setup here.
--
-- In config.toml (or Dashboard → Authentication → Hooks):
--
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/public/custom_access_token_hook"
--
-- After enabling, every token refresh will call custom_access_token_hook()
-- and the JWT will carry app_metadata.{role, org_id, is_super_admin}.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- §6  Performance Index for the Auth Hook Query
-- ─────────────────────────────────────────────────────────────────────────────
-- The hook queries organization_members by (user_id, status). Ensure the
-- existing index covers this hot path.

CREATE INDEX IF NOT EXISTS idx_org_members_user_status_role
  ON public.organization_members (user_id, status, role)
  WHERE status = 'active';

COMMENT ON INDEX idx_org_members_user_status_role IS
  'Aegis: covers the custom_access_token_hook hot-path query (user_id + active + role ordering).';


-- ═══════════════════════════════════════════════════════════════════════════════
-- End of Migration 120: Project Aegis — Global RBAC Engine
-- ═══════════════════════════════════════════════════════════════════════════════
