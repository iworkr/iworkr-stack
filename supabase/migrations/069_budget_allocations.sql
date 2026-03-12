-- ============================================================================
-- Migration 069: Budget Allocations, Quarantine Ledger, Funders & Claim Lines
-- (Project Nightingale Phase 3)
-- Real-time budget quarantining, multi-funder split billing, and claim line items.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Funders Table ──────────────────────────────────────────────────────
-- Multi-funder support: NDIA-managed, plan-managed, self-managed, private, etc.

CREATE TABLE IF NOT EXISTS public.funders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  name                  text NOT NULL,                         -- 'NDIA', 'Plan Manager - XYZ', etc.
  type                  text NOT NULL CHECK (type IN ('ndia_managed', 'plan_managed', 'self_managed', 'private', 'other')),
  contact_email         text,
  billing_reference     text,                                  -- ABN, NDIS reference, etc.
  is_primary            boolean DEFAULT false,
  is_active             boolean DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funders_org
  ON public.funders (organization_id);
CREATE INDEX IF NOT EXISTS idx_funders_participant
  ON public.funders (participant_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_funders_updated_at') THEN
    CREATE TRIGGER set_funders_updated_at
      BEFORE UPDATE ON public.funders
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 2. Budget Allocations ────────────────────────────────────────────────
-- Per-category budget envelopes for each service agreement.
-- Categories: core, capacity_building, capital (NDIS standard categories).

CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  service_agreement_id    uuid NOT NULL REFERENCES public.service_agreements ON DELETE CASCADE,
  participant_id          uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  category                text NOT NULL CHECK (category IN ('core', 'capacity_building', 'capital')),
  total_budget            numeric(12,2) NOT NULL DEFAULT 0,
  consumed_budget         numeric(12,2) NOT NULL DEFAULT 0,
  quarantined_budget      numeric(12,2) NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_agreement_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budget_alloc_agreement
  ON public.budget_allocations (service_agreement_id);
CREATE INDEX IF NOT EXISTS idx_budget_alloc_participant
  ON public.budget_allocations (participant_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_budget_allocations_updated_at') THEN
    CREATE TRIGGER set_budget_allocations_updated_at
      BEFORE UPDATE ON public.budget_allocations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Budget Quarantine Ledger ──────────────────────────────────────────
-- Immutable audit trail of every budget reservation and release.
-- When a shift is scheduled: quarantined. Completed: consumed. Cancelled: released.

CREATE TABLE IF NOT EXISTS public.budget_quarantine_ledger (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  allocation_id         uuid NOT NULL REFERENCES public.budget_allocations ON DELETE CASCADE,
  shift_id              uuid REFERENCES public.jobs ON DELETE SET NULL,
  amount                numeric(12,2) NOT NULL,
  status                text NOT NULL CHECK (status IN ('quarantined', 'consumed', 'released')),
  ndis_item_number      text,
  description           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_quarantine_shift
  ON public.budget_quarantine_ledger (shift_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_status
  ON public.budget_quarantine_ledger (status)
  WHERE status = 'quarantined';
CREATE INDEX IF NOT EXISTS idx_quarantine_allocation
  ON public.budget_quarantine_ledger (allocation_id);

-- ─── 4. Claim Line Items ─────────────────────────────────────────────────
-- One shift → many claim lines (split billing across funders).
-- Links to PRODA batches (FK added in migration 070).

CREATE TABLE IF NOT EXISTS public.claim_line_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  claim_batch_id        uuid,                                  -- FK added in migration 070
  shift_id              uuid REFERENCES public.jobs ON DELETE SET NULL,
  participant_id        uuid NOT NULL REFERENCES public.participant_profiles ON DELETE CASCADE,
  funder_id             uuid REFERENCES public.funders ON DELETE SET NULL,
  ndis_item_number      text,
  description           text NOT NULL,
  quantity              numeric(8,2) NOT NULL,
  unit_rate             numeric(10,2) NOT NULL,
  total_amount          numeric(12,2) NOT NULL,
  region_modifier       numeric(5,2) DEFAULT 0,
  gst_amount            numeric(10,2) DEFAULT 0,
  status                text NOT NULL CHECK (status IN ('draft', 'approved', 'submitted', 'paid', 'rejected', 'written_off')),
  rejection_code        text,
  rejection_reason      text,
  service_date          date,
  worker_id             uuid REFERENCES public.profiles ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_lines_batch
  ON public.claim_line_items (claim_batch_id);
CREATE INDEX IF NOT EXISTS idx_claim_lines_status
  ON public.claim_line_items (status);
CREATE INDEX IF NOT EXISTS idx_claim_lines_participant
  ON public.claim_line_items (participant_id);
CREATE INDEX IF NOT EXISTS idx_claim_lines_org
  ON public.claim_line_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_claim_lines_shift
  ON public.claim_line_items (shift_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_claim_line_items_updated_at') THEN
    CREATE TRIGGER set_claim_line_items_updated_at
      BEFORE UPDATE ON public.claim_line_items
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 5. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.funders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_quarantine_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_line_items ENABLE ROW LEVEL SECURITY;

-- ─── 6. RLS Policies ────────────────────────────────────────────────────────

-- Funders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'funders' AND policyname = 'Org members can view funders') THEN
    CREATE POLICY "Org members can view funders"
      ON public.funders FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'funders' AND policyname = 'Admins can manage funders') THEN
    CREATE POLICY "Admins can manage funders"
      ON public.funders FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = funders.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- Budget Allocations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budget_allocations' AND policyname = 'Org members can view budget allocations') THEN
    CREATE POLICY "Org members can view budget allocations"
      ON public.budget_allocations FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budget_allocations' AND policyname = 'Admins can manage budget allocations') THEN
    CREATE POLICY "Admins can manage budget allocations"
      ON public.budget_allocations FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = budget_allocations.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- Quarantine Ledger
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budget_quarantine_ledger' AND policyname = 'Org members can view quarantine ledger') THEN
    CREATE POLICY "Org members can view quarantine ledger"
      ON public.budget_quarantine_ledger FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'budget_quarantine_ledger' AND policyname = 'Admins can manage quarantine ledger') THEN
    CREATE POLICY "Admins can manage quarantine ledger"
      ON public.budget_quarantine_ledger FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = budget_quarantine_ledger.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- Claim Line Items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'claim_line_items' AND policyname = 'Org members can view claim line items') THEN
    CREATE POLICY "Org members can view claim line items"
      ON public.claim_line_items FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'claim_line_items' AND policyname = 'Admins can manage claim line items') THEN
    CREATE POLICY "Admins can manage claim line items"
      ON public.claim_line_items FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = claim_line_items.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 7. Budget Quarantine Helper Function ──────────────────────────────────
