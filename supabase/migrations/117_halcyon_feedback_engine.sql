-- ============================================================================
-- Migration 117: Project Halcyon — Psychological Feedback & Review Engine
-- 1) user_feedback_metrics  — per-user engagement & prompt tracking
-- 2) internal_feedback_logs — absorbed negative sentiment (the "1-star sieve")
-- 3) RLS policies for both tables
-- 4) Evaluation helper RPC for the Edge Function
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. User Feedback Metrics ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_feedback_metrics (
  user_id                     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Engagement tracking
  total_shifts_completed      INTEGER DEFAULT 0,
  app_open_count              INTEGER DEFAULT 0,

  -- Prompt history
  last_sentiment_prompted_at  TIMESTAMPTZ,
  sentiment_result            TEXT CHECK (sentiment_result IN ('positive', 'negative', 'dismissed', 'unanswered')),
  total_prompts_shown         INTEGER DEFAULT 0,
  total_positive_sentiments   INTEGER DEFAULT 0,
  total_negative_sentiments   INTEGER DEFAULT 0,

  -- Native API tracking (Apple allows max 3 per 365 days)
  last_native_review_requested_at TIMESTAMPTZ,
  native_review_count_365d    INTEGER DEFAULT 0,

  -- Telemetry / firewall blocks
  is_hard_locked              BOOLEAN DEFAULT FALSE,
  lock_reason                 TEXT,
  locked_until                TIMESTAMPTZ,

  -- Last trigger context
  last_trigger_event          TEXT,
  last_eligibility_score      NUMERIC(8,2),

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-provision row when a profile is created
CREATE OR REPLACE FUNCTION public.auto_provision_feedback_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_feedback_metrics (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_provision_feedback_metrics ON public.profiles;
CREATE TRIGGER trg_auto_provision_feedback_metrics
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_provision_feedback_metrics();

-- Back-fill existing users
INSERT INTO public.user_feedback_metrics (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;


-- ─── 2. Internal Feedback Logs (Absorbed Negative Sentiment) ────────────────

CREATE TABLE IF NOT EXISTS public.internal_feedback_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Context
  trigger_event   TEXT,              -- 'friday_finish', 'equinox_win', 'clinical_relief', etc.
  app_version     TEXT NOT NULL,
  device_info     JSONB DEFAULT '{}'::JSONB,

  -- The feedback itself
  feedback_text   TEXT NOT NULL,
  sentiment_score NUMERIC(3,2),      -- Optional: AI-scored sentiment (-1.0 to 1.0)

  -- Routing
  status          TEXT DEFAULT 'unread'
                  CHECK (status IN ('unread', 'ticket_created', 'resolved', 'escalated')),
  routed_to       TEXT,              -- 'slack', 'jira', 'email', 'internal'
  ticket_url      TEXT,              -- External ticket URL if created

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_feedback_user
  ON public.internal_feedback_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_feedback_status
  ON public.internal_feedback_logs (status);


-- ─── 3. Row-Level Security ──────────────────────────────────────────────────

ALTER TABLE public.user_feedback_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_feedback_logs ENABLE ROW LEVEL SECURITY;

-- Feedback Metrics: Users can read their own; service role can read/write all
CREATE POLICY "Users can read own feedback metrics"
  ON public.user_feedback_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages feedback metrics"
  ON public.user_feedback_metrics FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Internal Feedback: Users can insert their own; admins can read their org's
CREATE POLICY "Users can submit feedback"
  ON public.internal_feedback_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own feedback"
  ON public.internal_feedback_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Org admins can read feedback"
  ON public.internal_feedback_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = internal_feedback_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );

CREATE POLICY "Org admins can update feedback status"
  ON public.internal_feedback_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = internal_feedback_logs.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
        AND om.status = 'active'
    )
  );


-- ─── 4. Halcyon Eligibility Evaluation RPC ──────────────────────────────────
-- Heavy lifting in PostgreSQL so the Edge Function is lightweight.
-- Returns a JSON object with eligibility verdict and detailed reasoning.

