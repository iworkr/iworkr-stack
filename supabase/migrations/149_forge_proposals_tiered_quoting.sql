-- ============================================================================
-- @migration ForgeProposalsTieredQuoting
-- @status COMPLETE
-- @description Project Forge-Proposals — multi-option quoting, CPQ, psychological anchoring
-- @tables quote_tiers, quote_tier_line_items, proposal_templates
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Quote Tier Status ENUM ───────────────────────────────
DO $$ BEGIN
  CREATE TYPE quote_tier_status AS ENUM (
    'proposed', 'accepted', 'rejected_by_choice'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Kit Component Type ENUM ──────────────────────────────
DO $$ BEGIN
  CREATE TYPE kit_component_type AS ENUM (
    'material_internal', 'material_supplier', 'labor_role', 'subcontractor_fee'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Add is_multi_option + is_client_selectable to existing tables ─
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS is_multi_option BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.kit_components
  ADD COLUMN IF NOT EXISTS is_client_selectable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.kit_components
  ADD COLUMN IF NOT EXISTS component_type TEXT DEFAULT 'material_internal';

-- ── 4. Quote Tiers Table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  tier_name         TEXT NOT NULL DEFAULT 'Standard',
  tier_description  TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  is_recommended    BOOLEAN NOT NULL DEFAULT false,
  subtotal          DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax               DECIMAL(12,2) NOT NULL DEFAULT 0,
  total             DECIMAL(12,2) NOT NULL DEFAULT 0,
  status            quote_tier_status NOT NULL DEFAULT 'proposed',
  accepted_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_tiers_quote ON public.quote_tiers(quote_id);

-- ── 5. Quote Tier Lines Table ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.quote_tier_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id             UUID NOT NULL REFERENCES public.quote_tiers(id) ON DELETE CASCADE,
  kit_id              UUID REFERENCES public.trade_kits(id),
  kit_name            TEXT,
  description         TEXT NOT NULL,
  item_type           TEXT NOT NULL DEFAULT 'material',
  quantity            DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_cost           DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_sell           DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate            DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  line_total          DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_sell) STORED,
  is_optional_addon   BOOLEAN NOT NULL DEFAULT false,
  is_included         BOOLEAN NOT NULL DEFAULT true,
  sort_order          INT NOT NULL DEFAULT 0,
  reference_id        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_tier_lines_tier ON public.quote_tier_lines(tier_id);
CREATE INDEX IF NOT EXISTS idx_quote_tier_lines_kit ON public.quote_tier_lines(kit_id);

-- ── 6. Proposal Signatures Table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.proposal_signatures (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id          UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  tier_id           UUID NOT NULL REFERENCES public.quote_tiers(id),
  signer_name       TEXT NOT NULL,
  signer_email      TEXT,
  signature_data    TEXT NOT NULL,
  ip_address        TEXT,
  user_agent        TEXT,
  agreed_terms      BOOLEAN NOT NULL DEFAULT true,
  signed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_signatures_quote ON public.proposal_signatures(quote_id);

-- ── 7. RLS Policies ────────────────────────────────────────

ALTER TABLE public.quote_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_tier_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_signatures ENABLE ROW LEVEL SECURITY;

-- Quote tiers: inherit from parent quote via org membership
CREATE POLICY "Members manage quote tiers" ON public.quote_tiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.organization_members om ON om.organization_id = q.organization_id
      WHERE q.id = quote_tiers.quote_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Public read quote tiers by token" ON public.quote_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_tiers.quote_id
        AND q.secure_token IS NOT NULL
    )
  );

CREATE POLICY "Service role manages quote tiers" ON public.quote_tiers
  FOR ALL USING (auth.role() = 'service_role');

-- Quote tier lines: inherit via tier -> quote
CREATE POLICY "Members manage tier lines" ON public.quote_tier_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.quote_tiers qt
      JOIN public.quotes q ON q.id = qt.quote_id
      JOIN public.organization_members om ON om.organization_id = q.organization_id
      WHERE qt.id = quote_tier_lines.tier_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Public read tier lines by token" ON public.quote_tier_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quote_tiers qt
      JOIN public.quotes q ON q.id = qt.quote_id
      WHERE qt.id = quote_tier_lines.tier_id
        AND q.secure_token IS NOT NULL
    )
  );

CREATE POLICY "Service role manages tier lines" ON public.quote_tier_lines
  FOR ALL USING (auth.role() = 'service_role');

-- Signatures
CREATE POLICY "Members read signatures" ON public.proposal_signatures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.organization_members om ON om.organization_id = q.organization_id
      WHERE q.id = proposal_signatures.quote_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Service role manages signatures" ON public.proposal_signatures
  FOR ALL USING (auth.role() = 'service_role');

