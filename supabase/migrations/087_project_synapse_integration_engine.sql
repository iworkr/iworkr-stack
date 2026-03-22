-- ============================================================================
-- @migration ProjectSynapseIntegrationEngine
-- @status COMPLETE
-- @description Project Synapse — universal webhook ingestion, mapping ledger, sync queue
-- @tables external_mappings, sync_queue, webhook_events
-- @lastAudit 2026-03-22
-- ============================================================================

-- Extend integration status enum for lifecycle visibility.
ALTER TYPE public.integration_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.integration_status ADD VALUE IF NOT EXISTS 'paused';

-- ------------------------------------------------------------
-- 1) Universal external mapping ledger (internal <-> external IDs)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  internal_table text NOT NULL,
  internal_record_id uuid NOT NULL,
  external_id text NOT NULL,
  external_type text,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT external_mappings_unique_link UNIQUE (integration_id, internal_table, internal_record_id),
  CONSTRAINT external_mappings_unique_external UNIQUE (integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_external_mappings_org ON public.external_mappings (organization_id, internal_table);
CREATE INDEX IF NOT EXISTS idx_external_mappings_external ON public.external_mappings (integration_id, external_id);

CREATE TRIGGER set_external_mappings_updated_at
  BEFORE UPDATE ON public.external_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.external_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'external_mappings' AND policyname = 'Members can read org external mappings'
  ) THEN
    CREATE POLICY "Members can read org external mappings"
      ON public.external_mappings FOR SELECT
      USING (organization_id IN (SELECT public.get_user_org_ids()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'external_mappings' AND policyname = 'Admins can manage org external mappings'
  ) THEN
    CREATE POLICY "Admins can manage org external mappings"
      ON public.external_mappings FOR ALL
      USING (public.user_has_role(organization_id, 'admin'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2) Inbound webhook ingest ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_type text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  signature text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text,
  processed boolean DEFAULT false,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT integration_webhooks_provider_event_hash_unique UNIQUE (provider, event_type, payload_hash)
);

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_org ON public.integration_webhooks (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_provider ON public.integration_webhooks (provider, processed, created_at DESC);

ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_webhooks' AND policyname = 'Members can read org integration webhooks'
  ) THEN
    CREATE POLICY "Members can read org integration webhooks"
      ON public.integration_webhooks FOR SELECT
      USING (
        organization_id IS NOT NULL
        AND organization_id IN (SELECT public.get_user_org_ids())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_webhooks' AND policyname = 'Admins can manage org integration webhooks'
  ) THEN
    CREATE POLICY "Admins can manage org integration webhooks"
      ON public.integration_webhooks FOR ALL
      USING (
        organization_id IS NOT NULL
        AND public.user_has_role(organization_id, 'admin')
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3) Sync audit log (radar feed source)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional', 'inbound', 'outbound')),
  entity_type text NOT NULL,
  entity_id text,
  provider_entity_id text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'skipped', 'pending')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_log_org_created ON public.integration_sync_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_status ON public.integration_sync_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_sync_log_integration ON public.integration_sync_log (integration_id, created_at DESC);

ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_sync_log' AND policyname = 'Members can read org integration sync log'
  ) THEN
    CREATE POLICY "Members can read org integration sync log"
      ON public.integration_sync_log FOR SELECT
      USING (
        organization_id IS NOT NULL
        AND organization_id IN (SELECT public.get_user_org_ids())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_sync_log' AND policyname = 'Admins can manage org integration sync log'
  ) THEN
    CREATE POLICY "Admins can manage org integration sync log"
      ON public.integration_sync_log FOR ALL
      USING (
        organization_id IS NOT NULL
        AND public.user_has_role(organization_id, 'admin')
      );
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4) Outbound queue for rate-limited providers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  operation text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT integration_sync_queue_idempotency UNIQUE (integration_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_queue_next_attempt
  ON public.integration_sync_queue (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_integration_sync_queue_org
  ON public.integration_sync_queue (organization_id, created_at DESC);

CREATE TRIGGER set_integration_sync_queue_updated_at
  BEFORE UPDATE ON public.integration_sync_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.integration_sync_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_sync_queue' AND policyname = 'Members can read org integration sync queue'
  ) THEN
    CREATE POLICY "Members can read org integration sync queue"
      ON public.integration_sync_queue FOR SELECT
      USING (organization_id IN (SELECT public.get_user_org_ids()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'integration_sync_queue' AND policyname = 'Admins can manage org integration sync queue'
  ) THEN
    CREATE POLICY "Admins can manage org integration sync queue"
      ON public.integration_sync_queue FOR ALL
      USING (public.user_has_role(organization_id, 'admin'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5) Utility functions for queueing and radar feed
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_integration_sync_job(
  p_organization_id uuid,
  p_integration_id uuid,
  p_provider text,
  p_operation text,
  p_payload jsonb,
  p_idempotency_key text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.integration_sync_queue (
    organization_id,
    integration_id,
    provider,
    operation,
    payload,
    idempotency_key
  ) VALUES (
    p_organization_id,
    p_integration_id,
    p_provider,
    p_operation,
    COALESCE(p_payload, '{}'::jsonb),
    p_idempotency_key
  )
  ON CONFLICT (integration_id, idempotency_key) DO UPDATE
    SET payload = EXCLUDED.payload,
        updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_sync_radar_feed(
  p_org_id uuid,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  integration_id uuid,
  direction text,
  entity_type text,
  status text,
  error_message text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    l.id,
    l.integration_id,
    l.direction,
    l.entity_type,
    l.status,
    l.error_message,
    l.created_at
  FROM public.integration_sync_log l
  WHERE l.organization_id = p_org_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

CREATE OR REPLACE FUNCTION public.mark_integration_expired(
  p_integration_id uuid,
  p_error text DEFAULT 'Token expired or revoked. Re-authentication required.'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Dynamic SQL avoids enum "new value used before commit" migration failure.
  EXECUTE
    'UPDATE public.integrations
     SET status = $1::public.integration_status,
         error_message = COALESCE($2, error_message),
         updated_at = now()
     WHERE id = $3'
  USING 'expired', p_error, p_integration_id;
END;
$$;
