-- ============================================================================
-- @migration IroncladRemediationVault
-- @status COMPLETE
-- @description Evidence vault, compliance documents bucket, cascading worker suspension
-- @tables storage bucket: compliance-documents, remediation_actions
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. compliance-documents Storage Bucket ─────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compliance-documents',
  'compliance-documents',
  FALSE,
  5242880,  -- 5MB strict limit
  ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/jpg','image/png','image/webp'];

-- ── 2. RLS Policies for compliance-documents bucket ────────

-- Workers can read their own documents
CREATE POLICY "workers_read_own_compliance_docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'compliance-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'OWNER', 'MANAGER')
  )
);

-- Only ADMIN/OWNER can upload on behalf of workers
CREATE POLICY "admins_upload_compliance_docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'OWNER', 'MANAGER')
);

-- Admins can delete / replace documents
CREATE POLICY "admins_delete_compliance_docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'compliance-documents'
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ADMIN', 'OWNER', 'MANAGER')
);

-- ── 3. worker_credentials table enhancement ─────────────────
-- Add storage_path column if not present, and verification_status enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worker_credentials' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.worker_credentials ADD COLUMN storage_path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worker_credentials' AND column_name = 'issued_date'
  ) THEN
    ALTER TABLE public.worker_credentials ADD COLUMN issued_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worker_credentials' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE public.worker_credentials ADD COLUMN file_url TEXT;
  END IF;
END $$;

-- ── 4. suspend_worker_cascade RPC ──────────────────────────
CREATE OR REPLACE FUNCTION public.suspend_worker_cascade(
  p_worker_id  UUID,
  p_admin_id   UUID,
  p_reason     TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orphaned_count  INT  := 0;
  v_revenue_risk    DECIMAL(12,2) := 0;
  v_worker_name     TEXT;
BEGIN
  -- Guard: cannot suspend a worker who is currently clocked in
  IF EXISTS (
    SELECT 1 FROM public.time_logs
    WHERE worker_id = p_worker_id
      AND clock_out IS NULL
  ) THEN
    RAISE EXCEPTION 'WORKER_ACTIVE_SHIFT: Cannot suspend worker with an active in-progress shift. Ask the worker to clock out or manually close the timesheet first.';
  END IF;

  -- Guard: worker must exist
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_worker_id) THEN
    RAISE EXCEPTION 'WORKER_NOT_FOUND: Worker profile does not exist.';
  END IF;

  -- Fetch worker name for audit record
  SELECT COALESCE(full_name, email, 'Unknown') INTO v_worker_name
  FROM public.profiles WHERE id = p_worker_id;

  -- 1. Suspend the profile
  UPDATE public.profiles
  SET
    status       = 'suspended',
    suspended_at = NOW(),
    updated_at   = NOW()
  WHERE id = p_worker_id;

  -- 2. Orphan future shifts (all platforms: schedule_blocks table)
  WITH orphaned AS (
    UPDATE public.schedule_blocks
    SET
      assigned_to = NULL,
      status      = 'unassigned',
      updated_at  = NOW()
    WHERE assigned_to = p_worker_id
      AND start_time > NOW()
      AND status NOT IN ('cancelled', 'completed')
    RETURNING id, (metadata->>'expected_revenue')::decimal AS expected_revenue
  )
  SELECT
    COUNT(id),
    COALESCE(SUM(expected_revenue), 0)
  INTO v_orphaned_count, v_revenue_risk
  FROM orphaned;

  -- 3. Revoke JWT sessions — inject session_revoked_at into app_metadata
  --    The Supabase auth hook checks iat < session_revoked_at → 401
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('session_revoked_at', EXTRACT(EPOCH FROM NOW())::bigint)
  WHERE id = p_worker_id;

  -- 4. Create audit log
  INSERT INTO public.audit_logs (
    action,
    target_id,
    actor_id,
    organization_id,
    details,
    created_at
  )
  SELECT
    'WORKER_SUSPENDED',
    p_worker_id,
    p_admin_id,
    p.organization_id,
    jsonb_build_object(
      'reason',          p_reason,
      'worker_name',     v_worker_name,
      'orphaned_shifts', v_orphaned_count,
      'revenue_risk',    v_revenue_risk
    ),
    NOW()
  FROM public.profiles p
  WHERE p.id = p_admin_id
  LIMIT 1;

  RETURN json_build_object(
    'success',         true,
    'orphaned_shifts', v_orphaned_count,
    'revenue_risk',    v_revenue_risk,
    'worker_name',     v_worker_name
  );
