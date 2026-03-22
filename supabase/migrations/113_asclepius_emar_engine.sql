-- ============================================================================
-- @migration AsclepiusEMAREngine
-- @status COMPLETE
-- @description Project Asclepius — S8 drugs, PRN rules, Webster-pak, clinical PINs, pharmacy
-- @tables s8_register, prn_protocols, webster_pak_inventory, staff_profiles (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Clinical PINs & Employee IDs on staff_profiles ────────────
ALTER TABLE public.staff_profiles
  ADD COLUMN IF NOT EXISTS employee_id text,
  ADD COLUMN IF NOT EXISTS clinical_pin_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_employee_id_org
  ON public.staff_profiles(organization_id, employee_id)
  WHERE employee_id IS NOT NULL;

-- ── 2. Expand participant_medications for S8, PRN rules, Webster ─
ALTER TABLE public.participant_medications
  ADD COLUMN IF NOT EXISTS is_s8_controlled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pack_type text DEFAULT 'loose_box'
    CHECK (pack_type IN ('webster_pak', 'loose_box', 'bottle')),
  ADD COLUMN IF NOT EXISTS prn_min_gap_hours integer,
  ADD COLUMN IF NOT EXISTS prn_max_doses_24h integer,
  ADD COLUMN IF NOT EXISTS form text DEFAULT 'tablet'
    CHECK (form IN ('tablet', 'capsule', 'liquid', 'patch', 'injection', 'inhaler', 'cream', 'drops', 'suppository', 'other'));

-- ── 3. Expand medication_administration_records for S8 dual-sign ─
ALTER TABLE public.medication_administration_records
  ADD COLUMN IF NOT EXISTS stock_count_before numeric(10,2),
  ADD COLUMN IF NOT EXISTS stock_count_after numeric(10,2),
  ADD COLUMN IF NOT EXISTS prn_efficacy_status text
    CHECK (prn_efficacy_status IN ('pending', 'no_improvement', 'partial', 'complete')),
  ADD COLUMN IF NOT EXISTS prn_efficacy_logged_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_s8_administration boolean DEFAULT false;

-- ── 4. Medication Inventory Ledger (The Pill Count) ──────────────
CREATE TABLE IF NOT EXISTS public.medication_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES public.participant_medications(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,

  current_stock_count numeric(10,2) NOT NULL DEFAULT 0.00,
  daily_consumption_rate numeric(10,2) NOT NULL DEFAULT 1.00,
  reorder_threshold_days integer NOT NULL DEFAULT 3,

  linked_pharmacy_name text,
  linked_pharmacy_email text,
  linked_pharmacy_fax text,

  last_restocked_at timestamptz,
  last_reorder_sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(medication_id)
);

ALTER TABLE public.medication_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view medication inventory"
  ON public.medication_inventory FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = medication_inventory.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Admins can manage medication inventory"
  ON public.medication_inventory FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = medication_inventory.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = medication_inventory.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- Workers can update stock counts (on administration)
CREATE POLICY "Workers can update inventory on admin"
  ON public.medication_inventory FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = medication_inventory.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = medication_inventory.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

-- ── 5. Pharmacy Reorder Requests ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pharmacy_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  medication_ids uuid[] NOT NULL DEFAULT '{}',

  pharmacy_name text NOT NULL,
  pharmacy_contact text,

  status text NOT NULL DEFAULT 'transmitted'
    CHECK (status IN ('transmitted', 'acknowledged', 'ready_for_pickup', 'received', 'cancelled')),

  transmitted_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  received_at timestamptz,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pharmacy_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view pharmacy orders"
  ON public.pharmacy_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pharmacy_orders.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
    )
  );

CREATE POLICY "Admins can manage pharmacy orders"
  ON public.pharmacy_orders FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pharmacy_orders.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = pharmacy_orders.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin', 'manager')
    )
  );

-- ── 6. Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_med_inventory_org
  ON public.medication_inventory(organization_id);
CREATE INDEX IF NOT EXISTS idx_med_inventory_medication
  ON public.medication_inventory(medication_id);
CREATE INDEX IF NOT EXISTS idx_med_inventory_participant
  ON public.medication_inventory(participant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_org
  ON public.pharmacy_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_orders_participant
  ON public.pharmacy_orders(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_meds_s8
  ON public.participant_medications(participant_id)
  WHERE is_s8_controlled = true;
CREATE INDEX IF NOT EXISTS idx_mar_prn_efficacy
  ON public.medication_administration_records(medication_id, administered_at)
  WHERE prn_efficacy_status IS NOT NULL;
