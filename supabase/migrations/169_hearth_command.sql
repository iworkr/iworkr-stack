-- ============================================================================
-- Migration 169: Project Hearth-Command
-- Care Houses, ring-fenced rostering, micro-admin RLS for House Leaders
-- ============================================================================

-- ── 1. Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.house_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.house_participant_status AS ENUM ('active', 'transferred', 'discharged');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.house_staff_role AS ENUM ('leader', 'core_team', 'float_pool');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.house_note_category AS ENUM ('shift_handover', 'maintenance', 'groceries', 'general');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. care_houses ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_houses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         JSONB DEFAULT '{}'::JSONB,
  house_phone     TEXT,
  petty_cash_balance DECIMAL(10,2) DEFAULT 0.00,
  house_rules     TEXT,
  status          public.house_status DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_houses_org ON public.care_houses(organization_id);

ALTER TABLE public.care_houses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view houses" ON public.care_houses;
CREATE POLICY "Org members can view houses" ON public.care_houses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Admins can manage houses" ON public.care_houses;
CREATE POLICY "Admins can manage houses" ON public.care_houses
  FOR ALL USING (
    (SELECT role FROM organization_members
     WHERE organization_id = care_houses.organization_id
       AND user_id = auth.uid() AND status = 'active')
    = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role, 'office_admin'::org_role])
  );

-- ── 3. house_participants ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.house_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id        UUID NOT NULL REFERENCES public.care_houses(id) ON DELETE CASCADE,
  participant_id  UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  is_primary_residence BOOLEAN DEFAULT true,
  move_in_date    DATE DEFAULT CURRENT_DATE,
  move_out_date   DATE,
  status          public.house_participant_status DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(house_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_house_participants_house ON public.house_participants(house_id);
CREATE INDEX IF NOT EXISTS idx_house_participants_participant ON public.house_participants(participant_id);

ALTER TABLE public.house_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view house participants" ON public.house_participants;
CREATE POLICY "Org members can view house participants" ON public.house_participants
  FOR SELECT USING (
    house_id IN (
      SELECT id FROM care_houses WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage house participants" ON public.house_participants;
CREATE POLICY "Admins can manage house participants" ON public.house_participants
  FOR ALL USING (
    house_id IN (
      SELECT id FROM care_houses WHERE
        (SELECT role FROM organization_members
         WHERE organization_id = care_houses.organization_id
           AND user_id = auth.uid() AND status = 'active')
        = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role, 'office_admin'::org_role])
    )
  );

-- ── 4. house_staff (The Ring-Fence Roster) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.house_staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id        UUID NOT NULL REFERENCES public.care_houses(id) ON DELETE CASCADE,
  worker_id       UUID NOT NULL,
  role            public.house_staff_role NOT NULL DEFAULT 'core_team',
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(house_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_house_staff_house ON public.house_staff(house_id);
CREATE INDEX IF NOT EXISTS idx_house_staff_worker ON public.house_staff(worker_id);

ALTER TABLE public.house_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view house staff" ON public.house_staff;
CREATE POLICY "Org members can view house staff" ON public.house_staff
  FOR SELECT USING (
    house_id IN (
      SELECT id FROM care_houses WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Admins and leaders can manage house staff" ON public.house_staff;
CREATE POLICY "Admins and leaders can manage house staff" ON public.house_staff
  FOR ALL USING (
    house_id IN (
      SELECT id FROM care_houses WHERE
        (SELECT role FROM organization_members
         WHERE organization_id = care_houses.organization_id
           AND user_id = auth.uid() AND status = 'active')
        = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role, 'office_admin'::org_role])
    )
    OR
    house_id IN (
      SELECT hs.house_id FROM house_staff hs
      WHERE hs.worker_id = auth.uid() AND hs.role = 'leader'
    )
  );

-- ── 5. house_notes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.house_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id        UUID NOT NULL REFERENCES public.care_houses(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL,
  content         TEXT NOT NULL,
  category        public.house_note_category DEFAULT 'general',
  is_pinned       BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_house_notes_house ON public.house_notes(house_id);

ALTER TABLE public.house_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "House staff can view notes" ON public.house_notes;
CREATE POLICY "House staff can view notes" ON public.house_notes
  FOR SELECT USING (
    house_id IN (
      SELECT hs.house_id FROM house_staff hs WHERE hs.worker_id = auth.uid()
    )
    OR
    house_id IN (
      SELECT id FROM care_houses WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
          AND role = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role, 'office_admin'::org_role])
      )
    )
  );

