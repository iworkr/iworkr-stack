-- ============================================================================
-- @migration ProjectCapitalConnect
-- @status COMPLETE
-- @description Project Capital — iWorkr Connect trust engine, network identities, webhook idempotency
-- @tables network_identities, organizations (altered — stripe_account_active)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Fix stripe_account_id: ensure it's a real column (not just JSONB) ──
-- The column already exists from migration 037, but the onboard route writes
-- to settings JSONB. We add a trigger to keep them in sync.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_account_active BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: mark as active if charges_enabled AND payouts_enabled
UPDATE public.organizations
SET stripe_account_active = TRUE
WHERE charges_enabled = TRUE AND payouts_enabled = TRUE;

-- Trigger to keep stripe_account_active in sync with charges/payouts
CREATE OR REPLACE FUNCTION public.sync_stripe_account_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.stripe_account_active := (NEW.charges_enabled = TRUE AND NEW.payouts_enabled = TRUE);
  -- Also sync stripe_account_id from settings JSONB to real column (legacy compat)
  IF NEW.stripe_account_id IS NULL AND NEW.settings->>'stripe_account_id' IS NOT NULL THEN
    NEW.stripe_account_id := NEW.settings->>'stripe_account_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stripe_account_active ON public.organizations;
CREATE TRIGGER trg_sync_stripe_account_active
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.sync_stripe_account_active();

-- ── 2. Webhook idempotency table ─────────────────────────────────────────
-- Prevents duplicate Stripe webhook processing (idempotency requirement)
CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id TEXT PRIMARY KEY,                     -- Stripe event ID (evt_xxxx)
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workspace_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.stripe_webhook_events
  USING (false); -- Only accessible via service role key (edge functions)

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at
  ON public.stripe_webhook_events (created_at DESC);

-- ── 3. Universal Trust Engine: network_identities ─────────────────────────
-- Privacy-preserving cross-tenant identity hashing & trust scoring.
-- No PII is stored — only SHA-256 hashes of normalized email/phone/address.
CREATE TABLE IF NOT EXISTS public.network_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Privacy-preserving hashes (SHA-256 of normalized PII)
  email_hash TEXT,           -- SHA-256(lower(trim(email)))
  phone_hash TEXT,           -- SHA-256(e164_normalized_phone)
  address_hash TEXT,         -- SHA-256(normalized_street_address)

  -- Aggregate payment behavior across ALL workspaces on the platform
  total_invoices_issued INTEGER NOT NULL DEFAULT 0,
  total_invoices_paid INTEGER NOT NULL DEFAULT 0,
  total_invoices_overdue INTEGER NOT NULL DEFAULT 0,
  total_chargebacks_filed INTEGER NOT NULL DEFAULT 0,
  total_days_overdue_avg NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_outstanding_aud NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_collections INTEGER NOT NULL DEFAULT 0,  -- sent to collections agency

  -- Computed trust grade (A/B/C/D/F) — recalculated by the scoring function
  trust_grade TEXT NOT NULL DEFAULT 'A'
    CHECK (trust_grade IN ('A', 'B', 'C', 'D', 'F')),
  trust_score INTEGER NOT NULL DEFAULT 100  -- 0-100
    CHECK (trust_score >= 0 AND trust_score <= 100),

  -- Metadata
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workspace_count INTEGER NOT NULL DEFAULT 1,  -- how many workspaces this identity appears in

  -- Unique constraint: at least one hash must match
  CONSTRAINT at_least_one_hash CHECK (
    email_hash IS NOT NULL OR phone_hash IS NOT NULL OR address_hash IS NOT NULL
  )
);

ALTER TABLE public.network_identities ENABLE ROW LEVEL SECURITY;

-- Members can read trust data for customers in their workspace
CREATE POLICY "Members can read network identities"
  ON public.network_identities FOR SELECT
  USING (TRUE);  -- read-only for all authenticated users; writes via service role only

-- Cannot insert/update from client — must go through edge functions
CREATE POLICY "No direct writes"
  ON public.network_identities FOR INSERT
  WITH CHECK (FALSE);

CREATE INDEX IF NOT EXISTS idx_network_identities_email_hash
  ON public.network_identities (email_hash)
  WHERE email_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_network_identities_phone_hash
  ON public.network_identities (phone_hash)
  WHERE phone_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_network_identities_trust_grade
  ON public.network_identities (trust_grade);

-- ── 4. Link clients table to network_identities ───────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS network_identity_id UUID
    REFERENCES public.network_identities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_network_identity_id
  ON public.clients (network_identity_id)
  WHERE network_identity_id IS NOT NULL;

-- ── 5. iWorkr Grade calculation function ─────────────────────────────────
-- Called by the trust-engine edge function to recompute grades.
CREATE OR REPLACE FUNCTION public.calculate_trust_grade(
  p_invoices_issued INTEGER,
  p_invoices_paid INTEGER,
  p_invoices_overdue INTEGER,
  p_chargebacks INTEGER,
  p_days_overdue_avg NUMERIC,
  p_total_collections INTEGER,
  p_outstanding NUMERIC
) RETURNS TABLE (grade TEXT, score INTEGER)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_score INTEGER := 100;
  v_grade TEXT := 'A';
BEGIN
  -- Penalties (deduct from 100)
  -- Collections history: -30 pts each (capped at -60)
  v_score := v_score - LEAST(p_total_collections * 30, 60);
  -- Chargebacks: -20 pts each (capped at -40)
  v_score := v_score - LEAST(p_chargebacks * 20, 40);
  -- Outstanding overdue: -5 per overdue invoice
  v_score := v_score - LEAST(p_invoices_overdue * 5, 30);
  -- Average days overdue: -1 per 10 days
  v_score := v_score - LEAST((p_days_overdue_avg / 10)::INTEGER, 20);
  -- Rewards: +5 if pays 90%+ invoices on time
  IF p_invoices_issued > 0 AND (p_invoices_paid::NUMERIC / p_invoices_issued) >= 0.9 THEN
    v_score := v_score + 5;
  END IF;
  -- Floor at 0
  v_score := GREATEST(v_score, 0);

  -- Map score to grade
  v_grade := CASE
    WHEN v_score >= 85 THEN 'A'
    WHEN v_score >= 70 THEN 'B'
    WHEN v_score >= 50 THEN 'C'
    WHEN v_score >= 30 THEN 'D'
    ELSE 'F'
  END;

  -- Hard override: any chargebacks > 2 or collections > 0 = F
  IF p_chargebacks > 2 OR p_total_collections > 0 THEN
    v_grade := 'F';
    v_score := LEAST(v_score, 20);
  END IF;

  RETURN QUERY SELECT v_grade, v_score;
END;
$$;