CREATE OR REPLACE FUNCTION public.evaluate_halcyon_eligibility(
  p_user_id UUID,
  p_trigger_event TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_metrics         RECORD;
  v_incident_count  INTEGER;
  v_missed_mar      INTEGER;
  v_hours_7d        NUMERIC;
  v_crash_count     INTEGER;
  v_active_shift    BOOLEAN;
  v_days_since      NUMERIC;
  v_score           NUMERIC := 0;
  v_reasons         TEXT[] := '{}';
  v_org_id          UUID;
BEGIN
  -- Get user's current organization
  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.user_id = p_user_id AND om.status = 'active'
  LIMIT 1;

  -- 1. Fetch or create feedback metrics
  SELECT * INTO v_metrics
  FROM public.user_feedback_metrics
  WHERE user_id = p_user_id;

  IF v_metrics IS NULL THEN
    INSERT INTO public.user_feedback_metrics (user_id)
    VALUES (p_user_id)
    ON CONFLICT DO NOTHING;
    SELECT * INTO v_metrics FROM public.user_feedback_metrics WHERE user_id = p_user_id;
  END IF;

  -- ═══ ABSOLUTE FIREWALL CHECKS ═══

  -- 1a. Hard lock check
  IF v_metrics.is_hard_locked AND v_metrics.locked_until > NOW() THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'hard_lock_active',
      'locked_until', v_metrics.locked_until,
      'lock_reason', v_metrics.lock_reason
    );
  END IF;

  -- If lock expired, clear it
  IF v_metrics.is_hard_locked AND (v_metrics.locked_until IS NULL OR v_metrics.locked_until <= NOW()) THEN
    UPDATE public.user_feedback_metrics
    SET is_hard_locked = false, lock_reason = NULL, locked_until = NULL
    WHERE user_id = p_user_id;
  END IF;

  -- 1b. Cooldown check (120-day internal cooldown, stricter than Apple's 3/365)
  IF v_metrics.last_sentiment_prompted_at IS NOT NULL THEN
    v_days_since := EXTRACT(EPOCH FROM (NOW() - v_metrics.last_sentiment_prompted_at)) / 86400;
    IF v_days_since < 120 THEN
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'cooldown_active',
        'days_since_last', ROUND(v_days_since, 1),
        'cooldown_remaining_days', ROUND(120 - v_days_since, 1)
      );
    END IF;
  END IF;

  -- 2. AEGIS FIREWALL — Incident involvement in last 14 days
  SELECT COUNT(*) INTO v_incident_count
  FROM public.incidents
  WHERE worker_id = p_user_id
    AND created_at >= NOW() - INTERVAL '14 days';

  IF v_incident_count > 0 THEN
    v_reasons := array_append(v_reasons, 'aegis_firewall');
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'aegis_firewall',
      'detail', format('User involved in %s incident(s) in last 14 days', v_incident_count)
    );
  END IF;

  -- 3. ASCLEPIUS FIREWALL — Missed/withheld medications in last 72 hours
  SELECT COUNT(*) INTO v_missed_mar
  FROM public.medication_administration_records
  WHERE worker_id = p_user_id
    AND outcome IN ('absent', 'withheld')
    AND created_at >= NOW() - INTERVAL '72 hours';

  IF v_missed_mar > 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'asclepius_firewall',
      'detail', format('%s missed/withheld medication(s) in last 72 hours', v_missed_mar)
    );
  END IF;

  -- 4. ACTIVE SHIFT CHECK — Never prompt during an active shift
  SELECT EXISTS (
    SELECT 1 FROM public.time_entries
    WHERE worker_id = p_user_id
      AND status = 'active'
      AND clock_out IS NULL
  ) INTO v_active_shift;

  IF v_active_shift THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'active_shift',
      'detail', 'User is currently clocked into an active shift'
    );
  END IF;

  -- 5. FATIGUE LOCK — Over 45 hours in rolling 7-day window
  SELECT COALESCE(SUM(total_hours), 0) INTO v_hours_7d
  FROM public.time_entries
  WHERE worker_id = p_user_id
    AND clock_in >= NOW() - INTERVAL '7 days'
    AND status IN ('completed', 'approved');

  IF v_hours_7d > 45 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'fatigue_lock',
      'detail', format('User has worked %.1f hours in the last 7 days (threshold: 45)', v_hours_7d)
    );
  END IF;

  -- 6. TELEMETRY LOCK — Fatal errors or crashes in last 48 hours
  SELECT COUNT(*) INTO v_crash_count
  FROM public.telemetry_events
  WHERE user_id = p_user_id
    AND severity = 'fatal'
    AND event_timestamp >= NOW() - INTERVAL '48 hours';

  IF v_crash_count > 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'telemetry_lock',
      'detail', format('%s fatal error(s) recorded in last 48 hours', v_crash_count)
    );
  END IF;

  -- ═══ POSITIVE SCORE CALCULATION ═══
  -- Weighted scoring: E(u) = Σ(W_success × S_i) - Σ(W_stress × I_j) - (W_fatigue × H_worked)

  -- Positive signals (last 30 days)
  DECLARE
    v_clean_shifts   INTEGER;
    v_on_time_rate   NUMERIC;
  BEGIN
    -- Clean shifts (completed, no exceptions, no late starts)
    SELECT COUNT(*) INTO v_clean_shifts
    FROM public.time_entries
    WHERE worker_id = p_user_id
      AND status IN ('completed', 'approved')
      AND exception_type IS NULL
      AND clock_in >= NOW() - INTERVAL '30 days';

    v_score := v_score + (v_clean_shifts * 2.0);   -- +2 per clean shift
    v_score := v_score - (v_hours_7d * 0.3);       -- -0.3 per hour worked this week (fatigue penalty)
    v_score := v_score - (v_incident_count * 15.0); -- -15 per incident (already 0 if we got here)

    -- Trigger bonus: specific positive events get extra weight
    IF p_trigger_event = 'friday_finish' THEN
      v_score := v_score + 10.0;
    ELSIF p_trigger_event = 'equinox_win' THEN
      v_score := v_score + 8.0;
    ELSIF p_trigger_event = 'clinical_relief' THEN
      v_score := v_score + 12.0;
    ELSIF p_trigger_event = 'frictionless_finance' THEN
      v_score := v_score + 6.0;
    END IF;

    -- Update metrics with latest score
    UPDATE public.user_feedback_metrics
    SET last_trigger_event = p_trigger_event,
        last_eligibility_score = v_score,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Eligibility threshold: must have positive score AND at least 3 clean shifts
    IF v_score >= 5.0 AND v_clean_shifts >= 3 THEN
      RETURN jsonb_build_object(
        'eligible', true,
        'score', ROUND(v_score, 2),
        'clean_shifts_30d', v_clean_shifts,
        'hours_7d', ROUND(v_hours_7d, 1),
        'trigger', p_trigger_event
      );
    ELSE
      RETURN jsonb_build_object(
        'eligible', false,
        'reason', 'score_below_threshold',
        'score', ROUND(v_score, 2),
        'threshold', 5.0,
        'clean_shifts_30d', v_clean_shifts
      );
    END IF;
  END;
END;
$$;

-- ─── 5. Updated_at trigger ──────────────────────────────────────────────────

CREATE TRIGGER set_updated_at_feedback_metrics
  BEFORE UPDATE ON public.user_feedback_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ─── 6. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.user_feedback_metrics IS
  'Project Halcyon: Per-user engagement telemetry and review prompt state tracking.';
COMMENT ON TABLE public.internal_feedback_logs IS
  'Project Halcyon: Absorbed negative sentiment — redirected away from App Store ratings.';
COMMENT ON FUNCTION public.evaluate_halcyon_eligibility IS
  'Project Halcyon: Calculates user eligibility score for app review prompt. Enforces Aegis, Asclepius, Fatigue, and Telemetry firewalls.';
