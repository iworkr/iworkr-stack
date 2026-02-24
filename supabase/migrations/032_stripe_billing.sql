-- ═══════════════════════════════════════════════════════════
-- Migration 032: Stripe Billing Columns
-- ═══════════════════════════════════════════════════════════
-- Adds Stripe identifiers to the organizations and subscriptions
-- tables so the Stripe webhook can map events to workspaces.

-- 1. Add Stripe customer ID to organizations (one customer per workspace)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free'
    CHECK (plan_tier IN ('free', 'starter', 'pro', 'business'));

-- 2. Add Stripe subscription ID to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 3. Index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer
  ON public.organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- 4. RLS: allow service_role to update billing columns (webhook)
--    Normal users can only read their own org's plan_tier.
CREATE POLICY IF NOT EXISTS "Users can read own org plan_tier"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
