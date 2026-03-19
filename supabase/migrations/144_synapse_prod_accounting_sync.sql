-- ============================================================
-- Migration 144: Project Synapse-Prod — Production Accounting Sync
-- Version 146.0 — "Cryptographic Resilience & Absolute Ledger Parity"
-- ============================================================

-- ── 1. Upgrade integration_tokens with connection_id + webhook key ──
ALTER TABLE public.integration_tokens
  ADD COLUMN IF NOT EXISTS connection_id VARCHAR,
  ADD COLUMN IF NOT EXISTS webhook_signing_key TEXT,
  ADD COLUMN IF NOT EXISTS token_refresh_lock_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_failure_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_production BOOLEAN DEFAULT false;

-- ── 2. Upgrade integration_sync_queue with rate limit columns ──
ALTER TABLE public.integration_sync_queue
  ADD COLUMN IF NOT EXISTS endpoint VARCHAR,
  ADD COLUMN IF NOT EXISTS method VARCHAR DEFAULT 'POST',
  ADD COLUMN IF NOT EXISTS response_status INT,
  ADD COLUMN IF NOT EXISTS response_body JSONB,
  ADD COLUMN IF NOT EXISTS rate_limited_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_category_id VARCHAR,
  ADD COLUMN IF NOT EXISTS tracking_option_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_sync_queue_status_retry
  ON public.integration_sync_queue(status, next_attempt_at)
  WHERE status IN ('queued', 'QUEUED');

-- ── 3. Integration health metrics table ─────────────────────
CREATE TABLE IF NOT EXISTS public.integration_health_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  metric_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  items_synced          INT DEFAULT 0,
  items_failed          INT DEFAULT 0,
  items_queued          INT DEFAULT 0,
  avg_response_ms       INT DEFAULT 0,
  rate_limit_hits       INT DEFAULT 0,
  token_refreshes       INT DEFAULT 0,
  webhook_events        INT DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, provider, metric_date)
);

ALTER TABLE public.integration_health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view health metrics" ON public.integration_health_metrics FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 4. Tax mapping cache (live from provider) ───────────────
CREATE TABLE IF NOT EXISTS public.integration_tax_cache (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  tax_type              VARCHAR NOT NULL,
  tax_name              VARCHAR NOT NULL,
  tax_rate              NUMERIC(5,2),
  is_active             BOOLEAN DEFAULT true,
  fetched_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, provider, tax_type)
);

ALTER TABLE public.integration_tax_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view tax cache" ON public.integration_tax_cache FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 5. Account code cache (live from provider) ──────────────
CREATE TABLE IF NOT EXISTS public.integration_account_cache (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  account_code          VARCHAR NOT NULL,
  account_name          VARCHAR NOT NULL,
  account_type          VARCHAR,
  is_active             BOOLEAN DEFAULT true,
  fetched_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, provider, account_code)
);

