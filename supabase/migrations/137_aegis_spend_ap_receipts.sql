-- ============================================================
-- Migration 137: Project Aegis-Spend — Purchase Order Enhancements,
-- Supplier Receipts, Receipt OCR, Job Costing, Spend Limits
-- ============================================================

-- ── 1. Receipt status enum ──────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.receipt_status AS ENUM (
    'PENDING_AI_PARSE', 'NEEDS_REVIEW', 'VERIFIED', 'SYNCED_TO_ACCOUNTING', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Enhance purchase_orders for mobile PO generation ─────
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS worker_id         UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS po_number         TEXT,
  ADD COLUMN IF NOT EXISTS expected_total    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS approval_status   TEXT DEFAULT 'auto_approved',
  ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offline_ref       TEXT;

-- Unique po_number per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_number_org
  ON public.purchase_orders (organization_id, po_number)
  WHERE po_number IS NOT NULL;

-- ── 3. Add spend limit to organization_members ──────────────
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS max_po_limit NUMERIC(12,2) DEFAULT 500.00;

-- ── 4. Supplier Receipts (The AP Source Document) ───────────
CREATE TABLE IF NOT EXISTS public.supplier_receipts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  po_id                   UUID REFERENCES public.purchase_orders(id),
  job_id                  UUID REFERENCES public.jobs(id),
  worker_id               UUID REFERENCES public.profiles(id),
  -- Image
  receipt_image_url       TEXT,
  receipt_storage_path    TEXT,
  -- AI-extracted data
  supplier_name_extracted TEXT,
  supplier_invoice_number TEXT,
  actual_total_amount     NUMERIC(12,2),
  actual_tax_amount       NUMERIC(12,2),
  actual_subtotal         NUMERIC(12,2),
  extracted_date          DATE,
  extracted_po_number     TEXT,
  ai_raw_response         JSONB,
  ai_model_used           TEXT,
  ai_confidence           NUMERIC(5,2),
  -- Matching & validation
  po_variance_amount      NUMERIC(12,2),
  po_variance_pct         NUMERIC(8,4),
  match_status            TEXT DEFAULT 'unmatched',
  -- Accounting sync
  xero_bill_id            TEXT,
  xero_synced_at          TIMESTAMPTZ,
  cogs_account_code       TEXT,
  -- Status
  status                  public.receipt_status DEFAULT 'PENDING_AI_PARSE',
  verified_by             UUID REFERENCES public.profiles(id),
  verified_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  -- Audit
  notes                   TEXT,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.supplier_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org receipts"
  ON public.supplier_receipts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org receipts"
  ON public.supplier_receipts FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE INDEX IF NOT EXISTS idx_receipts_org ON public.supplier_receipts (organization_id);
CREATE INDEX IF NOT EXISTS idx_receipts_po ON public.supplier_receipts (po_id);
CREATE INDEX IF NOT EXISTS idx_receipts_job ON public.supplier_receipts (job_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.supplier_receipts (organization_id, status);

-- ── 5. Storage bucket for receipts ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('supplier-receipts-photos', 'supplier-receipts-photos', false, 20971520,
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ── 6. RPC: Generate next sequential PO number ─────────────
CREATE OR REPLACE FUNCTION public.generate_next_po_number(
  p_org_id UUID,
  p_job_id UUID DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL,
  p_supplier TEXT DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL,
  p_expected_total NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_offline_ref TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next_num INT;
  v_po_number TEXT;
  v_po_id UUID;
  v_spend_limit NUMERIC;
  v_needs_approval BOOLEAN := false;
BEGIN
  -- Get the next sequential number for this org
  SELECT COALESCE(MAX(
    CASE WHEN po_number ~ '^PO-\d+$'
      THEN SUBSTRING(po_number FROM 4)::INT
      ELSE 0 END
  ), 0) + 1
  INTO v_next_num
  FROM public.purchase_orders
  WHERE organization_id = p_org_id;

  v_po_number := 'PO-' || LPAD(v_next_num::TEXT, 4, '0');

  -- Check spend limit if worker provided
  IF p_worker_id IS NOT NULL AND p_expected_total IS NOT NULL THEN
    SELECT COALESCE(max_po_limit, 500.00) INTO v_spend_limit
    FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_worker_id
      AND status = 'active';

    IF v_spend_limit IS NOT NULL AND p_expected_total > v_spend_limit THEN
      v_needs_approval := true;
    END IF;
  END IF;

  -- Create the PO
  INSERT INTO public.purchase_orders (
    organization_id, display_id, po_number, supplier,
    supplier_name, source_job_id, worker_id, created_by,
    expected_total, notes, offline_ref, status,
    approval_status, approval_requested_at
  ) VALUES (
    p_org_id, v_po_number,  v_po_number,
    CASE WHEN p_supplier IS NOT NULL THEN p_supplier::public.b2b_supplier ELSE 'CUSTOM_API' END,
    COALESCE(p_supplier_name, p_supplier, 'Unknown'),
    p_job_id, p_worker_id, p_worker_id,
    p_expected_total, p_notes, p_offline_ref,
    CASE WHEN v_needs_approval THEN 'DRAFT' ELSE 'APPROVED' END,
    CASE WHEN v_needs_approval THEN 'pending' ELSE 'auto_approved' END,
    CASE WHEN v_needs_approval THEN now() ELSE NULL END
  ) RETURNING id INTO v_po_id;

  RETURN json_build_object(
    'success', true,
    'po_id', v_po_id,
    'po_number', v_po_number,
    'needs_approval', v_needs_approval,
    'spend_limit', v_spend_limit,
    'expected_total', p_expected_total
  );
END;
$$;

-- ── 7. RPC: Approve PO (for spend limit override) ──────────
CREATE OR REPLACE FUNCTION public.approve_purchase_order(
  p_po_id UUID,
  p_approver_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.purchase_orders SET
    status = 'APPROVED',
    approval_status = 'approved',
    approved_by = p_approver_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_po_id
    AND (status = 'DRAFT' OR approval_status = 'pending');

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'PO not found or already approved');
  END IF;

  RETURN json_build_object('success', true, 'po_id', p_po_id, 'approved_at', now());
END;
$$;

-- ── 8. RPC: Job Costing Calculator ──────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_job_costing(
  p_job_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_revenue NUMERIC := 0;
  v_labor_cost NUMERIC := 0;
  v_material_cost NUMERIC := 0;
  v_total_cogs NUMERIC;
  v_gross_profit NUMERIC;
  v_margin_pct NUMERIC;
  v_job RECORD;
BEGIN
  -- Get the job
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Job not found');
  END IF;

  -- Revenue: sum of invoices for this job
  SELECT COALESCE(SUM(total), 0) INTO v_revenue
  FROM public.invoices
  WHERE job_id = p_job_id
    AND status IN ('sent', 'paid');

  -- If no invoices, try quotes
  IF v_revenue = 0 THEN
    SELECT COALESCE(SUM(total), 0) INTO v_revenue
    FROM public.quotes
    WHERE job_id = p_job_id
      AND status IN ('accepted', 'sent');
  END IF;

  -- Labor cost: sum from time_entries for this job
  -- Uses total_hours if available, otherwise calculates from clock_in/clock_out
  SELECT COALESCE(SUM(
    COALESCE(te.total_hours,
      EXTRACT(EPOCH FROM (COALESCE(te.clock_out, now()) - te.clock_in)) / 3600.0
    ) * COALESCE(
      (SELECT COALESCE(sp.hourly_rate, 45.00)
       FROM public.staff_profiles sp WHERE sp.user_id = te.user_id LIMIT 1),
      45.00
    )
  ), 0) INTO v_labor_cost
  FROM public.time_entries te
  WHERE te.job_id = p_job_id;

  -- Material cost: sum of verified supplier receipts
  SELECT COALESCE(SUM(actual_total_amount), 0) INTO v_material_cost
  FROM public.supplier_receipts
  WHERE job_id = p_job_id
    AND status IN ('VERIFIED', 'SYNCED_TO_ACCOUNTING', 'NEEDS_REVIEW');

  -- Also add PO line totals where no receipt exists yet
  SELECT v_material_cost + COALESCE(SUM(pol.line_total), 0) INTO v_material_cost
  FROM public.purchase_order_lines pol
  JOIN public.purchase_orders po ON po.id = pol.purchase_order_id
  WHERE po.source_job_id = p_job_id
    AND po.status IN ('APPROVED', 'SUBMITTED')
    AND NOT EXISTS (
      SELECT 1 FROM public.supplier_receipts sr
      WHERE sr.po_id = po.id AND sr.status != 'REJECTED'
    );

  v_total_cogs := v_labor_cost + v_material_cost;
  v_gross_profit := v_revenue - v_total_cogs;
  v_margin_pct := CASE WHEN v_revenue > 0
    THEN ROUND((v_gross_profit / v_revenue) * 100, 2)
    ELSE 0 END;

  RETURN json_build_object(
    'job_id', p_job_id,
    'revenue', ROUND(v_revenue, 2),
    'labor_cost', ROUND(v_labor_cost, 2),
    'material_cost', ROUND(v_material_cost, 2),
    'total_cogs', ROUND(v_total_cogs, 2),
    'gross_profit', ROUND(v_gross_profit, 2),
    'margin_pct', v_margin_pct,
    'labor_pct', CASE WHEN v_revenue > 0 THEN ROUND((v_labor_cost / v_revenue) * 100, 2) ELSE 0 END,
    'material_pct', CASE WHEN v_revenue > 0 THEN ROUND((v_material_cost / v_revenue) * 100, 2) ELSE 0 END,
    'profit_pct', v_margin_pct
  );
END;
$$;

-- ── 9. Realtime for supplier_receipts ───────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_receipts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
