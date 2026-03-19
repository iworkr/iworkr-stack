-- ============================================================
-- Migration 156: Project Oracle-Yield — Algorithmic
--   Profitability & Zero-Rejection Cash Flow Engine
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- PART 1: ENUMs
-- ═══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'claim_prediction_status') THEN
    CREATE TYPE public.claim_prediction_status AS ENUM (
      'INTERCEPTED',
      'OVERRIDDEN_BY_HUMAN',
      'FIXED_AND_RESUBMITTED',
      'AUTO_PASSED',
      'FALSE_POSITIVE_CONFIRMED'
    );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 2: Yield Profiles (Admin-defined AI boundaries)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.yield_profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_name              VARCHAR(255) NOT NULL,
  trade_category            VARCHAR(100),
  base_margin               NUMERIC(5,4) NOT NULL DEFAULT 0.4000,
  min_margin_floor          NUMERIC(5,4) NOT NULL DEFAULT 0.2500,
  max_margin_ceiling        NUMERIC(5,4) NOT NULL DEFAULT 0.6500,
  sensitivity_weight_fleet  NUMERIC(4,3) NOT NULL DEFAULT 0.400,
  sensitivity_weight_weather NUMERIC(4,3) NOT NULL DEFAULT 0.300,
  sensitivity_weight_client NUMERIC(4,3) NOT NULL DEFAULT 0.300,
  is_active                 BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, profile_name),
  CONSTRAINT chk_margin_range CHECK (min_margin_floor <= base_margin AND base_margin <= max_margin_ceiling),
  CONSTRAINT chk_margin_floor CHECK (min_margin_floor >= 0 AND min_margin_floor <= 1),
  CONSTRAINT chk_margin_ceiling CHECK (max_margin_ceiling >= 0 AND max_margin_ceiling <= 1),
  CONSTRAINT chk_weights_positive CHECK (
    sensitivity_weight_fleet >= 0 AND
    sensitivity_weight_weather >= 0 AND
    sensitivity_weight_client >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_yield_profiles_org
  ON public.yield_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_yield_profiles_active
  ON public.yield_profiles(organization_id, is_active) WHERE is_active = true;

ALTER TABLE public.yield_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_yield_profiles"
  ON public.yield_profiles FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_admins_manage_yield_profiles"
  ON public.yield_profiles FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND role IN ('owner','admin')
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 3: Quote Yield Logs (AI decision audit trail)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.quote_yield_logs (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id               UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quote_id                      UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  proposal_id                   UUID,
  yield_profile_id              UUID REFERENCES public.yield_profiles(id) ON DELETE SET NULL,
  fleet_utilization_at_calc     NUMERIC(5,4),
  weather_severity_index        NUMERIC(4,3),
  weather_description           VARCHAR(255),
  client_historical_conversion  NUMERIC(5,4),
  surge_modifier                NUMERIC(6,4),
  base_margin_used              NUMERIC(5,4),
  raw_margin_calculated         NUMERIC(6,4),
  calculated_margin_applied     NUMERIC(5,4) NOT NULL,
  margin_floor_used             NUMERIC(5,4),
  margin_ceiling_used           NUMERIC(5,4),
  was_clamped                   BOOLEAN DEFAULT false,
  clamp_direction               VARCHAR(10),
  human_override                BOOLEAN DEFAULT false,
  human_override_margin         NUMERIC(5,4),
  override_reason               TEXT,
  calculation_time_ms           INT,
  created_at                    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_yield_logs_org
  ON public.quote_yield_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_yield_logs_quote
  ON public.quote_yield_logs(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_yield_logs_overrides
  ON public.quote_yield_logs(organization_id) WHERE human_override = true;

ALTER TABLE public.quote_yield_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_yield_logs"
  ON public.quote_yield_logs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_insert_yield_logs"
  ON public.quote_yield_logs FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 4: NDIS Claim Predictions (The PRODA Shield)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ndis_claim_predictions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id                UUID,
  timesheet_id              UUID,
  claim_batch_id            UUID,
  participant_id            UUID,
  worker_id                 UUID,
  support_item_code         VARCHAR(50),
  shift_date                DATE,
  claim_amount              NUMERIC(12,2),
  confidence_score_success  NUMERIC(5,4) NOT NULL,
  confidence_score_reject   NUMERIC(5,4) GENERATED ALWAYS AS (1.0 - confidence_score_success) STORED,
  predicted_error_code      VARCHAR(100),
  predicted_error_category  VARCHAR(50),
  flagged_reason            TEXT NOT NULL,
  ai_suggested_fix          TEXT,
  ai_suggested_code         VARCHAR(50),
  ai_suggested_amount       NUMERIC(12,2),
  status                    public.claim_prediction_status NOT NULL DEFAULT 'INTERCEPTED',
  resolved_by               UUID REFERENCES public.profiles(id),
  resolved_at               TIMESTAMPTZ,
  resolution_action         TEXT,
  original_pace_payload     JSONB,
  corrected_pace_payload    JSONB,
  model_version             VARCHAR(50) DEFAULT 'v1.0',
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ndis_predictions_org
  ON public.ndis_claim_predictions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndis_predictions_status
  ON public.ndis_claim_predictions(organization_id, status) WHERE status = 'INTERCEPTED';
CREATE INDEX IF NOT EXISTS idx_ndis_predictions_invoice
  ON public.ndis_claim_predictions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ndis_predictions_confidence
  ON public.ndis_claim_predictions(organization_id, confidence_score_success);

ALTER TABLE public.ndis_claim_predictions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_claim_predictions"
  ON public.ndis_claim_predictions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
CREATE POLICY "org_members_manage_claim_predictions"
  ON public.ndis_claim_predictions FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 5: ML Feedback Queue (for model retraining)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.oracle_ml_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prediction_id     UUID REFERENCES public.ndis_claim_predictions(id) ON DELETE CASCADE,
  prediction_type   VARCHAR(50) NOT NULL,
  predicted_outcome VARCHAR(50) NOT NULL,
  actual_outcome    VARCHAR(50),
  was_correct       BOOLEAN,
  feature_vector    JSONB,
  model_version     VARCHAR(50),
  feedback_source   VARCHAR(50) DEFAULT 'pace_webhook',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_feedback_org
  ON public.oracle_ml_feedback(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ml_feedback_incorrect
  ON public.oracle_ml_feedback(organization_id) WHERE was_correct = false;

ALTER TABLE public.oracle_ml_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_ml_feedback"
  ON public.oracle_ml_feedback FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- PART 6: Fleet Utilization Cache (materialized view + RPC)
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.fleet_utilization_cache (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trade_category      VARCHAR(100),
  utilization_ratio   NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  total_hours_booked  NUMERIC(10,2) DEFAULT 0,
  total_hours_avail   NUMERIC(10,2) DEFAULT 0,
  horizon_hours       INT DEFAULT 48,
  calculated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, trade_category)
);

ALTER TABLE public.fleet_utilization_cache ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
CREATE POLICY "org_members_read_fleet_cache"
  ON public.fleet_utilization_cache FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RPC: Refresh fleet utilization cache (run via pg_cron every 15 min)
CREATE OR REPLACE FUNCTION public.refresh_fleet_utilization_cache(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_horizon_start TIMESTAMPTZ := NOW();
  v_horizon_end   TIMESTAMPTZ := NOW() + INTERVAL '48 hours';
  v_total_techs   INT;
  v_booked_hours  NUMERIC;
  v_avail_hours   NUMERIC;
  v_ratio         NUMERIC;
BEGIN
  SELECT COUNT(DISTINCT technician_id) INTO v_total_techs
  FROM public.schedule_blocks
  WHERE organization_id = p_org_id
    AND start_time >= NOW() - INTERVAL '7 days';

  v_total_techs := GREATEST(v_total_techs, 1);

  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (LEAST(end_time, v_horizon_end) - GREATEST(start_time, v_horizon_start))) / 3600.0
  ), 0) INTO v_booked_hours
  FROM public.schedule_blocks
  WHERE organization_id = p_org_id
    AND status NOT IN ('cancelled', 'no_show')
    AND start_time < v_horizon_end
    AND end_time > v_horizon_start;

  v_avail_hours := v_total_techs * 48.0;
  v_ratio := LEAST(v_booked_hours / GREATEST(v_avail_hours, 1), 1.0);

  INSERT INTO public.fleet_utilization_cache
    (organization_id, trade_category, utilization_ratio, total_hours_booked, total_hours_avail, calculated_at)
  VALUES
    (p_org_id, 'ALL', v_ratio, v_booked_hours, v_avail_hours, NOW())
  ON CONFLICT (organization_id, trade_category)
  DO UPDATE SET
    utilization_ratio = EXCLUDED.utilization_ratio,
    total_hours_booked = EXCLUDED.total_hours_booked,
    total_hours_avail = EXCLUDED.total_hours_avail,
    calculated_at = NOW();
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 7: Dynamic Yield Calculation RPC
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.calculate_dynamic_yield(
  p_org_id            UUID,
  p_profile_id        UUID DEFAULT NULL,
  p_fleet_utilization NUMERIC DEFAULT NULL,
  p_weather_severity  NUMERIC DEFAULT 0,
  p_client_elasticity NUMERIC DEFAULT 0.5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile        RECORD;
  v_fleet_util     NUMERIC;
  v_surge          NUMERIC;
  v_raw_margin     NUMERIC;
  v_final_margin   NUMERIC;
  v_was_clamped    BOOLEAN := false;
  v_clamp_dir      VARCHAR(10) := NULL;
BEGIN
  -- Get yield profile
  IF p_profile_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.yield_profiles
    WHERE id = p_profile_id AND organization_id = p_org_id AND is_active = true;
  ELSE
    SELECT * INTO v_profile FROM public.yield_profiles
    WHERE organization_id = p_org_id AND is_active = true
    ORDER BY created_at LIMIT 1;
  END IF;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object(
      'margin', 0.40, 'surge_modifier', 0, 'was_clamped', false,
      'error', 'No active yield profile found'
    );
  END IF;

  -- Get fleet utilization from cache or parameter
  IF p_fleet_utilization IS NOT NULL THEN
    v_fleet_util := p_fleet_utilization;
  ELSE
    SELECT utilization_ratio INTO v_fleet_util
    FROM public.fleet_utilization_cache
    WHERE organization_id = p_org_id AND trade_category = 'ALL';
    v_fleet_util := COALESCE(v_fleet_util, 0.5);
  END IF;

  -- Calculate surge modifier: S = (α × U) + (β × W) + (γ × C)
  v_surge := (v_profile.sensitivity_weight_fleet * v_fleet_util)
           + (v_profile.sensitivity_weight_weather * p_weather_severity)
           + (v_profile.sensitivity_weight_client * p_client_elasticity);

  -- Raw dynamic margin: M_raw = M_base × (1 + S)
  v_raw_margin := v_profile.base_margin * (1 + v_surge);

  -- Cryptographic clamp: max(floor, min(raw, ceiling))
  v_final_margin := v_raw_margin;
  IF v_final_margin > v_profile.max_margin_ceiling THEN
    v_final_margin := v_profile.max_margin_ceiling;
    v_was_clamped := true;
    v_clamp_dir := 'ceiling';
  ELSIF v_final_margin < v_profile.min_margin_floor THEN
    v_final_margin := v_profile.min_margin_floor;
    v_was_clamped := true;
    v_clamp_dir := 'floor';
  END IF;

  RETURN jsonb_build_object(
    'margin', ROUND(v_final_margin, 4),
    'base_margin', v_profile.base_margin,
    'surge_modifier', ROUND(v_surge, 4),
    'raw_margin', ROUND(v_raw_margin, 4),
    'fleet_utilization', v_fleet_util,
    'weather_severity', p_weather_severity,
    'client_elasticity', p_client_elasticity,
    'was_clamped', v_was_clamped,
    'clamp_direction', v_clamp_dir,
    'margin_floor', v_profile.min_margin_floor,
    'margin_ceiling', v_profile.max_margin_ceiling,
    'profile_id', v_profile.id,
    'profile_name', v_profile.profile_name
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 8: Claim prediction helper RPC
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.predict_claim_rejection(
  p_org_id          UUID,
  p_worker_id       UUID,
  p_participant_id  UUID,
  p_support_item    VARCHAR,
  p_shift_date      DATE,
  p_claim_amount    NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_confidence     NUMERIC := 1.0;
  v_reasons        TEXT[] := '{}';
  v_error_code     VARCHAR := NULL;
  v_error_category VARCHAR := NULL;
  v_suggested_fix  TEXT := NULL;
  v_suggested_code VARCHAR := NULL;
  v_is_high_intensity BOOLEAN;
  v_cred_expired   BOOLEAN := false;
  v_budget_remaining NUMERIC;
  v_day_of_week    INT;
  v_is_weekend     BOOLEAN;
  v_overlap_count  INT;
BEGIN
  v_is_high_intensity := p_support_item LIKE '%0400%' OR p_support_item LIKE '%high%';
  v_day_of_week := EXTRACT(DOW FROM p_shift_date);
  v_is_weekend := v_day_of_week IN (0, 6);

  -- Check 1: Worker credential expiry (First Aid, CPR, Manual Handling)
  IF v_is_high_intensity THEN
    SELECT EXISTS(
      SELECT 1 FROM public.worker_credentials
      WHERE user_id = p_worker_id
        AND organization_id = p_org_id
        AND credential_type IN ('first_aid', 'cpr', 'manual_handling')
        AND expiry_date IS NOT NULL
        AND expiry_date < p_shift_date
    ) INTO v_cred_expired;

    IF v_cred_expired THEN
      v_confidence := v_confidence - 0.85;
      v_reasons := array_append(v_reasons,
        'Worker has expired qualification(s) on shift date for High-Intensity code');
      v_error_code := 'PACE_ERR_042';
      v_error_category := 'WORKER_COMPLIANCE';
      v_suggested_fix := 'Downgrade Support Item to Standard Intensity';
      v_suggested_code := REPLACE(p_support_item, '0400', '011');
    END IF;
  END IF;

  -- Check 2: Temporal conflict (weekend code on weekday or vice versa)
  IF p_support_item LIKE '%_TTP%' AND NOT v_is_weekend THEN
    v_confidence := v_confidence - 0.40;
    v_reasons := array_append(v_reasons,
      'TTP (weekend/public holiday) code claimed on a weekday');
    IF v_error_code IS NULL THEN
      v_error_code := 'PACE_ERR_017';
      v_error_category := 'TEMPORAL_CONFLICT';
      v_suggested_fix := 'Change to standard weekday support item code';
    END IF;
  END IF;

  -- Check 3: Budget exhaustion
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_budget_remaining
  FROM public.budget_allocations
  WHERE participant_id = p_participant_id
    AND category ILIKE '%core%'
    AND start_date <= p_shift_date
    AND end_date >= p_shift_date;

  IF v_budget_remaining < p_claim_amount AND v_budget_remaining >= 0 THEN
    v_confidence := v_confidence - 0.50;
    v_reasons := array_append(v_reasons,
      format('Insufficient budget: $%s remaining vs $%s claimed',
        ROUND(v_budget_remaining, 2), ROUND(p_claim_amount, 2)));
    IF v_error_code IS NULL THEN
      v_error_code := 'PACE_ERR_031';
      v_error_category := 'BUDGET_EXHAUSTION';
      v_suggested_fix := format('Reduce claim to $%s or request plan review', ROUND(v_budget_remaining, 2));
    END IF;
  END IF;

  -- Check 4: Ratio violation (simultaneous shifts)
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.schedule_blocks sb
  WHERE sb.technician_id = p_worker_id
    AND sb.organization_id = p_org_id
    AND sb.status NOT IN ('cancelled', 'no_show')
    AND DATE(sb.start_time) = p_shift_date
    AND sb.participant_id IS NOT NULL
    AND sb.participant_id != p_participant_id;

  IF v_overlap_count > 0 AND p_support_item LIKE '%01_%' THEN
    v_confidence := v_confidence - 0.30;
    v_reasons := array_append(v_reasons,
      format('Worker had %s other participant shift(s) on same date — possible ratio violation', v_overlap_count));
    IF v_error_code IS NULL THEN
      v_error_code := 'PACE_ERR_055';
      v_error_category := 'RATIO_VIOLATION';
      v_suggested_fix := 'Verify 1:1 vs group ratio and adjust support item code';
    END IF;
  END IF;

  -- Clamp confidence between 0 and 1
  v_confidence := GREATEST(v_confidence, 0.0);

  RETURN jsonb_build_object(
    'confidence_success', ROUND(v_confidence, 4),
    'confidence_reject', ROUND(1.0 - v_confidence, 4),
    'predicted_error_code', v_error_code,
    'predicted_error_category', v_error_category,
    'flagged_reasons', v_reasons,
    'suggested_fix', v_suggested_fix,
    'suggested_code', v_suggested_code,
    'checks_performed', jsonb_build_object(
      'credential_expiry', v_cred_expired,
      'temporal_conflict', p_support_item LIKE '%_TTP%' AND NOT v_is_weekend,
      'budget_remaining', v_budget_remaining,
      'overlap_shifts', v_overlap_count
    )
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- PART 9: Audit trigger for surge margin > 15%
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.audit_surge_margin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.calculated_margin_applied > (NEW.base_margin_used + 0.15) THEN
    INSERT INTO public.audit_log (
      organization_id, action, entity_type, entity_id,
      performed_by, metadata
    ) VALUES (
      NEW.organization_id, 'SURGE_MARGIN_ALERT', 'quote_yield_log', NEW.id,
      NULL,
      jsonb_build_object(
        'base_margin', NEW.base_margin_used,
        'applied_margin', NEW.calculated_margin_applied,
        'surge_above_base', NEW.calculated_margin_applied - NEW.base_margin_used,
        'fleet_util', NEW.fleet_utilization_at_calc,
        'weather', NEW.weather_severity_index
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_surge_margin ON public.quote_yield_logs;
CREATE TRIGGER trg_audit_surge_margin
  AFTER INSERT ON public.quote_yield_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_surge_margin();
