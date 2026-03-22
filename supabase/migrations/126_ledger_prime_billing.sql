-- ============================================================================
-- @migration LedgerPrimeBilling
-- @status COMPLETE
-- @description Project Ledger-Prime — NDIS participant invoicing, billing batches, support items
-- @tables invoices (altered), invoice_line_items (altered), ndis_support_items
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Extend invoices table for NDIS participant billing ─────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funding_type TEXT DEFAULT 'plan_managed'
    CHECK (funding_type IN ('plan_managed', 'self_managed', 'ndia_managed')),
  ADD COLUMN IF NOT EXISTS service_agreement_id UUID REFERENCES public.service_agreements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_manager_email TEXT,
  ADD COLUMN IF NOT EXISTS plan_manager_name TEXT,
  ADD COLUMN IF NOT EXISTS ndis_participant_number TEXT,
  ADD COLUMN IF NOT EXISTS ndis_claim_reference TEXT,
  ADD COLUMN IF NOT EXISTS billing_period_start DATE,
  ADD COLUMN IF NOT EXISTS billing_period_end DATE,
  ADD COLUMN IF NOT EXISTS proda_export_status TEXT DEFAULT 'not_queued'
    CHECK (proda_export_status IN ('not_queued', 'queued', 'exported', 'claimed')),
  ADD COLUMN IF NOT EXISTS dispatch_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_error TEXT;

-- ── 2. Extend invoice_line_items for NDIS compliance ─────────────────────
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS ndis_support_item_number TEXT,  -- e.g. 01_011_0107_1_1
  ADD COLUMN IF NOT EXISTS support_category TEXT,
  ADD COLUMN IF NOT EXISTS shift_date DATE,
  ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES public.schedule_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS worker_id UUID,
  ADD COLUMN IF NOT EXISTS hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS rate NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS line_total NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- Indexes for the billing dashboard queries
