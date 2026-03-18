-- ============================================================
-- Migration 136: Project Forge-Link — Supplier Catalog Sync & Live Pricing
-- B2B API credential vault, high-velocity catalog cache with pg_trgm,
-- margin protector quote extensions, purchase order automation.
-- ============================================================

-- ── 0. Extension: pg_trgm already exists from migration 134 ──
-- CREATE EXTENSION IF NOT EXISTS pg_trgm; (already installed)

-- ── 1. Enums ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.b2b_supplier AS ENUM (
    'REECE', 'TRADELINK', 'REXEL', 'MMEM', 'CNW',
    'MIDDYS', 'L_AND_H', 'SAMIOS', 'DERA', 'MASTERS_DERA',
    'BUNDABERG_PLUMBING', 'CUSTOM_SFTP', 'CUSTOM_API'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_sync_status AS ENUM (
    'ACTIVE', 'AUTH_FAILED', 'SYNCING', 'PAUSED', 'SETUP'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.purchase_order_status AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED',
    'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. The Credential Vault (workspace_suppliers) ───────────
CREATE TABLE IF NOT EXISTS public.workspace_suppliers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier            public.b2b_supplier NOT NULL,
  display_name        TEXT NOT NULL,
  account_number      TEXT,
  api_key_encrypted   TEXT,              -- Encrypted via Supabase Vault / app-level encryption
  api_endpoint        TEXT,              -- Custom endpoint for CUSTOM_API / CUSTOM_SFTP
  preferred_branch_id TEXT,              -- Supplier branch ID for stock checks
  preferred_branch    TEXT,              -- Human-readable branch name
  sync_status         public.supplier_sync_status DEFAULT 'SETUP',
  last_sync_at        TIMESTAMPTZ,
  last_sync_items     INT DEFAULT 0,
  last_sync_error     TEXT,
  pricing_tier        TEXT,              -- e.g. 'GOLD', 'PLATINUM', 'TRADE_STANDARD'
  contact_email       TEXT,
  contact_phone       TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, supplier)
);

ALTER TABLE public.workspace_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org suppliers"
  ON public.workspace_suppliers FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Admins can manage org suppliers"
  ON public.workspace_suppliers FOR ALL
  USING (
    (SELECT role FROM public.organization_members
     WHERE organization_id = workspace_suppliers.organization_id
       AND user_id = auth.uid()
       AND status = 'active'
    ) IN ('owner', 'admin', 'manager', 'office_admin')
  );

-- ── 3. The Massive Catalog Cache ────────────────────────────
-- Designed for millions of rows per workspace × supplier
CREATE TABLE IF NOT EXISTS public.supplier_catalog_cache (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  supplier          public.b2b_supplier NOT NULL,
  sku               TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  category          TEXT,
  subcategory       TEXT,
  brand             TEXT,
  trade_price       NUMERIC(12,2),       -- Negotiated cost to this workspace
  retail_price      NUMERIC(12,2),       -- RRP
  uom               TEXT DEFAULT 'EACH', -- Unit of Measure: EACH, ROLL, METER, BOX, PACK, PALLET
  pack_size         INT DEFAULT 1,
  barcode           TEXT,
  image_url         TEXT,
  is_active         BOOLEAN DEFAULT true,
  last_synced_at    TIMESTAMPTZ DEFAULT now(),
  metadata          JSONB DEFAULT '{}',
  UNIQUE(organization_id, supplier, sku)
);

ALTER TABLE public.supplier_catalog_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org catalog"
  ON public.supplier_catalog_cache FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "System can manage org catalog"
  ON public.supplier_catalog_cache FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 4. GIN Indexes for Sub-50ms pg_trgm Search ─────────────
-- These indexes are critical for mobile search performance
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_name_trgm
  ON public.supplier_catalog_cache
  USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_sku_trgm
  ON public.supplier_catalog_cache
  USING GIN (sku gin_trgm_ops);

