-- ============================================================================
-- @migration UnifiedPayrollTimesheets
-- @status COMPLETE
-- @description Project Ledger — timesheets, time entries with GPS/EVV, payroll exports
-- @tables timesheets, time_entries, payroll_exports
-- @lastAudit 2026-03-22
-- ============================================================================

-- ─── 1. Timesheets (Weekly Container) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.timesheets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id         uuid NOT NULL,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'approved', 'exported', 'adjustment'
  )),
  is_locked         boolean DEFAULT false,
  total_hours       numeric(6,2) DEFAULT 0.00,
  total_ordinary    numeric(6,2) DEFAULT 0.00,
  total_overtime    numeric(6,2) DEFAULT 0.00,
  total_leave       numeric(6,2) DEFAULT 0.00,
  total_allowances  numeric(10,2) DEFAULT 0.00,
  notes             text,
  approved_by       uuid,
  approved_at       timestamptz,
  exported_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate timesheets for same worker/period
  UNIQUE (organization_id, worker_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_timesheets_org
  ON public.timesheets (organization_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_worker
  ON public.timesheets (worker_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_period
  ON public.timesheets (organization_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_timesheets_status
  ON public.timesheets (organization_id, status);

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- ─── 2. Time Entries (Clock In/Out Records) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.time_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  timesheet_id          uuid REFERENCES public.timesheets(id) ON DELETE CASCADE,
  shift_id              uuid,  -- Links to schedule_blocks/shifts
  worker_id             uuid NOT NULL,

  -- Raw telemetry
  clock_in              timestamptz NOT NULL,
  clock_out             timestamptz,
  clock_in_location     jsonb,  -- {"lat": -27.4698, "lng": 153.0251, "accuracy_m": 12, "is_verified": true}
  clock_out_location    jsonb,

  -- Calculated
  total_hours           numeric(6,2),
  break_minutes         integer DEFAULT 0,
  travel_minutes        integer DEFAULT 0,
  travel_km             numeric(8,2) DEFAULT 0,

  -- Status & flags
  status                text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'approved', 'disputed', 'auto_resolved'
  )),
  is_geofence_override  boolean DEFAULT false,
  geofence_override_reason text,
  is_manual_entry       boolean DEFAULT false,
  is_auto_clock_out     boolean DEFAULT false,

  -- Exceptions
  scheduled_start       timestamptz,
  scheduled_end         timestamptz,
  variance_minutes      integer DEFAULT 0,   -- Deviation from schedule
  exception_type        text CHECK (exception_type IN (
    NULL, 'late_start', 'early_finish', 'overtime', 'no_show',
    'unscheduled', 'missed_clock_out', 'geofence_breach'
  )),
  exception_resolved    boolean DEFAULT false,
  exception_resolved_by uuid,
  exception_notes       text,

  -- Award interpretation output
  award_interpretation  jsonb,  -- The fractured payroll payload from Edge Function
  -- e.g. {"categories": [{"code":"BASE_ORD","hours":7.6,"multiplier":1.0}, ...], "allowances": [...]}

  -- Breaks log
  breaks                jsonb DEFAULT '[]'::jsonb,
  -- Array of: {"start": "2026-03-13T12:00:00Z", "end": "2026-03-13T12:30:00Z", "type": "unpaid"}

  -- Allowances captured at clock-out
  allowances_captured   jsonb DEFAULT '[]'::jsonb,
  -- Array of: {"type": "vehicle_km", "value": 45, "notes": "Client transport"}

  -- Leave injection
  is_leave_entry        boolean DEFAULT false,
  leave_type            text CHECK (leave_type IN (
    NULL, 'annual', 'personal_carers', 'compassionate',
    'unpaid', 'long_service', 'parental', 'community_service'
  )),

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_org
  ON public.time_entries (organization_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_timesheet
  ON public.time_entries (timesheet_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_worker
  ON public.time_entries (worker_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in
  ON public.time_entries (organization_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_status
  ON public.time_entries (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_exception
  ON public.time_entries (organization_id, exception_type)
  WHERE exception_type IS NOT NULL;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- ─── 3. Payroll Exports ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_exports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  timesheet_ids     uuid[] NOT NULL,
  target_platform   text NOT NULL CHECK (target_platform IN ('xero', 'myob', 'keypay', 'csv')),
  batch_status      text NOT NULL DEFAULT 'processing' CHECK (batch_status IN (
    'processing', 'success', 'partial_fail', 'failed'
  )),
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  worker_count      integer DEFAULT 0,
  total_hours       numeric(8,2) DEFAULT 0.00,
  total_cost        numeric(12,2) DEFAULT 0.00,
  api_response      jsonb,
  error_details     jsonb,
  exported_by       uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_exports_org
  ON public.payroll_exports (organization_id);

ALTER TABLE public.payroll_exports ENABLE ROW LEVEL SECURITY;

-- ─── 4. Timesheet Adjustments (Post-lock corrections) ────────────────────────

CREATE TABLE IF NOT EXISTS public.timesheet_adjustments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  original_entry_id     uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  adjustment_type       text NOT NULL CHECK (adjustment_type IN (
    'time_correction', 'rate_correction', 'allowance_add', 'allowance_remove', 'void'
  )),
  reason                text NOT NULL,
  old_values            jsonb NOT NULL,  -- Snapshot of original
  new_values            jsonb NOT NULL,  -- The correction
  approved_by           uuid,
  approved_at           timestamptz,
  created_by            uuid NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ts_adj_org
  ON public.timesheet_adjustments (organization_id);
CREATE INDEX IF NOT EXISTS idx_ts_adj_entry
  ON public.timesheet_adjustments (original_entry_id);

ALTER TABLE public.timesheet_adjustments ENABLE ROW LEVEL SECURITY;

-- ─── 5. RLS Policies ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'timesheets' AND policyname = 'Org members manage timesheets') THEN
    EXECUTE 'CREATE POLICY "Org members manage timesheets" ON public.timesheets FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = timesheets.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'time_entries' AND policyname = 'Org members manage time entries') THEN
    EXECUTE 'CREATE POLICY "Org members manage time entries" ON public.time_entries FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = time_entries.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payroll_exports' AND policyname = 'Org members manage payroll exports') THEN
    EXECUTE 'CREATE POLICY "Org members manage payroll exports" ON public.payroll_exports FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = payroll_exports.organization_id AND members.user_id = auth.uid())
    )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'timesheet_adjustments' AND policyname = 'Org members manage timesheet adjustments') THEN
    EXECUTE 'CREATE POLICY "Org members manage timesheet adjustments" ON public.timesheet_adjustments FOR ALL USING (
      EXISTS (SELECT 1 FROM public.organization_members members WHERE members.organization_id = timesheet_adjustments.organization_id AND members.user_id = auth.uid())
    )';
  END IF;
END $$;

-- ─── 6. Auto-update triggers ────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_timesheets_updated_at') THEN
    CREATE TRIGGER set_timesheets_updated_at
      BEFORE UPDATE ON public.timesheets
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_time_entries_updated_at') THEN
    CREATE TRIGGER set_time_entries_updated_at
      BEFORE UPDATE ON public.time_entries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 7. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.timesheets IS
  'Weekly timesheet containers for workers. Once exported, is_locked prevents mutation. Project Ledger.';
COMMENT ON TABLE public.time_entries IS
  'Individual clock-in/out records with GPS telemetry, EVV compliance, and award interpretation payloads.';
COMMENT ON TABLE public.payroll_exports IS
  'Batch export records tracking sync status to Xero/MYOB/KeyPay accounting platforms.';
COMMENT ON TABLE public.timesheet_adjustments IS
  'Post-lock corrections maintaining forensic audit trail. Links to original time_entries.';
