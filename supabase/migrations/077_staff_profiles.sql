-- ============================================================================
-- Migration 077: Staff Profiles & SCHADS Award Rates
-- (Project Nightingale — Workforce & Intelligent Rostering Engine)
-- Extends organization_members with deep HR profile data and federal wage lookup.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Staff Profiles ─────────────────────────────────────────────────────
-- 1:1 extension of organization_members for detailed HR/employment data.
-- Links SCHADS classification to base pay rate for automated cost calculations.

CREATE TABLE IF NOT EXISTS public.staff_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employment_type       text NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'casual')) DEFAULT 'casual',
  schads_level          text NOT NULL DEFAULT '2.1',
  base_hourly_rate      numeric(10,2) NOT NULL DEFAULT 0,
  max_weekly_hours      integer DEFAULT 38,
  contracted_hours      integer,
  qualifications        text[] DEFAULT '{}',
  home_address          text,
  home_lat              numeric(10,7),
  home_lng              numeric(10,7),
  availability          jsonb DEFAULT '{}'::jsonb,
  emergency_contact     jsonb,
  date_of_birth         date,
  tax_file_number_hash  text,
  superannuation_fund   text,
  superannuation_number text,
  visa_status           text,
  vehicle_registration  text,
  license_number        text,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_org
  ON public.staff_profiles (organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user
  ON public.staff_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_level
  ON public.staff_profiles (organization_id, schads_level);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_geo
  ON public.staff_profiles (organization_id, home_lat, home_lng)
  WHERE home_lat IS NOT NULL AND home_lng IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_staff_profiles_updated_at') THEN
    CREATE TRIGGER set_staff_profiles_updated_at
      BEFORE UPDATE ON public.staff_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 2. SCHADS Award Rates ─────────────────────────────────────────────────
-- Federal minimum wages by SCHADS classification level.
-- Maintained by iWorkr system — updated when federal award changes (typically 1 July).

CREATE TABLE IF NOT EXISTS public.schads_award_rates (
  id                serial PRIMARY KEY,
  effective_date    date NOT NULL,
  level_code        text NOT NULL,
  base_rate         numeric(10,2) NOT NULL,
  casual_loading    numeric(4,2) DEFAULT 1.25,
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (effective_date, level_code)
);

CREATE INDEX IF NOT EXISTS idx_schads_rates_effective
  ON public.schads_award_rates (effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_schads_rates_level
  ON public.schads_award_rates (level_code, effective_date DESC);

-- ─── 3. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schads_award_rates ENABLE ROW LEVEL SECURITY;

-- ─── 4. RLS Policies — staff_profiles ───────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_profiles' AND policyname = 'Org members can view staff profiles') THEN
    CREATE POLICY "Org members can view staff profiles"
      ON public.staff_profiles FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_profiles' AND policyname = 'Workers can view own staff profile') THEN
    CREATE POLICY "Workers can view own staff profile"
      ON public.staff_profiles FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_profiles' AND policyname = 'Admins can manage staff profiles') THEN
    CREATE POLICY "Admins can manage staff profiles"
      ON public.staff_profiles FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = staff_profiles.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager')
      );
  END IF;
END $$;

-- ─── 5. RLS Policies — schads_award_rates (read-only for all authenticated) ─

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schads_award_rates' AND policyname = 'Authenticated users can read SCHADS rates') THEN
    CREATE POLICY "Authenticated users can read SCHADS rates"
      ON public.schads_award_rates FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ─── 6. Seed SCHADS Award Rates (2025-26 Financial Year) ───────────────────
-- Based on SCHADS Award MA000100 effective 1 July 2025.
-- These are minimum weekly rates converted to hourly (÷ 38).

INSERT INTO public.schads_award_rates (effective_date, level_code, base_rate, casual_loading, description) VALUES
  ('2025-07-01', '1',   '25.52', 1.25, 'SCHADS Level 1 — Trainee / Entry'),
  ('2025-07-01', '2.1', '27.76', 1.25, 'SCHADS Level 2 Pay Point 1 — New Personal Care Worker'),
  ('2025-07-01', '2.2', '28.25', 1.25, 'SCHADS Level 2 Pay Point 2 — 1+ Year Experience'),
  ('2025-07-01', '2.3', '28.84', 1.25, 'SCHADS Level 2 Pay Point 3 — 2+ Years Experience'),
  ('2025-07-01', '2.4', '29.04', 1.25, 'SCHADS Level 2 Pay Point 4 — Senior Care Worker'),
  ('2025-07-01', '3.1', '29.82', 1.25, 'SCHADS Level 3 Pay Point 1 — Complex Care / Team Leader'),
  ('2025-07-01', '3.2', '30.37', 1.25, 'SCHADS Level 3 Pay Point 2 — Experienced Complex Care'),
  ('2025-07-01', '3.3', '31.24', 1.25, 'SCHADS Level 3 Pay Point 3 — Specialist Practitioner'),
  ('2025-07-01', '4.1', '31.84', 1.25, 'SCHADS Level 4 Pay Point 1 — Coordinator / Supervisor'),
  ('2025-07-01', '4.2', '32.65', 1.25, 'SCHADS Level 4 Pay Point 2 — Senior Coordinator'),
  ('2025-07-01', '4.3', '33.48', 1.25, 'SCHADS Level 4 Pay Point 3 — Team Manager'),
  ('2025-07-01', '5',   '35.03', 1.25, 'SCHADS Level 5 — Service Manager / Clinical Lead'),
  ('2025-07-01', '6',   '37.22', 1.25, 'SCHADS Level 6 — Senior Manager / Quality & Compliance'),
  ('2025-07-01', '7',   '39.91', 1.25, 'SCHADS Level 7 — Director / Head of Department'),
  ('2025-07-01', '8',   '43.85', 1.25, 'SCHADS Level 8 — Executive / CEO-level')
ON CONFLICT (effective_date, level_code) DO NOTHING;

-- ─── 7. Helper: Lookup SCHADS rate for a level ─────────────────────────────

CREATE OR REPLACE FUNCTION public.get_schads_rate(
  p_level_code text,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT base_rate INTO v_rate
  FROM public.schads_award_rates
  WHERE level_code = p_level_code
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  RETURN COALESCE(v_rate, 0);
END;
$$;

-- ─── 8. Helper: Lookup SCHADS rate with casual loading ─────────────────────

CREATE OR REPLACE FUNCTION public.get_schads_rate_with_loading(
  p_level_code text,
  p_employment_type text,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_rate numeric;
  v_loading numeric;
BEGIN
  SELECT base_rate, casual_loading INTO v_rate, v_loading
  FROM public.schads_award_rates
  WHERE level_code = p_level_code
    AND effective_date <= p_date
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_rate IS NULL THEN
    RETURN 0;
  END IF;

  IF p_employment_type = 'casual' THEN
    RETURN ROUND(v_rate * v_loading, 2);
  END IF;

  RETURN v_rate;
END;
$$;

-- ─── 9. Comments ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.staff_profiles IS
  'Extended HR profile for workers. Links SCHADS classification to base pay rate, stores qualifications, availability, and geographic home location for roster optimization.';
COMMENT ON TABLE public.schads_award_rates IS
  'Federal SCHADS Award minimum wage rates by classification level. Updated annually by iWorkr system when federal award changes.';
COMMENT ON FUNCTION public.get_schads_rate IS
  'Lookup the applicable SCHADS base rate for a given level and date.';
COMMENT ON FUNCTION public.get_schads_rate_with_loading IS
  'Lookup the applicable SCHADS rate including casual loading if applicable.';
