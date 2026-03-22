-- ============================================================================
-- @migration ZenithApexGAHardening
-- @status COMPLETE
-- @description Project Zenith-Apex GA Launch: Performance indexes for RLS,
--   audit/analytics table lockdown, and invoice secure_token for IDOR prevention.
-- @tables organization_members, admin_audit_logs, analytics_refresh_log, invoices
-- @lastAudit 2026-03-22
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. RLS PERFORMANCE INDEX
-- ═══════════════════════════════════════════════════════════════════════════════
-- is_org_member() is called on EVERY row access for jobs/clients/invoices.
-- Without this index, Postgres does a sequential scan on organization_members.
-- At 10K+ members this becomes a performance cliff.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_org_members_user_org_active
ON public.organization_members(user_id, organization_id)
WHERE status = 'active';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. AUDIT LOGS LOCKDOWN (Pre-Launch Audit Item #19)
-- ═══════════════════════════════════════════════════════════════════════════════
-- admin_audit_logs currently allows ANY authenticated user to INSERT/SELECT.
-- Lock down to service_role only (INSERT) and admin/superadmin (SELECT).
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Enable insert for all users" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "insert_audit_logs" ON public.admin_audit_logs;

-- Only service_role and superadmins can insert audit entries
CREATE POLICY "zenith_audit_logs_insert_service_role"
ON public.admin_audit_logs FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt()->'app_metadata'->>'is_super_admin')::boolean = true
);

-- Only superadmins can read audit logs
DROP POLICY IF EXISTS "Enable read for all users" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Anyone can read audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "select_audit_logs" ON public.admin_audit_logs;

CREATE POLICY "zenith_audit_logs_select_superadmin"
ON public.admin_audit_logs FOR SELECT TO authenticated
USING (
  (auth.jwt()->'app_metadata'->>'is_super_admin')::boolean = true
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ANALYTICS REFRESH LOG LOCKDOWN (Pre-Launch Audit Item #18)
-- ═══════════════════════════════════════════════════════════════════════════════
-- analytics_refresh_log has FOR ALL USING(true) without TO restriction.
-- Lock to service_role only.
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service role manages refresh log" ON public.analytics_refresh_log;
DROP POLICY IF EXISTS "Enable full access for all users" ON public.analytics_refresh_log;

-- Block all authenticated access — only service_role (which bypasses RLS) can write
CREATE POLICY "zenith_analytics_refresh_deny_all"
ON public.analytics_refresh_log FOR ALL TO authenticated
USING (false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. INVOICE SECURE TOKEN (IDOR Prevention — Pre-Launch Audit Item #7)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Public invoice access currently only requires the invoice UUID.
-- Add a secure_token column for IDOR-safe public access.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS secure_token UUID DEFAULT gen_random_uuid();

-- Backfill: ensure all existing invoices get a token
UPDATE public.invoices SET secure_token = gen_random_uuid()
WHERE secure_token IS NULL;

-- Index for public invoice lookups by id + token
CREATE INDEX IF NOT EXISTS idx_invoices_secure_token
ON public.invoices(id, secure_token);
