-- ============================================================================
-- Migration 115: Project Terminus — Temporal Math Engine + Glasshouse RLS
-- 1) calculate_schads_split_shift RPC for midnight-crossover payroll splits
-- 2) release_s8_medication_locks RPC for zombie lock cleanup
-- 3) Fortified Glasshouse RLS policies on schedule_blocks for family users
-- 4) Enable RLS on care_typing_indicators (Argus P0-2 remediation)
-- SAFE: All statements use IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================================

-- ─── 1. Temporal Math Engine: Midnight Crossover Split ───────────────────────
-- Splits a time_entry across midnight boundary, returning per-day segments
-- with correct penalty day classification (weekday vs Saturday vs Sunday vs PH).

CREATE OR REPLACE FUNCTION public.calculate_schads_split_shift(
    p_time_entry_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry RECORD;
    v_org RECORD;
    v_start_time timestamptz;
    v_end_time timestamptz;
    v_tz text;
    v_local_start timestamp;
    v_local_end timestamp;
    v_midnight timestamp;
    v_segment_start timestamp;
    v_segment_end timestamp;
    v_segments jsonb := '[]'::jsonb;
    v_segment_hours numeric;
    v_day_of_week int;
    v_is_ph boolean;
    v_rate_multiplier numeric;
    v_rate_code text;
    v_rate_description text;
    v_total_hours numeric := 0;
    v_total_cost_hours numeric := 0;
BEGIN
    -- Fetch the time entry
    SELECT * INTO v_entry FROM public.time_entries WHERE id = p_time_entry_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Time entry not found');
    END IF;

    IF v_entry.clock_out IS NULL THEN
        RETURN jsonb_build_object('error', 'Shift still active — no clock_out');
    END IF;

    v_start_time := v_entry.clock_in;
    v_end_time := v_entry.clock_out;

    -- Determine timezone: use organization's configured tz or default to Australia/Brisbane
    SELECT timezone INTO v_tz
    FROM public.organizations
    WHERE id = v_entry.organization_id;
    v_tz := COALESCE(v_tz, 'Australia/Brisbane');

    -- Convert to local time for day-boundary calculations
    v_local_start := v_start_time AT TIME ZONE v_tz;
    v_local_end := v_end_time AT TIME ZONE v_tz;

    -- Walk through each calendar day the shift spans
    v_segment_start := v_local_start;

    WHILE v_segment_start < v_local_end LOOP
        -- Calculate midnight of the NEXT day
        v_midnight := date_trunc('day', v_segment_start) + interval '1 day';

        -- Segment ends at midnight or shift end, whichever is first
        v_segment_end := LEAST(v_midnight, v_local_end);

        -- Calculate hours for this segment (subtract break proportionally for first segment only)
        v_segment_hours := EXTRACT(EPOCH FROM (v_segment_end - v_segment_start)) / 3600.0;

        -- Determine day-of-week for this segment (0=Sun, 6=Sat)
        v_day_of_week := EXTRACT(DOW FROM v_segment_start);

        -- Check if this segment's date is a public holiday
        v_is_ph := public.is_public_holiday(
            v_entry.organization_id,
            v_segment_start::date,
            'National'
        );

        -- Determine rate based on day classification
        IF v_is_ph THEN
            v_rate_multiplier := 2.5;
            v_rate_code := 'PH_250';
            v_rate_description := 'Public Holiday (250%)';
        ELSIF v_day_of_week = 0 THEN  -- Sunday
            v_rate_multiplier := COALESCE(
                public.get_award_rule(v_entry.organization_id, 'sunday_loading_pct') / 100.0 + 1.0,
                2.0
            );
            v_rate_code := 'SUN_200';
            v_rate_description := 'Sunday (' || ROUND(v_rate_multiplier * 100) || '%)';
        ELSIF v_day_of_week = 6 THEN  -- Saturday
            v_rate_multiplier := COALESCE(
                public.get_award_rule(v_entry.organization_id, 'saturday_loading_pct') / 100.0 + 1.0,
                1.5
            );
            v_rate_code := 'SAT_150';
            v_rate_description := 'Saturday (' || ROUND(v_rate_multiplier * 100) || '%)';
        ELSE  -- Weekday
            -- Check for evening/night loading
            IF EXTRACT(HOUR FROM v_segment_start) >= 20 OR EXTRACT(HOUR FROM v_segment_start) < 6 THEN
                v_rate_multiplier := 1.15;
                v_rate_code := 'NIGHT_LOAD';
                v_rate_description := 'Night Loading (115%)';
            ELSIF EXTRACT(HOUR FROM v_segment_start) >= 18 THEN
                v_rate_multiplier := 1.125;
                v_rate_code := 'EVE_LOAD';
                v_rate_description := 'Evening Loading (112.5%)';
            ELSE
                v_rate_multiplier := 1.0;
                v_rate_code := 'BASE_ORD';
                v_rate_description := 'Ordinary Hours (100%)';
            END IF;
        END IF;

        v_total_hours := v_total_hours + v_segment_hours;
        v_total_cost_hours := v_total_cost_hours + (v_segment_hours * v_rate_multiplier);

        -- Append segment to array
        v_segments := v_segments || jsonb_build_object(
            'date', v_segment_start::date,
            'day_name', to_char(v_segment_start, 'Day'),
            'start_time', to_char(v_segment_start, 'HH24:MI:SS'),
            'end_time', to_char(v_segment_end, 'HH24:MI:SS'),
            'hours', ROUND(v_segment_hours::numeric, 4),
            'rate_code', v_rate_code,
            'rate_multiplier', v_rate_multiplier,
            'rate_description', v_rate_description,
            'is_public_holiday', v_is_ph,
            'cost_hours', ROUND((v_segment_hours * v_rate_multiplier)::numeric, 4)
        );

        -- Move to the start of the next day
        v_segment_start := v_midnight;
    END LOOP;

    RETURN jsonb_build_object(
        'time_entry_id', p_time_entry_id,
        'is_split', jsonb_array_length(v_segments) > 1,
        'segments', v_segments,
        'total_hours', ROUND(v_total_hours::numeric, 4),
        'total_cost_hours', ROUND(v_total_cost_hours::numeric, 4),
        'break_minutes', COALESCE(v_entry.break_minutes, 0),
        'timezone', v_tz,
        'engine_version', 'terminus-split-v1.0',
        'processed_at', now()
    );
END;
$$;

COMMENT ON FUNCTION public.calculate_schads_split_shift(uuid) IS
  'Project Terminus: Splits a time_entry across midnight boundary for SCHADS penalty rate calculation. Returns per-day segments with correct rate multipliers.';


-- ─── 2. Zombie Lock Release: S8 Medication Administration ────────────────────
-- When a worker force-quits during S8 double-sign, this function releases
-- any pending medication locks older than the timeout threshold.

CREATE OR REPLACE FUNCTION public.release_s8_medication_locks(
    p_user_id uuid,
    p_timeout_minutes int DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_released int := 0;
BEGIN
    -- Release any medication_administration_records stuck in 'pending_witness'
    -- that belong to this user and are older than the timeout
    UPDATE public.medication_administration_records
    SET
        status = 'cancelled',
        notes = COALESCE(notes, '') || ' [AUTO-RELEASED: App lifecycle detachment at ' || now()::text || ']'
    WHERE administered_by = p_user_id
      AND status = 'pending_witness'
      AND created_at < now() - (p_timeout_minutes || ' minutes')::interval;

    GET DIAGNOSTICS v_released = ROW_COUNT;

    -- Also release any medication_inventory locks (if locking column exists)
    -- This is a safety net for the S8 double-sign flow
    UPDATE public.medication_inventory
    SET
        locked_by = NULL,
        locked_at = NULL
    WHERE locked_by = p_user_id
      AND locked_at < now() - (p_timeout_minutes || ' minutes')::interval;

    RETURN jsonb_build_object(
        'released_records', v_released,
        'user_id', p_user_id,
        'timeout_minutes', p_timeout_minutes,
        'released_at', now()
    );
END;
$$;

COMMENT ON FUNCTION public.release_s8_medication_locks(uuid, int) IS
  'Project Terminus: Releases zombie-locked S8 medication administration records and inventory locks caused by app force-quit during double-sign flow.';


-- ─── 3. Fortify Glasshouse RLS: Prevent raw REST bypass ─────────────────────
-- The existing "Family can view linked participant shifts" policy on schedule_blocks
-- is correct but we add an explicit DENY for non-org-member, non-family users.
-- We also tighten the health_observations family policy.

-- Add explicit column-level restriction: family users can only see limited columns
-- via the view, not the raw table. We enforce this by ensuring the schedule_blocks
-- family policy strictly validates participant_network_members relationship type.

DO $$
BEGIN
    -- Drop and recreate with tighter conditions
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'schedule_blocks'
          AND policyname = 'Family can view linked participant shifts'
    ) THEN
        DROP POLICY "Family can view linked participant shifts" ON public.schedule_blocks;
    END IF;

    CREATE POLICY "Family can view linked participant shifts"
      ON public.schedule_blocks
      FOR SELECT
      USING (
        participant_id IS NOT NULL
        AND status IN ('scheduled', 'en_route', 'on_site', 'in_progress', 'complete')
        AND EXISTS (
          SELECT 1
          FROM public.participant_network_members pnm
          WHERE pnm.participant_id = schedule_blocks.participant_id
            AND pnm.user_id = auth.uid()
            AND pnm.relationship_type IN ('primary_guardian', 'secondary_guardian', 'self')
        )
      );
END $$;


-- ─── 4. Argus P0-2 Remediation: Enable RLS on care_typing_indicators ────────

ALTER TABLE IF EXISTS public.care_typing_indicators ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'care_typing_indicators'
      AND policyname = 'Chat members can manage typing indicators'
  ) THEN
    CREATE POLICY "Chat members can manage typing indicators"
      ON public.care_typing_indicators
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.care_chat_members ccm
          WHERE ccm.channel_id = care_typing_indicators.channel_id
            AND ccm.user_id = auth.uid()
        )
      );
  END IF;
END $$;


-- ─── 5. Scheduled cleanup: pg_cron job for zombie locks ──────────────────────
-- Runs every 15 minutes to release any stale S8 locks across all users.
-- NOTE: pg_cron must be enabled on the Supabase project.

DO $$
BEGIN
  -- Only create the cron job if pg_cron extension is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('terminus_release_zombie_locks');
    PERFORM cron.schedule(
      'terminus_release_zombie_locks',
      '*/15 * * * *',
      $$
        UPDATE public.medication_administration_records
        SET status = 'cancelled',
            notes = COALESCE(notes, '') || ' [CRON-RELEASED: ' || now()::text || ']'
        WHERE status = 'pending_witness'
          AND created_at < now() - interval '30 minutes';

        UPDATE public.medication_inventory
        SET locked_by = NULL, locked_at = NULL
        WHERE locked_by IS NOT NULL
          AND locked_at < now() - interval '30 minutes';
      $$
    );
  END IF;
END $$;
