-- ============================================================================
-- @migration RevenueNet
-- @status COMPLETE
-- @description Project Revenue-Net: Automated dunning & off-session charging.
--   Payment mandate tokenization vault, dunning state machine, auto-charge
--   scheduling, and client financial suspension.
-- @tables payment_mandates (NEW)
-- @alters invoices (dunning + auto-charge), clients (stripe_customer_id)
-- @lastAudit 2026-03-24
-- ============================================================================

-- ─── 1. Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mandate_type_enum') THEN
    CREATE TYPE public.mandate_type_enum AS ENUM ('CREDIT_CARD', 'BECS_DEBIT');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mandate_status_enum') THEN
    CREATE TYPE public.mandate_status_enum AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'FAILED_SETUP');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dunning_status_enum') THEN
    CREATE TYPE public.dunning_status_enum AS ENUM ('NONE', 'FAIL_1', 'FAIL_2', 'FAIL_3', 'SENT_TO_COLLECTIONS');
  END IF;
END $$;

-- ─── 2. Payment Mandates Table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_mandates (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id                 UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  stripe_customer_id        TEXT NOT NULL,
  stripe_payment_method_id  TEXT NOT NULL,
  stripe_setup_intent_id    TEXT,

  mandate_type              public.mandate_type_enum NOT NULL,
  status                    public.mandate_status_enum NOT NULL DEFAULT 'ACTIVE',

  card_brand                TEXT,
  last4                     VARCHAR(4),
  exp_month                 INTEGER,
  exp_year                  INTEGER,
  bsb_last4                 VARCHAR(4),
  account_last4             VARCHAR(4),

  is_default                BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mandates_org_client
  ON public.payment_mandates (organization_id, client_id, status);
CREATE INDEX IF NOT EXISTS idx_mandates_stripe_pm
  ON public.payment_mandates (stripe_payment_method_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mandates_default
  ON public.payment_mandates (client_id)
  WHERE is_default = true AND status = 'ACTIVE';

-- ─── 3. Add stripe_customer_id to clients ────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients'
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients'
    AND column_name = 'is_financially_suspended'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN is_financially_suspended BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clients_stripe
  ON public.clients (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ─── 4. Add dunning + auto-charge columns to invoices ────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
    AND column_name = 'auto_charge_date'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN auto_charge_date TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
    AND column_name = 'dunning_status'
  ) THEN
    ALTER TABLE public.invoices
      ADD COLUMN dunning_status public.dunning_status_enum NOT NULL DEFAULT 'NONE';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
    AND column_name = 'dunning_attempts'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN dunning_attempts INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
    AND column_name = 'last_charge_error'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN last_charge_error TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_autocharge
  ON public.invoices (status, auto_charge_date)
  WHERE auto_charge_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_dunning
  ON public.invoices (organization_id, dunning_status)
  WHERE dunning_status != 'NONE';

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.payment_mandates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_mandates' AND policyname = 'Org members view mandates') THEN
    CREATE POLICY "Org members view mandates"
      ON public.payment_mandates FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_mandates' AND policyname = 'Admins manage mandates') THEN
    CREATE POLICY "Admins manage mandates"
      ON public.payment_mandates FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = payment_mandates.organization_id
           AND user_id = auth.uid() AND status = 'active')
        IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 6. RPCs ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_auto_charge_invoices(p_org_id UUID DEFAULT NULL)
RETURNS TABLE (
  invoice_id UUID,
  org_id UUID,
  client_id UUID,
  display_id TEXT,
  total NUMERIC,
  funding_type TEXT,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  mandate_type public.mandate_type_enum,
  dunning_status public.dunning_status_enum,
  plan_manager_email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id AS invoice_id,
    i.organization_id AS org_id,
    i.client_id,
    i.display_id,
    i.total,
    i.funding_type,
    c.stripe_customer_id,
    pm.stripe_payment_method_id,
    pm.mandate_type,
    i.dunning_status,
    i.plan_manager_email
  FROM public.invoices i
  JOIN public.clients c ON c.id = i.client_id
  LEFT JOIN public.payment_mandates pm
    ON pm.client_id = i.client_id
    AND pm.status = 'ACTIVE'
    AND pm.is_default = true
  WHERE i.status = 'sent'
    AND i.auto_charge_date IS NOT NULL
    AND i.auto_charge_date <= now()
    AND (p_org_id IS NULL OR i.organization_id = p_org_id)
  ORDER BY i.auto_charge_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_dunning(
  p_invoice_id UUID,
  p_error_message TEXT DEFAULT NULL
)
RETURNS public.dunning_status_enum
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current public.dunning_status_enum;
  v_next public.dunning_status_enum;
  v_retry_hours INTEGER;
BEGIN
  SELECT dunning_status INTO v_current
  FROM public.invoices WHERE id = p_invoice_id;

  CASE v_current
    WHEN 'NONE' THEN v_next := 'FAIL_1'; v_retry_hours := 48;
    WHEN 'FAIL_1' THEN v_next := 'FAIL_2'; v_retry_hours := 48;
    WHEN 'FAIL_2' THEN v_next := 'FAIL_3'; v_retry_hours := 0;
    WHEN 'FAIL_3' THEN v_next := 'SENT_TO_COLLECTIONS'; v_retry_hours := 0;
    ELSE v_next := 'SENT_TO_COLLECTIONS'; v_retry_hours := 0;
  END CASE;

  UPDATE public.invoices
  SET dunning_status = v_next,
      dunning_attempts = dunning_attempts + 1,
      last_charge_error = p_error_message,
      auto_charge_date = CASE
        WHEN v_retry_hours > 0 THEN now() + (v_retry_hours || ' hours')::interval
        ELSE NULL
      END,
      status = CASE WHEN v_next IN ('FAIL_3', 'SENT_TO_COLLECTIONS') THEN 'overdue' ELSE status END,
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Suspend client on FAIL_3
  IF v_next = 'FAIL_3' THEN
    UPDATE public.clients
    SET is_financially_suspended = true
    WHERE id = (SELECT client_id FROM public.invoices WHERE id = p_invoice_id);
  END IF;

  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_invoice_paid_via_stripe(
  p_invoice_id UUID,
  p_payment_intent_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.invoices
  SET status = 'paid',
      paid_date = now(),
      stripe_payment_intent_id = p_payment_intent_id,
      dunning_status = 'NONE',
      dunning_attempts = 0,
      last_charge_error = NULL,
      auto_charge_date = NULL,
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Lift financial suspension if no more overdue invoices
  UPDATE public.clients
  SET is_financially_suspended = false
  WHERE id = (SELECT client_id FROM public.invoices WHERE id = p_invoice_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.invoices
      WHERE client_id = (SELECT client_id FROM public.invoices WHERE id = p_invoice_id)
        AND status = 'overdue'
        AND id != p_invoice_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dunning_stats(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'active_mandates', (SELECT COUNT(*) FROM public.payment_mandates WHERE organization_id = p_org_id AND status = 'ACTIVE'),
    'pending_charges', (SELECT COUNT(*) FROM public.invoices WHERE organization_id = p_org_id AND status = 'sent' AND auto_charge_date IS NOT NULL AND auto_charge_date <= now()),
    'dunning_fail_1', (SELECT COUNT(*) FROM public.invoices WHERE organization_id = p_org_id AND dunning_status = 'FAIL_1'),
    'dunning_fail_2', (SELECT COUNT(*) FROM public.invoices WHERE organization_id = p_org_id AND dunning_status = 'FAIL_2'),
    'dunning_fail_3', (SELECT COUNT(*) FROM public.invoices WHERE organization_id = p_org_id AND dunning_status = 'FAIL_3'),
    'collections', (SELECT COUNT(*) FROM public.invoices WHERE organization_id = p_org_id AND dunning_status = 'SENT_TO_COLLECTIONS'),
    'suspended_clients', (SELECT COUNT(*) FROM public.clients WHERE organization_id = p_org_id AND is_financially_suspended = true),
    'auto_collected_30d', (SELECT COALESCE(SUM(total), 0) FROM public.invoices WHERE organization_id = p_org_id AND status = 'paid' AND paid_date > now() - interval '30 days' AND stripe_payment_intent_id IS NOT NULL)
  );
END;
$$;

-- ─── 7. Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_mandates;

COMMENT ON TABLE public.payment_mandates IS
  'Project Revenue-Net: Tokenized payment method vault for off-session charging.';
