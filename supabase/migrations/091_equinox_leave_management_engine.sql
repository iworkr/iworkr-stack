-- ============================================================================
-- Migration 091: Project Equinox — Global Leave Management & Emergency Cover
-- ============================================================================
-- Upgrades existing leave flows into an operational + financial engine:
-- 1) richer leave_requests lifecycle
-- 2) leave balance cache
-- 3) blast-radius RPC
-- 4) automated drop-and-cover trigger path
-- 5) shadow timesheet injection for payroll-only leave
-- ============================================================================

-- ── 0) Expand schedule enum / assignability for critical unassigned states ───

DO $$
BEGIN
  ALTER TYPE public.schedule_block_status ADD VALUE IF NOT EXISTS 'unassigned_critical';
EXCEPTION WHEN others THEN
  NULL;
END $$;

ALTER TABLE public.schedule_blocks
  ALTER COLUMN technician_id DROP NOT NULL;

-- ── 1) leave_requests table hardening / extension ────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'annual' CHECK (leave_type IN ('annual', 'sick', 'rdo', 'unpaid', 'compassionate')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_at timestamptz,
  end_at timestamptz,
  is_full_day boolean NOT NULL DEFAULT true,
  days numeric(6,2) NOT NULL DEFAULT 1,
  reason text,
  notes text,
  medical_cert_url text,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  manager_notes text,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'mobile', 'emergency_sick')),
  emergency_reported boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_valid_range CHECK (end_date >= start_date)
);

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS leave_type text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_full_day boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS medical_cert_url text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_notes text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS emergency_reported boolean NOT NULL DEFAULT false;

-- Backward compatibility from legacy fields
UPDATE public.leave_requests
SET worker_id = COALESCE(worker_id, user_id)
WHERE worker_id IS NULL AND user_id IS NOT NULL;

UPDATE public.leave_requests
SET leave_type = COALESCE(leave_type, 'annual')
WHERE leave_type IS NULL;

UPDATE public.leave_requests
SET start_at = COALESCE(start_at, (start_date::timestamptz))
WHERE start_at IS NULL;

