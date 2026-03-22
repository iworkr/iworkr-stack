-- ============================================================================
-- @migration LedgerSyncIntegration
-- @status COMPLETE
-- @description Project Ledger-Sync — bidirectional Xero/MYOB accounting integration
-- @tables accounting_mappings, sync_sessions, sync_errors
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── ENUMs ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accounting_provider') THEN
    CREATE TYPE public.accounting_provider AS ENUM ('XERO', 'MYOB');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_entity_type') THEN
    CREATE TYPE public.integration_entity_type AS ENUM (
      'NDIS_CATEGORY', 'PAY_CATEGORY', 'TAX_RATE'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_direction') THEN
    CREATE TYPE public.sync_direction AS ENUM ('OUTBOUND_PUSH', 'INBOUND_WEBHOOK');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_entity_type') THEN
    CREATE TYPE public.sync_entity_type AS ENUM ('INVOICE', 'CONTACT', 'PAYROLL');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
    CREATE TYPE public.sync_status AS ENUM ('SUCCESS', 'PENDING', 'FAILED');
  END IF;
END $$;

-- ── integration_tokens (OAuth Vault) ─────────────────────
CREATE TABLE IF NOT EXISTS public.integration_tokens (
  workspace_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider             accounting_provider NOT NULL,
  access_token         TEXT NOT NULL,
  refresh_token        TEXT NOT NULL,
  external_tenant_id   VARCHAR(255),
  external_org_name    VARCHAR(255),
  expires_at           TIMESTAMPTZ NOT NULL,
  scopes               TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, provider)
);

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins manage integration tokens"
  ON public.integration_tokens
  USING (
    workspace_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- ── integration_mappings (Semantic Mapper) ────────────────
CREATE TABLE IF NOT EXISTS public.integration_mappings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider                  accounting_provider NOT NULL,
  iworkr_entity_type        integration_entity_type NOT NULL,
  iworkr_entity_id          VARCHAR(255) NOT NULL,
  iworkr_entity_label       VARCHAR(255),
  external_account_code     VARCHAR(255) NOT NULL,
  external_account_name     VARCHAR(255),
  external_tax_type         VARCHAR(100),
  external_tracking_category VARCHAR(255),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, iworkr_entity_type, iworkr_entity_id)
);

ALTER TABLE public.integration_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins manage integration mappings"
  ON public.integration_mappings
  USING (
    workspace_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_integration_mappings_workspace
  ON public.integration_mappings(workspace_id, provider);

-- ── integration_sync_logs (The Audit Ledger) ─────────────
CREATE TABLE IF NOT EXISTS public.integration_sync_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider        accounting_provider NOT NULL DEFAULT 'XERO',
  direction       sync_direction NOT NULL,
  entity_type     sync_entity_type NOT NULL,
  entity_id       UUID,
  entity_label    TEXT,
  status          sync_status NOT NULL DEFAULT 'PENDING',
  http_status     INT,
  payload         JSONB,
  response        JSONB,
  error_message   TEXT,
  external_id     TEXT,
  retry_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.integration_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins read sync logs"
  ON public.integration_sync_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin','manager')
    )
  );

