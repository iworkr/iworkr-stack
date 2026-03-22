-- ============================================================================
-- @migration AegisCitadelAuditEngine
-- @status COMPLETE
-- @description Aegis-Citadel Phase 1B — append-only forensic audit log for PII access
-- @tables security_audit_log (partitioned)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Security Audit Log — Append-Only, Partitioned by Month
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  event_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type      TEXT NOT NULL,       -- 'PII_ACCESS', 'PII_MODIFY', 'AUTH_ANOMALY', 'RASP_VIOLATION', 'SESSION_REVOKED'
  severity        TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical', 'breach'
  user_id         UUID,
  session_id      TEXT,
  ip_address      INET,
  country_code    TEXT,
  user_agent      TEXT,
  resource_type   TEXT,                -- 'staff_profiles', 'participant_profiles', etc.
  resource_id     TEXT,                -- The row ID accessed
  action          TEXT,                -- 'SELECT', 'UPDATE', 'DELETE', 'INSERT'
  details         JSONB DEFAULT '{}'::jsonb,  -- Additional forensic context
  organization_id UUID,

  PRIMARY KEY (id, event_time)
) PARTITION BY RANGE (event_time);

-- Create partitions for current + next 12 months
DO $$
DECLARE
  v_start DATE;
  v_end   DATE;
  v_name  TEXT;
BEGIN
  FOR i IN 0..12 LOOP
    v_start := DATE_TRUNC('month', NOW()) + (i || ' months')::INTERVAL;
    v_end   := v_start + '1 month'::INTERVAL;
    v_name  := 'security_audit_log_' || TO_CHAR(v_start, 'YYYY_MM');

    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_name) THEN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.security_audit_log FOR VALUES FROM (%L) TO (%L)',
        v_name, v_start, v_end
      );
    END IF;
  END LOOP;
END;
$$;

