-- ============================================================================
-- @migration LedgerBridgeEngine
-- @status COMPLETE
-- @description Project Ledger-Bridge — Two-way accounting sync engine with
--   GL code mapping, payroll earnings rate mapping, entity identity tracking,
--   queue-based AR pipeline, and connection health monitoring.
-- @tables integration_account_codes, integration_entity_map
-- @alters integration_tokens, integration_sync_queue
-- @lastAudit 2026-03-24
-- ============================================================================

-- ── 1. Extend accounting_provider enum ────────────────────
DO $$ BEGIN
  ALTER TYPE public.accounting_provider ADD VALUE IF NOT EXISTS 'QBO';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Extend integration_entity_type enum ────────────────
DO $$ BEGIN
  ALTER TYPE public.integration_entity_type ADD VALUE IF NOT EXISTS 'CONTACT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.integration_entity_type ADD VALUE IF NOT EXISTS 'INVOICE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.integration_entity_type ADD VALUE IF NOT EXISTS 'PAYMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.integration_entity_type ADD VALUE IF NOT EXISTS 'TIMESHEET';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.integration_entity_type ADD VALUE IF NOT EXISTS 'EARNINGS_RATE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.integration_entity_type ADD VALUE IF NOT EXISTS 'GL_ACCOUNT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Extend sync_entity_type enum ──────────────────────
DO $$ BEGIN
  ALTER TYPE public.sync_entity_type ADD VALUE IF NOT EXISTS 'PAYMENT';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.sync_entity_type ADD VALUE IF NOT EXISTS 'ITEM';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Integration Account Codes (GL + Payroll Earnings Rate Mapping) ──
-- Maps iWorkr service categories and pay categories to Xero GL codes,
-- tax types, and Payroll Earnings Rate GUIDs.
CREATE TABLE IF NOT EXISTS public.integration_account_codes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL DEFAULT 'XERO',

  iworkr_code_type          TEXT NOT NULL,
  iworkr_code_key           TEXT NOT NULL,
  iworkr_code_label         TEXT,

  external_code             TEXT NOT NULL,
  external_name             TEXT,
  external_tax_type         TEXT,
  external_category         TEXT,

  is_gst_free               BOOLEAN DEFAULT false,
  is_active                 BOOLEAN DEFAULT true,

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),

  UNIQUE(workspace_id, provider, iworkr_code_type, iworkr_code_key)
);

ALTER TABLE public.integration_account_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_account_codes'
      AND policyname = 'org_admins_manage_account_codes'
  ) THEN
    CREATE POLICY "org_admins_manage_account_codes"
      ON public.integration_account_codes FOR ALL
      USING (
        workspace_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_codes_workspace
  ON public.integration_account_codes(workspace_id, provider, iworkr_code_type);

-- ── 5. Integration Entity Map (AR Pipeline Identity Tracking) ──
-- Tracks the relationship between iWorkr UUIDs and external accounting GUIDs
-- for Contacts, Invoices, Payments, Employees, etc.
CREATE TABLE IF NOT EXISTS public.integration_entity_map (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL DEFAULT 'XERO',
  entity_type               TEXT NOT NULL,
  iworkr_id                 UUID NOT NULL,
  external_id               TEXT NOT NULL,
  external_number           TEXT,
  sync_status               TEXT DEFAULT 'SYNCED',
  last_synced_at            TIMESTAMPTZ DEFAULT now(),
  last_error                TEXT,
  metadata                  JSONB DEFAULT '{}',

  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),

  UNIQUE(workspace_id, provider, entity_type, iworkr_id)
);

