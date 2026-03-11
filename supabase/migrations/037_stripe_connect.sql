-- ═══════════════════════════════════════════════════════════
-- Migration 037: Stripe Connect — iWorkr Pay Infrastructure
-- SAFE: All statements idempotent.
-- ═══════════════════════════════════════════════════════════

-- ── Stripe Connect fields on organizations ───────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS connect_onboarded_at timestamptz;

-- Add unique constraint if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_stripe_account_id_key'
  ) THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_stripe_account_id_key UNIQUE (stripe_account_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_account
  ON public.organizations (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- ── Platform fee configuration ───────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) NOT NULL DEFAULT 1.00;

-- ── Payment records table ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  platform_fee_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  payment_method text NOT NULL DEFAULT 'card'
    CHECK (payment_method IN ('card', 'tap_to_pay', 'bank_transfer', 'link')),
  client_name text,
  client_email text,
  collected_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add FK to invoices if invoices table exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invoices')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'payments_invoice_id_fkey' AND table_name = 'payments'
     ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add unique constraint on stripe_payment_intent_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_stripe_payment_intent_id_key'
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_stripe_payment_intent_id_key UNIQUE (stripe_payment_intent_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('owner', 'admin', 'manager', 'office_admin')
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_org ON public.payments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON public.payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ── Connection tokens table (for Stripe Terminal) ────────

CREATE TABLE IF NOT EXISTS public.terminal_connection_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.terminal_connection_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "terminal_tokens_select" ON public.terminal_connection_tokens
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