-- Index for fast queries by user and time
CREATE INDEX IF NOT EXISTS idx_security_audit_user_time
  ON public.security_audit_log (user_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_org_time
  ON public.security_audit_log (organization_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity
  ON public.security_audit_log (severity, event_time DESC)
  WHERE severity IN ('critical', 'breach');

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Immutability Protection — Prevent DELETE/UPDATE on audit log
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trg_protect_audit_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION 'CITADEL FAILSAFE: Security audit log is immutable. DELETE and UPDATE are prohibited.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.security_audit_log;
CREATE TRIGGER trg_audit_immutable
  BEFORE UPDATE OR DELETE ON public.security_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_protect_audit_immutability();

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RLS — Only service_role can insert, admin+ can read
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_role_insert_audit"
  ON public.security_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "admin_read_audit"
  ON public.security_audit_log FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. PII Modification Audit Triggers
-- ══════════════════════════════════════════════════════════════════════════════

-- Trigger: Audit staff_profiles PII changes
CREATE OR REPLACE FUNCTION public.trg_audit_staff_pii_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_changed JSONB := '{}'::jsonb;
BEGIN
  v_user_id := COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  );

  -- Track which PII fields changed
  IF NEW.bank_account_name IS DISTINCT FROM OLD.bank_account_name THEN
    v_changed := v_changed || '{"bank_account_name": "changed"}'::jsonb;
  END IF;
  IF NEW.bank_bsb IS DISTINCT FROM OLD.bank_bsb THEN
    v_changed := v_changed || '{"bank_bsb": "changed"}'::jsonb;
  END IF;
  IF NEW.bank_account_number IS DISTINCT FROM OLD.bank_account_number THEN
    v_changed := v_changed || '{"bank_account_number": "changed"}'::jsonb;
  END IF;
  IF NEW.home_address IS DISTINCT FROM OLD.home_address THEN
    v_changed := v_changed || '{"home_address": "changed"}'::jsonb;
  END IF;
  IF NEW.license_number IS DISTINCT FROM OLD.license_number THEN
    v_changed := v_changed || '{"license_number": "changed"}'::jsonb;
  END IF;

  -- Only log if PII actually changed
  IF v_changed != '{}'::jsonb THEN
    INSERT INTO public.security_audit_log (
      event_type, severity, user_id, ip_address, resource_type, resource_id,
      action, details, organization_id
    ) VALUES (
      'PII_MODIFY', 'warning', v_user_id,
      NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet,
      'staff_profiles', NEW.id::text,
      TG_OP, v_changed, NEW.organization_id
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the actual operation due to audit failure
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_staff_pii ON public.staff_profiles;
CREATE TRIGGER trg_audit_staff_pii
  AFTER UPDATE ON public.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_staff_pii_change();

-- Trigger: Audit participant_profiles PII changes
CREATE OR REPLACE FUNCTION public.trg_audit_participant_pii_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_changed JSONB := '{}'::jsonb;
BEGIN
  v_user_id := COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  );

  IF NEW.ndis_number IS DISTINCT FROM OLD.ndis_number THEN
    v_changed := v_changed || '{"ndis_number": "changed"}'::jsonb;
  END IF;
  IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    v_changed := v_changed || '{"date_of_birth": "changed"}'::jsonb;
  END IF;
  IF NEW.critical_alerts IS DISTINCT FROM OLD.critical_alerts THEN
    v_changed := v_changed || '{"critical_alerts": "changed"}'::jsonb;
  END IF;

  IF v_changed != '{}'::jsonb THEN
    INSERT INTO public.security_audit_log (
      event_type, severity, user_id, ip_address, resource_type, resource_id,
      action, details, organization_id
    ) VALUES (
      'PII_MODIFY', 'warning', v_user_id,
      NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet,
      'participant_profiles', NEW.id::text,
      TG_OP, v_changed, NEW.organization_id
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_participant_pii ON public.participant_profiles;
CREATE TRIGGER trg_audit_participant_pii
  AFTER UPDATE ON public.participant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_participant_pii_change();

-- Trigger: Audit medication changes (safety-critical)
CREATE OR REPLACE FUNCTION public.trg_audit_medication_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  );

  INSERT INTO public.security_audit_log (
    event_type, severity, user_id, ip_address, resource_type, resource_id,
    action, details, organization_id
  ) VALUES (
    'PII_MODIFY',
    CASE WHEN TG_OP = 'DELETE' THEN 'critical' ELSE 'warning' END,
    v_user_id,
    NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet,
    'participant_medications',
    COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    jsonb_build_object(
      'medication_name', COALESCE(NEW.name, OLD.name),
      'dosage', COALESCE(NEW.dosage, OLD.dosage),
      'participant_id', COALESCE(NEW.participant_id, OLD.participant_id)
    ),
    COALESCE(NEW.organization_id, OLD.organization_id)
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_medications ON public.participant_medications;
CREATE TRIGGER trg_audit_medications
  AFTER INSERT OR UPDATE OR DELETE ON public.participant_medications
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_medication_change();

-- Trigger: Audit incident changes (SIRS-reportable events)
CREATE OR REPLACE FUNCTION public.trg_audit_incident_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid
  );

  INSERT INTO public.security_audit_log (
    event_type, severity, user_id, ip_address, resource_type, resource_id,
    action, details, organization_id
  ) VALUES (
    'PII_MODIFY',
    CASE
      WHEN COALESCE(NEW.severity, OLD.severity)::text IN ('critical', 'high') THEN 'critical'
      ELSE 'warning'
    END,
    v_user_id,
    NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', '')::inet,
    'incidents',
    COALESCE(NEW.id, OLD.id)::text,
    TG_OP,
    jsonb_build_object(
      'title', COALESCE(NEW.title, OLD.title),
      'severity', COALESCE(NEW.severity, OLD.severity),
      'participant_id', COALESCE(NEW.participant_id, OLD.participant_id)
    ),
    COALESCE(NEW.organization_id, OLD.organization_id)
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_incidents ON public.incidents;
CREATE TRIGGER trg_audit_incidents
  AFTER INSERT OR UPDATE OR DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_incident_change();

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Convenience RPC: Log a security event from Edge Functions
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'info',
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_organization_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.security_audit_log (
    event_type, severity, user_id, ip_address, country_code, user_agent,
    resource_type, resource_id, action, details, organization_id
  ) VALUES (
    p_event_type, p_severity,
    COALESCE(p_user_id, auth.uid()),
    p_ip_address::inet,
    p_country_code, p_user_agent,
    p_resource_type, p_resource_id, p_action,
    p_details, p_organization_id
  );
EXCEPTION WHEN OTHERS THEN
  -- Never fail silently — but never block the caller
  RAISE WARNING 'CITADEL AUDIT: Failed to log security event: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_security_event TO service_role;
REVOKE ALL ON FUNCTION public.log_security_event FROM PUBLIC, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. Auto-Partition Maintenance (monthly partition creation via pg_cron)
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'citadel-audit-partition-maintenance',
      '0 0 1 * *',  -- 1st of every month at midnight
      $$
      DO $inner$
      DECLARE
        v_start DATE := DATE_TRUNC('month', NOW() + '2 months'::interval);
        v_end   DATE := v_start + '1 month'::interval;
        v_name  TEXT := 'security_audit_log_' || TO_CHAR(v_start, 'YYYY_MM');
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = v_name) THEN
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.security_audit_log FOR VALUES FROM (%L) TO (%L)',
            v_name, v_start, v_end
          );
        END IF;
      END;
      $inner$;
      $$
    );
  END IF;
END;
$$;