ALTER TABLE public.integration_entity_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_entity_map'
      AND policyname = 'org_members_read_entity_map'
  ) THEN
    CREATE POLICY "org_members_read_entity_map"
      ON public.integration_entity_map FOR SELECT
      USING (
        workspace_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_entity_map'
      AND policyname = 'org_admins_manage_entity_map'
  ) THEN
    CREATE POLICY "org_admins_manage_entity_map"
      ON public.integration_entity_map FOR ALL
      USING (
        workspace_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entity_map_workspace
  ON public.integration_entity_map(workspace_id, provider, entity_type);

CREATE INDEX IF NOT EXISTS idx_entity_map_external_id
  ON public.integration_entity_map(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_map_iworkr_id
  ON public.integration_entity_map(iworkr_id);

-- ── 6. Extend integration_tokens with connection health ──
ALTER TABLE public.integration_tokens
  ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'CONNECTED',
  ADD COLUMN IF NOT EXISTS disconnect_reason TEXT,
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

-- ── 7. Extend integration_sync_queue for entity-aware processing ──
ALTER TABLE public.integration_sync_queue
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS action TEXT DEFAULT 'CREATE',
  ADD COLUMN IF NOT EXISTS payload_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS error_log TEXT;

CREATE INDEX IF NOT EXISTS idx_sync_queue_entity
  ON public.integration_sync_queue(entity_type, entity_id)
  WHERE entity_type IS NOT NULL;

-- ── 8. Auto-update triggers ─────────────────────────────
DROP TRIGGER IF EXISTS trg_account_codes_updated_at ON public.integration_account_codes;
CREATE TRIGGER trg_account_codes_updated_at
  BEFORE UPDATE ON public.integration_account_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_integration_updated_at();

DROP TRIGGER IF EXISTS trg_entity_map_updated_at ON public.integration_entity_map;
CREATE TRIGGER trg_entity_map_updated_at
  BEFORE UPDATE ON public.integration_entity_map
  FOR EACH ROW EXECUTE FUNCTION public.update_integration_updated_at();

-- ── 9. RPC: Enqueue entity for accounting sync ──────────
CREATE OR REPLACE FUNCTION public.enqueue_ledger_sync(
  p_workspace_id      UUID,
  p_entity_type       TEXT,
  p_entity_id         UUID,
  p_action            TEXT DEFAULT 'CREATE',
  p_payload           JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_integration_id UUID;
  v_provider TEXT := 'xero';
  v_idempotency_key TEXT;
BEGIN
  SELECT i.id INTO v_integration_id
  FROM public.integrations i
  WHERE i.organization_id = p_workspace_id
    AND i.provider IN ('xero', 'XERO')
    AND i.status = 'connected'
  LIMIT 1;

  IF v_integration_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.integration_tokens
      WHERE workspace_id = p_workspace_id
        AND provider = 'XERO'
        AND (connection_status IS NULL OR connection_status = 'CONNECTED')
    ) THEN
      INSERT INTO public.integrations (organization_id, provider, status, config)
      VALUES (p_workspace_id, 'xero', 'connected', '{"auto_created": true}'::jsonb)
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_integration_id;

      IF v_integration_id IS NULL THEN
        SELECT id INTO v_integration_id
        FROM public.integrations
        WHERE organization_id = p_workspace_id
          AND provider IN ('xero', 'XERO')
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  IF v_integration_id IS NULL THEN
    RAISE EXCEPTION 'No active accounting integration found for workspace %', p_workspace_id;
  END IF;

  v_idempotency_key := p_entity_type || '_' || p_entity_id::text || '_' || p_action;

  INSERT INTO public.integration_sync_queue (
    organization_id, integration_id, provider, operation,
    entity_type, entity_id, action, payload_snapshot, payload,
    idempotency_key, status, next_attempt_at
  ) VALUES (
    p_workspace_id, v_integration_id, v_provider, p_action,
    p_entity_type, p_entity_id, p_action, p_payload, p_payload,
    v_idempotency_key, 'queued', now()
  )
  ON CONFLICT (integration_id, idempotency_key) DO UPDATE
    SET payload_snapshot = EXCLUDED.payload_snapshot,
        payload = EXCLUDED.payload,
        status = 'queued',
        attempt_count = 0,
        next_attempt_at = now(),
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 10. RPC: Get queue dashboard stats ──────────────────
CREATE OR REPLACE FUNCTION public.get_queue_dashboard(
  p_workspace_id UUID
)
RETURNS TABLE (
  total_queued BIGINT,
  total_processing BIGINT,
  total_completed BIGINT,
  total_failed BIGINT,
  oldest_queued_at TIMESTAMPTZ,
  recent_items JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('queued', 'pending', 'QUEUED')) AS total_queued,
      COUNT(*) FILTER (WHERE status = 'processing') AS total_processing,
      COUNT(*) FILTER (WHERE status IN ('completed', 'done')) AS total_completed,
      COUNT(*) FILTER (WHERE status IN ('failed', 'FAILED_PERMANENTLY')) AS total_failed,
      MIN(created_at) FILTER (WHERE status IN ('queued', 'pending', 'QUEUED')) AS oldest_queued_at
    FROM public.integration_sync_queue
    WHERE organization_id = p_workspace_id
  ),
  recent AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', sq.id,
        'entity_type', COALESCE(sq.entity_type, sq.operation),
        'action', COALESCE(sq.action, sq.operation),
        'status', sq.status,
        'attempt_count', sq.attempt_count,
        'last_error', sq.last_error,
        'created_at', sq.created_at,
        'completed_at', sq.completed_at
      ) ORDER BY sq.created_at DESC
    ) AS items
    FROM (
      SELECT * FROM public.integration_sync_queue
      WHERE organization_id = p_workspace_id
      ORDER BY created_at DESC
      LIMIT 25
    ) sq
  )
  SELECT
    s.total_queued,
    s.total_processing,
    s.total_completed,
    s.total_failed,
    s.oldest_queued_at,
    COALESCE(r.items, '[]'::jsonb) AS recent_items
  FROM stats s
  CROSS JOIN recent r;
