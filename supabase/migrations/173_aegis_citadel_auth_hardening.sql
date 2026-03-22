-- ============================================================================
-- Aegis-Citadel Phase 4: Zero-Trust IAM — Session Geometry & Auth Hardening
-- ============================================================================
-- Tracks session locations for velocity anomaly detection.
-- Logs security events for forensic analysis.
-- ============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Session Geometry Table
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.session_geometry (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      TEXT,
  ip_address      INET NOT NULL,
  country_code    TEXT,              -- ISO 3166-1 alpha-2 (from Vercel x-vercel-ip-country)
  city            TEXT,              -- From x-vercel-ip-city
  user_agent_hash TEXT,              -- SHA-256 of User-Agent for fingerprinting
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_geo_user_time
  ON public.session_geometry (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_geo_user_country
  ON public.session_geometry (user_id, country_code);

-- Expire old entries automatically (keep 90 days)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'citadel-session-geo-cleanup',
      '0 3 * * 0',  -- Every Sunday at 3 AM
      $$DELETE FROM public.session_geometry WHERE created_at < NOW() - INTERVAL '90 days';$$
    );
  END IF;
END;
$$;

-- RLS
ALTER TABLE public.session_geometry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_geometry FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_sessions"
  ON public.session_geometry FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "service_role_manage_sessions"
  ON public.session_geometry FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Security Events Table (consolidated anomaly/threat events)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TYPE public.security_event_type AS ENUM (
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGIN_BRUTE_FORCE',
  'SESSION_REVOKED',
  'VELOCITY_ANOMALY',
  'IMPOSSIBLE_TRAVEL',
  'MFA_ENROLLED',
  'MFA_VERIFIED',
  'MFA_FAILED',
  'RASP_ROOT_DETECTED',
  'RASP_DEBUGGER_DETECTED',
  'RASP_EMULATOR_DETECTED',
  'RASP_TAMPER_DETECTED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET',
  'ROLE_ESCALATION_ATTEMPT',
  'INACTIVITY_TIMEOUT',
  'CONCURRENT_SESSION_LIMIT'
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type      public.security_event_type NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'info',  -- info, warning, critical
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address      INET,
  country_code    TEXT,
  user_agent      TEXT,
  details         JSONB DEFAULT '{}'::jsonb,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  resolved        BOOLEAN DEFAULT false,
  resolved_by     UUID REFERENCES auth.users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_time
  ON public.security_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_org_time
  ON public.security_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type
  ON public.security_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved
  ON public.security_events (organization_id, created_at DESC)
  WHERE resolved = false AND severity IN ('warning', 'critical');

-- RLS
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_security_events"
  ON public.security_events FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()  -- Users can see their own events
  );

CREATE POLICY "service_role_manage_events"
  ON public.security_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Velocity Anomaly Check RPC
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_velocity_anomaly(
  p_user_id UUID,
  p_current_country TEXT,
  p_current_ip TEXT,
  p_user_agent_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_last_session RECORD;
  v_minutes_elapsed INTEGER;
  v_is_anomaly BOOLEAN := false;
  v_reason TEXT := '';
BEGIN
  -- Get the user's most recent session geometry
  SELECT * INTO v_last_session
  FROM public.session_geometry
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- No previous session — first login, record and allow
  IF v_last_session IS NULL THEN
    INSERT INTO public.session_geometry (user_id, ip_address, country_code, user_agent_hash)
    VALUES (p_user_id, p_current_ip::inet, p_current_country, p_user_agent_hash);

    RETURN jsonb_build_object('anomaly', false, 'reason', 'first_session');
  END IF;

  v_minutes_elapsed := EXTRACT(EPOCH FROM (now() - v_last_session.created_at)) / 60;

  -- Rule 1: Country changed within 5 minutes (impossible travel)
  IF v_last_session.country_code IS NOT NULL
     AND p_current_country IS NOT NULL
     AND v_last_session.country_code != p_current_country
     AND v_minutes_elapsed < 5
  THEN
    v_is_anomaly := true;
    v_reason := format(
      'Impossible travel: %s → %s in %s minutes',
      v_last_session.country_code, p_current_country, v_minutes_elapsed
    );
  END IF;

  -- Rule 2: Country changed within 60 minutes (suspicious travel)
  IF NOT v_is_anomaly
     AND v_last_session.country_code IS NOT NULL
     AND p_current_country IS NOT NULL
     AND v_last_session.country_code != p_current_country
     AND v_minutes_elapsed < 60
  THEN
    v_is_anomaly := true;
    v_reason := format(
      'Suspicious travel: %s → %s in %s minutes',
      v_last_session.country_code, p_current_country, v_minutes_elapsed
    );
  END IF;

  -- Record the new session regardless
  INSERT INTO public.session_geometry (user_id, ip_address, country_code, user_agent_hash)
  VALUES (p_user_id, p_current_ip::inet, p_current_country, p_user_agent_hash);

  -- If anomaly detected, log a security event
  IF v_is_anomaly THEN
    INSERT INTO public.security_events (
      event_type, severity, user_id, ip_address, country_code, user_agent,
      details
    ) VALUES (
      CASE WHEN v_minutes_elapsed < 5 THEN 'IMPOSSIBLE_TRAVEL' ELSE 'VELOCITY_ANOMALY' END,
      CASE WHEN v_minutes_elapsed < 5 THEN 'critical' ELSE 'warning' END,
      p_user_id, p_current_ip::inet, p_current_country, NULL,
      jsonb_build_object(
        'reason', v_reason,
        'previous_country', v_last_session.country_code,
        'previous_ip', v_last_session.ip_address::text,
        'minutes_elapsed', v_minutes_elapsed
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'anomaly', v_is_anomaly,
    'reason', v_reason,
    'minutes_elapsed', v_minutes_elapsed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_velocity_anomaly TO service_role;
REVOKE ALL ON FUNCTION public.check_velocity_anomaly FROM PUBLIC, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Failed Login Rate Limiting (brute-force detection)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  p_email TEXT,
  p_ip TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_recent_failures INTEGER;
  v_is_blocked BOOLEAN := false;
BEGIN
  -- Count failed logins from this IP in last 15 minutes
  SELECT count(*) INTO v_recent_failures
  FROM public.security_events
  WHERE event_type = 'LOGIN_FAILURE'
    AND ip_address = p_ip::inet
    AND created_at > now() - interval '15 minutes';

  -- Block after 10 failures from same IP
  IF v_recent_failures >= 10 THEN
    v_is_blocked := true;

    INSERT INTO public.security_events (
      event_type, severity, ip_address,
      details
    ) VALUES (
      'LOGIN_BRUTE_FORCE', 'critical', p_ip::inet,
      jsonb_build_object('target_email', p_email, 'attempts', v_recent_failures)
    );
  END IF;

  RETURN jsonb_build_object(
    'blocked', v_is_blocked,
    'recent_failures', v_recent_failures
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_login_rate_limit TO service_role;
REVOKE ALL ON FUNCTION public.check_login_rate_limit FROM PUBLIC, anon, authenticated;
