-- ============================================================================
-- @migration GenesisStripeWebhookFailures
-- @description Dead-letter queue table for Stripe webhook events that fail
--              during critical billing synchronization.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stripe_webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_failures_unresolved
  ON public.stripe_webhook_failures (resolved, created_at DESC);
