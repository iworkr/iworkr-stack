-- ============================================================================
-- @migration ChronosSCHADSPayroll
-- @status COMPLETE
-- @description Project Chronos-SCHADS — award interpreter, pay profiles, timesheet pay lines
-- @tables worker_pay_profiles, timesheet_pay_lines, australian_public_holidays, time_entries (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Extend time_entries for SCHADS-specific flags ─────────────────────
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS is_sleepover BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_short_notice_cancel BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS schads_pay_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schads_pay_error TEXT;

-- ── 2. Worker Pay Profiles (temporally versioned) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.worker_pay_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL,    -- references auth.users
  employment_type   TEXT NOT NULL DEFAULT 'CASUAL'
    CHECK (employment_type IN ('CASUAL', 'PART_TIME', 'FULL_TIME')),
  schads_level      INT NOT NULL DEFAULT 2 CHECK (schads_level BETWEEN 1 AND 8),
  schads_paypoint   INT NOT NULL DEFAULT 1 CHECK (schads_paypoint BETWEEN 1 AND 4),
  base_hourly_rate  NUMERIC(10,4) NOT NULL,
  effective_from    DATE NOT NULL,
  effective_to      DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.worker_pay_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view pay profiles"
  ON public.worker_pay_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = worker_pay_profiles.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );
CREATE POLICY "Admins can manage pay profiles"
  ON public.worker_pay_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = worker_pay_profiles.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','manager')
        AND om.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_worker_pay_profiles_user_org
  ON public.worker_pay_profiles (user_id, organization_id, effective_from DESC);

-- ── 3. Timesheet Pay Lines (engine output) ────────────────────────────────
-- Each approved shift is fractured into multiple pay lines by the engine.
CREATE TABLE IF NOT EXISTS public.timesheet_pay_lines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  timesheet_id         UUID REFERENCES public.timesheets(id) ON DELETE CASCADE,
  time_entry_id        UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
  worker_id            UUID NOT NULL,
  pay_category         TEXT NOT NULL
    CHECK (pay_category IN (
      'ORDINARY_HOURS',
      'EVENING_SHIFT',    -- 8pm–12am: +12.5%
      'NIGHT_SHIFT',      -- 12am–6am: +15%
      'SATURDAY',         -- Sat: +50% (casual +75%)
      'SUNDAY',           -- Sun: +100%
      'PUBLIC_HOLIDAY',   -- PH: +150%
      'OVERTIME_1_5X',    -- First 2h OT: +50%
      'OVERTIME_2_0X',    -- Subsequent OT: +100%
      'MINIMUM_ENGAGEMENT_PADDING', -- FWO minimum engagement
      'CLIENT_CANCELLATION'  -- Short-notice cancel, still billable
    )),
  allowance_type       TEXT NOT NULL DEFAULT 'NONE'
    CHECK (allowance_type IN (
      'NONE',
      'BROKEN_SHIFT_1_BREAK',  -- $19.34 flat
      'BROKEN_SHIFT_2_BREAKS', -- $25.67 flat
      'SLEEPOVER',             -- $55.00 flat
      'FIRST_AID',             -- FWO first aid certificate
      'KILOMETRE_ALLOWANCE',   -- Travel km
      'LAUNDRY',
      'TOOL_ALLOWANCE'
    )),
  units                NUMERIC(8,4) NOT NULL,  -- hours or count
  rate_multiplier      NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  base_rate            NUMERIC(10,4) NOT NULL,
  casual_loading       NUMERIC(6,4) NOT NULL DEFAULT 1.0, -- 1.25 for casual
  calculated_rate      NUMERIC(10,4) NOT NULL,  -- base_rate * rate_multiplier * casual_loading
  total_line_amount    NUMERIC(12,4) NOT NULL,
  shift_date           DATE NOT NULL,
  shift_start_utc      TIMESTAMPTZ,
  shift_end_utc        TIMESTAMPTZ,
  is_synthetic         BOOLEAN NOT NULL DEFAULT FALSE,  -- padding / sleepover lines
  engine_version       TEXT NOT NULL DEFAULT '1.0',
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.timesheet_pay_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view pay lines"
  ON public.timesheet_pay_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = timesheet_pay_lines.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_pay_lines_timesheet_id
  ON public.timesheet_pay_lines (timesheet_id);
