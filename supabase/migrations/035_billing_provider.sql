-- ============================================================================
-- @migration BillingProvider
-- @status COMPLETE
-- @description Multi-provider billing support (Stripe, Apple IAP, Google IAP via RevenueCat)
-- @tables organizations (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'free'
    CHECK (billing_provider IN ('free', 'stripe', 'apple', 'google')),
  ADD COLUMN IF NOT EXISTS rc_original_app_user_id text,
  ADD COLUMN IF NOT EXISTS subscription_active_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_organizations_rc_user
  ON public.organizations (rc_original_app_user_id)
  WHERE rc_original_app_user_id IS NOT NULL;
