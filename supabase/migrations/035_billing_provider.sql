-- ═══════════════════════════════════════════════════════════
-- Migration 035: Multi-Provider Billing Support
-- ═══════════════════════════════════════════════════════════
-- Adds billing_provider tracking so the system knows whether
-- a workspace pays via Stripe (web), Apple IAP, or Google IAP.
-- RevenueCat webhooks populate these fields alongside Stripe.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_provider text NOT NULL DEFAULT 'free'
    CHECK (billing_provider IN ('free', 'stripe', 'apple', 'google')),
  ADD COLUMN IF NOT EXISTS rc_original_app_user_id text,
  ADD COLUMN IF NOT EXISTS subscription_active_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_organizations_rc_user
  ON public.organizations (rc_original_app_user_id)
  WHERE rc_original_app_user_id IS NOT NULL;
