-- ============================================================================
-- @migration VanguardWorkforceBanking
-- @status COMPLETE
-- @description Project Vanguard — banking, super, TFN fields on staff profiles
-- @tables staff_profiles (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── Banking & Financial Routing Columns ──────────────────
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS bank_account_name  TEXT,
  ADD COLUMN IF NOT EXISTS bank_bsb           TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS super_fund_name    TEXT,
  ADD COLUMN IF NOT EXISTS super_usi          TEXT,
  ADD COLUMN IF NOT EXISTS super_member_number TEXT,
  ADD COLUMN IF NOT EXISTS tfn_hash           TEXT;

-- ── Audit Logs Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id          UUID REFERENCES auth.users(id),
  target_user_id    UUID REFERENCES auth.users(id),
  action            TEXT NOT NULL,
  description       TEXT,
  actor_name        TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_org_read" ON public.audit_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin', 'manager')
    )
  );

CREATE POLICY "audit_logs_org_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ── SCHADS Paypoint Support ──────────────────────────────
-- Add paypoint column to schads_award_rates if missing
ALTER TABLE public.schads_award_rates
  ADD COLUMN IF NOT EXISTS paypoint INTEGER DEFAULT 1;

-- Update existing level_code to include paypoint reference
-- E.g. "3.1" means Level 3, Paypoint 1
COMMENT ON COLUMN public.schads_award_rates.level_code IS 'Format: <level>.<paypoint> — e.g. 3.1 = Level 3, Paypoint 1';
