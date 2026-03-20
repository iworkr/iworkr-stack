-- Migration 164: Add funds management columns to participant_profiles
-- Project Genesis-Intake enhancement: petty cash, transport budget, discretionary funds

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS petty_cash_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS petty_cash_limit DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS petty_cash_notes TEXT,
  ADD COLUMN IF NOT EXISTS transport_budget_weekly DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discretionary_fund_notes TEXT;