UPDATE public.leave_requests
SET end_at = COALESCE(end_at, (end_date::timestamptz + interval '23 hours 59 minutes 59 seconds'))
WHERE end_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leave_requests_leave_type_check'
      AND conrelid = 'public.leave_requests'::regclass
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_leave_type_check
      CHECK (leave_type IN ('annual', 'sick', 'rdo', 'unpaid', 'compassionate'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leave_requests_source_check'
      AND conrelid = 'public.leave_requests'::regclass
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_source_check
      CHECK (source IN ('manual', 'mobile', 'emergency_sick'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leave_requests_org_worker
  ON public.leave_requests (organization_id, worker_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status
  ON public.leave_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_emergency
  ON public.leave_requests (organization_id, emergency_reported, created_at DESC)
  WHERE emergency_reported = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_leave_requests_updated_at') THEN
    CREATE TRIGGER set_leave_requests_updated_at
      BEFORE UPDATE ON public.leave_requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ── 2) Leave balance cache ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_balances_cache (
  worker_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  annual_leave_hours numeric(8,2) NOT NULL DEFAULT 0.00,
  sick_leave_hours numeric(8,2) NOT NULL DEFAULT 0.00,
  external_source text DEFAULT 'xero',
  external_payload jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_cache_org
  ON public.leave_balances_cache (organization_id, last_synced_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_leave_balances_cache_updated_at') THEN
    CREATE TRIGGER set_leave_balances_cache_updated_at
      BEFORE UPDATE ON public.leave_balances_cache
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ── 3) Drop-and-cover telemetry table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leave_cover_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  schedule_block_id uuid REFERENCES public.schedule_blocks(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.participant_profiles(id) ON DELETE SET NULL,
  tier text NOT NULL CHECK (tier IN ('tier_1_backup', 'tier_2_familiarity', 'tier_3_broadcast')),
  target_worker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload jsonb,
  dispatched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_cover_dispatch_org
  ON public.leave_cover_dispatch_log (organization_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_leave_cover_dispatch_leave
  ON public.leave_cover_dispatch_log (leave_request_id, dispatched_at DESC);

-- ── 4) Blast-radius RPC ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_leave_impact(
  p_worker_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_impacted_shifts integer := 0;
  v_revenue_at_risk numeric(12,2) := 0;
  v_impacted_participants integer := 0;
  v_master_roster_impacts integer := 0;
BEGIN
  SELECT count(*)
  INTO v_impacted_shifts
  FROM public.schedule_blocks sb
  WHERE sb.technician_id = p_worker_id
    AND sb.status IN ('scheduled', 'en_route', 'in_progress', 'on_site')
    AND sb.start_time <= p_end_date
    AND sb.end_time >= p_start_date;

  SELECT COALESCE(sum(sfl.projected_revenue), 0)
  INTO v_revenue_at_risk
  FROM public.schedule_blocks sb
  JOIN public.shift_financial_ledgers sfl
    ON sfl.shift_id = sb.id
  WHERE sb.technician_id = p_worker_id
    AND sb.start_time <= p_end_date
    AND sb.end_time >= p_start_date;

  SELECT count(DISTINCT sb.participant_id)
  INTO v_impacted_participants
  FROM public.schedule_blocks sb
  WHERE sb.technician_id = p_worker_id
    AND sb.participant_id IS NOT NULL
    AND sb.start_time <= p_end_date
    AND sb.end_time >= p_start_date;

  SELECT count(*)
  INTO v_master_roster_impacts
  FROM public.template_shifts ts
  WHERE ts.primary_worker_id = p_worker_id;

  RETURN jsonb_build_object(
    'impacted_shift_count', v_impacted_shifts,
    'revenue_at_risk', v_revenue_at_risk,
    'unique_participants_affected', v_impacted_participants,
    'master_roster_impacts', v_master_roster_impacts
  );
END;
$$;

-- ── 5) Drop-and-cover engine ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.execute_drop_and_cover_leave(
  p_leave_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave public.leave_requests%ROWTYPE;
  v_impacted_count integer := 0;
  v_tier1 integer := 0;
  v_tier2 integer := 0;
  v_tier3 integer := 0;
  v_candidate record;
BEGIN
  SELECT *
  INTO v_leave
  FROM public.leave_requests
  WHERE id = p_leave_request_id
  LIMIT 1;

  IF v_leave.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'leave_request_not_found');
  END IF;

  IF v_leave.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'leave_not_approved');
  END IF;

  -- 1) Mutate matching shifts to critical unassigned (non-destructive)
  WITH impacted AS (
    UPDATE public.schedule_blocks sb
    SET technician_id = NULL,
        status = 'unassigned_critical',
        is_conflict = true,
        metadata = COALESCE(sb.metadata, '{}'::jsonb) || jsonb_build_object(
          'drop_and_cover', true,
          'leave_request_id', v_leave.id,
          'source', v_leave.source,
          'triggered_at', now()
        )
    WHERE sb.organization_id = v_leave.organization_id
      AND sb.technician_id = v_leave.worker_id
      AND sb.start_time <= COALESCE(v_leave.end_at, v_leave.end_date::timestamptz + interval '1 day' - interval '1 second')
      AND sb.end_time >= COALESCE(v_leave.start_at, v_leave.start_date::timestamptz)
      AND sb.status IN ('scheduled', 'en_route', 'in_progress', 'on_site')
    RETURNING sb.*
  )
  SELECT count(*) INTO v_impacted_count FROM impacted;

  -- 2) Tier 1: backup worker from template shift
  INSERT INTO public.leave_cover_dispatch_log (
    organization_id, leave_request_id, schedule_block_id, participant_id, tier, target_worker_id, payload
  )
  SELECT
    sb.organization_id,
    v_leave.id,
    sb.id,
    sb.participant_id,
    'tier_1_backup',
    ts.backup_worker_id,
    jsonb_build_object(
      'message', 'Emergency cover requested from template backup worker',
      'start_time', sb.start_time,
      'end_time', sb.end_time
    )
  FROM public.schedule_blocks sb
  JOIN public.template_shifts ts ON ts.id = sb.generated_from_template_id
  WHERE sb.organization_id = v_leave.organization_id
    AND sb.status = 'unassigned_critical'
    AND (sb.metadata ->> 'leave_request_id')::uuid = v_leave.id
    AND ts.backup_worker_id IS NOT NULL;

  GET DIAGNOSTICS v_tier1 = ROW_COUNT;

  -- 3) Tier 2: top familiarity workers from historical progress notes
  FOR v_candidate IN
    SELECT
      sb.id AS schedule_block_id,
      sb.participant_id,
      pn.worker_id,
      count(*) AS touch_count
    FROM public.schedule_blocks sb
    JOIN public.progress_notes pn
      ON pn.participant_id = sb.participant_id
     AND pn.organization_id = sb.organization_id
    WHERE sb.organization_id = v_leave.organization_id
      AND sb.status = 'unassigned_critical'
      AND (sb.metadata ->> 'leave_request_id')::uuid = v_leave.id
      AND pn.created_at >= now() - interval '6 months'
      AND pn.worker_id IS NOT NULL
      AND pn.worker_id <> v_leave.worker_id
    GROUP BY sb.id, sb.participant_id, pn.worker_id
    ORDER BY count(*) DESC
    LIMIT 30
  LOOP
    INSERT INTO public.leave_cover_dispatch_log (
      organization_id, leave_request_id, schedule_block_id, participant_id, tier, target_worker_id, payload
    )
    VALUES (
      v_leave.organization_id,
      v_leave.id,
      v_candidate.schedule_block_id,
      v_candidate.participant_id,
      'tier_2_familiarity',
      v_candidate.worker_id,
      jsonb_build_object(
        'message', 'Emergency cover requested based on participant familiarity',
        'touch_count', v_candidate.touch_count
      )
    );
    v_tier2 := v_tier2 + 1;
  END LOOP;

  -- 4) Tier 3: global broadcast marker (for UI + async notification workers)
  INSERT INTO public.leave_cover_dispatch_log (
    organization_id, leave_request_id, schedule_block_id, participant_id, tier, target_worker_id, payload
  )
  SELECT
    sb.organization_id,
    v_leave.id,
    sb.id,
    sb.participant_id,
    'tier_3_broadcast',
    NULL,
    jsonb_build_object(
      'message', 'Broadcast open shift to nearby and credential-matched workers',
      'radius_km', 15
    )
  FROM public.schedule_blocks sb
  WHERE sb.organization_id = v_leave.organization_id
    AND sb.status = 'unassigned_critical'
    AND (sb.metadata ->> 'leave_request_id')::uuid = v_leave.id;

  GET DIAGNOSTICS v_tier3 = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'impacted_shift_count', v_impacted_count,
    'tier_1_dispatches', v_tier1,
    'tier_2_dispatches', v_tier2,
    'tier_3_dispatches', v_tier3
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_requests_drop_cover_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.start_date IS DISTINCT FROM NEW.start_date
       OR OLD.end_date IS DISTINCT FROM NEW.end_date
     ) THEN
    PERFORM public.execute_drop_and_cover_leave(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_leave_drop_cover') THEN
    CREATE TRIGGER trigger_leave_drop_cover
      AFTER INSERT OR UPDATE ON public.leave_requests
      FOR EACH ROW EXECUTE FUNCTION public.leave_requests_drop_cover_trigger();
  END IF;
END $$;

-- ── 6) Shadow leave timesheet injection ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.inject_leave_shadow_entries(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave record;
  v_day date;
  v_inserted integer := 0;
  v_hours numeric(6,2);
  v_timesheet_id uuid;
  v_entry_exists boolean;
BEGIN
  FOR v_leave IN
    SELECT *
    FROM public.leave_requests lr
    WHERE lr.organization_id = p_organization_id
      AND lr.status = 'approved'
      AND lr.worker_id IS NOT NULL
      AND daterange(lr.start_date, lr.end_date, '[]') && daterange(p_period_start, p_period_end, '[]')
  LOOP
    v_day := GREATEST(v_leave.start_date, p_period_start);
    WHILE v_day <= LEAST(v_leave.end_date, p_period_end) LOOP
      v_hours := CASE
        WHEN COALESCE(v_leave.is_full_day, true) THEN 7.60
        WHEN v_leave.start_at IS NOT NULL AND v_leave.end_at IS NOT NULL
          THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_leave.end_at - v_leave.start_at)) / 3600.0, 2))
        ELSE 7.60
      END;

      SELECT id
      INTO v_timesheet_id
      FROM public.timesheets
      WHERE organization_id = p_organization_id
        AND worker_id = v_leave.worker_id
        AND period_start = p_period_start
      LIMIT 1;

      IF v_timesheet_id IS NULL THEN
        INSERT INTO public.timesheets (
          organization_id, worker_id, period_start, period_end, status, is_locked
        )
        VALUES (
          p_organization_id, v_leave.worker_id, p_period_start, p_period_end, 'draft', false
        )
        RETURNING id INTO v_timesheet_id;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.time_entries te
        WHERE te.organization_id = p_organization_id
          AND te.worker_id = v_leave.worker_id
          AND te.is_leave_entry = true
          AND te.clock_in::date = v_day
          AND te.exception_notes = ('leave_request:' || v_leave.id::text)
      ) INTO v_entry_exists;

      IF NOT v_entry_exists THEN
        INSERT INTO public.time_entries (
          organization_id,
          timesheet_id,
          shift_id,
          worker_id,
          clock_in,
          clock_out,
          total_hours,
          status,
          is_manual_entry,
          is_leave_entry,
          leave_type,
          exception_notes,
          award_interpretation
        )
        VALUES (
          p_organization_id,
          v_timesheet_id,
          NULL,
          v_leave.worker_id,
          (v_day::text || 'T09:00:00+10:00')::timestamptz,
          ((v_day::text || 'T09:00:00+10:00')::timestamptz + make_interval(hours => v_hours::int)),
          v_hours,
          'approved',
          true,
          true,
          CASE
            WHEN v_leave.leave_type = 'sick' THEN 'personal_carers'
            WHEN v_leave.leave_type = 'compassionate' THEN 'compassionate'
            WHEN v_leave.leave_type = 'unpaid' THEN 'unpaid'
            ELSE 'annual'
          END,
          ('leave_request:' || v_leave.id::text),
          CASE
            WHEN v_leave.leave_type = 'annual' THEN jsonb_build_object(
              'payroll_categories', jsonb_build_array(
                jsonb_build_object('code', 'LEAVE_ANNUAL', 'hours', v_hours, 'rate_multiplier', 1.0, 'is_billable_to_ndis', false),
                jsonb_build_object('code', 'LEAVE_LOADING_17.5', 'hours', v_hours, 'rate_multiplier', 0.175, 'is_billable_to_ndis', false)
              )
            )
            WHEN v_leave.leave_type = 'sick' THEN jsonb_build_object(
              'payroll_categories', jsonb_build_array(
                jsonb_build_object('code', 'LEAVE_SICK', 'hours', v_hours, 'rate_multiplier', 1.0, 'is_billable_to_ndis', false)
              )
            )
            ELSE jsonb_build_object(
              'payroll_categories', jsonb_build_array(
                jsonb_build_object('code', ('LEAVE_' || upper(v_leave.leave_type)), 'hours', v_hours, 'rate_multiplier', 1.0, 'is_billable_to_ndis', false)
              )
            )
          END
        );

        v_inserted := v_inserted + 1;
      END IF;

      v_day := v_day + 1;
    END LOOP;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- ── 7) RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_cover_dispatch_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'Org members can view leave requests') THEN
    CREATE POLICY "Org members can view leave requests"
      ON public.leave_requests FOR SELECT
      USING (
        organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'Workers can create own leave requests') THEN
    CREATE POLICY "Workers can create own leave requests"
      ON public.leave_requests FOR INSERT
      WITH CHECK (
        worker_id = auth.uid()
        AND organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_requests' AND policyname = 'Managers can manage leave requests') THEN
    CREATE POLICY "Managers can manage leave requests"
      ON public.leave_requests FOR ALL
      USING (
        (SELECT om.role FROM public.organization_members om
         WHERE om.organization_id = leave_requests.organization_id
           AND om.user_id = auth.uid()
           AND om.status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
        OR auth.role() = 'service_role'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_balances_cache' AND policyname = 'Org members can view leave balances cache') THEN
    CREATE POLICY "Org members can view leave balances cache"
      ON public.leave_balances_cache FOR SELECT
      USING (
        organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_balances_cache' AND policyname = 'Managers can manage leave balances cache') THEN
    CREATE POLICY "Managers can manage leave balances cache"
      ON public.leave_balances_cache FOR ALL
      USING (
        (SELECT om.role FROM public.organization_members om
         WHERE om.organization_id = leave_balances_cache.organization_id
           AND om.user_id = auth.uid()
           AND om.status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
        OR auth.role() = 'service_role'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_cover_dispatch_log' AND policyname = 'Org members can view leave dispatch logs') THEN
    CREATE POLICY "Org members can view leave dispatch logs"
      ON public.leave_cover_dispatch_log FOR SELECT
      USING (
        organization_id IN (
          SELECT om.organization_id
          FROM public.organization_members om
          WHERE om.user_id = auth.uid()
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leave_cover_dispatch_log' AND policyname = 'System can insert leave dispatch logs') THEN
    CREATE POLICY "System can insert leave dispatch logs"
      ON public.leave_cover_dispatch_log FOR INSERT
      WITH CHECK (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.calculate_leave_impact(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_drop_and_cover_leave(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inject_leave_shadow_entries(uuid, date, date) TO authenticated, service_role;

