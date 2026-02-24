-- ═══════════════════════════════════════════════════════════
-- Migration 033: Workspace Branding
-- ═══════════════════════════════════════════════════════════
-- Adds brand customization columns to organizations for
-- multi-tenant white-labeling (dynamic theme colors + logos).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS brand_color_hex varchar(7) DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS brand_logo_url text;
