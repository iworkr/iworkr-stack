-- ============================================================================
-- Migration 078: Shift Financial Ledgers
-- (Project Nightingale — Workforce & Intelligent Rostering Engine)
-- Per-shift cost/revenue tracking linking SCHADS wages to NDIS pricing.
-- SAFE: All statements use IF NOT EXISTS.
-- ============================================================================

-- ─── 1. Shift Financial Ledgers ─────────────────────────────────────────────
-- 1:1 with schedule_blocks. Stores projected and actual cost/revenue breakdowns.

CREATE TABLE IF NOT EXISTS public.shift_financial_ledgers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_block_id     uuid NOT NULL REFERENCES public.schedule_blocks(id) ON DELETE CASCADE,
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  worker_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  participant_id        uuid,
  ndis_line_item        text,

  -- Projected financials (calculated at scheduling time)
  projected_cost        numeric(10,2) DEFAULT 0,
  projected_revenue     numeric(10,2) DEFAULT 0,
  projected_margin      numeric(10,2) DEFAULT 0,

  -- Actual financials (calculated post-shift from clock-in/out)
  actual_cost           numeric(10,2),
  actual_revenue        numeric(10,2),
  actual_margin         numeric(10,2),

  -- Detailed breakdowns (JSONB payloads)
  cost_breakdown        jsonb DEFAULT '{}'::jsonb,
  revenue_breakdown     jsonb DEFAULT '{}'::jsonb,

  -- Travel components
  travel_distance_km    numeric(8,2),
  travel_duration_mins  integer,
  travel_cost           numeric(10,2) DEFAULT 0,
  travel_revenue        numeric(10,2) DEFAULT 0,

  -- Flags
  is_overtime           boolean DEFAULT false,
  is_broken_shift       boolean DEFAULT false,
  is_public_holiday     boolean DEFAULT false,
  penalty_type          text,   -- 'evening', 'night', 'saturday', 'sunday', 'public_holiday'

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_block_id)
);

CREATE INDEX IF NOT EXISTS idx_shift_ledgers_org
  ON public.shift_financial_ledgers (organization_id);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_worker
  ON public.shift_financial_ledgers (worker_id);
CREATE INDEX IF NOT EXISTS idx_shift_ledgers_block
  ON public.shift_financial_ledgers (schedule_block_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_shift_financial_ledgers_updated_at') THEN
    CREATE TRIGGER set_shift_financial_ledgers_updated_at
      BEFORE UPDATE ON public.shift_financial_ledgers
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 2. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.shift_financial_ledgers ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS Policies ────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_financial_ledgers' AND policyname = 'Org members can view shift ledgers') THEN
    CREATE POLICY "Org members can view shift ledgers"
      ON public.shift_financial_ledgers FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_financial_ledgers' AND policyname = 'System can manage shift ledgers') THEN
    CREATE POLICY "System can manage shift ledgers"
      ON public.shift_financial_ledgers FOR ALL
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

-- ─── 4. Comments ──────────────────────────────────────────────────────────────

COMMENT ON TABLE public.shift_financial_ledgers IS
  'Per-shift financial tracking: projected and actual cost (SCHADS wages) vs revenue (NDIS billing), with detailed breakdowns and travel apportionment.';
