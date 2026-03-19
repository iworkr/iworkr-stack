-- ============================================================
-- Migration 160: Project Panopticon-Chat — Text-to-SQL
--   Conversational Analytics Engine
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART 1: analytics_reader role (read-only sandbox)
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'analytics_reader') THEN
    CREATE ROLE analytics_reader NOLOGIN;
  END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM analytics_reader;
REVOKE ALL ON SCHEMA auth FROM analytics_reader;
REVOKE ALL ON SCHEMA storage FROM analytics_reader;

GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT SELECT ON public.secure_job_profitability TO analytics_reader;
GRANT SELECT ON public.secure_worker_utilization TO analytics_reader;
GRANT SELECT ON public.secure_ndis_fund_burn TO analytics_reader;
GRANT SELECT ON public.secure_trade_estimate_vs_actual TO analytics_reader;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Chat session & message tables
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.panopticon_chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id),
  title           TEXT,
  message_count   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_org
  ON public.panopticon_chat_sessions(organization_id, user_id, updated_at DESC);

ALTER TABLE public.panopticon_chat_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "users_own_chat_sessions"
  ON public.panopticon_chat_sessions FOR ALL
  USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.panopticon_chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.panopticon_chat_sessions(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL,
  content         TEXT NOT NULL,
  sql_query       TEXT,
  sql_error       TEXT,
  retry_count     INT DEFAULT 0,
  data_result     JSONB,
  row_count       INT,
  rendering       JSONB,
  executive_summary TEXT,
  processing_ms   INT,
  model_used      VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON public.panopticon_chat_messages(session_id, created_at);

ALTER TABLE public.panopticon_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "users_read_own_messages"
  ON public.panopticon_chat_messages FOR ALL
  USING (
    session_id IN (
      SELECT id FROM public.panopticon_chat_sessions WHERE user_id = auth.uid()
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Secure SQL execution RPC
--   Executes read-only queries as analytics_reader with
--   workspace isolation via JWT claims injection
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.execute_analytics_query(
  p_sql       TEXT,
  p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_upper  TEXT;
BEGIN
  v_upper := UPPER(TRIM(p_sql));

  IF v_upper !~ '^(SELECT|WITH)' THEN
    RAISE EXCEPTION 'Only SELECT queries are permitted';
  END IF;

  IF v_upper ~ '(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|EXECUTE|CALL)' THEN
    RAISE EXCEPTION 'Mutation statements are forbidden';
  END IF;

  IF v_upper ~ '(pg_catalog|information_schema|auth\.|storage\.|supabase_migrations)' THEN
    RAISE EXCEPTION 'Access to system schemas is forbidden';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'app_metadata', json_build_object('active_workspace', p_workspace_id::text)
    )::text,
    true
  );

  SET LOCAL ROLE analytics_reader;

  EXECUTE format('SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', p_sql)
    INTO v_result;

  RESET ROLE;

  RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 4: Refresh timestamp helper
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_analytics_last_refresh()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT MAX(completed_at)
  FROM public.analytics_refresh_log
  WHERE status = 'completed';
$$;
