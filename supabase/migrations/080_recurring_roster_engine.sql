-- ============================================================================
-- Migration 080: Recurring Roster & Master Schedule Engine
-- (Project Nightingale — The Blueprint Matrix)
-- Creates roster_templates, template_shifts, staff_leave tables.
-- Extends schedule_blocks with template origin tracking & cancellation fields.
-- SAFE: All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Staff Leave ─────────────────────────────────────────────────────────
-- Worker leave/absence tracking for rollout conflict detection.

CREATE TABLE IF NOT EXISTS public.staff_leave (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type            text NOT NULL CHECK (leave_type IN (
    'annual', 'sick', 'personal', 'long_service', 'parental',
    'workers_comp', 'unpaid', 'public_holiday', 'other'
  )),
  start_date            date NOT NULL,
  end_date              date NOT NULL,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'cancelled'
  )),
  notes                 text,
  approved_by           uuid REFERENCES public.profiles(id),
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_org
  ON public.staff_leave (organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_user
  ON public.staff_leave (user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_staff_leave_status
  ON public.staff_leave (organization_id, status)
  WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_staff_leave_date_range
  ON public.staff_leave (organization_id, start_date, end_date)
  WHERE status = 'approved';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_staff_leave_updated_at') THEN
    CREATE TRIGGER set_staff_leave_updated_at
      BEFORE UPDATE ON public.staff_leave
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 2. Roster Templates (The Blueprint Container) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.roster_templates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  cycle_length_days     integer NOT NULL CHECK (cycle_length_days IN (7, 14, 21, 28)),
  is_active             boolean DEFAULT true,
  notes                 text,
  created_by            uuid REFERENCES public.profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_templates_org
  ON public.roster_templates (organization_id);
CREATE INDEX IF NOT EXISTS idx_roster_templates_participant
  ON public.roster_templates (participant_id);
CREATE INDEX IF NOT EXISTS idx_roster_templates_active
  ON public.roster_templates (organization_id, is_active)
  WHERE is_active = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_roster_templates_updated_at') THEN
    CREATE TRIGGER set_roster_templates_updated_at
      BEFORE UPDATE ON public.roster_templates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Template Shifts (Individual Blueprint Shifts) ───────────────────────

CREATE TABLE IF NOT EXISTS public.template_shifts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id               uuid NOT NULL REFERENCES public.roster_templates(id) ON DELETE CASCADE,
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Relative time (Day 1 = first day of cycle)
  day_of_cycle              integer NOT NULL CHECK (day_of_cycle >= 1 AND day_of_cycle <= 28),
  start_time                time NOT NULL,
  end_time                  time NOT NULL,

  -- Primary data
  ndis_line_item            text,
  support_purpose           text,
  title                     text,
  primary_worker_id         uuid REFERENCES public.profiles(id),
  backup_worker_id          uuid REFERENCES public.profiles(id),

  -- Rule sets
  public_holiday_behavior   text NOT NULL DEFAULT 'flag' CHECK (
    public_holiday_behavior IN ('proceed', 'cancel', 'flag')
  ),

  -- Metadata
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_template_times CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_template_shifts_template
  ON public.template_shifts (template_id);
CREATE INDEX IF NOT EXISTS idx_template_shifts_org
  ON public.template_shifts (organization_id);
CREATE INDEX IF NOT EXISTS idx_template_shifts_primary_worker
  ON public.template_shifts (primary_worker_id)
  WHERE primary_worker_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_template_shifts_updated_at') THEN
    CREATE TRIGGER set_template_shifts_updated_at
      BEFORE UPDATE ON public.template_shifts
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 4. Rollout Log (Audit trail of each rollout execution) ─────────────────

CREATE TABLE IF NOT EXISTS public.rollout_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id           uuid REFERENCES public.roster_templates(id) ON DELETE SET NULL,
  rollout_start_date    date NOT NULL,
  rollout_end_date      date NOT NULL,
  total_projected       integer NOT NULL DEFAULT 0,
  total_committed       integer NOT NULL DEFAULT 0,
  total_conflicts       integer NOT NULL DEFAULT 0,
  conflicts_detail      jsonb DEFAULT '[]'::jsonb,
  status                text NOT NULL DEFAULT 'preview' CHECK (status IN (
    'preview', 'committed', 'partial', 'failed'
  )),
  committed_by          uuid REFERENCES public.profiles(id),
  committed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rollout_log_org
  ON public.rollout_log (organization_id);
CREATE INDEX IF NOT EXISTS idx_rollout_log_template
  ON public.rollout_log (template_id);

-- ─── 5. Extend schedule_blocks with template tracking & cancellation ────────

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS generated_from_template_id uuid REFERENCES public.template_shifts(id) ON DELETE SET NULL;

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS rollout_id uuid REFERENCES public.rollout_log(id) ON DELETE SET NULL;

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS is_short_notice_cancellation boolean DEFAULT false;

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS cancellation_type text CHECK (
    cancellation_type IN ('standard', 'short_notice_billable', 'provider', 'no_show')
  );

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS participant_id uuid REFERENCES public.participant_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_template
  ON public.schedule_blocks (generated_from_template_id)
  WHERE generated_from_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_rollout
  ON public.schedule_blocks (rollout_id)
  WHERE rollout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_participant
  ON public.schedule_blocks (participant_id)
  WHERE participant_id IS NOT NULL;

-- ─── 6. Enable RLS ─────────────────────────────────────────────────────────

ALTER TABLE public.staff_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollout_log ENABLE ROW LEVEL SECURITY;

-- ─── 7. RLS Policies ───────────────────────────────────────────────────────

-- Staff Leave
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_leave' AND policyname = 'Org members can view leave') THEN
    CREATE POLICY "Org members can view leave"
      ON public.staff_leave FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_leave' AND policyname = 'Workers can request own leave') THEN
    CREATE POLICY "Workers can request own leave"
      ON public.staff_leave FOR INSERT
      WITH CHECK (
        user_id = auth.uid()
        AND organization_id IN (
          SELECT organization_id FROM public.organization_members
          WHERE user_id = auth.uid() AND status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff_leave' AND policyname = 'Admins can manage leave') THEN
    CREATE POLICY "Admins can manage leave"
      ON public.staff_leave FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = staff_leave.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- Roster Templates
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roster_templates' AND policyname = 'Org members can view roster templates') THEN
    CREATE POLICY "Org members can view roster templates"
      ON public.roster_templates FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'roster_templates' AND policyname = 'Admins can manage roster templates') THEN
    CREATE POLICY "Admins can manage roster templates"
      ON public.roster_templates FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = roster_templates.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- Template Shifts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_shifts' AND policyname = 'Org members can view template shifts') THEN
    CREATE POLICY "Org members can view template shifts"
      ON public.template_shifts FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'template_shifts' AND policyname = 'Admins can manage template shifts') THEN
    CREATE POLICY "Admins can manage template shifts"
      ON public.template_shifts FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = template_shifts.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- Rollout Log
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rollout_log' AND policyname = 'Org members can view rollout log') THEN
    CREATE POLICY "Org members can view rollout log"
      ON public.rollout_log FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rollout_log' AND policyname = 'Admins can manage rollout log') THEN
    CREATE POLICY "Admins can manage rollout log"
      ON public.rollout_log FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = rollout_log.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 8. Helper Functions ────────────────────────────────────────────────────

-- Check if a worker is on approved leave for a given date
CREATE OR REPLACE FUNCTION public.is_worker_on_leave(
  p_user_id uuid,
  p_org_id uuid,
  p_date date
)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_leave
    WHERE user_id = p_user_id
      AND organization_id = p_org_id
      AND status = 'approved'
      AND p_date BETWEEN start_date AND end_date
  );
$$;

-- Get all approved leave for a worker in a date range
CREATE OR REPLACE FUNCTION public.get_worker_leave_in_range(
  p_user_id uuid,
  p_org_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  id uuid,
  leave_type text,
  start_date date,
  end_date date,
  notes text
)
LANGUAGE sql STABLE
AS $$
  SELECT id, leave_type, start_date, end_date, notes
  FROM public.staff_leave
  WHERE user_id = p_user_id
    AND organization_id = p_org_id
    AND status = 'approved'
    AND daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]');
$$;

-- ─── 9. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.staff_leave IS
  'Worker leave/absence tracking for roster rollout conflict detection and HR management.';
COMMENT ON TABLE public.roster_templates IS
  'Master Roster blueprints defining ideal recurring shift patterns per participant.';
COMMENT ON TABLE public.template_shifts IS
  'Individual blueprint shifts within a roster template — relative to cycle day, not calendar dates.';
COMMENT ON TABLE public.rollout_log IS
  'Audit trail of roster rollout executions, tracking projections, conflicts, and commit status.';
