-- ============================================================================
-- Migration 072: SCHADS Award Rules, Public Holidays & Fatigue Overrides
-- (Project Nightingale Phase 3.5)
-- Award interpretation engine for SCHADS compliance guardrails.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Award Rules Configuration ─────────────────────────────────────────
-- Configurable per-organization SCHADS rules. Defaults match the current award
-- but can be overridden by the organization for custom EBA arrangements.

CREATE TABLE IF NOT EXISTS public.award_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  rule_type             text NOT NULL CHECK (rule_type IN (
    'minimum_engagement_hours',
    'broken_shift_allowance',
    'fatigue_gap_hours',
    'overtime_threshold_weekly',
    'double_time_threshold_weekly',
    'saturday_loading_pct',
    'sunday_loading_pct',
    'public_holiday_loading_pct',
    'sleepover_flat_rate',
    'active_night_multiplier',
    'travel_rate_per_km'
  )),
  value_numeric         numeric(10,2),                         -- e.g., 38.00 for overtime threshold
  value_text            text,                                  -- for complex rules
  effective_from        date NOT NULL DEFAULT CURRENT_DATE,
  effective_to          date,
  source                text DEFAULT 'SCHADS 2025',            -- award reference
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_award_rules_org
  ON public.award_rules (organization_id);
CREATE INDEX IF NOT EXISTS idx_award_rules_type
  ON public.award_rules (organization_id, rule_type);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_award_rules_updated_at') THEN
    CREATE TRIGGER set_award_rules_updated_at
      BEFORE UPDATE ON public.award_rules
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 2. Public Holidays ───────────────────────────────────────────────────
-- Per-state public holiday calendar for penalty rate calculation.

CREATE TABLE IF NOT EXISTS public.public_holidays (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name                  text NOT NULL,
  date                  date NOT NULL,
  state                 text NOT NULL CHECK (state IN (
    'NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'National'
  )),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, date, state)
);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date
  ON public.public_holidays (date, state);
CREATE INDEX IF NOT EXISTS idx_public_holidays_org
  ON public.public_holidays (organization_id);

-- ─── 3. Fatigue Management Overrides ──────────────────────────────────────
-- Audit trail when a manager overrides the 10-hour fatigue rule.

CREATE TABLE IF NOT EXISTS public.fatigue_overrides (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  worker_id             uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  shift_id              uuid NOT NULL REFERENCES public.jobs ON DELETE CASCADE,
  previous_shift_id     uuid REFERENCES public.jobs ON DELETE SET NULL,
  gap_hours             numeric(4,1) NOT NULL,                 -- actual gap in hours
  justification         text NOT NULL,
  approved_by           uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fatigue_overrides_worker
  ON public.fatigue_overrides (worker_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_overrides_org
  ON public.fatigue_overrides (organization_id);

-- ─── 4. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.award_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fatigue_overrides ENABLE ROW LEVEL SECURITY;

-- ─── 5. RLS Policies ────────────────────────────────────────────────────────

-- Award Rules
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'award_rules' AND policyname = 'Org members can view award rules') THEN
    CREATE POLICY "Org members can view award rules"
      ON public.award_rules FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'award_rules' AND policyname = 'Admins can manage award rules') THEN
    CREATE POLICY "Admins can manage award rules"
      ON public.award_rules FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = award_rules.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- Public Holidays
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_holidays' AND policyname = 'Org members can view public holidays') THEN
    CREATE POLICY "Org members can view public holidays"
      ON public.public_holidays FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'public_holidays' AND policyname = 'Admins can manage public holidays') THEN
    CREATE POLICY "Admins can manage public holidays"
      ON public.public_holidays FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = public_holidays.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- Fatigue Overrides
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fatigue_overrides' AND policyname = 'Org members can view fatigue overrides') THEN
    CREATE POLICY "Org members can view fatigue overrides"
      ON public.fatigue_overrides FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fatigue_overrides' AND policyname = 'Managers can insert fatigue overrides') THEN
    CREATE POLICY "Managers can insert fatigue overrides"
      ON public.fatigue_overrides FOR INSERT
      WITH CHECK (
        (SELECT role FROM public.organization_members
         WHERE organization_id = fatigue_overrides.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- ─── 6. Helper: Get active award rule value ───────────────────────────────

CREATE OR REPLACE FUNCTION public.get_award_rule(
  p_organization_id uuid,
  p_rule_type text,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_value numeric;
BEGIN
  SELECT value_numeric INTO v_value
  FROM public.award_rules
  WHERE organization_id = p_organization_id
    AND rule_type = p_rule_type
    AND effective_from <= p_date
    AND (effective_to IS NULL OR effective_to > p_date)
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Return SCHADS defaults if no org-specific rule configured
  IF v_value IS NULL THEN
    CASE p_rule_type
      WHEN 'minimum_engagement_hours' THEN v_value := 2.0;
      WHEN 'fatigue_gap_hours' THEN v_value := 10.0;
      WHEN 'overtime_threshold_weekly' THEN v_value := 38.0;
      WHEN 'double_time_threshold_weekly' THEN v_value := 45.6;
      WHEN 'saturday_loading_pct' THEN v_value := 50.0;
      WHEN 'sunday_loading_pct' THEN v_value := 100.0;
      WHEN 'public_holiday_loading_pct' THEN v_value := 150.0;
      WHEN 'broken_shift_allowance' THEN v_value := 15.73;
      WHEN 'sleepover_flat_rate' THEN v_value := 51.09;
      WHEN 'active_night_multiplier' THEN v_value := 1.15;
      WHEN 'travel_rate_per_km' THEN v_value := 0.96;
      ELSE v_value := 0;
    END CASE;
  END IF;

  RETURN v_value;
END;
$$;

-- ─── 7. Helper: Check if date is a public holiday ────────────────────────

CREATE OR REPLACE FUNCTION public.is_public_holiday(
  p_organization_id uuid,
  p_date date,
  p_state text DEFAULT 'National'
)
RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.public_holidays
    WHERE organization_id = p_organization_id
      AND date = p_date
      AND state IN (p_state, 'National')
  );
END;
$$;

-- ─── 8. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.award_rules IS
  'Configurable SCHADS Award rules per organization. Defaults match current SCHADS but can be overridden for EBA arrangements.';
COMMENT ON TABLE public.public_holidays IS
  'Per-state public holiday calendar for automatic penalty rate calculation.';
COMMENT ON TABLE public.fatigue_overrides IS
  'Audit trail for manager overrides of the SCHADS 10-hour fatigue rest rule.';