$$;

-- ── 11. RPC: Get entity mappings ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_entity_mappings(
  p_workspace_id UUID,
  p_entity_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  iworkr_id UUID,
  external_id TEXT,
  external_number TEXT,
  sync_status TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, entity_type, iworkr_id, external_id, external_number,
         sync_status, last_synced_at, last_error
  FROM public.integration_entity_map
  WHERE workspace_id = p_workspace_id
    AND (p_entity_type IS NULL OR entity_type = p_entity_type)
  ORDER BY last_synced_at DESC NULLS LAST
  LIMIT p_limit;
$$;

-- ── 12. RPC: Upsert entity mapping ──────────────────────
CREATE OR REPLACE FUNCTION public.upsert_entity_mapping(
  p_workspace_id    UUID,
  p_provider        TEXT,
  p_entity_type     TEXT,
  p_iworkr_id       UUID,
  p_external_id     TEXT,
  p_external_number TEXT DEFAULT NULL,
  p_metadata        JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.integration_entity_map (
    workspace_id, provider, entity_type, iworkr_id,
    external_id, external_number, sync_status, last_synced_at, metadata
  ) VALUES (
    p_workspace_id, p_provider, p_entity_type, p_iworkr_id,
    p_external_id, p_external_number, 'SYNCED', now(), p_metadata
  )
  ON CONFLICT (workspace_id, provider, entity_type, iworkr_id)
  DO UPDATE SET
    external_id = EXCLUDED.external_id,
    external_number = EXCLUDED.external_number,
    sync_status = 'SYNCED',
    last_synced_at = now(),
    last_error = NULL,
    metadata = EXCLUDED.metadata,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── 13. RPC: Mark connection disconnected ────────────────
CREATE OR REPLACE FUNCTION public.mark_integration_disconnected(
  p_workspace_id UUID,
  p_provider TEXT DEFAULT 'XERO',
  p_reason TEXT DEFAULT 'Token refresh failed or revoked'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.integration_tokens
  SET connection_status = 'DISCONNECTED',
      disconnect_reason = p_reason,
      disconnected_at = now(),
      updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND provider = p_provider::accounting_provider;

  UPDATE public.integrations
  SET status = 'disconnected',
      error_message = p_reason,
      updated_at = now()
  WHERE organization_id = p_workspace_id
    AND provider IN (LOWER(p_provider), UPPER(p_provider));
END;
$$;