CREATE INDEX IF NOT EXISTS idx_sync_logs_workspace_status
  ON public.integration_sync_logs(workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_logs_entity_id
  ON public.integration_sync_logs(entity_id);

-- ── Extend invoices with external_id ─────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS external_id           TEXT,
  ADD COLUMN IF NOT EXISTS external_provider     accounting_provider,
  ADD COLUMN IF NOT EXISTS external_contact_id   TEXT,
  ADD COLUMN IF NOT EXISTS sync_status           sync_status DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS sync_error            TEXT,
  ADD COLUMN IF NOT EXISTS synced_at             TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invoices_external_id
  ON public.invoices(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_sync_status
  ON public.invoices(sync_status) WHERE sync_status IS NOT NULL;

-- ── RPC: upsert_integration_token ────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_integration_token(
  p_workspace_id       UUID,
  p_provider           accounting_provider,
  p_access_token       TEXT,
  p_refresh_token      TEXT,
  p_external_tenant_id VARCHAR,
  p_external_org_name  VARCHAR,
  p_expires_at         TIMESTAMPTZ,
  p_scopes             TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.integration_tokens (
    workspace_id, provider, access_token, refresh_token,
    external_tenant_id, external_org_name, expires_at, scopes, updated_at
  ) VALUES (
    p_workspace_id, p_provider, p_access_token, p_refresh_token,
    p_external_tenant_id, p_external_org_name, p_expires_at, p_scopes, now()
  )
  ON CONFLICT (workspace_id, provider)
  DO UPDATE SET
    access_token       = EXCLUDED.access_token,
    refresh_token      = EXCLUDED.refresh_token,
    external_tenant_id = EXCLUDED.external_tenant_id,
    external_org_name  = EXCLUDED.external_org_name,
    expires_at         = EXCLUDED.expires_at,
    scopes             = EXCLUDED.scopes,
    updated_at         = now();
END;
$$;

-- ── RPC: get_integration_status ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_integration_status(
  p_workspace_id UUID
)
RETURNS TABLE (
  provider          accounting_provider,
  is_connected      BOOLEAN,
  external_org_name VARCHAR,
  expires_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  is_expired        BOOLEAN,
  mapping_count     BIGINT,
  last_sync_at      TIMESTAMPTZ,
  last_sync_status  sync_status,
  failed_count      BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH token_data AS (
    SELECT t.provider, t.external_org_name, t.expires_at, t.updated_at,
           t.expires_at < now() AS is_expired
    FROM public.integration_tokens t
    WHERE t.workspace_id = p_workspace_id
  ),
  mapping_counts AS (
    SELECT m.provider, COUNT(*) AS cnt
    FROM public.integration_mappings m
    WHERE m.workspace_id = p_workspace_id
    GROUP BY m.provider
  ),
  sync_stats AS (
    SELECT DISTINCT ON (sl.provider)
      sl.provider,
      sl.created_at AS last_sync_at,
      sl.status AS last_sync_status
    FROM public.integration_sync_logs sl
    WHERE sl.workspace_id = p_workspace_id
    ORDER BY sl.provider, sl.created_at DESC
  ),
  failed_counts AS (
    SELECT sl.provider, COUNT(*) AS cnt
    FROM public.integration_sync_logs sl
    WHERE sl.workspace_id = p_workspace_id AND sl.status = 'FAILED'
    GROUP BY sl.provider
  )
  -- Return all known providers
  SELECT
    p.provider::accounting_provider,
    (td.provider IS NOT NULL AND NOT COALESCE(td.is_expired, true)) AS is_connected,
    td.external_org_name,
    td.expires_at,
    td.updated_at,
    COALESCE(td.is_expired, true) AS is_expired,
    COALESCE(mc.cnt, 0) AS mapping_count,
    ss.last_sync_at,
    ss.last_sync_status,
    COALESCE(fc.cnt, 0) AS failed_count
  FROM (VALUES ('XERO'::accounting_provider), ('MYOB'::accounting_provider)) AS p(provider)
  LEFT JOIN token_data td ON td.provider = p.provider
  LEFT JOIN mapping_counts mc ON mc.provider = p.provider
  LEFT JOIN sync_stats ss ON ss.provider = p.provider
  LEFT JOIN failed_counts fc ON fc.provider = p.provider;
$$;

-- ── RPC: get_sync_errors ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_sync_errors(
  p_workspace_id UUID,
  p_limit        INT DEFAULT 50
)
RETURNS TABLE (
  id            UUID,
  provider      accounting_provider,
  direction     sync_direction,
  entity_type   sync_entity_type,
  entity_id     UUID,
  entity_label  TEXT,
  error_message TEXT,
  http_status   INT,
  retry_count   INT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, provider, direction, entity_type, entity_id, entity_label,
         error_message, http_status, retry_count, created_at
  FROM public.integration_sync_logs
  WHERE workspace_id = p_workspace_id AND status = 'FAILED'
  ORDER BY created_at DESC
  LIMIT p_limit;
$$;

-- ── RPC: disconnect_integration ─────────────────────────
CREATE OR REPLACE FUNCTION public.disconnect_integration(
  p_workspace_id UUID,
  p_provider     accounting_provider
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.integration_tokens
  WHERE workspace_id = p_workspace_id AND provider = p_provider;
$$;

-- ── Auto-update triggers ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_integration_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_integration_tokens_updated_at ON public.integration_tokens;
CREATE TRIGGER trg_integration_tokens_updated_at
  BEFORE UPDATE ON public.integration_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_integration_updated_at();

DROP TRIGGER IF EXISTS trg_integration_mappings_updated_at ON public.integration_mappings;
CREATE TRIGGER trg_integration_mappings_updated_at
  BEFORE UPDATE ON public.integration_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_integration_updated_at();

DROP TRIGGER IF EXISTS trg_sync_logs_updated_at ON public.integration_sync_logs;
CREATE TRIGGER trg_sync_logs_updated_at
  BEFORE UPDATE ON public.integration_sync_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_integration_updated_at();