-- ── 8. RPC: Get Proposal By Token (public) ──────────────────
CREATE OR REPLACE FUNCTION public.get_proposal_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_quote RECORD;
  v_tiers JSON;
  v_org RECORD;
BEGIN
  SELECT * INTO v_quote FROM public.quotes
  WHERE secure_token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_quote.status = 'expired' THEN
    RETURN json_build_object('error', 'expired');
  END IF;

  IF v_quote.status = 'accepted' THEN
    RETURN json_build_object('error', 'already_accepted', 'accepted_at', v_quote.signed_at);
  END IF;

  -- Mark as viewed
  IF v_quote.status = 'sent' THEN
    UPDATE public.quotes SET status = 'viewed', updated_at = now()
    WHERE id = v_quote.id;
  END IF;

  -- Get org branding
  SELECT name INTO v_org FROM public.organizations WHERE id = v_quote.organization_id;

  -- Build tiers with lines
  SELECT json_agg(
    json_build_object(
      'id', qt.id,
      'tier_name', qt.tier_name,
      'tier_description', qt.tier_description,
      'sort_order', qt.sort_order,
      'is_recommended', qt.is_recommended,
      'subtotal', qt.subtotal,
      'tax', qt.tax,
      'total', qt.total,
      'status', qt.status,
      'lines', (
        SELECT COALESCE(json_agg(
          json_build_object(
            'id', qtl.id,
            'description', qtl.description,
            'item_type', qtl.item_type,
            'quantity', qtl.quantity,
            'unit_sell', qtl.unit_sell,
            'line_total', qtl.line_total,
            'is_optional_addon', qtl.is_optional_addon,
            'is_included', qtl.is_included,
            'kit_name', qtl.kit_name,
            'sort_order', qtl.sort_order
          ) ORDER BY qtl.sort_order
        ), '[]'::json)
        FROM public.quote_tier_lines qtl
        WHERE qtl.tier_id = qt.id
      )
    ) ORDER BY qt.sort_order
  ) INTO v_tiers
  FROM public.quote_tiers qt
  WHERE qt.quote_id = v_quote.id;

  RETURN json_build_object(
    'quote_id', v_quote.id,
    'display_id', v_quote.display_id,
    'title', v_quote.title,
    'client_name', v_quote.client_name,
    'client_email', v_quote.client_email,
    'client_address', v_quote.client_address,
    'status', v_quote.status,
    'is_multi_option', v_quote.is_multi_option,
    'issue_date', v_quote.issue_date,
    'valid_until', v_quote.valid_until,
    'terms', v_quote.terms,
    'notes', v_quote.notes,
    'organization_name', v_org.name,
    'tiers', COALESCE(v_tiers, '[]'::json)
  );
END;
$$;