DROP POLICY IF EXISTS "House staff can create notes" ON public.house_notes;
CREATE POLICY "House staff can create notes" ON public.house_notes
  FOR INSERT WITH CHECK (
    house_id IN (
      SELECT hs.house_id FROM house_staff hs WHERE hs.worker_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Leaders and admins can manage notes" ON public.house_notes;
CREATE POLICY "Leaders and admins can manage notes" ON public.house_notes
  FOR ALL USING (
    (author_id = auth.uid())
    OR
    house_id IN (
      SELECT hs.house_id FROM house_staff hs
      WHERE hs.worker_id = auth.uid() AND hs.role = 'leader'
    )
    OR
    house_id IN (
      SELECT id FROM care_houses WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
          AND role = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role, 'office_admin'::org_role])
      )
    )
  );

-- ── 6. Add house_id to schedule_blocks ──────────────────────────────────────

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS house_id UUID REFERENCES public.care_houses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_house ON public.schedule_blocks(house_id);

-- ── 7. get_user_house_ids() — RLS helper function ──────────────────────────

CREATE OR REPLACE FUNCTION public.get_user_house_ids(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    ARRAY(SELECT house_id FROM public.house_staff WHERE worker_id = p_user_id),
    '{}'::UUID[]
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_leader_house_ids(p_user_id UUID DEFAULT auth.uid())
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    ARRAY(SELECT house_id FROM public.house_staff WHERE worker_id = p_user_id AND role = 'leader'),
    '{}'::UUID[]
  );
$$;

-- ── 8. Petty cash transaction logging ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.house_petty_cash_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id        UUID NOT NULL REFERENCES public.care_houses(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT DEFAULT 'general',
  receipt_url     TEXT,
  balance_after   DECIMAL(10,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_house ON public.house_petty_cash_log(house_id);

ALTER TABLE public.house_petty_cash_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "House leaders and admins can view petty cash" ON public.house_petty_cash_log;
CREATE POLICY "House leaders and admins can view petty cash" ON public.house_petty_cash_log
  FOR SELECT USING (
    house_id IN (
      SELECT hs.house_id FROM house_staff hs WHERE hs.worker_id = auth.uid()
    )
    OR
    house_id IN (
      SELECT id FROM care_houses WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
          AND role = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role, 'office_admin'::org_role])
      )
    )
  );

DROP POLICY IF EXISTS "Leaders can log petty cash" ON public.house_petty_cash_log;
CREATE POLICY "Leaders can log petty cash" ON public.house_petty_cash_log
  FOR INSERT WITH CHECK (
    house_id IN (
      SELECT hs.house_id FROM house_staff hs
      WHERE hs.worker_id = auth.uid() AND hs.role = 'leader'
    )
    OR
    house_id IN (
      SELECT id FROM care_houses WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND status = 'active'
          AND role = ANY(ARRAY['owner'::org_role, 'admin'::org_role, 'manager'::org_role, 'office_admin'::org_role])
      )
    )
  );

-- ── 9. Petty cash deduction RPC (atomic) ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_house_petty_cash_deduct(
  p_house_id UUID,
  p_amount DECIMAL,
  p_description TEXT,
  p_category TEXT DEFAULT 'general',
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL(10,2);
BEGIN
  UPDATE public.care_houses
  SET petty_cash_balance = petty_cash_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_house_id
  RETURNING petty_cash_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'House not found: %', p_house_id;
  END IF;

  INSERT INTO public.house_petty_cash_log (
    house_id, author_id, amount, description, category, receipt_url, balance_after
  ) VALUES (
    p_house_id, auth.uid(), -p_amount, p_description, p_category, p_receipt_url, v_new_balance
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount
  );
END;
$$;

-- ── 10. Petty cash top-up RPC ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_house_petty_cash_topup(
  p_house_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT 'Top-up'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL(10,2);
BEGIN
  UPDATE public.care_houses
  SET petty_cash_balance = petty_cash_balance + p_amount,
      updated_at = NOW()
  WHERE id = p_house_id
  RETURNING petty_cash_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'House not found: %', p_house_id;
  END IF;

  INSERT INTO public.house_petty_cash_log (
    house_id, author_id, amount, description, category, balance_after
  ) VALUES (
    p_house_id, auth.uid(), p_amount, p_description, 'top_up', v_new_balance
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
