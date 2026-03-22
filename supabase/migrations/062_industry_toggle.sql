-- ============================================================================
-- @migration IndustryToggle
-- @status COMPLETE
-- @description Project Nightingale — adds industry_type toggle (trades vs care) to organizations
-- @tables organizations (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

-- 1. Add industry_type column to organizations
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'industry_type'
  ) THEN
    ALTER TABLE public.organizations
      ADD COLUMN industry_type text NOT NULL DEFAULT 'trades'
      CHECK (industry_type IN ('trades', 'care'));
  END IF;
END $$;

-- 2. Index for filtering by industry type
CREATE INDEX IF NOT EXISTS idx_organizations_industry_type
  ON public.organizations (industry_type);

-- 3. Comment for documentation
COMMENT ON COLUMN public.organizations.industry_type IS
  'Industry toggle: trades = field service / trade businesses, care = NDIS / aged care providers. Controls nomenclature, compliance gates, and feature visibility.';
