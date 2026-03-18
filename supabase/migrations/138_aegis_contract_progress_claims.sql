-- ============================================================
-- Migration 138: Project Aegis-Contract — Commercial Progress
-- Claims, Schedule of Values, Retention Escrow
-- Version 140.0 — "Mathematical Supremacy & Cash Flow Determinism"
-- ============================================================

-- ── 1. Contract status enum ─────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.contract_status AS ENUM (
    'DRAFT', 'LOCKED', 'ACTIVE', 'PRACTICAL_COMPLETION', 'DLP', 'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM (
    'DRAFT', 'SUBMITTED', 'CERTIFIED_PARTIAL', 'CERTIFIED_FULL', 'INVOICED', 'PAID'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Master Commercial Contract ───────────────────────────
CREATE TABLE IF NOT EXISTS public.commercial_contracts (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id                    UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  contract_number           TEXT,
  client_name               TEXT,
  project_name              TEXT,
  total_contract_value      NUMERIC(14,2) NOT NULL,
  original_contract_value   NUMERIC(14,2),
  approved_variations_total NUMERIC(14,2) DEFAULT 0,
  retention_percentage      NUMERIC(6,4) NOT NULL DEFAULT 10.0000,
  retention_cap_percentage  NUMERIC(6,4) DEFAULT 5.0000,
  -- Retention tracking
  total_retention_held      NUMERIC(14,2) DEFAULT 0,
  retention_released        NUMERIC(14,2) DEFAULT 0,
  retention_release_50_done BOOLEAN DEFAULT false,
  retention_release_final   BOOLEAN DEFAULT false,
  -- Dates
  contract_date             DATE,
  practical_completion_date DATE,
  dlp_end_date              DATE,
  dlp_notification_sent     BOOLEAN DEFAULT false,
  -- Status
  status                    public.contract_status DEFAULT 'DRAFT',
  locked_at                 TIMESTAMPTZ,
  locked_by                 UUID REFERENCES public.profiles(id),
  -- Xero integration
  xero_contact_id           TEXT,
  retention_account_code    TEXT DEFAULT '2150',
  revenue_account_code      TEXT DEFAULT '200',
  -- Audit
  notes                     TEXT,
  metadata                  JSONB DEFAULT '{}',
  created_by                UUID REFERENCES public.profiles(id),
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_job_contract UNIQUE (job_id)
);

ALTER TABLE public.commercial_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage commercial contracts"
  ON public.commercial_contracts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE INDEX IF NOT EXISTS idx_contracts_org ON public.commercial_contracts (organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_job ON public.commercial_contracts (job_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.commercial_contracts (organization_id, status);

-- ── 3. Schedule of Values (SOV) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.schedule_of_values (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES public.commercial_contracts(id) ON DELETE CASCADE,
  item_code       TEXT NOT NULL,
  description     TEXT NOT NULL,
  scheduled_value NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order      INT DEFAULT 0,
  is_variation    BOOLEAN DEFAULT false,
  variation_ref   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.schedule_of_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage SOV via contract"
  ON public.schedule_of_values FOR ALL
  USING (contract_id IN (
    SELECT id FROM public.commercial_contracts
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

CREATE INDEX IF NOT EXISTS idx_sov_contract ON public.schedule_of_values (contract_id);

-- ── 4. Progress Claims ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.progress_claims (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id                 UUID NOT NULL REFERENCES public.commercial_contracts(id) ON DELETE CASCADE,
  claim_number                INT NOT NULL,
  period_start                DATE,
  period_end                  DATE NOT NULL,
  -- Calculated totals (denormalized for speed)
  gross_completed_previously  NUMERIC(14,2) DEFAULT 0,
  gross_completed_this_period NUMERIC(14,2) DEFAULT 0,
  materials_stored_this_period NUMERIC(14,2) DEFAULT 0,
  total_completed_to_date     NUMERIC(14,2) DEFAULT 0,
  retention_to_date           NUMERIC(14,2) DEFAULT 0,
  total_earned_less_retention NUMERIC(14,2) DEFAULT 0,
  less_previous_certificates  NUMERIC(14,2) DEFAULT 0,
  current_payment_due         NUMERIC(14,2) DEFAULT 0,
  -- Certification
  certified_amount            NUMERIC(14,2),
  certified_by_name           TEXT,
  certified_at                TIMESTAMPTZ,
  -- Status
  status                      public.claim_status DEFAULT 'DRAFT',
  submitted_at                TIMESTAMPTZ,
  invoiced_at                 TIMESTAMPTZ,
  xero_invoice_id             TEXT,
  -- Audit
  notes                       TEXT,
  metadata                    JSONB DEFAULT '{}',
  created_by                  UUID REFERENCES public.profiles(id),
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_claim_number UNIQUE (contract_id, claim_number)
);

ALTER TABLE public.progress_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage claims via contract"
  ON public.progress_claims FOR ALL
  USING (contract_id IN (
    SELECT id FROM public.commercial_contracts
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

CREATE INDEX IF NOT EXISTS idx_claims_contract ON public.progress_claims (contract_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.progress_claims (contract_id, status);

-- ── 5. Claim Line Items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claim_lines (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                     UUID NOT NULL REFERENCES public.progress_claims(id) ON DELETE CASCADE,
  sov_id                       UUID NOT NULL REFERENCES public.schedule_of_values(id) ON DELETE CASCADE,
  -- Previous (rolled forward from prior claim)
  previously_completed         NUMERIC(14,2) DEFAULT 0,
  previously_stored            NUMERIC(14,2) DEFAULT 0,
  -- This period input
  work_completed_this_period   NUMERIC(14,2) DEFAULT 0,
  materials_stored_this_period NUMERIC(14,2) DEFAULT 0,
  -- Calculated
  total_completed_to_date      NUMERIC(14,2) DEFAULT 0,
  percent_complete             NUMERIC(8,4) DEFAULT 0,
  balance_to_finish            NUMERIC(14,2) DEFAULT 0,
  -- Certification override
  certified_work_this_period   NUMERIC(14,2),
  certified_stored_this_period NUMERIC(14,2),
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.claim_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage claim lines via claim"
  ON public.claim_lines FOR ALL
  USING (claim_id IN (
    SELECT id FROM public.progress_claims
    WHERE contract_id IN (
      SELECT id FROM public.commercial_contracts
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  ));

CREATE INDEX IF NOT EXISTS idx_claim_lines_claim ON public.claim_lines (claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_lines_sov ON public.claim_lines (sov_id);

-- ── 6. RPC: Calculate Progress Claim Summary ────────────────
CREATE OR REPLACE FUNCTION public.calculate_claim_summary(
  p_claim_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_claim RECORD;
  v_contract RECORD;
  v_gross_prev NUMERIC := 0;
  v_gross_this NUMERIC := 0;
  v_materials_this NUMERIC := 0;
  v_total_completed NUMERIC := 0;
  v_retention NUMERIC := 0;
  v_retention_cap NUMERIC := 0;
  v_earned_less_retention NUMERIC := 0;
  v_prev_certificates NUMERIC := 0;
  v_payment_due NUMERIC := 0;
BEGIN
  -- Get the claim
  SELECT * INTO v_claim FROM public.progress_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Claim not found');
  END IF;

  -- Get the contract
  SELECT * INTO v_contract FROM public.commercial_contracts WHERE id = v_claim.contract_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Contract not found');
  END IF;

  -- Sum all claim lines for this period
  SELECT
    COALESCE(SUM(previously_completed + previously_stored), 0),
    COALESCE(SUM(work_completed_this_period), 0),
    COALESCE(SUM(materials_stored_this_period), 0),
    COALESCE(SUM(total_completed_to_date), 0)
  INTO v_gross_prev, v_gross_this, v_materials_this, v_total_completed
  FROM public.claim_lines WHERE claim_id = p_claim_id;

  -- Recalculate total completed = prev + this period work + this period materials
  v_total_completed := v_gross_prev + v_gross_this + v_materials_this;

  -- Calculate retention (subject to cap)
  v_retention := v_total_completed * (v_contract.retention_percentage / 100.0);
  IF v_contract.retention_cap_percentage IS NOT NULL AND v_contract.retention_cap_percentage > 0 THEN
    v_retention_cap := v_contract.total_contract_value * (v_contract.retention_cap_percentage / 100.0);
    IF v_retention > v_retention_cap THEN
      v_retention := v_retention_cap;
    END IF;
  END IF;

  -- Total earned less retention
  v_earned_less_retention := v_total_completed - v_retention;

  -- Sum previous certified payments
  SELECT COALESCE(SUM(
    CASE
      WHEN certified_amount IS NOT NULL THEN certified_amount
      ELSE current_payment_due
    END
  ), 0) INTO v_prev_certificates
  FROM public.progress_claims
  WHERE contract_id = v_claim.contract_id
    AND claim_number < v_claim.claim_number
    AND status IN ('CERTIFIED_PARTIAL', 'CERTIFIED_FULL', 'INVOICED', 'PAID');

  -- Current payment due
  v_payment_due := v_earned_less_retention - v_prev_certificates;

  -- Update the claim record with calculated values
  UPDATE public.progress_claims SET
    gross_completed_previously = v_gross_prev,
    gross_completed_this_period = v_gross_this,
    materials_stored_this_period = v_materials_this,
    total_completed_to_date = v_total_completed,
    retention_to_date = ROUND(v_retention, 2),
    total_earned_less_retention = ROUND(v_earned_less_retention, 2),
    less_previous_certificates = ROUND(v_prev_certificates, 2),
    current_payment_due = ROUND(v_payment_due, 2),
    updated_at = now()
  WHERE id = p_claim_id;

  -- Update contract retention tracking
  UPDATE public.commercial_contracts SET
    total_retention_held = ROUND(v_retention, 2),
    updated_at = now()
  WHERE id = v_claim.contract_id;

  RETURN json_build_object(
    'claim_id', p_claim_id,
    'claim_number', v_claim.claim_number,
    'contract_value', v_contract.total_contract_value,
    'gross_completed_previously', ROUND(v_gross_prev, 2),
    'gross_work_this_period', ROUND(v_gross_this, 2),
    'materials_stored_this_period', ROUND(v_materials_this, 2),
    'total_completed_to_date', ROUND(v_total_completed, 2),
    'retention_rate', v_contract.retention_percentage,
    'retention_to_date', ROUND(v_retention, 2),
    'total_earned_less_retention', ROUND(v_earned_less_retention, 2),
    'less_previous_certificates', ROUND(v_prev_certificates, 2),
    'current_payment_due', ROUND(v_payment_due, 2),
    'balance_remaining', ROUND(v_contract.total_contract_value - v_total_completed, 2),
    'percent_complete_overall', CASE WHEN v_contract.total_contract_value > 0
      THEN ROUND((v_total_completed / v_contract.total_contract_value) * 100, 2) ELSE 0 END
  );
END;
$$;

-- ── 7. RPC: Generate Next Claim (Roll-Forward Engine) ───────
CREATE OR REPLACE FUNCTION public.generate_next_claim(
  p_contract_id UUID,
  p_period_end DATE,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_contract RECORD;
  v_next_number INT;
  v_claim_id UUID;
  v_prev_claim RECORD;
  v_sov RECORD;
  v_prev_total NUMERIC;
  v_prev_stored NUMERIC;
BEGIN
  -- Get the contract
  SELECT * INTO v_contract FROM public.commercial_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Contract not found');
  END IF;

  IF v_contract.status NOT IN ('ACTIVE', 'LOCKED', 'PRACTICAL_COMPLETION') THEN
    RETURN json_build_object('error', 'Contract must be ACTIVE to generate claims');
  END IF;

  -- Get next claim number
  SELECT COALESCE(MAX(claim_number), 0) + 1 INTO v_next_number
  FROM public.progress_claims WHERE contract_id = p_contract_id;

  -- Get the previous claim (if exists)
  SELECT * INTO v_prev_claim
  FROM public.progress_claims
  WHERE contract_id = p_contract_id
    AND claim_number = v_next_number - 1
  LIMIT 1;

  -- Create the new claim
  INSERT INTO public.progress_claims (
    contract_id, claim_number, period_start, period_end,
    status, created_by
  ) VALUES (
    p_contract_id, v_next_number,
    CASE WHEN v_prev_claim.id IS NOT NULL THEN v_prev_claim.period_end + 1 ELSE v_contract.contract_date END,
    p_period_end,
    'DRAFT', p_created_by
  ) RETURNING id INTO v_claim_id;

  -- Generate claim lines from SOV with rolled-forward values
  FOR v_sov IN
    SELECT * FROM public.schedule_of_values
    WHERE contract_id = p_contract_id
    ORDER BY sort_order, item_code
  LOOP
    -- Get previously completed for this SOV item
    v_prev_total := 0;
    v_prev_stored := 0;

    IF v_prev_claim.id IS NOT NULL THEN
      SELECT
        COALESCE(total_completed_to_date, 0),
        COALESCE(materials_stored_this_period, 0)
      INTO v_prev_total, v_prev_stored
      FROM public.claim_lines
      WHERE claim_id = v_prev_claim.id AND sov_id = v_sov.id;
    END IF;

    INSERT INTO public.claim_lines (
      claim_id, sov_id,
      previously_completed, previously_stored,
      work_completed_this_period, materials_stored_this_period,
      total_completed_to_date, percent_complete, balance_to_finish
    ) VALUES (
      v_claim_id, v_sov.id,
      v_prev_total, v_prev_stored,
      0, 0,
      v_prev_total,
      CASE WHEN v_sov.scheduled_value > 0
        THEN ROUND((v_prev_total / v_sov.scheduled_value) * 100, 4) ELSE 0 END,
      v_sov.scheduled_value - v_prev_total
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'claim_id', v_claim_id,
    'claim_number', v_next_number,
    'period_end', p_period_end,
    'sov_lines_generated', (SELECT count(*) FROM public.claim_lines WHERE claim_id = v_claim_id)
  );
END;
$$;

-- ── 8. RPC: Lock Contract (Validate SOV = Contract Value) ───
CREATE OR REPLACE FUNCTION public.lock_commercial_contract(
  p_contract_id UUID,
  p_locked_by UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_contract RECORD;
  v_sov_total NUMERIC;
  v_variance NUMERIC;
BEGIN
  SELECT * INTO v_contract FROM public.commercial_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Contract not found');
  END IF;

  IF v_contract.status != 'DRAFT' THEN
    RETURN json_build_object('error', 'Only DRAFT contracts can be locked');
  END IF;

  -- Sum all SOV lines
  SELECT COALESCE(SUM(scheduled_value), 0) INTO v_sov_total
  FROM public.schedule_of_values WHERE contract_id = p_contract_id;

  v_variance := v_contract.total_contract_value - v_sov_total;

  -- CRITICAL: SOV must exactly match contract value
  IF v_variance != 0 THEN
    RETURN json_build_object(
      'error', 'SOV total does not match contract value',
      'sov_total', v_sov_total,
      'contract_value', v_contract.total_contract_value,
      'variance', v_variance
    );
  END IF;

  -- Lock the contract
  UPDATE public.commercial_contracts SET
    status = 'ACTIVE',
    original_contract_value = v_contract.total_contract_value,
    locked_at = now(),
    locked_by = p_locked_by,
    updated_at = now()
  WHERE id = p_contract_id;

  RETURN json_build_object(
    'success', true,
    'contract_id', p_contract_id,
    'status', 'ACTIVE',
    'sov_total', v_sov_total,
    'locked_at', now()
  );
END;
$$;

-- ── 9. RPC: Add Variation to Contract ───────────────────────
CREATE OR REPLACE FUNCTION public.add_contract_variation(
  p_contract_id UUID,
  p_description TEXT,
  p_value NUMERIC,
  p_variation_ref TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_contract RECORD;
  v_next_code TEXT;
  v_sov_id UUID;
  v_new_total NUMERIC;
BEGIN
  SELECT * INTO v_contract FROM public.commercial_contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Contract not found');
  END IF;

  -- Generate variation code
  SELECT 'V' || LPAD((COALESCE(COUNT(*), 0) + 1)::TEXT, 2, '0') INTO v_next_code
  FROM public.schedule_of_values
  WHERE contract_id = p_contract_id AND is_variation = true;

  -- Add to SOV
  INSERT INTO public.schedule_of_values (
    contract_id, item_code, description, scheduled_value,
    sort_order, is_variation, variation_ref
  ) VALUES (
    p_contract_id, v_next_code, p_description, p_value,
    (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.schedule_of_values WHERE contract_id = p_contract_id),
    true, COALESCE(p_variation_ref, v_next_code)
  ) RETURNING id INTO v_sov_id;

  -- Update contract value
  v_new_total := v_contract.total_contract_value + p_value;
  UPDATE public.commercial_contracts SET
    total_contract_value = v_new_total,
    approved_variations_total = COALESCE(approved_variations_total, 0) + p_value,
    updated_at = now()
  WHERE id = p_contract_id;

  RETURN json_build_object(
    'success', true,
    'sov_id', v_sov_id,
    'variation_code', v_next_code,
    'new_contract_total', v_new_total
  );
END;
$$;

-- ── 10. Realtime ─────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.commercial_contracts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.progress_claims;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