ALTER TABLE public.integration_account_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view account cache" ON public.integration_account_cache FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 6. Tracking categories cache ────────────────────────────
CREATE TABLE IF NOT EXISTS public.integration_tracking_cache (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  category_id           VARCHAR NOT NULL,
  category_name         VARCHAR NOT NULL,
  option_id             VARCHAR,
  option_name           VARCHAR,
  fetched_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.integration_tracking_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view tracking cache" ON public.integration_tracking_cache FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'));

-- ── 7. RPC: Get valid token with advisory lock ──────────────
CREATE OR REPLACE FUNCTION public.get_valid_integration_token(
  p_workspace_id UUID,
  p_provider TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token RECORD;
  v_lock_key BIGINT;
  v_locked BOOLEAN;
BEGIN
  -- Compute a deterministic lock key from workspace_id
  v_lock_key := hashtext(p_workspace_id::text || '_' || p_provider);

  -- Attempt to acquire advisory lock (transaction-scoped)
  v_locked := pg_try_advisory_xact_lock(v_lock_key);

  IF NOT v_locked THEN
    -- Another thread is refreshing. Wait up to 10 seconds then retry.
    PERFORM pg_sleep(0.5);
    -- Re-fetch — the other thread should have refreshed by now
    SELECT * INTO v_token
    FROM public.integration_tokens
    WHERE workspace_id = p_workspace_id AND provider::text = p_provider;

    IF v_token IS NULL THEN
      RETURN json_build_object('error', 'Token not found', 'needs_refresh', false);
    END IF;

    RETURN json_build_object(
      'access_token', v_token.access_token,
      'refresh_token', v_token.refresh_token,
      'expires_at', v_token.expires_at,
      'external_tenant_id', v_token.external_tenant_id,
      'connection_id', v_token.connection_id,
      'needs_refresh', v_token.expires_at <= (now() + interval '5 minutes'),
      'locked_by_other', true
    );
  END IF;

  -- We have the lock. Fetch token.
  SELECT * INTO v_token
  FROM public.integration_tokens
  WHERE workspace_id = p_workspace_id AND provider::text = p_provider;

  IF v_token IS NULL THEN
    RETURN json_build_object('error', 'Token not found', 'needs_refresh', false);
  END IF;

  -- Check if token is still valid (5-minute buffer)
  IF v_token.expires_at > (now() + interval '5 minutes') THEN
    RETURN json_build_object(
      'access_token', v_token.access_token,
      'refresh_token', v_token.refresh_token,
      'expires_at', v_token.expires_at,
      'external_tenant_id', v_token.external_tenant_id,
      'connection_id', v_token.connection_id,
      'needs_refresh', false,
      'locked_by_other', false
    );
  END IF;

  -- Token is expired or expiring soon — caller must refresh
  -- Mark lock timestamp to prevent thundering herd
  UPDATE public.integration_tokens
  SET token_refresh_lock_until = now() + interval '30 seconds'
  WHERE workspace_id = p_workspace_id AND provider::text = p_provider;

  RETURN json_build_object(
    'access_token', v_token.access_token,
    'refresh_token', v_token.refresh_token,
    'expires_at', v_token.expires_at,
    'external_tenant_id', v_token.external_tenant_id,
    'connection_id', v_token.connection_id,
    'needs_refresh', true,
    'locked_by_other', false
  );
END;
$$;

-- ── 8. RPC: Update token after refresh ──────────────────────
CREATE OR REPLACE FUNCTION public.update_integration_token(
  p_workspace_id UUID,
  p_provider TEXT,
  p_access_token TEXT,
  p_refresh_token TEXT,
  p_expires_in_seconds INT DEFAULT 1800
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.integration_tokens
  SET access_token = p_access_token,
      refresh_token = p_refresh_token,
      expires_at = now() + (p_expires_in_seconds || ' seconds')::interval,
      last_refresh_at = now(),
      refresh_failure_count = 0,
      token_refresh_lock_until = NULL,
      updated_at = now()
  WHERE workspace_id = p_workspace_id AND provider::text = p_provider;

  RETURN json_build_object('success', true, 'expires_at', now() + (p_expires_in_seconds || ' seconds')::interval);
END;
$$;

-- ── 9. RPC: Get integration health stats ────────────────────
CREATE OR REPLACE FUNCTION public.get_integration_health_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_synced_30d INT; v_pending INT; v_failed INT; v_rate_limits INT;
  v_providers JSON;
BEGIN
  -- Items synced in last 30 days
  SELECT COUNT(*) INTO v_synced_30d
  FROM public.integration_sync_log
  WHERE organization_id = p_org_id AND status = 'success' AND created_at > now() - interval '30 days';

  -- Pending in queue
  SELECT COUNT(*) INTO v_pending
  FROM public.integration_sync_queue
  WHERE organization_id = p_org_id AND status IN ('queued', 'QUEUED');

  -- Failed permanently
  SELECT COUNT(*) INTO v_failed
  FROM public.integration_sync_queue
  WHERE organization_id = p_org_id AND status IN ('failed', 'FAILED_PERMANENTLY');

  -- Rate limit hits in last 7 days
  SELECT COALESCE(SUM(rate_limit_hits), 0) INTO v_rate_limits
  FROM public.integration_health_metrics
  WHERE organization_id = p_org_id AND metric_date > CURRENT_DATE - 7;

  -- Provider connection status
  SELECT json_agg(json_build_object(
    'provider', it.provider,
    'connected', true,
    'is_production', it.is_production,
    'expires_at', it.expires_at,
    'external_org', it.external_org_name
  )) INTO v_providers
  FROM public.integration_tokens it
  JOIN public.organizations o ON o.id = p_org_id
  WHERE it.workspace_id = p_org_id;

  RETURN json_build_object(
    'synced_30d', v_synced_30d,
    'pending_queue', v_pending,
    'failed', v_failed,
    'rate_limit_hits_7d', v_rate_limits,
    'providers', COALESCE(v_providers, '[]'::json)
  );
END;
$$;