CREATE INDEX IF NOT EXISTS idx_invoices_participant_id ON public.invoices (participant_id) WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_funding_type ON public.invoices (funding_type);
CREATE INDEX IF NOT EXISTS idx_invoices_status_org ON public.invoices (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON public.invoice_line_items (invoice_id);

-- ── 3. NDIS Support Items pricing catalog ────────────────────────────────
-- Stores the NDIS Price Guide rates, locked by effective_from date.
-- When generating invoices, we JOIN on the shift date to get the price
-- that was valid when the shift occurred (protects against July 1 changes).
CREATE TABLE IF NOT EXISTS public.ndis_support_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_item_number TEXT NOT NULL,      -- e.g. 01_011_0107_1_1
  support_item_name TEXT NOT NULL,
  support_category_number TEXT NOT NULL,  -- e.g. 01
  support_category_name TEXT NOT NULL,    -- e.g. Daily Activities
  registration_group_number TEXT,
  unit TEXT NOT NULL DEFAULT 'H',         -- H=Hourly, EA=Each, D=Day, WK=Week
  price_limit_national NUMERIC(10,4),
  price_limit_remote NUMERIC(10,4),
  price_limit_very_remote NUMERIC(10,4),
  support_purpose TEXT,  -- Capital/Core/Capacity
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ndis_support_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can read support items"
  ON public.ndis_support_items FOR SELECT USING (TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ndis_items_number_date
  ON public.ndis_support_items (support_item_number, effective_from);

CREATE INDEX IF NOT EXISTS idx_ndis_items_active ON public.ndis_support_items (is_active, effective_from);

-- Seed 10 common NDIS support items for demos
INSERT INTO public.ndis_support_items (support_item_number, support_item_name, support_category_number, support_category_name, registration_group_number, unit, price_limit_national, price_limit_remote, price_limit_very_remote, support_purpose, effective_from)
VALUES
  ('01_011_0107_1_1', 'Assistance With Self-Care Activities - Standard - Weekday Daytime', '01', 'Daily Activities', '0107', 'H', 67.56, 94.58, 108.10, 'Core', '2024-07-01'),
  ('01_012_0107_1_1', 'Assistance With Self-Care Activities - Standard - Weekday Evening', '01', 'Daily Activities', '0107', 'H', 74.44, 104.22, 119.10, 'Core', '2024-07-01'),
  ('01_013_0107_1_1', 'Assistance With Self-Care Activities - Standard - Saturday', '01', 'Daily Activities', '0107', 'H', 94.99, 132.99, 151.98, 'Core', '2024-07-01'),
  ('01_014_0107_1_1', 'Assistance With Self-Care Activities - Standard - Sunday', '01', 'Daily Activities', '0107', 'H', 121.73, 170.42, 194.77, 'Core', '2024-07-01'),
  ('01_015_0107_1_1', 'Assistance With Self-Care Activities - Standard - Public Holiday', '01', 'Daily Activities', '0107', 'H', 148.47, 207.86, 237.55, 'Core', '2024-07-01'),
  ('04_210_0125_6_1', 'Assistance With Social, Economic And Community Participation - Standard', '04', 'Assistance With Social, Economic & Community Participation', '0125', 'H', 67.56, 94.58, 108.10, 'Core', '2024-07-01'),
  ('07_002_0106_1_1', 'Assistance With Daily Life Tasks In A Group Or Shared Living Arrangement', '07', 'Support Coordination', '0106', 'H', 65.09, 91.13, 104.14, 'Core', '2024-07-01'),
  ('07_004_0132_8_3', 'Support Coordination', '07', 'Support Coordination', '0132', 'H', 108.13, 151.38, 172.01, 'Capacity Building', '2024-07-01'),
  ('09_001_0351_1_3', 'Interpreting And Translation', '09', 'Improved Living Arrangements', '0351', 'H', 116.39, NULL, NULL, 'Capacity Building', '2024-07-01'),
  ('15_053_0128_1_3', 'Specialist Positive Behaviour Support', '15', 'Improved Daily Living', '0128', 'H', 217.37, 304.32, 347.79, 'Capacity Building', '2024-07-01')
ON CONFLICT (support_item_number, effective_from) DO NOTHING;

-- ── 4. The generate_billing_batches RPC ──────────────────────────────────
-- Sweeps all completed, unbilled schedule_blocks that have a participant_id,
-- groups by participant + funding_management_type from their service agreement,
-- creates DRAFT invoices in batches, and returns the array of new invoice IDs.
-- 
-- LOCK SAFETY: Uses an advisory lock to prevent concurrent batch runs.
-- IDEMPOTENCY: Marks schedule_blocks.billed_at to prevent double-billing.
-- PRICE LOCK: Uses the rate that was valid on the shift date, not today.

-- First add billed_at to schedule_blocks if not present
ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ndis_support_item_number TEXT,
  ADD COLUMN IF NOT EXISTS billable_rate NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS billable_hours NUMERIC(6,2);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_unbilled
  ON public.schedule_blocks (organization_id, participant_id, status)
  WHERE billed_at IS NULL AND participant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_billing_batches(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shift         RECORD;
  v_participant   RECORD;
  v_sa            RECORD;
  v_invoice_id    UUID;
  v_display_id    TEXT;
  v_count         INTEGER := 0;
  v_result        JSONB := '{"invoices_created": [], "batches": 0, "shifts_billed": 0}'::JSONB;
  v_invoice_ids   UUID[] := '{}';
  v_lock_key      BIGINT := hashtext(p_org_id::text);
BEGIN
  -- Advisory lock: prevents concurrent batch runs for same org
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'BILLING_LOCK: Another billing batch is already running for this workspace.';
  END IF;

  -- Find all completed, unbilled shifts with a participant
  FOR v_shift IN
    SELECT
      sb.id AS shift_id,
      sb.organization_id,
      sb.participant_id,
      sb.start_time,
      sb.end_time,
      sb.status,
      sb.ndis_support_item_number,
      sb.billable_rate,
      sb.billable_hours,
      -- Calculate hours if not pre-set
      COALESCE(
        sb.billable_hours,
        EXTRACT(EPOCH FROM (sb.end_time - sb.start_time)) / 3600.0
      ) AS computed_hours,
      -- Get the NDIS rate valid on the shift date
      COALESCE(
        sb.billable_rate,
        (SELECT n.price_limit_national 
         FROM public.ndis_support_items n
         WHERE n.support_item_number = sb.ndis_support_item_number
           AND n.effective_from <= sb.start_time::DATE
         ORDER BY n.effective_from DESC
         LIMIT 1),
        67.56  -- fallback: standard weekday rate
      ) AS resolved_rate,
      -- Participant funding type from their most recent active service agreement
      (SELECT sa.funding_management_type 
       FROM public.service_agreements sa
       WHERE sa.participant_id = sb.participant_id
         AND sa.organization_id = p_org_id
         AND sa.status = 'active'
       ORDER BY sa.created_at DESC
       LIMIT 1) AS funding_type
    FROM public.schedule_blocks sb
    WHERE sb.organization_id = p_org_id
      AND sb.participant_id IS NOT NULL
      AND sb.billed_at IS NULL
      AND sb.invoice_id IS NULL
      AND sb.status IN ('complete', 'completed', 'on_site')
    ORDER BY sb.participant_id, sb.start_time
  LOOP
    v_count := v_count + 1;

    -- Check if a DRAFT invoice already exists for this participant + funding_type in this batch run
    SELECT id INTO v_invoice_id
    FROM public.invoices
    WHERE organization_id = p_org_id
      AND participant_id = v_shift.participant_id
      AND funding_type = COALESCE(v_shift.funding_type, 'plan_managed')
      AND status = 'draft'
      AND billing_period_end IS NULL  -- from THIS batch run
    LIMIT 1;

    IF v_invoice_id IS NULL THEN
      -- Generate invoice display ID
      v_display_id := 'INV-' || LPAD(
        (SELECT COALESCE(MAX(CAST(SUBSTRING(display_id FROM 5) AS INTEGER)), 0) + 1
         FROM public.invoices
         WHERE organization_id = p_org_id
           AND display_id ~ '^INV-[0-9]+$')::TEXT,
        5, '0'
      );

      -- Create new DRAFT invoice
      INSERT INTO public.invoices (
        organization_id, display_id, participant_id, status,
        funding_type, issue_date, due_date, subtotal, total,
        billing_period_start
      )
      VALUES (
        p_org_id, v_display_id, v_shift.participant_id, 'draft',
        COALESCE(v_shift.funding_type, 'plan_managed'),
        CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days',
        0, 0, v_shift.start_time::DATE
      )
      RETURNING id INTO v_invoice_id;

      v_invoice_ids := v_invoice_ids || v_invoice_id;
    END IF;

    -- Add line item to the invoice
    INSERT INTO public.invoice_line_items (
      invoice_id, description, quantity, unit_price,
      ndis_support_item_number, shift_date, shift_id,
      hours, rate, line_total, sort_order
    )
    VALUES (
      v_invoice_id,
      COALESCE(
        (SELECT support_item_name FROM public.ndis_support_items 
         WHERE support_item_number = v_shift.ndis_support_item_number
         ORDER BY effective_from DESC LIMIT 1),
        'Support Services'
      ),
      v_shift.computed_hours,
      v_shift.resolved_rate,
      v_shift.ndis_support_item_number,
      v_shift.start_time::DATE,
      v_shift.shift_id,
      v_shift.computed_hours,
      v_shift.resolved_rate,
      ROUND(v_shift.computed_hours * v_shift.resolved_rate, 2),
      v_count
    );

    -- Mark shift as billed (idempotency)
    UPDATE public.schedule_blocks
    SET billed_at = NOW(),
        invoice_id = v_invoice_id
    WHERE id = v_shift.shift_id;
  END LOOP;

  -- Recalculate totals for all invoices created in this batch
  UPDATE public.invoices inv
  SET
    subtotal = (
      SELECT COALESCE(SUM(COALESCE(li.line_total, li.quantity * li.unit_price)), 0)
      FROM public.invoice_line_items li
      WHERE li.invoice_id = inv.id
    ),
    total = (
      SELECT COALESCE(SUM(COALESCE(li.line_total, li.quantity * li.unit_price)), 0)
      FROM public.invoice_line_items li
      WHERE li.invoice_id = inv.id
    ),
    billing_period_end = NOW()::DATE
  WHERE id = ANY(v_invoice_ids);

  RETURN jsonb_build_object(
    'invoices_created', v_invoice_ids,
    'batches', array_length(v_invoice_ids, 1),
    'shifts_billed', v_count
  );
END;
$$;

-- ── 5. Billing telemetry RPC (for the Telemetry Ribbon) ──────────────────
CREATE OR REPLACE FUNCTION public.get_billing_telemetry(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_unbilled_value NUMERIC := 0;
  v_draft_value    NUMERIC := 0;
  v_outstanding    NUMERIC := 0;
  v_overdue        NUMERIC := 0;
  v_ytd_revenue    NUMERIC := 0;
BEGIN
  -- Unbilled: completed schedule_blocks not yet in an invoice
  SELECT COALESCE(SUM(
    COALESCE(sb.billable_hours, EXTRACT(EPOCH FROM (sb.end_time - sb.start_time)) / 3600.0)
    * COALESCE(sb.billable_rate, 67.56)
  ), 0) INTO v_unbilled_value
  FROM public.schedule_blocks sb
  WHERE sb.organization_id = p_org_id
    AND sb.participant_id IS NOT NULL
    AND sb.billed_at IS NULL
    AND sb.invoice_id IS NULL
    AND sb.status IN ('complete', 'completed');

  -- Draft invoices total
  SELECT COALESCE(SUM(total), 0) INTO v_draft_value
  FROM public.invoices
  WHERE organization_id = p_org_id
    AND status = 'draft'
    AND deleted_at IS NULL;

  -- Total outstanding (sent but not paid)
  SELECT COALESCE(SUM(total), 0) INTO v_outstanding
  FROM public.invoices
  WHERE organization_id = p_org_id
    AND status IN ('sent', 'viewed')
    AND deleted_at IS NULL;

  -- Overdue >30 days
  SELECT COALESCE(SUM(total), 0) INTO v_overdue
  FROM public.invoices
  WHERE organization_id = p_org_id
    AND status IN ('sent', 'viewed', 'overdue')
    AND due_date < CURRENT_DATE - INTERVAL '30 days'
    AND deleted_at IS NULL;

  -- Revenue YTD
  SELECT COALESCE(SUM(total), 0) INTO v_ytd_revenue
  FROM public.invoices
  WHERE organization_id = p_org_id
    AND status = 'paid'
    AND paid_date >= DATE_TRUNC('year', CURRENT_DATE)
    AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'unbilled_value', v_unbilled_value,
    'draft_value', v_draft_value,
    'outstanding', v_outstanding,
    'overdue', v_overdue,
    'ytd_revenue', v_ytd_revenue
  );
END;
$$;