-- Composite index for workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_org_supplier
  ON public.supplier_catalog_cache (organization_id, supplier);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_org_sku
  ON public.supplier_catalog_cache (organization_id, sku);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_org_category
  ON public.supplier_catalog_cache (organization_id, category);

-- ── 5. Quote Line Items Extensions for Margin Protector ─────
ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS is_supplier_linked    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_sku          TEXT,
  ADD COLUMN IF NOT EXISTS supplier_enum         TEXT,
  ADD COLUMN IF NOT EXISTS locked_cost_basis     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS live_cost             NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS target_margin         NUMERIC(5,4) DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS cost_delta            NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cost_delta_pct        NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS price_check_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS branch_stock          INT,
  ADD COLUMN IF NOT EXISTS dc_stock              INT,
  ADD COLUMN IF NOT EXISTS preferred_branch_id   TEXT;

-- ── 6. Purchase Orders ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  display_id          TEXT NOT NULL,          -- e.g. "PO-0001"
  supplier            public.b2b_supplier NOT NULL,
  supplier_name       TEXT NOT NULL,
  supplier_account    TEXT,
  status              public.purchase_order_status DEFAULT 'DRAFT',
  -- Source tracking
  source_quote_id     UUID REFERENCES public.quotes(id),
  source_job_id       UUID REFERENCES public.jobs(id),
  -- Delivery
  delivery_method     TEXT DEFAULT 'PICKUP', -- PICKUP, DELIVERY
  delivery_branch_id  TEXT,
  delivery_branch     TEXT,
  delivery_address    TEXT,
  delivery_notes      TEXT,
  -- Supplier response
  external_order_id   TEXT,                  -- Supplier's confirmation number
  external_status     TEXT,                  -- Supplier's order status string
  submitted_at        TIMESTAMPTZ,
  acknowledged_at     TIMESTAMPTZ,
  -- Financial
  subtotal            NUMERIC(12,2) DEFAULT 0,
  tax                 NUMERIC(12,2) DEFAULT 0,
  total               NUMERIC(12,2) DEFAULT 0,
  -- Audit
  created_by          UUID REFERENCES public.profiles(id),
  approved_by         UUID REFERENCES public.profiles(id),
  notes               TEXT,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org purchase orders"
  ON public.purchase_orders FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org purchase orders"
  ON public.purchase_orders FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 7. Purchase Order Line Items ────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  sku               TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  quantity          NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  uom               TEXT DEFAULT 'EACH',
  -- Linking
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  quote_line_id     UUID REFERENCES public.quote_line_items(id),
  -- Receiving
  quantity_received NUMERIC(10,2) DEFAULT 0,
  received_at       TIMESTAMPTZ,
  -- Metadata
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PO line access follows PO"
  ON public.purchase_order_lines FOR SELECT
  USING (purchase_order_id IN (
    SELECT id FROM public.purchase_orders
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

CREATE POLICY "PO line manage follows PO"
  ON public.purchase_order_lines FOR ALL
  USING (purchase_order_id IN (
    SELECT id FROM public.purchase_orders
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- ── 8. RPC: Trigram Supplier Catalog Search ─────────────────
CREATE OR REPLACE FUNCTION public.search_supplier_catalog(
  p_org_id UUID,
  p_query TEXT,
  p_supplier TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  supplier public.b2b_supplier,
  sku TEXT,
  name TEXT,
  description TEXT,
  category TEXT,
  brand TEXT,
  trade_price NUMERIC,
  retail_price NUMERIC,
  uom TEXT,
  pack_size INT,
  image_url TEXT,
  similarity REAL
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.supplier, c.sku, c.name, c.description,
    c.category, c.brand, c.trade_price, c.retail_price,
    c.uom, c.pack_size, c.image_url,
    GREATEST(
      similarity(c.name, p_query),
      similarity(c.sku, p_query)
    ) AS similarity
  FROM public.supplier_catalog_cache c
  WHERE c.organization_id = p_org_id
    AND c.is_active = true
    AND (p_supplier IS NULL OR c.supplier::text = p_supplier)
    AND (p_category IS NULL OR c.category = p_category)
    AND (
      c.name % p_query
      OR c.sku % p_query
      OR c.sku ILIKE p_query || '%'
    )
  ORDER BY similarity DESC, c.name ASC
  LIMIT p_limit;
END;
$$;

-- ── 9. RPC: Generate PO from accepted quote ─────────────────
CREATE OR REPLACE FUNCTION public.generate_purchase_orders_from_quote(
  p_quote_id UUID,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_quote RECORD;
  v_supplier RECORD;
  v_po_id UUID;
  v_po_display_id TEXT;
  v_po_count INT := 0;
  v_pos JSON[] := '{}';
  v_subtotal NUMERIC;
BEGIN
  -- Get the quote
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Quote not found');
  END IF;

  -- Iterate distinct suppliers in the quote line items
  FOR v_supplier IN
    SELECT DISTINCT ql.supplier_enum
    FROM public.quote_line_items ql
    WHERE ql.quote_id = p_quote_id
      AND ql.is_supplier_linked = true
      AND ql.supplier_enum IS NOT NULL
  LOOP
    -- Generate display ID
    SELECT 'PO-' || LPAD((COUNT(*) + 1)::TEXT, 4, '0') INTO v_po_display_id
    FROM public.purchase_orders
    WHERE organization_id = v_quote.organization_id;

    -- Create the PO
    INSERT INTO public.purchase_orders (
      organization_id, display_id, supplier, supplier_name, supplier_account,
      source_quote_id, created_by
    )
    SELECT
      v_quote.organization_id,
      v_po_display_id,
      v_supplier.supplier_enum::public.b2b_supplier,
      v_supplier.supplier_enum,
      ws.account_number
    FROM public.workspace_suppliers ws
    WHERE ws.organization_id = v_quote.organization_id
      AND ws.supplier::text = v_supplier.supplier_enum
    LIMIT 1
    RETURNING id INTO v_po_id;

    -- If no workspace_supplier match, create without account
    IF v_po_id IS NULL THEN
      INSERT INTO public.purchase_orders (
        organization_id, display_id, supplier, supplier_name,
        source_quote_id, created_by
      ) VALUES (
        v_quote.organization_id, v_po_display_id,
        v_supplier.supplier_enum::public.b2b_supplier,
        v_supplier.supplier_enum, p_quote_id, p_actor_id
      ) RETURNING id INTO v_po_id;
    END IF;

    -- Copy line items
    INSERT INTO public.purchase_order_lines (
      purchase_order_id, sku, name, description, quantity, unit_cost, line_total, quote_line_id
    )
    SELECT
      v_po_id,
      ql.supplier_sku,
      ql.description,
      ql.description,
      ql.quantity,
      COALESCE(ql.live_cost, ql.locked_cost_basis, ql.unit_price),
      ql.quantity * COALESCE(ql.live_cost, ql.locked_cost_basis, ql.unit_price),
      ql.id
    FROM public.quote_line_items ql
    WHERE ql.quote_id = p_quote_id
      AND ql.is_supplier_linked = true
      AND ql.supplier_enum = v_supplier.supplier_enum;

    -- Calculate totals
    SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
    FROM public.purchase_order_lines WHERE purchase_order_id = v_po_id;

    UPDATE public.purchase_orders SET
      subtotal = v_subtotal,
      tax = ROUND(v_subtotal * 0.10, 2),
      total = ROUND(v_subtotal * 1.10, 2),
      updated_at = now()
    WHERE id = v_po_id;

    v_po_count := v_po_count + 1;
    v_pos := v_pos || json_build_object('po_id', v_po_id, 'display_id', v_po_display_id, 'supplier', v_supplier.supplier_enum)::json;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'purchase_orders_created', v_po_count,
    'purchase_orders', to_json(v_pos)
  );
END;
$$;

-- ── 10. RPC: Margin Protector — Evaluate quote cost drift ───
CREATE OR REPLACE FUNCTION public.evaluate_quote_cost_drift(
  p_quote_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_drift NUMERIC := 0;
  v_items_drifted INT := 0;
  v_items_checked INT := 0;
  v_line RECORD;
BEGIN
  FOR v_line IN
    SELECT ql.id, ql.locked_cost_basis, ql.quantity,
           ql.unit_price, ql.target_margin,
           scc.trade_price AS current_cache_price
    FROM public.quote_line_items ql
    LEFT JOIN public.supplier_catalog_cache scc
      ON scc.sku = ql.supplier_sku
      AND scc.organization_id = (SELECT organization_id FROM public.quotes WHERE id = p_quote_id)
    WHERE ql.quote_id = p_quote_id
      AND ql.is_supplier_linked = true
  LOOP
    v_items_checked := v_items_checked + 1;

    IF v_line.current_cache_price IS NOT NULL
       AND v_line.locked_cost_basis IS NOT NULL
       AND v_line.current_cache_price <> v_line.locked_cost_basis THEN

      v_items_drifted := v_items_drifted + 1;
      v_total_drift := v_total_drift + (
        (v_line.current_cache_price - v_line.locked_cost_basis) * v_line.quantity
      );

      -- Update the live_cost and delta on the line item
      UPDATE public.quote_line_items SET
        live_cost = v_line.current_cache_price,
        cost_delta = v_line.current_cache_price - v_line.locked_cost_basis,
        cost_delta_pct = CASE WHEN v_line.locked_cost_basis > 0
          THEN ROUND(((v_line.current_cache_price - v_line.locked_cost_basis) / v_line.locked_cost_basis) * 100, 2)
          ELSE 0 END,
        price_check_at = now()
      WHERE id = v_line.id;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'items_checked', v_items_checked,
    'items_drifted', v_items_drifted,
    'total_cost_drift', ROUND(v_total_drift, 2),
    'evaluated_at', now()
  );
END;
$$;

-- ── 11. RPC: Accept new pricing on drifted quote ────────────
CREATE OR REPLACE FUNCTION public.accept_quote_new_pricing(
  p_quote_id UUID
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_line RECORD;
  v_updated INT := 0;
  v_new_subtotal NUMERIC := 0;
BEGIN
  FOR v_line IN
    SELECT id, live_cost, target_margin, quantity
    FROM public.quote_line_items
    WHERE quote_id = p_quote_id
      AND is_supplier_linked = true
      AND live_cost IS NOT NULL
      AND cost_delta IS NOT NULL
      AND cost_delta <> 0
  LOOP
    -- Recalculate sell price: live_cost / (1 - target_margin)
    UPDATE public.quote_line_items SET
      locked_cost_basis = v_line.live_cost,
      unit_price = ROUND(v_line.live_cost / NULLIF(1 - COALESCE(v_line.target_margin, 0.40), 0), 2),
      cost_delta = 0,
      cost_delta_pct = 0,
      price_check_at = now()
    WHERE id = v_line.id;

    v_updated := v_updated + 1;
  END LOOP;

  -- Recalculate quote totals
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_new_subtotal
  FROM public.quote_line_items
  WHERE quote_id = p_quote_id;

  UPDATE public.quotes SET
    subtotal = v_new_subtotal,
    tax = ROUND(v_new_subtotal * COALESCE(tax_rate, 10) / 100, 2),
    total = v_new_subtotal + ROUND(v_new_subtotal * COALESCE(tax_rate, 10) / 100, 2),
    updated_at = now()
  WHERE id = p_quote_id;

  RETURN json_build_object(
    'success', true,
    'lines_updated', v_updated,
    'new_subtotal', v_new_subtotal,
    'new_total', v_new_subtotal + ROUND(v_new_subtotal * 10 / 100, 2)
  );
END;
$$;

-- ── 12. Indexes for purchase orders ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_po_org ON public.purchase_orders (organization_id);
CREATE INDEX IF NOT EXISTS idx_po_quote ON public.purchase_orders (source_quote_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_po_lines_po ON public.purchase_order_lines (purchase_order_id);

-- ── 13. Realtime for purchase_orders ────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_suppliers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