CREATE INDEX IF NOT EXISTS idx_pay_lines_worker_date
  ON public.timesheet_pay_lines (worker_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_pay_lines_worker_org
  ON public.timesheet_pay_lines (worker_id, organization_id, shift_date);

-- ── 4. Australian Public Holidays ─────────────────────────────────────────
-- Stores public holidays by state/territory for penalty rate detection.
CREATE TABLE IF NOT EXISTS public.australian_public_holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date  DATE NOT NULL,
  holiday_name  TEXT NOT NULL,
  state         TEXT NOT NULL CHECK (state IN ('ACT','NSW','VIC','QLD','SA','WA','TAS','NT','NAT')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.australian_public_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read public holidays"
  ON public.australian_public_holidays FOR SELECT USING (TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ph_date_state
  ON public.australian_public_holidays (holiday_date, state);

-- Seed 2024-2025 public holidays (national + most populous states)
INSERT INTO public.australian_public_holidays (holiday_date, holiday_name, state) VALUES
  -- National
  ('2025-01-01','New Year''s Day','NAT'),
  ('2025-01-27','Australia Day','NAT'),
  ('2025-04-18','Good Friday','NAT'),
  ('2025-04-19','Easter Saturday','NAT'),
  ('2025-04-20','Easter Sunday','NAT'),
  ('2025-04-21','Easter Monday','NAT'),
  ('2025-04-25','ANZAC Day','NAT'),
  ('2025-12-25','Christmas Day','NAT'),
  ('2025-12-26','Boxing Day','NAT'),
  -- NSW
  ('2025-06-09','King''s Birthday','NSW'),
  ('2025-10-06','Labour Day','NSW'),
  -- VIC
  ('2025-03-10','Labour Day','VIC'),
  ('2025-06-09','King''s Birthday','VIC'),
  ('2025-11-04','Melbourne Cup Day','VIC'),
  -- QLD
  ('2025-05-05','Labour Day','QLD'),
  ('2025-08-13','Royal Queensland Show','QLD'),
  ('2025-10-06','King''s Birthday','QLD'),
  -- SA
  ('2025-06-09','King''s Birthday','SA'),
  ('2025-10-06','Labour Day','SA'),
  -- WA
  ('2025-03-03','Labour Day','WA'),
  ('2025-09-22','Queen''s Birthday','WA'),
  -- 2026
  ('2026-01-01','New Year''s Day','NAT'),
  ('2026-01-26','Australia Day','NAT'),
  ('2026-04-03','Good Friday','NAT'),
  ('2026-04-04','Easter Saturday','NAT'),
  ('2026-04-05','Easter Sunday','NAT'),
  ('2026-04-06','Easter Monday','NAT'),
  ('2026-04-25','ANZAC Day','NAT'),
  ('2026-12-25','Christmas Day','NAT'),
  ('2026-12-26','Boxing Day','NAT')
ON CONFLICT (holiday_date, state) DO NOTHING;

-- ── 5. SCHADS reference rates (2024-25 pay guide) ────────────────────────
-- Base hourly rates for each Level/Paypoint. Engine looks up rate at date.
CREATE TABLE IF NOT EXISTS public.schads_base_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schads_level    INT NOT NULL CHECK (schads_level BETWEEN 1 AND 8),
  schads_paypoint INT NOT NULL CHECK (schads_paypoint BETWEEN 1 AND 4),
  hourly_rate     NUMERIC(8,4) NOT NULL,
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.schads_base_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read schads rates"
  ON public.schads_base_rates FOR SELECT USING (TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schads_rates_level_pp_date
  ON public.schads_base_rates (schads_level, schads_paypoint, effective_from);

-- Seed SCHADS 2024-25 pay guide rates (disability support workers)
-- Source: FWO SCHADS Award (MA000100) - approximate rates for illustration
INSERT INTO public.schads_base_rates (schads_level, schads_paypoint, hourly_rate, effective_from) VALUES
  (1,1,23.00,'2024-07-01'),(1,2,23.39,'2024-07-01'),(1,3,23.78,'2024-07-01'),(1,4,24.17,'2024-07-01'),
  (2,1,24.57,'2024-07-01'),(2,2,24.98,'2024-07-01'),(2,3,25.39,'2024-07-01'),(2,4,25.80,'2024-07-01'),
  (3,1,26.21,'2024-07-01'),(3,2,26.62,'2024-07-01'),(3,3,27.03,'2024-07-01'),(3,4,27.44,'2024-07-01'),
  (4,1,27.85,'2024-07-01'),(4,2,28.26,'2024-07-01'),(4,3,28.67,'2024-07-01'),(4,4,29.08,'2024-07-01'),
  (5,1,29.49,'2024-07-01'),(5,2,29.98,'2024-07-01'),(5,3,30.47,'2024-07-01'),(5,4,30.96,'2024-07-01'),
  (6,1,31.45,'2024-07-01'),(6,2,32.02,'2024-07-01'),(6,3,32.59,'2024-07-01'),(6,4,33.16,'2024-07-01'),
  (7,1,33.73,'2024-07-01'),(7,2,34.38,'2024-07-01'),(7,3,35.03,'2024-07-01'),(7,4,35.68,'2024-07-01'),
  (8,1,36.33,'2024-07-01'),(8,2,37.06,'2024-07-01'),(8,3,37.79,'2024-07-01'),(8,4,38.52,'2024-07-01')
ON CONFLICT (schads_level, schads_paypoint, effective_from) DO NOTHING;

-- ── 6. RPCs for the engine ────────────────────────────────────────────────

-- Returns cumulative hours worked by a worker in the ISO week containing p_date
CREATE OR REPLACE FUNCTION public.get_cumulative_week_hours(
  p_worker_id UUID,
  p_org_id    UUID,
  p_date      DATE
) RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    SUM(
      EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0
      - COALESCE(te.break_minutes, 0) / 60.0
    ),
    0
  )
  FROM public.time_entries te
  WHERE te.worker_id = p_worker_id
    AND te.organization_id = p_org_id
    AND te.clock_in >= date_trunc('week', p_date::TIMESTAMPTZ)
    AND te.clock_in < date_trunc('week', p_date::TIMESTAMPTZ) + INTERVAL '7 days'
    AND te.status IN ('approved', 'auto_resolved', 'completed')
    AND te.clock_out IS NOT NULL;
$$;

-- Returns the worker's pay profile effective on a given date
CREATE OR REPLACE FUNCTION public.get_worker_pay_profile_at_date(
  p_user_id UUID,
  p_org_id  UUID,
  p_date    DATE
) RETURNS TABLE (
  employment_type  TEXT,
  schads_level     INT,
  schads_paypoint  INT,
  base_hourly_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT wpp.employment_type, wpp.schads_level, wpp.schads_paypoint, wpp.base_hourly_rate
  FROM public.worker_pay_profiles wpp
  WHERE wpp.user_id = p_user_id
    AND wpp.organization_id = p_org_id
    AND wpp.effective_from <= p_date
    AND (wpp.effective_to IS NULL OR wpp.effective_to >= p_date)
  ORDER BY wpp.effective_from DESC
  LIMIT 1;
$$;

-- Check if a date is a public holiday (NAT + state)
CREATE OR REPLACE FUNCTION public.is_public_holiday(p_date DATE, p_state TEXT DEFAULT 'NAT')
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.australian_public_holidays
    WHERE holiday_date = p_date
      AND (state = 'NAT' OR state = p_state)
  );
$$;