END;
$$;

-- ── 5. lift_worker_suspension RPC ──────────────────────────
CREATE OR REPLACE FUNCTION public.lift_worker_suspension(
  p_worker_id UUID,
  p_admin_id  UUID,
  p_notes     TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_worker_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_worker_id AND status = 'suspended'
  ) THEN
    RAISE EXCEPTION 'WORKER_NOT_SUSPENDED: Worker is not currently suspended.';
  END IF;

  SELECT COALESCE(full_name, email, 'Unknown') INTO v_worker_name
  FROM public.profiles WHERE id = p_worker_id;

  -- Restore profile status
  UPDATE public.profiles
  SET
    status       = 'active',
    suspended_at = NULL,
    updated_at   = NOW()
  WHERE id = p_worker_id;

  -- Clear session revocation so they can log back in
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) - 'session_revoked_at'
  WHERE id = p_worker_id;

  -- Audit log
  INSERT INTO public.audit_logs (
    action, target_id, actor_id, organization_id, details, created_at
  )
  SELECT
    'WORKER_SUSPENSION_LIFTED',
    p_worker_id,
    p_admin_id,
    p.organization_id,
    jsonb_build_object(
      'worker_name', v_worker_name,
      'notes',       p_notes
    ),
    NOW()
  FROM public.profiles p
  WHERE p.id = p_admin_id
  LIMIT 1;

  RETURN json_build_object('success', true, 'worker_name', v_worker_name);
END;
$$;

-- ── 6. preview_suspension_impact RPC (for telemetry) ────────
CREATE OR REPLACE FUNCTION public.preview_suspension_impact(
  p_worker_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orphaned_count  INT;
  v_revenue_risk    DECIMAL(12,2);
  v_has_active_shift BOOLEAN;
  v_worker_name     TEXT;
BEGIN
  SELECT COALESCE(full_name, email, 'Unknown') INTO v_worker_name
  FROM public.profiles WHERE id = p_worker_id;

  SELECT EXISTS(
    SELECT 1 FROM public.time_logs
    WHERE worker_id = p_worker_id AND clock_out IS NULL
  ) INTO v_has_active_shift;

  SELECT
    COUNT(id),
    COALESCE(SUM((metadata->>'expected_revenue')::decimal), 0)
  INTO v_orphaned_count, v_revenue_risk
  FROM public.schedule_blocks
  WHERE assigned_to = p_worker_id
    AND start_time > NOW()
    AND status NOT IN ('cancelled', 'completed', 'unassigned');

  RETURN json_build_object(
    'worker_name',      v_worker_name,
    'orphaned_shifts',  v_orphaned_count,
    'revenue_risk',     v_revenue_risk,
    'has_active_shift', v_has_active_shift
  );
END;
$$;

-- ── 7. add 'suspended_at' column to profiles if missing ─────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN suspended_at TIMESTAMPTZ;
  END IF;
END $$;

-- ── 8. audit_log organization_id column if missing ──────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.audit_log ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
  END IF;
END $$;

COMMENT ON FUNCTION public.suspend_worker_cascade IS
  'Atomically: suspend profile, orphan future shifts, revoke JWT sessions, write audit log. Guards against in-flight shifts.';

COMMENT ON FUNCTION public.lift_worker_suspension IS
  'Lift a suspension: restore active status, clear session revocation. Does NOT re-assign orphaned shifts.';

COMMENT ON FUNCTION public.preview_suspension_impact IS
  'Read-only preview of how many shifts + revenue would be impacted by a suspension. Used to populate UI telemetry before confirmation.';
