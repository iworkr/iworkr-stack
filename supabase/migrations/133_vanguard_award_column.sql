-- ============================================================================
-- @migration VanguardAwardColumn
-- @status COMPLETE
-- @description Add award_type column to staff_profiles for industrial instrument tracking
-- @tables staff_profiles (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS award_type TEXT DEFAULT 'SCHADS';

COMMENT ON COLUMN public.staff_profiles.award_type IS 'Industrial instrument / award that applies to this worker (e.g. SCHADS, NURSES, FLAT_RATE)';