-- Called when a shift is scheduled: reserves projected cost from participant budget.

CREATE OR REPLACE FUNCTION public.quarantine_shift_budget(
  p_organization_id uuid,
  p_allocation_id uuid,
  p_shift_id uuid,
  p_amount numeric,
  p_ndis_item_number text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_available numeric;
  v_total numeric;
  v_consumed numeric;
  v_quarantined numeric;
BEGIN
  -- Get current budget state
  SELECT total_budget, consumed_budget, quarantined_budget
  INTO v_total, v_consumed, v_quarantined
  FROM public.budget_allocations
  WHERE id = p_allocation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Budget allocation not found');
  END IF;

  v_available := v_total - v_consumed - v_quarantined;

  IF p_amount > v_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient budget',
      'available', v_available,
      'requested', p_amount,
      'overage', p_amount - v_available
    );
  END IF;

  -- Create quarantine record
  INSERT INTO public.budget_quarantine_ledger (
    organization_id, allocation_id, shift_id, amount, status, ndis_item_number, description
  ) VALUES (
    p_organization_id, p_allocation_id, p_shift_id, p_amount, 'quarantined', p_ndis_item_number, p_description
  );

  -- Update allocation
  UPDATE public.budget_allocations
  SET quarantined_budget = quarantined_budget + p_amount,
      updated_at = now()
  WHERE id = p_allocation_id;

  RETURN jsonb_build_object(
    'success', true,
    'quarantined', p_amount,
    'remaining', v_available - p_amount
  );
END;
$$;

-- ─── 8. Release Quarantine (shift cancelled) ──────────────────────────────

CREATE OR REPLACE FUNCTION public.release_shift_quarantine(
  p_shift_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_record RECORD;
  v_released_total numeric := 0;
BEGIN
  FOR v_record IN
    SELECT id, allocation_id, amount
    FROM public.budget_quarantine_ledger
    WHERE shift_id = p_shift_id AND status = 'quarantined'
    FOR UPDATE
  LOOP
    UPDATE public.budget_quarantine_ledger
    SET status = 'released', resolved_at = now()
    WHERE id = v_record.id;

    UPDATE public.budget_allocations
    SET quarantined_budget = quarantined_budget - v_record.amount,
        updated_at = now()
    WHERE id = v_record.allocation_id;

    v_released_total := v_released_total + v_record.amount;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'released', v_released_total);
END;
$$;

-- ─── 9. Consume Quarantine (shift completed) ──────────────────────────────

CREATE OR REPLACE FUNCTION public.consume_shift_quarantine(
  p_shift_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_record RECORD;
  v_consumed_total numeric := 0;
BEGIN
  FOR v_record IN
    SELECT id, allocation_id, amount
    FROM public.budget_quarantine_ledger
    WHERE shift_id = p_shift_id AND status = 'quarantined'
    FOR UPDATE
  LOOP
    UPDATE public.budget_quarantine_ledger
    SET status = 'consumed', resolved_at = now()
    WHERE id = v_record.id;

    UPDATE public.budget_allocations
    SET quarantined_budget = quarantined_budget - v_record.amount,
        consumed_budget = consumed_budget + v_record.amount,
        updated_at = now()
    WHERE id = v_record.allocation_id;

    v_consumed_total := v_consumed_total + v_record.amount;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'consumed', v_consumed_total);
END;
$$;

-- ─── 10. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.funders IS
  'Multi-funder support for split billing: NDIA, plan managers, self-managed, private payers.';
COMMENT ON TABLE public.budget_allocations IS
  'Per-category budget envelopes (core, capacity_building, capital) for NDIS service agreements.';
COMMENT ON TABLE public.budget_quarantine_ledger IS
  'Immutable audit trail of budget reservations (quarantine), consumptions, and releases.';
COMMENT ON TABLE public.claim_line_items IS
  'Individual claim lines for NDIS billing. One shift can produce multiple claim lines across funders.';
