-- ============================================================================
-- @migration NDISCatalogue
-- @status COMPLETE
-- @description Versioned NDIS Price Guide catalogue with temporal querying and MMM regions
-- @tables ndis_catalogue, ndis_region_modifiers
-- @lastAudit 2026-03-22
-- ============================================================================

-- ─── 1. NDIS Support Catalogue ─────────────────────────────────────────────
-- Stores every NDIS Support Item number with historical rate versioning.
-- Rates change annually (typically July 1). Each row represents one item in one
-- price guide version, with effective_from/effective_to for temporal queries.

CREATE TABLE IF NOT EXISTS public.ndis_catalogue (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_item_number         text NOT NULL,                  -- e.g. '01_011_0107_1_1'
  support_item_name           text NOT NULL,
  registration_group          text,
  support_category            text NOT NULL,                  -- 'core', 'capacity_building', 'capital'
  unit                        text NOT NULL,                  -- 'hour', 'each', 'day', 'week'
  base_rate_national          numeric(10,2) NOT NULL,
  base_rate_remote            numeric(10,2),
  base_rate_very_remote       numeric(10,2),
  effective_from              date NOT NULL,                  -- typically July 1
  effective_to                date,                           -- NULL = currently active
  is_group_based              boolean DEFAULT false,
  provider_travel_eligible    boolean DEFAULT false,
  cancellation_eligible       boolean DEFAULT false,
  non_face_to_face_eligible   boolean DEFAULT false,
  irregularity_indicator      text,                           -- 'TTP', etc.
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- Composite index: item number + temporal range for fast lookups
CREATE INDEX IF NOT EXISTS idx_ndis_catalogue_item_temporal
  ON public.ndis_catalogue (support_item_number, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_ndis_catalogue_category
  ON public.ndis_catalogue (support_category);
CREATE INDEX IF NOT EXISTS idx_ndis_catalogue_active
  ON public.ndis_catalogue (effective_to)
  WHERE effective_to IS NULL;

-- ─── 2. MMM Region Modifiers ───────────────────────────────────────────────
-- Modified Monash Model geographic classification (1-7) with rate loading.
-- MMM 1 = metropolitan, MMM 7 = very remote. Loading increases with remoteness.

CREATE TABLE IF NOT EXISTS public.ndis_region_modifiers (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mmm_classification          int NOT NULL CHECK (mmm_classification BETWEEN 1 AND 7),
  modifier_percentage         numeric(5,2) NOT NULL,          -- e.g., 40.00 for 40% loading
  effective_from              date NOT NULL,
  effective_to                date,
  label                       text NOT NULL,                  -- 'Metropolitan', 'Regional', 'Remote'
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ndis_region_modifiers_mmm
  ON public.ndis_region_modifiers (mmm_classification, effective_from DESC);

-- ─── 3. Enable RLS ──────────────────────────────────────────────────────────

ALTER TABLE public.ndis_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ndis_region_modifiers ENABLE ROW LEVEL SECURITY;

-- ─── 4. RLS: NDIS Catalogue (read-only for all authenticated users) ────────
-- The catalogue is a shared resource — not org-scoped. All authenticated users can read.
-- Only service_role can insert/update (via Edge Functions).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ndis_catalogue' AND policyname = 'Authenticated users can read NDIS catalogue') THEN
    CREATE POLICY "Authenticated users can read NDIS catalogue"
      ON public.ndis_catalogue FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ndis_region_modifiers' AND policyname = 'Authenticated users can read region modifiers') THEN
    CREATE POLICY "Authenticated users can read region modifiers"
      ON public.ndis_region_modifiers FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- ─── 5. Helper Function: Get rate for a support item at a point in time ────

CREATE OR REPLACE FUNCTION public.get_ndis_rate(
  p_support_item_number text,
  p_date date DEFAULT CURRENT_DATE,
  p_mmm_classification int DEFAULT 1
)
RETURNS TABLE (
  support_item_number text,
  support_item_name text,
  base_rate numeric,
  region_modifier_pct numeric,
  effective_rate numeric,
  unit text
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_modifier numeric := 0;
BEGIN
  -- Get the regional loading modifier
  SELECT COALESCE(rm.modifier_percentage, 0) INTO v_modifier
  FROM public.ndis_region_modifiers rm
  WHERE rm.mmm_classification = p_mmm_classification
    AND rm.effective_from <= p_date
    AND (rm.effective_to IS NULL OR rm.effective_to > p_date)
  ORDER BY rm.effective_from DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    c.support_item_number,
    c.support_item_name,
    c.base_rate_national AS base_rate,
    v_modifier AS region_modifier_pct,
    ROUND(c.base_rate_national * (1 + v_modifier / 100), 2) AS effective_rate,
    c.unit
  FROM public.ndis_catalogue c
  WHERE c.support_item_number = p_support_item_number
    AND c.effective_from <= p_date
    AND (c.effective_to IS NULL OR c.effective_to > p_date)
  ORDER BY c.effective_from DESC
  LIMIT 1;
END;
$$;

-- ─── 6. Comments ─────────────────────────────────────────────────────────────

COMMENT ON TABLE public.ndis_catalogue IS
  'Versioned NDIS Support Item catalogue. Stores historically versioned rates with temporal querying for temporal billing accuracy.';
COMMENT ON TABLE public.ndis_region_modifiers IS
  'Modified Monash Model (MMM 1-7) geographic loading multipliers for NDIS rate calculations.';
COMMENT ON FUNCTION public.get_ndis_rate IS
  'Returns the effective NDIS rate for a support item at a given date, applying the correct MMM regional modifier.';
