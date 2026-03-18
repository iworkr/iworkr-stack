-- ============================================================
-- Migration 133: Add award_type column to staff_profiles
-- Tracks which industrial instrument applies to each worker
-- (SCHADS, NURSES, FLAT_RATE, etc.)
-- ============================================================

ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS award_type TEXT DEFAULT 'SCHADS';

COMMENT ON COLUMN public.staff_profiles.award_type IS 'Industrial instrument / award that applies to this worker (e.g. SCHADS, NURSES, FLAT_RATE)';