-- ── 9. RPC: Accept Quote Tier (atomic conversion) ───────────
CREATE OR REPLACE FUNCTION public.accept_quote_tier(
  p_quote_id UUID,
  p_tier_id UUID,
  p_signer_name TEXT,
  p_signer_email TEXT DEFAULT NULL,
  p_signature_data TEXT DEFAULT '',
  p_ip_address TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_quote RECORD;
  v_tier RECORD;
  v_job_id UUID;
  v_invoice_id UUID;
  v_line RECORD;
  v_po_id UUID;
  v_display_id TEXT;
BEGIN
  -- Lock the quote row
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Quote not found');
  END IF;

  IF v_quote.status NOT IN ('sent', 'viewed', 'draft') THEN
    RETURN json_build_object('error', 'Quote is not in an acceptable state', 'status', v_quote.status::text);
  END IF;

  -- Verify tier belongs to quote
  SELECT * INTO v_tier FROM public.quote_tiers
  WHERE id = p_tier_id AND quote_id = p_quote_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Tier not found for this quote');
  END IF;

  -- ── A. Status Morph: Accept the quote ──────────────────────
  UPDATE public.quotes SET
    status = 'accepted',
    signed_at = now(),
    signed_by = p_signer_name,
    updated_at = now()
  WHERE id = p_quote_id;

  -- ── B. Tier Arbitration ────────────────────────────────────
  UPDATE public.quote_tiers SET
    status = 'accepted',
    accepted_at = now(),
    updated_at = now()
  WHERE id = p_tier_id;

  UPDATE public.quote_tiers SET
    status = 'rejected_by_choice',
    updated_at = now()
  WHERE quote_id = p_quote_id AND id != p_tier_id;

  -- ── C. Record Signature ────────────────────────────────────
  INSERT INTO public.proposal_signatures (
    quote_id, tier_id, signer_name, signer_email,
    signature_data, ip_address
  ) VALUES (
    p_quote_id, p_tier_id, p_signer_name, p_signer_email,
    p_signature_data, p_ip_address
  );

  -- ── D. Spawn Job ──────────────────────────────────────────
  -- Generate display_id
  SELECT 'JOB-' || LPAD((COALESCE(
    (SELECT COUNT(*) + 1 FROM public.jobs WHERE organization_id = v_quote.organization_id),
    1
  ))::text, 4, '0') INTO v_display_id;

  INSERT INTO public.jobs (
    organization_id, display_id, title, status,
    client_id, description,
    labels, metadata
  ) VALUES (
    v_quote.organization_id,
    v_display_id,
    COALESCE(v_quote.title, 'Job from ' || v_quote.display_id),
    'scheduled',
    v_quote.client_id,
    'Auto-generated from accepted proposal ' || v_quote.display_id ||
    ' (Tier: ' || v_tier.tier_name || ')',
    ARRAY['from_proposal'],
    jsonb_build_object(
      'source', 'proposal',
      'quote_id', v_quote.id,
      'tier_id', v_tier.id,
      'tier_name', v_tier.tier_name,
      'accepted_total', v_tier.total
    )
  )
  RETURNING id INTO v_job_id;

  -- Link job back to quote
  UPDATE public.quotes SET job_id = v_job_id WHERE id = p_quote_id;

  -- ── E. Draft Invoice ──────────────────────────────────────
  INSERT INTO public.invoices (
    organization_id,
    display_id,
    client_id, client_name, client_email, client_address,
    job_id, quote_id,
    status, issue_date, due_date,
    subtotal, tax_rate, tax, total,
    notes,
    metadata
  ) VALUES (
    v_quote.organization_id,
    'INV-' || LPAD((COALESCE(
      (SELECT COUNT(*) + 1 FROM public.invoices WHERE organization_id = v_quote.organization_id),
      1
    ))::text, 4, '0'),
    v_quote.client_id, v_quote.client_name, v_quote.client_email, v_quote.client_address,
    v_job_id, p_quote_id,
    'draft',
    CURRENT_DATE, CURRENT_DATE + 14,
    v_tier.subtotal, 0.10, v_tier.tax, v_tier.total,
    'Auto-generated from proposal ' || v_quote.display_id,
    jsonb_build_object('source', 'proposal', 'tier_name', v_tier.tier_name)
  )
  RETURNING id INTO v_invoice_id;

  -- ── F. Generate Purchase Orders for materials ──────────────
  FOR v_line IN
    SELECT * FROM public.quote_tier_lines
    WHERE tier_id = p_tier_id
      AND item_type IN ('material_supplier', 'material')
      AND is_included = true
      AND quantity > 0
  LOOP
    -- Create one PO per material line (simplified; in production, group by supplier)
    INSERT INTO public.purchase_orders (
      organization_id,
      display_id,
      supplier, supplier_name,
      status,
      source_quote_id, source_job_id,
      subtotal, tax, total,
      notes,
      metadata
    ) VALUES (
      v_quote.organization_id,
      'PO-' || LPAD((COALESCE(
        (SELECT COUNT(*) + 1 FROM public.purchase_orders WHERE organization_id = v_quote.organization_id),
        1
      ))::text, 4, '0'),
      'REECE', 'Auto-generated Supplier PO',
      'DRAFT',
      p_quote_id, v_job_id,
      v_line.quantity * v_line.unit_cost,
      ROUND(v_line.quantity * v_line.unit_cost * 0.10, 2),
      ROUND(v_line.quantity * v_line.unit_cost * 1.10, 2),
      'Auto-PO from proposal ' || v_quote.display_id || ': ' || v_line.description,
      jsonb_build_object('source', 'proposal', 'tier_line_id', v_line.id)
    )
    RETURNING id INTO v_po_id;

    INSERT INTO public.purchase_order_lines (
      purchase_order_id,
      name, description, quantity, unit_cost,
      line_total, sku
    ) VALUES (
      v_po_id,
      v_line.description,
      v_line.description,
      v_line.quantity,
      v_line.unit_cost,
      v_line.quantity * v_line.unit_cost,
      COALESCE(v_line.reference_id, '')
    );
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'job_id', v_job_id,
    'invoice_id', v_invoice_id,
    'tier_name', v_tier.tier_name,
    'total', v_tier.total,
    'signer', p_signer_name
  );
END;
$$;

