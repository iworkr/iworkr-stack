-- ============================================================================
-- @migration VaultSync
-- @status COMPLETE
-- @description Project Vault-Sync: Server-side support for offline-first mobile
--   sync engine. Device registry, sync logs, and conflict tracking.
-- @tables sync_device_logs
-- @lastAudit 2026-03-24
-- ============================================================================

-- ─── 1. Sync Device Logs ─────────────────────────────────────────────────────
-- Tracks every sync attempt from mobile devices for monitoring and debugging.

CREATE TABLE IF NOT EXISTS public.sync_device_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       TEXT NOT NULL,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  mutation_count  INTEGER NOT NULL DEFAULT 0,
  success_count   INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  sync_duration_ms INTEGER,
  error_summary   TEXT,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_device_logs_user
  ON public.sync_device_logs (user_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_device_logs_device
  ON public.sync_device_logs (device_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_device_logs_synced
  ON public.sync_device_logs (synced_at DESC);

-- ─── 2. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.sync_device_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_device_logs' AND policyname = 'Users can view own sync logs') THEN
    CREATE POLICY "Users can view own sync logs"
      ON public.sync_device_logs FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sync_device_logs' AND policyname = 'Service role can manage sync logs') THEN
    CREATE POLICY "Service role can manage sync logs"
      ON public.sync_device_logs FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- ─── 3. Sync Health RPC ──────────────────────────────────────────────────────
-- Returns sync health metrics for the admin dashboard.

CREATE OR REPLACE FUNCTION public.get_sync_health(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_syncs_24h', (
      SELECT COUNT(*) FROM public.sync_device_logs
      WHERE synced_at > now() - interval '24 hours'
        AND user_id IN (
          SELECT user_id FROM public.organization_members
          WHERE organization_id = p_organization_id AND status = 'active'
        )
    ),
    'unique_devices_24h', (
      SELECT COUNT(DISTINCT device_id) FROM public.sync_device_logs
      WHERE synced_at > now() - interval '24 hours'
        AND user_id IN (
          SELECT user_id FROM public.organization_members
          WHERE organization_id = p_organization_id AND status = 'active'
        )
    ),
    'total_mutations_24h', (
      SELECT COALESCE(SUM(mutation_count), 0) FROM public.sync_device_logs
      WHERE synced_at > now() - interval '24 hours'
        AND user_id IN (
          SELECT user_id FROM public.organization_members
          WHERE organization_id = p_organization_id AND status = 'active'
        )
    ),
    'failed_mutations_24h', (
      SELECT COALESCE(SUM(failed_count), 0) FROM public.sync_device_logs
      WHERE synced_at > now() - interval '24 hours'
        AND user_id IN (
          SELECT user_id FROM public.organization_members
          WHERE organization_id = p_organization_id AND status = 'active'
        )
    ),
    'last_sync', (
      SELECT MAX(synced_at) FROM public.sync_device_logs
      WHERE user_id IN (
        SELECT user_id FROM public.organization_members
        WHERE organization_id = p_organization_id AND status = 'active'
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON TABLE public.sync_device_logs IS
  'Project Vault-Sync: Tracks mobile device sync attempts for monitoring and debugging.';
