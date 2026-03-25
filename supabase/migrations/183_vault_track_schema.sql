-- ============================================================================
-- @migration VaultTrackSchema
-- @status COMPLETE
-- @description Project Vault-Track — Multi-location inventory ledger, immutable
--              transactions, van stock, stock transfers, concurrency-safe RPCs,
--              low-stock PO autonomy, financial bridge helpers.
-- @tables inventory_locations, inventory_levels, inventory_transactions,
--         van_stock, stock_transfers
-- @lastAudit 2026-03-24
-- ============================================================================

-- ── 1. Enums ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.inventory_location_type AS ENUM (
    'WAREHOUSE', 'VAN', 'SITE', 'OFFICE', 'CONTAINER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_transaction_type AS ENUM (
    'CONSUMED', 'RESTOCKED', 'TRANSFER_OUT', 'TRANSFER_IN',
    'AUDIT_ADJUSTMENT', 'RETURNED', 'WRITTEN_OFF', 'INITIAL'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_transfer_status AS ENUM (
    'pending', 'accepted', 'declined', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Inventory Locations (The Topology) ───────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  type                public.inventory_location_type NOT NULL DEFAULT 'WAREHOUSE',
  assigned_worker_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  address             TEXT,
  is_active           BOOLEAN DEFAULT true,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_locations_org
  ON public.inventory_locations (organization_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_inv_locations_worker
  ON public.inventory_locations (assigned_worker_id) WHERE assigned_worker_id IS NOT NULL;

CREATE TRIGGER set_inv_locations_updated_at
  BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org locations"
  ON public.inventory_locations FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org locations"
  ON public.inventory_locations FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 3. Inventory Levels (Current State — Junction Table) ────────
CREATE TABLE IF NOT EXISTS public.inventory_levels (
  item_id       UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES public.inventory_locations(id) ON DELETE CASCADE,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_audited_at TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (item_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_levels_location
  ON public.inventory_levels (location_id);
CREATE INDEX IF NOT EXISTS idx_inv_levels_low_stock
  ON public.inventory_levels (item_id) WHERE quantity <= 0;

CREATE TRIGGER set_inv_levels_updated_at
  BEFORE UPDATE ON public.inventory_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read inventory levels"
  ON public.inventory_levels FOR SELECT
  USING (location_id IN (
    SELECT id FROM public.inventory_locations
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

CREATE POLICY "Members can manage inventory levels"
  ON public.inventory_levels FOR ALL
  USING (location_id IN (
    SELECT id FROM public.inventory_locations
    WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- ── 4. Inventory Transactions (Immutable Ledger) ────────────────
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id           UUID NOT NULL REFERENCES public.inventory_items(id),
  location_id       UUID NOT NULL REFERENCES public.inventory_locations(id),
  job_id            UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  worker_id         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  transaction_type  public.inventory_transaction_type NOT NULL,
  quantity_change   NUMERIC(10,2) NOT NULL,
  unit_cost_at_time NUMERIC(12,4) NOT NULL DEFAULT 0,
  reference_id      UUID,
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_txn_org
  ON public.inventory_transactions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item
  ON public.inventory_transactions (item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_location
  ON public.inventory_transactions (location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_job
  ON public.inventory_transactions (job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_txn_type
  ON public.inventory_transactions (organization_id, transaction_type);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org transactions"
  ON public.inventory_transactions FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can insert org transactions"
  ON public.inventory_transactions FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 5. Van Stock (Per-Worker Inventory Tracking) ────────────────
CREATE TABLE IF NOT EXISTS public.van_stock (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id       UUID REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  quantity          INT NOT NULL DEFAULT 0,
  min_quantity      INT NOT NULL DEFAULT 2,
  last_restocked_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_van_stock_org ON public.van_stock (organization_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_user ON public.van_stock (user_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_item ON public.van_stock (inventory_item_id);

CREATE TRIGGER set_van_stock_updated_at
  BEFORE UPDATE ON public.van_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.van_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org van stock"
  ON public.van_stock FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage van stock"
  ON public.van_stock FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 6. Stock Transfers ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inventory_item_id   UUID NOT NULL REFERENCES public.inventory_items(id),
  from_user_id        UUID REFERENCES auth.users(id),
  to_user_id          UUID NOT NULL REFERENCES auth.users(id),
  from_location_id    UUID REFERENCES public.inventory_locations(id),
  to_location_id      UUID REFERENCES public.inventory_locations(id),
  quantity            INT NOT NULL DEFAULT 1,
  status              public.stock_transfer_status DEFAULT 'pending',
  notes               TEXT,
  from_location       TEXT,
  to_location         TEXT,
  requested_at        TIMESTAMPTZ DEFAULT now(),
  responded_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_org
  ON public.stock_transfers (organization_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from
  ON public.stock_transfers (from_user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to
  ON public.stock_transfers (to_user_id) WHERE status = 'pending';

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read org transfers"
  ON public.stock_transfers FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "Members can manage org transfers"
  ON public.stock_transfers FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 7. Enhance inventory_items for Vault-Track ──────────────────
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS default_markup_percent NUMERIC(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES public.workspace_suppliers(id),
  ADD COLUMN IF NOT EXISTS par_level INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ── 8. RPC: Consume Inventory V2 (Concurrency-Safe) ────────────
-- Uses SELECT ... FOR UPDATE to prevent phantom stock / lost updates.
-- Supports multi-location, decimal quantities, and immutable ledger.
CREATE OR REPLACE FUNCTION public.consume_inventory_v2(
  p_item_id UUID,
  p_location_id UUID,
  p_job_id UUID DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL,
  p_qty NUMERIC DEFAULT 1,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_qty NUMERIC;
  v_new_qty NUMERIC;
  v_item RECORD;
  v_org_id UUID;
  v_txn_id UUID;
  v_worker_name TEXT;
  v_negative_stock BOOLEAN := false;
BEGIN
  -- 1. Get item details (cost snapshot)
  SELECT id, organization_id, name, unit_cost, moving_average_cost,
         latest_cost, default_markup_percent, sell_price
  INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Inventory item not found', 'success', false);
  END IF;

  v_org_id := v_item.organization_id;

  -- 2. Lock the specific row — prevents race conditions
  SELECT quantity INTO v_current_qty
  FROM public.inventory_levels
  WHERE item_id = p_item_id AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create the level row if it doesn't exist
    INSERT INTO public.inventory_levels (item_id, location_id, quantity)
    VALUES (p_item_id, p_location_id, 0)
    ON CONFLICT (item_id, location_id) DO NOTHING;
    v_current_qty := 0;
  END IF;

  -- 3. Calculate new quantity (allow negative — flag it)
  v_new_qty := v_current_qty - p_qty;
  v_negative_stock := v_new_qty < 0;

  -- 4. Update the cached quantity
  UPDATE public.inventory_levels
  SET quantity = v_new_qty,
      last_audited_at = now()
  WHERE item_id = p_item_id AND location_id = p_location_id;

  -- 5. Get worker name for audit trail
  IF p_worker_id IS NOT NULL THEN
    SELECT full_name INTO v_worker_name
    FROM public.profiles WHERE id = p_worker_id;
  END IF;

  -- 6. Insert immutable transaction record
  INSERT INTO public.inventory_transactions (
    organization_id, item_id, location_id, job_id, worker_id,
    transaction_type, quantity_change, unit_cost_at_time, notes, metadata
  ) VALUES (
    v_org_id, p_item_id, p_location_id, p_job_id, p_worker_id,
    'CONSUMED', -p_qty,
    COALESCE(v_item.latest_cost, v_item.moving_average_cost, v_item.unit_cost, 0),
    COALESCE(p_notes, 'Consumed ' || p_qty || 'x ' || v_item.name),
    json_build_object(
      'previous_qty', v_current_qty,
      'new_qty', v_new_qty,
      'worker_name', v_worker_name,
      'negative_stock', v_negative_stock
    )::jsonb
  )
  RETURNING id INTO v_txn_id;

  -- 7. Update legacy inventory_items.quantity for backward compatibility
  UPDATE public.inventory_items
  SET quantity = GREATEST(0, quantity - p_qty::int),
      stock_level = CASE
        WHEN quantity - p_qty::int <= 0 THEN 'critical'::public.stock_level
        WHEN quantity - p_qty::int <= min_quantity THEN 'low'::public.stock_level
        ELSE 'ok'::public.stock_level
      END,
      updated_at = now()
  WHERE id = p_item_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'item_name', v_item.name,
    'previous_qty', v_current_qty,
    'new_qty', v_new_qty,
    'negative_stock', v_negative_stock,
    'unit_cost', COALESCE(v_item.latest_cost, v_item.unit_cost, 0),
    'sell_price', COALESCE(v_item.sell_price, 0),
    'markup_percent', COALESCE(v_item.default_markup_percent, 20)
  );
END;
$$;

-- ── 9. RPC: Restock Inventory ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.restock_inventory(
  p_item_id UUID,
  p_location_id UUID,
  p_qty NUMERIC,
  p_worker_id UUID DEFAULT NULL,
  p_unit_cost NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_org_id UUID;
  v_new_qty NUMERIC;
  v_txn_id UUID;
BEGIN
  SELECT id, organization_id, name, unit_cost
  INTO v_item FROM public.inventory_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Item not found', 'success', false);
  END IF;

  v_org_id := v_item.organization_id;

  -- Upsert inventory level
  INSERT INTO public.inventory_levels (item_id, location_id, quantity)
  VALUES (p_item_id, p_location_id, p_qty)
  ON CONFLICT (item_id, location_id)
  DO UPDATE SET quantity = public.inventory_levels.quantity + p_qty,
                last_audited_at = now();

  SELECT quantity INTO v_new_qty
  FROM public.inventory_levels
  WHERE item_id = p_item_id AND location_id = p_location_id;

  -- Immutable ledger entry
  INSERT INTO public.inventory_transactions (
    organization_id, item_id, location_id, worker_id,
    transaction_type, quantity_change, unit_cost_at_time, notes
  ) VALUES (
    v_org_id, p_item_id, p_location_id, p_worker_id,
    'RESTOCKED', p_qty,
    COALESCE(p_unit_cost, v_item.unit_cost, 0),
    COALESCE(p_notes, 'Restocked ' || p_qty || 'x ' || v_item.name)
  )
  RETURNING id INTO v_txn_id;

  -- Update legacy quantity
  UPDATE public.inventory_items
  SET quantity = quantity + p_qty::int,
      stock_level = CASE
        WHEN quantity + p_qty::int <= 0 THEN 'critical'::public.stock_level
        WHEN quantity + p_qty::int <= min_quantity THEN 'low'::public.stock_level
        ELSE 'ok'::public.stock_level
      END,
      updated_at = now()
  WHERE id = p_item_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'new_qty', v_new_qty
  );
END;
$$;

-- ── 10. RPC: Transfer Inventory Between Locations ───────────────
CREATE OR REPLACE FUNCTION public.transfer_inventory(
  p_item_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_qty NUMERIC,
  p_worker_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_org_id UUID;
  v_from_qty NUMERIC;
  v_to_qty NUMERIC;
BEGIN
  SELECT id, organization_id, name, unit_cost
  INTO v_item FROM public.inventory_items WHERE id = p_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Item not found', 'success', false);
  END IF;

  v_org_id := v_item.organization_id;

  -- Lock source row
  SELECT quantity INTO v_from_qty
  FROM public.inventory_levels
  WHERE item_id = p_item_id AND location_id = p_from_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No stock at source location', 'success', false);
  END IF;

  IF v_from_qty < p_qty THEN
    RETURN json_build_object(
      'error', 'Insufficient stock at source (' || v_from_qty || ' available, ' || p_qty || ' requested)',
      'success', false
    );
  END IF;

  -- Decrement source
  UPDATE public.inventory_levels
  SET quantity = quantity - p_qty, last_audited_at = now()
  WHERE item_id = p_item_id AND location_id = p_from_location_id;

  -- Increment destination (upsert)
  INSERT INTO public.inventory_levels (item_id, location_id, quantity)
  VALUES (p_item_id, p_to_location_id, p_qty)
  ON CONFLICT (item_id, location_id)
  DO UPDATE SET quantity = public.inventory_levels.quantity + p_qty,
                last_audited_at = now();

  SELECT quantity INTO v_to_qty
  FROM public.inventory_levels
  WHERE item_id = p_item_id AND location_id = p_to_location_id;

  -- Immutable ledger: two entries (out + in)
  INSERT INTO public.inventory_transactions (
    organization_id, item_id, location_id, worker_id,
    transaction_type, quantity_change, unit_cost_at_time,
    reference_id, notes
  ) VALUES
  (v_org_id, p_item_id, p_from_location_id, p_worker_id,
   'TRANSFER_OUT', -p_qty, COALESCE(v_item.unit_cost, 0),
   p_to_location_id,
   COALESCE(p_notes, 'Transferred ' || p_qty || 'x ' || v_item.name || ' out')),
  (v_org_id, p_item_id, p_to_location_id, p_worker_id,
   'TRANSFER_IN', p_qty, COALESCE(v_item.unit_cost, 0),
   p_from_location_id,
   COALESCE(p_notes, 'Transferred ' || p_qty || 'x ' || v_item.name || ' in'));

  RETURN json_build_object(
    'success', true,
    'from_new_qty', v_from_qty - p_qty,
    'to_new_qty', v_to_qty
  );
END;
$$;

-- ── 11. RPC: Process Material Cart (Batch Consumption) ──────────
-- Called by the Edge Function when a worker completes a job.
CREATE OR REPLACE FUNCTION public.process_material_cart(
  p_organization_id UUID,
  p_job_id UUID,
  p_worker_id UUID,
  p_location_id UUID,
  p_items JSONB -- Array: [{"item_id": "uuid", "qty": 2.5}, ...]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item JSONB;
  v_result JSON;
  v_results JSON[] := '{}';
  v_total_cost NUMERIC := 0;
  v_total_sell NUMERIC := 0;
  v_item_count INT := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_result := public.consume_inventory_v2(
      p_item_id := (v_item->>'item_id')::UUID,
      p_location_id := p_location_id,
      p_job_id := p_job_id,
      p_worker_id := p_worker_id,
      p_qty := (v_item->>'qty')::NUMERIC,
      p_notes := v_item->>'notes'
    );

    v_results := v_results || v_result;
    v_item_count := v_item_count + 1;

    IF (v_result->>'success')::BOOLEAN THEN
      v_total_cost := v_total_cost + (
        (v_result->>'unit_cost')::NUMERIC * (v_item->>'qty')::NUMERIC
      );
      v_total_sell := v_total_sell + (
        (v_result->>'unit_cost')::NUMERIC *
        (1 + ((v_result->>'markup_percent')::NUMERIC / 100)) *
        (v_item->>'qty')::NUMERIC
      );
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'items_processed', v_item_count,
    'total_cost', ROUND(v_total_cost, 2),
    'total_sell', ROUND(v_total_sell, 2),
    'margin', ROUND(v_total_sell - v_total_cost, 2),
    'results', to_json(v_results)
  );
END;
$$;

-- ── 12. RPC: Get Inventory Dashboard ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_inventory_dashboard(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_items', (
      SELECT count(*) FROM public.inventory_items
      WHERE organization_id = p_org_id
    ),
    'total_locations', (
      SELECT count(*) FROM public.inventory_locations
      WHERE organization_id = p_org_id AND is_active
    ),
    'total_value', (
      SELECT COALESCE(SUM(il.quantity * COALESCE(ii.latest_cost, ii.unit_cost, 0)), 0)
      FROM public.inventory_levels il
      JOIN public.inventory_items ii ON ii.id = il.item_id
      JOIN public.inventory_locations loc ON loc.id = il.location_id
      WHERE loc.organization_id = p_org_id
    ),
    'low_stock_count', (
      SELECT count(DISTINCT il.item_id)
      FROM public.inventory_levels il
      JOIN public.inventory_items ii ON ii.id = il.item_id
      JOIN public.inventory_locations loc ON loc.id = il.location_id
      WHERE loc.organization_id = p_org_id
        AND il.quantity <= ii.min_quantity
        AND il.quantity > 0
    ),
    'critical_stock_count', (
      SELECT count(DISTINCT il.item_id)
      FROM public.inventory_levels il
      JOIN public.inventory_items ii ON ii.id = il.item_id
      JOIN public.inventory_locations loc ON loc.id = il.location_id
      WHERE loc.organization_id = p_org_id
        AND il.quantity <= 0
    ),
    'recent_transactions', (
      SELECT COALESCE(json_agg(t ORDER BY t.created_at DESC), '[]')
      FROM (
        SELECT it.id, it.transaction_type::text, it.quantity_change,
               it.created_at, ii.name AS item_name, il.name AS location_name
        FROM public.inventory_transactions it
        JOIN public.inventory_items ii ON ii.id = it.item_id
        JOIN public.inventory_locations il ON il.id = it.location_id
        WHERE it.organization_id = p_org_id
        ORDER BY it.created_at DESC
        LIMIT 20
      ) t
    ),
    'locations', (
      SELECT COALESCE(json_agg(l), '[]')
      FROM (
        SELECT loc.id, loc.name, loc.type::text,
               count(il.item_id) AS item_count,
               COALESCE(SUM(il.quantity), 0) AS total_units
        FROM public.inventory_locations loc
        LEFT JOIN public.inventory_levels il ON il.location_id = loc.id
        WHERE loc.organization_id = p_org_id AND loc.is_active
        GROUP BY loc.id, loc.name, loc.type
        ORDER BY loc.name
      ) l
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ── 13. RPC: Generate Low-Stock Purchase Order ──────────────────
CREATE OR REPLACE FUNCTION public.generate_low_stock_po(
  p_org_id UUID,
  p_item_id UUID,
  p_location_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item RECORD;
  v_supplier RECORD;
  v_po_id UUID;
  v_po_display_id TEXT;
  v_order_qty INT;
  v_existing_po_id UUID;
BEGIN
  -- Get item with supplier info
  SELECT ii.*, ws.id AS ws_id, ws.supplier, ws.display_name AS supplier_display_name,
         ws.account_number AS supplier_account
  INTO v_item
  FROM public.inventory_items ii
  LEFT JOIN public.workspace_suppliers ws ON ws.id = ii.preferred_supplier_id
  WHERE ii.id = p_item_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Item not found', 'success', false);
  END IF;

  -- Calculate order quantity to reach par level
  v_order_qty := GREATEST(
    COALESCE(v_item.par_level, v_item.max_quantity, 10) -
    COALESCE((SELECT quantity FROM public.inventory_levels
              WHERE item_id = p_item_id AND location_id = p_location_id), 0)::INT,
    v_item.min_quantity
  );

  IF v_item.ws_id IS NOT NULL AND v_item.supplier IS NOT NULL THEN
    -- Check for existing DRAFT PO for this supplier
    SELECT id INTO v_existing_po_id
    FROM public.purchase_orders
    WHERE organization_id = p_org_id
      AND supplier = v_item.supplier
      AND status = 'DRAFT'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_po_id IS NOT NULL THEN
      -- Append to existing PO (idempotent: skip if line exists)
      INSERT INTO public.purchase_order_lines (
        purchase_order_id, sku, name, quantity, unit_cost, line_total,
        inventory_item_id
      )
      SELECT v_existing_po_id, COALESCE(v_item.sku, 'N/A'), v_item.name,
             v_order_qty, COALESCE(v_item.latest_cost, v_item.unit_cost, 0),
             v_order_qty * COALESCE(v_item.latest_cost, v_item.unit_cost, 0),
             v_item.id
      WHERE NOT EXISTS (
        SELECT 1 FROM public.purchase_order_lines
        WHERE purchase_order_id = v_existing_po_id
          AND inventory_item_id = v_item.id
      );

      -- Recalculate PO totals
      UPDATE public.purchase_orders SET
        subtotal = (SELECT COALESCE(SUM(line_total), 0) FROM public.purchase_order_lines WHERE purchase_order_id = v_existing_po_id),
        tax = ROUND((SELECT COALESCE(SUM(line_total), 0) FROM public.purchase_order_lines WHERE purchase_order_id = v_existing_po_id) * 0.10, 2),
        total = ROUND((SELECT COALESCE(SUM(line_total), 0) FROM public.purchase_order_lines WHERE purchase_order_id = v_existing_po_id) * 1.10, 2),
        updated_at = now()
      WHERE id = v_existing_po_id;

      RETURN json_build_object(
        'success', true,
        'action', 'appended',
        'po_id', v_existing_po_id,
        'item_name', v_item.name,
        'order_qty', v_order_qty
      );
    END IF;

    -- Create new PO
    SELECT 'PO-' || LPAD((COUNT(*) + 1)::TEXT, 4, '0') INTO v_po_display_id
    FROM public.purchase_orders WHERE organization_id = p_org_id;

    INSERT INTO public.purchase_orders (
      organization_id, display_id, supplier, supplier_name,
      supplier_account, status, notes
    ) VALUES (
      p_org_id, v_po_display_id, v_item.supplier,
      v_item.supplier_display_name,
      v_item.supplier_account, 'DRAFT',
      'Auto-generated by Vault-Track low-stock monitor'
    )
    RETURNING id INTO v_po_id;

    INSERT INTO public.purchase_order_lines (
      purchase_order_id, sku, name, quantity, unit_cost, line_total,
      inventory_item_id
    ) VALUES (
      v_po_id, COALESCE(v_item.sku, 'N/A'), v_item.name,
      v_order_qty, COALESCE(v_item.latest_cost, v_item.unit_cost, 0),
      v_order_qty * COALESCE(v_item.latest_cost, v_item.unit_cost, 0),
      v_item.id
    );

    UPDATE public.purchase_orders SET
      subtotal = v_order_qty * COALESCE(v_item.latest_cost, v_item.unit_cost, 0),
      tax = ROUND(v_order_qty * COALESCE(v_item.latest_cost, v_item.unit_cost, 0) * 0.10, 2),
      total = ROUND(v_order_qty * COALESCE(v_item.latest_cost, v_item.unit_cost, 0) * 1.10, 2)
    WHERE id = v_po_id;

    RETURN json_build_object(
      'success', true,
      'action', 'created',
      'po_id', v_po_id,
      'display_id', v_po_display_id,
      'item_name', v_item.name,
      'order_qty', v_order_qty,
      'supplier', v_item.supplier_display_name
    );
  END IF;

  -- No supplier linked
  RETURN json_build_object(
    'success', false,
    'error', 'No preferred supplier linked to item',
    'item_name', v_item.name
  );
END;
$$;

-- ── 14. Trigger: Low Stock Monitor on inventory_levels ──────────
-- Fires when quantity drops below min_stock_level, creates PO draft
-- and inserts notification for office admins.
CREATE OR REPLACE FUNCTION public.vault_track_low_stock_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_location RECORD;
  v_po_result JSON;
BEGIN
  -- Get the item and its min threshold
  SELECT * INTO v_item FROM public.inventory_items WHERE id = NEW.item_id;
  SELECT * INTO v_location FROM public.inventory_locations WHERE id = NEW.location_id;

  IF NOT FOUND OR v_item IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only fire when crossing below the threshold
  IF NEW.quantity <= v_item.min_quantity
     AND (OLD.quantity > v_item.min_quantity OR OLD.quantity IS NULL)
  THEN
    -- Attempt to auto-generate a PO
    v_po_result := public.generate_low_stock_po(
      v_item.organization_id, NEW.item_id, NEW.location_id
    );

    -- Notify office admins
    INSERT INTO public.notifications (user_id, type, title, body, metadata)
    SELECT
      om.user_id,
      'system',
      'Low Stock Alert — ' || COALESCE(v_location.name, 'Unknown'),
      v_item.name || ' is below reorder point (' || NEW.quantity || ' remaining at ' ||
      COALESCE(v_location.name, 'location') || '). ' ||
      CASE WHEN (v_po_result->>'success')::BOOLEAN
        THEN 'A draft PO has been ' || (v_po_result->>'action') || '.'
        ELSE 'No supplier linked — manual reorder required.'
      END,
      json_build_object(
        'inventory_id', NEW.item_id,
        'location_id', NEW.location_id,
        'item_name', v_item.name,
        'location_name', v_location.name,
        'quantity', NEW.quantity,
        'min_quantity', v_item.min_quantity,
        'po_result', v_po_result
      )::jsonb
    FROM public.organization_members om
    WHERE om.organization_id = v_item.organization_id
      AND om.role IN ('owner', 'admin', 'office_admin', 'manager');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS vault_track_low_stock ON public.inventory_levels;
CREATE TRIGGER vault_track_low_stock
  AFTER UPDATE ON public.inventory_levels
  FOR EACH ROW
  EXECUTE FUNCTION public.vault_track_low_stock_trigger();

-- ── 15. RPC: Barcode Lookup (Optimized for Mobile) ──────────────
CREATE OR REPLACE FUNCTION public.barcode_lookup(
  p_org_id UUID,
  p_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Check inventory_items by barcode, sku, or supplier_code
  SELECT json_build_object(
    'found', true,
    'type', 'inventory',
    'id', ii.id,
    'name', ii.name,
    'sku', ii.sku,
    'barcode', ii.barcode,
    'category', ii.category,
    'unit_cost', COALESCE(ii.latest_cost, ii.unit_cost, 0),
    'sell_price', COALESCE(ii.sell_price, 0),
    'markup_percent', COALESCE(ii.default_markup_percent, 20),
    'billing_type', COALESCE(ii.billing_type, 'FIXED'),
    'unit', COALESCE(ii.unit, 'each'),
    'quantity', ii.quantity,
    'stock_level', ii.stock_level::text,
    'brand', ii.brand
  ) INTO v_result
  FROM public.inventory_items ii
  WHERE ii.organization_id = p_org_id
    AND (ii.barcode = p_code OR ii.sku = p_code OR ii.supplier_code = p_code)
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- Check supplier catalog
  SELECT json_build_object(
    'found', true,
    'type', 'catalog',
    'id', scc.id,
    'name', scc.name,
    'sku', scc.sku,
    'barcode', scc.barcode,
    'category', scc.category,
    'unit_cost', COALESCE(scc.trade_price, 0),
    'sell_price', COALESCE(scc.retail_price, 0),
    'markup_percent', 20,
    'billing_type', 'FIXED',
    'unit', COALESCE(scc.uom, 'each'),
    'brand', scc.brand,
    'supplier', scc.supplier::text,
    'image_url', scc.image_url
  ) INTO v_result
  FROM public.supplier_catalog_cache scc
  WHERE scc.organization_id = p_org_id
    AND (scc.barcode = p_code OR scc.sku = p_code)
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  RETURN json_build_object('found', false, 'code', p_code);
END;
$$;

-- ── 16. Realtime for new tables ─────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_levels;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.van_stock;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_transfers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
