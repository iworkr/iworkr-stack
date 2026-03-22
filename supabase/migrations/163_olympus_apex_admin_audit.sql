-- ============================================================================
-- @migration OlympusApexAdminAudit
-- @status COMPLETE
-- @description Project Olympus-Apex — immutable admin audit logs, impersonation tracking
-- @tables admin_audit_logs, impersonation_sessions
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1. Ensure admin_audit_logs exists with immutable constraints
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admin_id UUID NOT NULL,
    admin_email TEXT,
    action_type TEXT NOT NULL,
    target_workspace_id UUID,
    target_user_id UUID,
    target_record_id TEXT,
    payload JSONB DEFAULT '{}',
    ip_address TEXT,
    duration_seconds INT
);

-- Immutable: deny UPDATE and DELETE on audit logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'Deny delete on admin_audit_logs'
  ) THEN
    ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Deny delete on admin_audit_logs"
      ON public.admin_audit_logs FOR DELETE USING (false);
    CREATE POLICY "Deny update on admin_audit_logs"
      ON public.admin_audit_logs FOR UPDATE USING (false);
    CREATE POLICY "Service role insert on admin_audit_logs"
      ON public.admin_audit_logs FOR INSERT WITH CHECK (true);
    CREATE POLICY "Service role select on admin_audit_logs"
      ON public.admin_audit_logs FOR SELECT USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin
    ON public.admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action
    ON public.admin_audit_logs (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_ws
    ON public.admin_audit_logs (target_workspace_id, created_at DESC);

-- 2. Communication logs indexes for Omni-Ledger search
CREATE INDEX IF NOT EXISTS idx_comms_logs_created
    ON public.communication_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_logs_workspace
    ON public.communication_logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_logs_channel
    ON public.communication_logs (channel, created_at DESC);

-- 3. Impersonation sessions table
CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID NOT NULL,
    admin_email TEXT NOT NULL,
    target_user_id UUID NOT NULL,
    target_email TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_impersonation_active
    ON public.impersonation_sessions (target_user_id, status)
    WHERE status = 'active';

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role access on impersonation_sessions"
    ON public.impersonation_sessions FOR ALL USING (true) WITH CHECK (true);
