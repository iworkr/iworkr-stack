-- ============================================================
-- Migration 155: Project Synapse-Omega — Schema Linearization
--   & Integration Engine for QBO, Google Calendar, GoHighLevel
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART 1: Patch schema_migrations for renamed duplicate files
-- ═══════════════════════════════════════════════════════════
-- If the old prefixed versions exist in the tracking table,
-- update them to the new timestamp-based names.
-- This is safe to run multiple times (idempotent).
DO $$
BEGIN
  UPDATE supabase_migrations.schema_migrations
    SET version = '20240320000062'
    WHERE version = '062_project_beacon_outbound_comms';

  UPDATE supabase_migrations.schema_migrations
    SET version = '20240320000130'
    WHERE version = '130_teleology_goal_matrix';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'schema_migrations patch skipped: %', SQLERRM;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Provider type for integrations
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'oauth_provider') THEN
    CREATE TYPE public.oauth_provider AS ENUM (
      'xero', 'quickbooks', 'google_calendar', 'gmail',
      'outlook', 'outlook_calendar', 'google_drive', 'slack',
      'gohighlevel', 'stripe', 'twilio'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Upgrade integrations table for provider-specific fields
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS external_tenant_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS token_refresh_lock_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_failure_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS webhook_channel_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS webhook_resource_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS webhook_expiration TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_token TEXT;

-- ═══════════════════════════════════════════════════════════
-- PART 4: Google Calendar Sync Channels tracking
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.google_calendar_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  channel_id VARCHAR(255) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  calendar_id VARCHAR(500) NOT NULL DEFAULT 'primary',
  sync_token TEXT,
  expiration TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, calendar_id)
);

CREATE INDEX IF NOT EXISTS idx_gcal_channels_org
  ON public.google_calendar_channels(organization_id);
CREATE INDEX IF NOT EXISTS idx_gcal_channels_expiry
  ON public.google_calendar_channels(expiration);

-- RLS
ALTER TABLE public.google_calendar_channels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'google_calendar_channels'
      AND policyname = 'org_members_read_gcal_channels'
  ) THEN
    CREATE POLICY "org_members_read_gcal_channels"
      ON public.google_calendar_channels FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'google_calendar_channels'
      AND policyname = 'org_admins_manage_gcal_channels'
  ) THEN
    CREATE POLICY "org_admins_manage_gcal_channels"
      ON public.google_calendar_channels FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 5: GoHighLevel Location mapping
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ghl_location_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  ghl_location_id VARCHAR(255) NOT NULL,
  ghl_location_name VARCHAR(500),
  ghl_agency_id VARCHAR(255),
  webhook_subscriptions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, ghl_location_id)
);

CREATE INDEX IF NOT EXISTS idx_ghl_location_org
  ON public.ghl_location_mappings(organization_id);

-- RLS
ALTER TABLE public.ghl_location_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ghl_location_mappings'
      AND policyname = 'org_members_read_ghl'
  ) THEN
    CREATE POLICY "org_members_read_ghl"
      ON public.ghl_location_mappings FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ghl_location_mappings'
      AND policyname = 'org_admins_manage_ghl'
  ) THEN
    CREATE POLICY "org_admins_manage_ghl"
      ON public.ghl_location_mappings FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 6: QuickBooks Tax Code mapping table
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.qbo_tax_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  iworkr_tax_name VARCHAR(255) NOT NULL,
  qbo_tax_code_id VARCHAR(50) NOT NULL,
  qbo_tax_code_name VARCHAR(255),
  qbo_tax_rate_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, iworkr_tax_name)
);

-- RLS
ALTER TABLE public.qbo_tax_mappings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qbo_tax_mappings'
      AND policyname = 'org_members_read_qbo_tax'
  ) THEN
    CREATE POLICY "org_members_read_qbo_tax"
      ON public.qbo_tax_mappings FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qbo_tax_mappings'
      AND policyname = 'org_admins_manage_qbo_tax'
  ) THEN
    CREATE POLICY "org_admins_manage_qbo_tax"
      ON public.qbo_tax_mappings FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 7: Advisory lock helper for token refresh concurrency
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.refresh_integration_token_locked(
  p_integration_id UUID,
  p_new_access_token TEXT,
  p_new_refresh_token TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
BEGIN
  v_lock_key := hashtext(p_integration_id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  UPDATE public.integrations SET
    access_token = p_new_access_token,
    refresh_token = COALESCE(p_new_refresh_token, refresh_token),
    token_expires_at = p_expires_at,
    last_refresh_at = NOW(),
    refresh_failure_count = 0,
    token_refresh_lock_until = NULL,
    error_message = NULL,
    updated_at = NOW()
  WHERE id = p_integration_id;
END;
$$;

-- Mark token as being refreshed (prevents stampede)
CREATE OR REPLACE FUNCTION public.claim_token_refresh_lock(
  p_integration_id UUID,
  p_lock_seconds INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed BOOLEAN := FALSE;
BEGIN
  UPDATE public.integrations SET
    token_refresh_lock_until = NOW() + (p_lock_seconds || ' seconds')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_integration_id
    AND (token_refresh_lock_until IS NULL OR token_refresh_lock_until < NOW())
  RETURNING TRUE INTO v_claimed;

  RETURN COALESCE(v_claimed, FALSE);
END;
$$;
