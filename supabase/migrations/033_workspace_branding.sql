-- ============================================================================
-- @migration WorkspaceBranding
-- @status COMPLETE
-- @description Adds brand customization columns for multi-tenant white-labeling
-- @tables organizations (altered)
-- @lastAudit 2026-03-22
-- ============================================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_color_hex varchar(7) DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS brand_logo_url text;
