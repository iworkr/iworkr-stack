-- ============================================================
-- Migration 134: Project Hephaestus — CPQ, Seeded Kits & AI Supplier Sync
-- Native Configure-Price-Quote engine, trade seed catalog,
-- supplier invoice parsing, Moving Average Cost, margin cascade.
-- ============================================================

-- ── 0. Extension: pg_trgm for fuzzy matching ────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── 1. Enums ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.trade_category AS ENUM (
    'PLUMBING', 'ELECTRICAL', 'HVAC', 'LANDSCAPING',
    'CLEANING', 'PAINTING', 'CARPENTRY', 'ROOFING',
    'PEST_CONTROL', 'LOCKSMITH', 'GENERAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.seed_item_type AS ENUM ('MATERIAL', 'LABOR_PHASE', 'KIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_invoice_status AS ENUM (
    'PENDING_AI', 'NEEDS_REVIEW', 'SYNCED', 'FAILED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_line_match_status AS ENUM (
    'AUTO_MATCHED', 'FUZZY_MATCHED', 'NEEDS_MAPPING', 'CONFIRMED', 'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM (
    'DRAFT', 'PRESENTED', 'ACCEPTED', 'DECLINED', 'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Global Trade Seed Catalog (read-only master) ─────────
CREATE TABLE IF NOT EXISTS public.global_trade_seed (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_category  public.trade_category NOT NULL,
  type            public.seed_item_type NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  default_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_sell    NUMERIC(12,2) NOT NULL DEFAULT 0,
  sku             TEXT,
  unit            TEXT DEFAULT 'each',
  brand           TEXT,
  supplier_hint   TEXT,
  -- For KIT type items, contains the recipe
  kit_components  JSONB DEFAULT '[]',
  -- Metadata: images, specs, etc.
  metadata        JSONB DEFAULT '{}',
  sort_order      INT DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seed_trade_type
  ON public.global_trade_seed (trade_category, type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_seed_name_trgm
  ON public.global_trade_seed USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_seed_sku
  ON public.global_trade_seed (sku) WHERE sku IS NOT NULL;

-- Global seed is read-only for all authenticated users
ALTER TABLE public.global_trade_seed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global seed"
  ON public.global_trade_seed FOR SELECT
  USING (true);

-- Only service_role can insert/update (no user-facing write policies)

-- ── 3. Enhance inventory_items for Hephaestus ──────────────
-- Add MAC, sell_price, latest_cost, trade_category, barcode, etc.
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS moving_average_cost NUMERIC(12,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_cost         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sell_price          NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_category      TEXT,
  ADD COLUMN IF NOT EXISTS barcode             TEXT,
  ADD COLUMN IF NOT EXISTS brand               TEXT,
  ADD COLUMN IF NOT EXISTS unit                TEXT DEFAULT 'each',
  ADD COLUMN IF NOT EXISTS seed_origin_id      UUID REFERENCES public.global_trade_seed(id),
  ADD COLUMN IF NOT EXISTS supplier_code       TEXT,
  ADD COLUMN IF NOT EXISTS last_supplier_name  TEXT,
  ADD COLUMN IF NOT EXISTS cost_updated_at     TIMESTAMPTZ;

-- Migrate existing unit_cost -> moving_average_cost where not yet set
UPDATE public.inventory_items
SET moving_average_cost = unit_cost,
    latest_cost = unit_cost
WHERE moving_average_cost = 0 AND unit_cost > 0;

CREATE INDEX IF NOT EXISTS idx_inventory_sku_trgm
  ON public.inventory_items USING gin (sku gin_trgm_ops) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_name_trgm
  ON public.inventory_items USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode
  ON public.inventory_items (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_supplier_code
  ON public.inventory_items (organization_id, supplier_code) WHERE supplier_code IS NOT NULL;

-- ── 4. Trade Kits ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_kits (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  name                    TEXT NOT NULL,
  description             TEXT,
  trade_category          TEXT,
  -- Pricing
  fixed_sell_price        NUMERIC(12,2),
  target_margin_pct       NUMERIC(5,2) DEFAULT 40.00,
  calculated_cost         NUMERIC(12,2) DEFAULT 0,
  calculated_sell         NUMERIC(12,2) DEFAULT 0,
  -- Status flags
  margin_warning          BOOLEAN DEFAULT false,
  current_margin_pct      NUMERIC(5,2) DEFAULT 0,
  -- Display
  image_url               TEXT,
  customer_description    TEXT,
  estimated_duration_mins INT,
  -- Tiering
  tier_label              TEXT DEFAULT 'Standard',
  -- Tracking
  seed_origin_id          UUID,
  usage_count             INT DEFAULT 0,
  is_active               BOOLEAN DEFAULT true,
  archived_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kits_org
  ON public.trade_kits (organization_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kits_org_trade
  ON public.trade_kits (organization_id, trade_category) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_kits_name_trgm
  ON public.trade_kits USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kits_margin_warning
  ON public.trade_kits (organization_id) WHERE margin_warning = true AND archived_at IS NULL;

CREATE TRIGGER set_trade_kits_updated_at
  BEFORE UPDATE ON public.trade_kits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.trade_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org kits"
  ON public.trade_kits FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org kits"
  ON public.trade_kits FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 5. Kit Components (junction table) ──────────────────────
CREATE TABLE IF NOT EXISTS public.kit_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id          UUID NOT NULL REFERENCES public.trade_kits ON DELETE CASCADE,
  item_type       TEXT NOT NULL CHECK (item_type IN ('INVENTORY_ITEM', 'LABOR_RATE')),
  item_id         UUID,  -- FK to inventory_items if INVENTORY_ITEM
  label           TEXT,  -- Display name (or labor description)
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_cost       NUMERIC(12,2) DEFAULT 0,
  sell_price      NUMERIC(12,2) DEFAULT 0,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kit_components_kit
  ON public.kit_components (kit_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_kit_components_item
  ON public.kit_components (item_id) WHERE item_id IS NOT NULL;

ALTER TABLE public.kit_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kit component access follows kit access"
  ON public.kit_components FOR SELECT
  USING (kit_id IN (
    SELECT id FROM public.trade_kits
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

CREATE POLICY "Kit component manage follows kit access"
  ON public.kit_components FOR ALL
  USING (kit_id IN (
    SELECT id FROM public.trade_kits
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- ── 6. Supplier Invoices (AI Parsed) ────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  supplier_name     TEXT,
  invoice_number    TEXT,
  invoice_date      DATE,
  pdf_url           TEXT,
  pdf_storage_path  TEXT,
  -- AI extraction
  processing_status public.supplier_invoice_status NOT NULL DEFAULT 'PENDING_AI',
  ai_model_used     TEXT,
  ai_raw_response   JSONB,
  ai_confidence     NUMERIC(5,2),
  -- Financials
  subtotal_amount   NUMERIC(12,2),
  tax_amount        NUMERIC(12,2),
  total_amount      NUMERIC(12,2),
  -- Sanity check
  math_check_passed BOOLEAN,
  -- Linking
  xero_bill_id      TEXT,
  source_email      TEXT,
  source_email_subject TEXT,
  -- Review
  reviewed_by       UUID REFERENCES public.profiles,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  -- Tracking
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_org
  ON public.supplier_invoices (organization_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status
  ON public.supplier_invoices (processing_status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier
  ON public.supplier_invoices (organization_id, supplier_name);

CREATE TRIGGER set_supplier_invoices_updated_at
  BEFORE UPDATE ON public.supplier_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org supplier invoices"
  ON public.supplier_invoices FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org supplier invoices"
  ON public.supplier_invoices FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 7. Supplier Invoice Line Items ──────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_invoice_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES public.supplier_invoices ON DELETE CASCADE,
  -- From AI extraction
  raw_sku             TEXT,
  raw_description     TEXT,
  raw_quantity        NUMERIC(10,2),
  raw_unit_cost       NUMERIC(12,4),
  raw_total           NUMERIC(12,2),
  -- Matching
  match_status        public.invoice_line_match_status DEFAULT 'NEEDS_MAPPING',
  matched_inventory_id UUID REFERENCES public.inventory_items(id),
  match_confidence     NUMERIC(5,2),
  match_method         TEXT,  -- 'sku_exact', 'sku_fuzzy', 'description_fuzzy', 'manual'
  -- Cost variance
  previous_cost       NUMERIC(12,4),
  cost_variance_pct   NUMERIC(8,2),
  cost_anomaly        BOOLEAN DEFAULT false,
  -- Status
  synced_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice
  ON public.supplier_invoice_lines (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_match
  ON public.supplier_invoice_lines (match_status);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_inventory
  ON public.supplier_invoice_lines (matched_inventory_id) WHERE matched_inventory_id IS NOT NULL;

ALTER TABLE public.supplier_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supplier invoice line access follows invoice"
  ON public.supplier_invoice_lines FOR SELECT
  USING (invoice_id IN (
    SELECT id FROM public.supplier_invoices
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

CREATE POLICY "Supplier invoice line manage follows invoice"
  ON public.supplier_invoice_lines FOR ALL
  USING (invoice_id IN (
    SELECT id FROM public.supplier_invoices
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- ── 8. Proposals (Good/Better/Best) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  -- Linking
  client_id         UUID,
  job_id            UUID,
  quote_id          UUID,
  -- Status
  status            public.proposal_status NOT NULL DEFAULT 'DRAFT',
  -- Content
  title             TEXT NOT NULL DEFAULT 'Service Proposal',
  site_address      TEXT,
  notes             TEXT,
  customer_notes    TEXT,
  -- Options (JSONB array of tiers)
  options           JSONB NOT NULL DEFAULT '[]',
  -- Selected option
  selected_option   INT,
  selected_at       TIMESTAMPTZ,
  -- Signature
  signature_data    TEXT,
  signed_by_name    TEXT,
  signed_at         TIMESTAMPTZ,
  -- Created by
  created_by        UUID REFERENCES public.profiles,
  -- Tracking
  presented_at      TIMESTAMPTZ,
  expired_at        TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_org
  ON public.proposals (organization_id, status) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_client
  ON public.proposals (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_job
  ON public.proposals (job_id) WHERE job_id IS NOT NULL;

CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org proposals"
  ON public.proposals FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org proposals"
  ON public.proposals FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 9. Supplier Item Mappings (learning cache) ──────────────
CREATE TABLE IF NOT EXISTS public.supplier_item_mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  supplier_name     TEXT NOT NULL,
  supplier_sku      TEXT,
  supplier_desc     TEXT NOT NULL,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  confidence        NUMERIC(5,2) DEFAULT 100,
  created_at        TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, supplier_name, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_supplier_mappings_org
  ON public.supplier_item_mappings (organization_id, supplier_name);

ALTER TABLE public.supplier_item_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org supplier mappings"
  ON public.supplier_item_mappings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org supplier mappings"
  ON public.supplier_item_mappings FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 10. Storage bucket for supplier invoices ────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-invoices',
  'supplier-invoices',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ── 11. RPC: Clone Industry Seed into tenant ────────────────
CREATE OR REPLACE FUNCTION public.clone_industry_seed(
  p_org_id UUID,
  p_trade TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade public.trade_category;
  v_material_count INT := 0;
  v_kit_count INT := 0;
  v_labor_rate NUMERIC := 85.00;  -- Default hourly rate
  v_item_map JSONB := '{}';
  v_seed RECORD;
  v_new_item_id UUID;
  v_comp JSONB;
  v_new_kit_id UUID;
BEGIN
  -- Map trade string to enum
  v_trade := UPPER(COALESCE(p_trade, 'GENERAL'))::public.trade_category;

  -- Phase 1: Clone MATERIAL items
  FOR v_seed IN
    SELECT * FROM public.global_trade_seed
    WHERE trade_category = v_trade
      AND type = 'MATERIAL'
      AND is_active = true
    ORDER BY sort_order
  LOOP
    INSERT INTO public.inventory_items (
      organization_id, name, sku, category, unit_cost,
      moving_average_cost, latest_cost, sell_price,
      quantity, min_quantity, trade_category, brand, unit,
      seed_origin_id, metadata
    ) VALUES (
      p_org_id, v_seed.name, v_seed.sku, v_seed.trade_category::text,
      v_seed.default_cost,
      v_seed.default_cost, v_seed.default_cost, v_seed.default_sell,
      0, 5, v_seed.trade_category::text, v_seed.brand, v_seed.unit,
      v_seed.id, v_seed.metadata
    )
    RETURNING id INTO v_new_item_id;

    -- Track mapping: seed_id -> new_item_id
    v_item_map := v_item_map || jsonb_build_object(v_seed.id::text, v_new_item_id::text);
    v_material_count := v_material_count + 1;
  END LOOP;

  -- Phase 2: Clone KIT items and resolve component references
  FOR v_seed IN
    SELECT * FROM public.global_trade_seed
    WHERE trade_category = v_trade
      AND type = 'KIT'
      AND is_active = true
    ORDER BY sort_order
  LOOP
    INSERT INTO public.trade_kits (
      organization_id, name, description, trade_category,
      target_margin_pct, customer_description,
      estimated_duration_mins, seed_origin_id, image_url
    ) VALUES (
      p_org_id, v_seed.name, v_seed.description, v_seed.trade_category::text,
      40.00, COALESCE(v_seed.description, v_seed.name),
      (v_seed.metadata->>'duration_mins')::int,
      v_seed.id, v_seed.metadata->>'image_url'
    )
    RETURNING id INTO v_new_kit_id;

    -- Resolve components from kit_components JSONB
    FOR v_comp IN SELECT * FROM jsonb_array_elements(v_seed.kit_components)
    LOOP
      INSERT INTO public.kit_components (
        kit_id, item_type, item_id, label, quantity, unit_cost, sell_price, sort_order
      ) VALUES (
        v_new_kit_id,
        COALESCE(v_comp->>'type', 'INVENTORY_ITEM'),
        CASE
          WHEN v_comp->>'type' = 'LABOR_RATE' THEN NULL
          WHEN v_item_map ? (v_comp->>'seed_item_id')
            THEN (v_item_map->>(v_comp->>'seed_item_id'))::uuid
          ELSE NULL
        END,
        v_comp->>'label',
        COALESCE((v_comp->>'quantity')::numeric, 1),
        CASE
          WHEN v_comp->>'type' = 'LABOR_RATE' THEN v_labor_rate
          ELSE COALESCE((v_comp->>'cost')::numeric, 0)
        END,
        CASE
          WHEN v_comp->>'type' = 'LABOR_RATE' THEN v_labor_rate
          ELSE COALESCE((v_comp->>'sell')::numeric, 0)
        END,
        COALESCE((v_comp->>'sort_order')::int, 0)
      );
    END LOOP;

    v_kit_count := v_kit_count + 1;
  END LOOP;

  -- Phase 3: Recalculate all kit costs for this org
  PERFORM public.recalculate_all_kit_margins(p_org_id);

  RETURN json_build_object(
    'success', true,
    'materials_cloned', v_material_count,
    'kits_cloned', v_kit_count,
    'trade', v_trade
  );
END;
$$;

-- ── 12. RPC: Recalculate kit margins ────────────────────────
CREATE OR REPLACE FUNCTION public.recalculate_all_kit_margins(
  p_org_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kit RECORD;
  v_total_cost NUMERIC;
  v_calc_sell NUMERIC;
  v_margin NUMERIC;
  v_warning BOOLEAN;
BEGIN
  FOR v_kit IN
    SELECT k.id, k.target_margin_pct, k.fixed_sell_price
    FROM public.trade_kits k
    WHERE k.organization_id = p_org_id
      AND k.archived_at IS NULL
      AND k.is_active = true
  LOOP
    -- Sum component costs
    SELECT COALESCE(SUM(
      CASE
        WHEN kc.item_type = 'INVENTORY_ITEM' AND kc.item_id IS NOT NULL THEN
          kc.quantity * COALESCE(
            (SELECT i.moving_average_cost FROM public.inventory_items i WHERE i.id = kc.item_id),
            kc.unit_cost
          )
        ELSE
          kc.quantity * kc.unit_cost
      END
    ), 0) INTO v_total_cost
    FROM public.kit_components kc
    WHERE kc.kit_id = v_kit.id;

    -- Calculate sell price from margin target
    IF v_kit.target_margin_pct > 0 AND v_kit.target_margin_pct < 100 THEN
      v_calc_sell := ROUND(v_total_cost / (1 - v_kit.target_margin_pct / 100), 2);
    ELSE
      v_calc_sell := v_total_cost;
    END IF;

    -- Calculate actual margin
    IF v_kit.fixed_sell_price IS NOT NULL AND v_kit.fixed_sell_price > 0 THEN
      v_margin := ROUND(((v_kit.fixed_sell_price - v_total_cost) / v_kit.fixed_sell_price) * 100, 2);
      v_warning := v_margin < v_kit.target_margin_pct;
    ELSE
      v_margin := v_kit.target_margin_pct;
      v_warning := false;
    END IF;

    UPDATE public.trade_kits
    SET calculated_cost = v_total_cost,
        calculated_sell = v_calc_sell,
        current_margin_pct = v_margin,
        margin_warning = v_warning,
        updated_at = now()
    WHERE id = v_kit.id;
  END LOOP;
END;
$$;

-- ── 13. RPC: Update MAC on inventory receive ────────────────
CREATE OR REPLACE FUNCTION public.update_inventory_mac(
  p_item_id UUID,
  p_new_qty NUMERIC,
  p_new_cost NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_new_mac NUMERIC;
  v_new_stock INT;
  v_new_level TEXT;
BEGIN
  SELECT * INTO v_item FROM public.inventory_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Item not found');
  END IF;

  -- Moving Average Cost formula
  v_new_mac := ROUND(
    (
      (COALESCE(v_item.moving_average_cost, 0) * COALESCE(v_item.quantity, 0))
      + (p_new_cost * p_new_qty)
    ) / NULLIF(COALESCE(v_item.quantity, 0) + p_new_qty, 0),
    4
  );

  v_new_stock := COALESCE(v_item.quantity, 0) + p_new_qty::int;

  -- Calculate new stock level
  IF v_new_stock <= 0 THEN
    v_new_level := 'critical';
  ELSIF v_new_stock <= v_item.min_quantity THEN
    v_new_level := 'low';
  ELSE
    v_new_level := 'ok';
  END IF;

  UPDATE public.inventory_items
  SET moving_average_cost = v_new_mac,
      latest_cost = p_new_cost,
      unit_cost = v_new_mac,
      quantity = v_new_stock,
      stock_level = v_new_level::public.stock_level,
      cost_updated_at = now(),
      updated_at = now()
  WHERE id = p_item_id;

  RETURN json_build_object(
    'success', true,
    'previous_mac', v_item.moving_average_cost,
    'new_mac', v_new_mac,
    'previous_stock', v_item.quantity,
    'new_stock', v_new_stock,
    'latest_cost', p_new_cost
  );
END;
$$;

-- ── 14. RPC: Fuzzy match inventory item ─────────────────────
CREATE OR REPLACE FUNCTION public.fuzzy_match_inventory(
  p_org_id UUID,
  p_sku TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_supplier_name TEXT DEFAULT NULL,
  p_threshold NUMERIC DEFAULT 0.3
)
RETURNS TABLE (
  item_id UUID,
  item_name TEXT,
  item_sku TEXT,
  match_method TEXT,
  similarity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Priority 1: Check learned supplier mappings
  IF p_supplier_name IS NOT NULL AND p_sku IS NOT NULL THEN
    RETURN QUERY
    SELECT sm.inventory_item_id, i.name, i.sku, 'supplier_mapping'::text, sm.confidence
    FROM public.supplier_item_mappings sm
    JOIN public.inventory_items i ON i.id = sm.inventory_item_id
    WHERE sm.organization_id = p_org_id
      AND sm.supplier_name = p_supplier_name
      AND sm.supplier_sku = p_sku
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 2: Exact SKU match
  IF p_sku IS NOT NULL THEN
    RETURN QUERY
    SELECT i.id, i.name, i.sku, 'sku_exact'::text, 1.0::numeric
    FROM public.inventory_items i
    WHERE i.organization_id = p_org_id
      AND LOWER(i.sku) = LOWER(p_sku)
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    -- Priority 3: Fuzzy SKU match
    RETURN QUERY
    SELECT i.id, i.name, i.sku, 'sku_fuzzy'::text,
           ROUND(similarity(i.sku, p_sku)::numeric, 2)
    FROM public.inventory_items i
    WHERE i.organization_id = p_org_id
      AND i.sku IS NOT NULL
      AND similarity(i.sku, p_sku) > p_threshold
    ORDER BY similarity(i.sku, p_sku) DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Priority 4: Fuzzy description match
  IF p_description IS NOT NULL THEN
    RETURN QUERY
    SELECT i.id, i.name, i.sku, 'description_fuzzy'::text,
           ROUND(similarity(i.name, p_description)::numeric, 2)
    FROM public.inventory_items i
    WHERE i.organization_id = p_org_id
      AND similarity(i.name, p_description) > p_threshold
    ORDER BY similarity(i.name, p_description) DESC
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;

    -- Priority 5: Supplier code match
    RETURN QUERY
    SELECT i.id, i.name, i.sku, 'supplier_code'::text, 0.8::numeric
    FROM public.inventory_items i
    WHERE i.organization_id = p_org_id
      AND i.supplier_code IS NOT NULL
      AND i.supplier_code = p_sku
    LIMIT 1;
  END IF;

  RETURN;
END;
$$;

-- ── 15. Trigger: Cascade MAC change to kit margins ──────────
CREATE OR REPLACE FUNCTION public.cascade_inventory_cost_to_kits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when cost actually changed
  IF NEW.moving_average_cost IS DISTINCT FROM OLD.moving_average_cost THEN
    -- Find all kits containing this inventory item and recalculate
    PERFORM public.recalculate_all_kit_margins(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_inventory_cost_change ON public.inventory_items;
CREATE TRIGGER on_inventory_cost_change
  AFTER UPDATE OF moving_average_cost ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_inventory_cost_to_kits();

-- ── 16. RPC: Bulk price adjustment ──────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_price_adjustment(
  p_org_id UUID,
  p_category TEXT,
  p_adjustment_pct NUMERIC,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.inventory_items
  SET moving_average_cost = ROUND(moving_average_cost * (1 + p_adjustment_pct / 100), 4),
      latest_cost = ROUND(latest_cost * (1 + p_adjustment_pct / 100), 2),
      unit_cost = ROUND(unit_cost * (1 + p_adjustment_pct / 100), 2),
      sell_price = ROUND(sell_price * (1 + p_adjustment_pct / 100), 2),
      cost_updated_at = now(),
      updated_at = now()
  WHERE organization_id = p_org_id
    AND (category = p_category OR trade_category = p_category);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Cascade to kits
  PERFORM public.recalculate_all_kit_margins(p_org_id);

  -- Audit
  INSERT INTO public.audit_log (
    organization_id, user_id, action, entity_type, new_data
  ) VALUES (
    p_org_id, p_actor_id, 'inventory.bulk_price_adjustment', 'inventory_items',
    json_build_object(
      'category', p_category,
      'adjustment_pct', p_adjustment_pct,
      'items_affected', v_count
    )::jsonb
  );

  RETURN json_build_object(
    'success', true,
    'items_adjusted', v_count,
    'adjustment_pct', p_adjustment_pct,
    'category', p_category
  );
END;
$$;

-- ── 17. RPC: Win proposal (accept + spawn job) ──────────────
CREATE OR REPLACE FUNCTION public.win_proposal(
  p_proposal_id UUID,
  p_selected_option INT,
  p_signature_data TEXT DEFAULT NULL,
  p_signed_by TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proposal RECORD;
  v_option JSONB;
  v_job_id UUID;
BEGIN
  SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Proposal not found');
  END IF;

  -- Get the selected option
  v_option := v_proposal.options->p_selected_option;
  IF v_option IS NULL THEN
    RETURN json_build_object('error', 'Invalid option index');
  END IF;

  -- Update proposal
  UPDATE public.proposals
  SET status = 'ACCEPTED',
      selected_option = p_selected_option,
      selected_at = now(),
      signature_data = p_signature_data,
      signed_by_name = p_signed_by,
      signed_at = CASE WHEN p_signature_data IS NOT NULL THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_proposal_id;

  -- Create job from accepted proposal
  INSERT INTO public.jobs (
    organization_id, title, description, status, priority,
    client_id, revenue, metadata, created_by
  ) VALUES (
    v_proposal.organization_id,
    COALESCE(v_option->>'label', v_proposal.title),
    'Created from proposal acceptance',
    'todo',
    'medium',
    v_proposal.client_id,
    (v_option->>'total_price')::numeric,
    jsonb_build_object(
      'source', 'proposal',
      'proposal_id', p_proposal_id,
      'selected_option', p_selected_option,
      'kits', v_option->'kits'
    ),
    v_proposal.created_by
  )
  RETURNING id INTO v_job_id;

  -- Update proposal with job link
  UPDATE public.proposals SET job_id = v_job_id WHERE id = p_proposal_id;

  RETURN json_build_object(
    'success', true,
    'job_id', v_job_id,
    'proposal_id', p_proposal_id,
    'selected_option', p_selected_option,
    'total_price', v_option->>'total_price'
  );
END;
$$;

-- ── 18. Realtime for trade_kits and proposals ───────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trade_kits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_kits;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
  END IF;
END $$;
