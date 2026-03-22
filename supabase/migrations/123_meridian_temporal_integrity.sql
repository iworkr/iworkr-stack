-- ============================================================================
-- @migration MeridianTemporalIntegrity
-- @status COMPLETE
-- @description Project Meridian — TIMESTAMPTZ enforcement audit across all tables
-- @tables organizations (altered — timezone), (verification across all tables)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Verify TIMESTAMPTZ compliance ───────────────────────────────────────
-- All target tables already use TIMESTAMPTZ (verified 2026-03-16).
-- This migration documents the mandate and provides a safety cast guard.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'schedule_blocks', 'time_logs', 'leave_requests', 'timesheets',
        'timesheet_entries', 'audit_log', 'medication_administrations'
      )
      AND data_type = 'timestamp without time zone'
  LOOP
    RAISE WARNING '[Meridian] TIMESTAMPTZ violation: %.% is TIMESTAMP WITHOUT TIME ZONE',
      r.table_name, r.column_name;
  END LOOP;
END;
$$;

-- ── 2. Ensure organizations.timezone exists and has a safe default ──────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Australia/Brisbane';

-- ── 3. Comment the timezone column for documentation ───────────────────────
COMMENT ON COLUMN public.organizations.timezone IS
  'IANA timezone identifier (e.g. Australia/Brisbane). Used by the web roster
  to lock grid times to the workspace locale, immune to the dispatcher''s
  browser timezone. All timestamp mutations use fromZonedTime(t, this) to
  produce strict UTC ISO-8601 payloads before DB write.';

-- ── 4. Index schedule_blocks.start_time for range queries ──────────────────
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_start_time_tz
  ON public.schedule_blocks (start_time);
