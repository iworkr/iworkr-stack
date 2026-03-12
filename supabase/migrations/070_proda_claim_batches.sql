-- ============================================================================
-- Migration 070: PRODA Claim Batches (Project Nightingale Phase 3)
-- Batch tracking for NDIS bulk claiming via PRODA/PACE APIs.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Batch Status Enum ──────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proda_batch_status') THEN
    CREATE TYPE public.proda_batch_status AS ENUM (
      'draft',
      'validating',
      'submitted',
      'processing',
      'partially_reconciled',
      'reconciled',
      'failed'
    );
  END IF;
END $$;

-- ─── 2. PRODA Claim Batches ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.proda_claim_batches (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  batch_number          text NOT NULL,                         -- 'BATCH-2026-07-001'
  status                public.proda_batch_status NOT NULL DEFAULT 'draft',
  total_claims          int NOT NULL DEFAULT 0,
  total_amount          numeric(14,2) NOT NULL DEFAULT 0,
  successful_claims     int DEFAULT 0,
  failed_claims         int DEFAULT 0,
  paid_amount           numeric(14,2) DEFAULT 0,
  submitted_at          timestamptz,
  submitted_by          uuid REFERENCES public.profiles ON DELETE SET NULL,
  reconciled_at         timestamptz,
  proda_reference       text,                                  -- reference returned by PRODA
  payload_url           text,                                  -- Storage path to submitted CSV/XML
  remittance_url        text,                                  -- Storage path to remittance file
  error_log             jsonb DEFAULT '[]'::jsonb,             -- [{claim_id, error_code, error_message}]
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proda_batches_org
  ON public.proda_claim_batches (organization_id);
CREATE INDEX IF NOT EXISTS idx_proda_batches_status
  ON public.proda_claim_batches (status);
CREATE INDEX IF NOT EXISTS idx_proda_batches_number
  ON public.proda_claim_batches (batch_number);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_proda_claim_batches_updated_at') THEN
    CREATE TRIGGER set_proda_claim_batches_updated_at
      BEFORE UPDATE ON public.proda_claim_batches
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Add FK from claim_line_items to proda_claim_batches ───────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_claim_batch'
      AND table_name = 'claim_line_items'
  ) THEN
    ALTER TABLE public.claim_line_items
      ADD CONSTRAINT fk_claim_batch
      FOREIGN KEY (claim_batch_id) REFERENCES public.proda_claim_batches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 4. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.proda_claim_batches ENABLE ROW LEVEL SECURITY;

-- ─── 5. RLS Policies ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proda_claim_batches' AND policyname = 'Org members can view PRODA batches') THEN
    CREATE POLICY "Org members can view PRODA batches"
      ON public.proda_claim_batches FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proda_claim_batches' AND policyname = 'Admins can manage PRODA batches') THEN
    CREATE POLICY "Admins can manage PRODA batches"
      ON public.proda_claim_batches FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = proda_claim_batches.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 6. Batch Number Generator ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_batch_number(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_month text := to_char(now(), 'MM');
  v_count int;
BEGIN
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.proda_claim_batches
  WHERE organization_id = p_organization_id
    AND batch_number LIKE 'BATCH-' || v_year || '-' || v_month || '-%';

  RETURN 'BATCH-' || v_year || '-' || v_month || '-' || lpad(v_count::text, 3, '0');
END;
$$;

-- ─── 7. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.proda_claim_batches IS
  'PRODA/PACE API bulk claim batches. Tracks submission lifecycle from draft to reconciliation.';