-- ── 10. RPC: Recalculate Tier Totals ────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_tier_totals(p_tier_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_subtotal DECIMAL(12,2);
  v_tax DECIMAL(12,2);
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN is_included THEN quantity * unit_sell ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN is_included THEN quantity * unit_sell * tax_rate ELSE 0 END), 0)
  INTO v_subtotal, v_tax
  FROM public.quote_tier_lines
  WHERE tier_id = p_tier_id;

  UPDATE public.quote_tiers SET
    subtotal = v_subtotal,
    tax = ROUND(v_tax, 2),
    total = v_subtotal + ROUND(v_tax, 2),
    updated_at = now()
  WHERE id = p_tier_id;

  RETURN json_build_object(
    'subtotal', v_subtotal,
    'tax', ROUND(v_tax, 2),
    'total', v_subtotal + ROUND(v_tax, 2)
  );
END;
$$;

-- ── 11. RPC: Explode Kit into Tier Lines ────────────────────
CREATE OR REPLACE FUNCTION public.explode_kit_into_tier(
  p_tier_id UUID,
  p_kit_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_kit RECORD;
  v_comp RECORD;
  v_count INT := 0;
  v_max_sort INT;
BEGIN
  SELECT * INTO v_kit FROM public.trade_kits WHERE id = p_kit_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Kit not found');
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
  FROM public.quote_tier_lines WHERE tier_id = p_tier_id;

  FOR v_comp IN
    SELECT * FROM public.kit_components
    WHERE kit_id = p_kit_id
    ORDER BY sort_order
  LOOP
    v_max_sort := v_max_sort + 1;
    INSERT INTO public.quote_tier_lines (
      tier_id, kit_id, kit_name,
      description, item_type, quantity,
      unit_cost, unit_sell, tax_rate,
      is_optional_addon, is_included,
      sort_order, reference_id
    ) VALUES (
      p_tier_id, p_kit_id, v_kit.name,
      v_comp.label,
      COALESCE(v_comp.component_type, v_comp.item_type),
      v_comp.quantity,
      v_comp.unit_cost,
      v_comp.sell_price,
      0.10,
      v_comp.is_client_selectable,
      true,
      v_max_sort,
      v_comp.item_id::text
    );
    v_count := v_count + 1;
  END LOOP;

  -- Recalculate tier totals
  PERFORM public.recalculate_tier_totals(p_tier_id);

  RETURN json_build_object('success', true, 'lines_added', v_count, 'kit_name', v_kit.name);
END;
$$;

-- ── 12. RPC: Get Kit Margin Math ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_kit_margin_math(p_kit_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_kit RECORD;
  v_total_cost DECIMAL;
  v_total_sell DECIMAL;
  v_required_sell DECIMAL;
  v_actual_margin DECIMAL;
BEGIN
  SELECT * INTO v_kit FROM public.trade_kits WHERE id = p_kit_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Kit not found');
  END IF;

  SELECT
    COALESCE(SUM(quantity * unit_cost), 0),
    COALESCE(SUM(quantity * sell_price), 0)
  INTO v_total_cost, v_total_sell
  FROM public.kit_components
  WHERE kit_id = p_kit_id;

  -- Required sell for target margin
  IF v_kit.target_margin_pct IS NOT NULL AND v_kit.target_margin_pct < 1 THEN
    v_required_sell := ROUND(v_total_cost / (1 - v_kit.target_margin_pct), 2);
  ELSE
    v_required_sell := v_total_cost;
  END IF;

  -- Actual margin
  IF v_total_sell > 0 THEN
    v_actual_margin := ROUND(((v_total_sell - v_total_cost) / v_total_sell) * 100, 2);
  ELSE
    v_actual_margin := 0;
  END IF;

  -- Update kit with calculated values
  UPDATE public.trade_kits SET
    calculated_cost = v_total_cost,
    calculated_sell = v_total_sell,
    current_margin_pct = v_actual_margin,
    margin_warning = (v_actual_margin < COALESCE(v_kit.target_margin_pct * 100, 0)),
    updated_at = now()
  WHERE id = p_kit_id;

  RETURN json_build_object(
    'kit_id', p_kit_id,
    'kit_name', v_kit.name,
    'total_cost', v_total_cost,
    'total_sell', v_total_sell,
    'target_margin_pct', v_kit.target_margin_pct,
    'required_sell_for_target', v_required_sell,
    'actual_margin_pct', v_actual_margin,
    'margin_warning', (v_actual_margin < COALESCE(v_kit.target_margin_pct * 100, 0))
  );
END;
$$;

-- ── 13. Realtime for proposal acceptance ────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quote_tiers;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
