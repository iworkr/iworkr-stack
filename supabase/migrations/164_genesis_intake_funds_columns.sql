-- ============================================================================
-- @migration GenesisIntakeFundsColumns
-- @status COMPLETE
-- @description Add petty cash, transport budget, discretionary fund columns to participant profiles
-- @tables participant_profiles (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS petty_cash_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS petty_cash_limit DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS petty_cash_notes TEXT,
  ADD COLUMN IF NOT EXISTS transport_budget_weekly DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discretionary_fund_notes TEXT;
