-- ============================================================================
-- @migration ChameleonBrandEngine
-- @status COMPLETE
-- @description Project Chameleon — white-label branding, build factory, facility overrides
-- @tables workspace_branding (altered), facility_brand_overrides
-- @lastAudit 2026-03-22
-- ============================================================================

-- ─── 1. Enhance workspace_branding for white-label ──────────────────────────

ALTER TABLE public.workspace_branding
  ADD COLUMN IF NOT EXISTS app_name VARCHAR(15),
  ADD COLUMN IF NOT EXISTS app_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS accent_color_hex VARCHAR(7) DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS build_status TEXT DEFAULT 'none'
    CHECK (build_status IN ('none', 'queued', 'building', 'deployed', 'awaiting_store_review', 'failed')),
  ADD COLUMN IF NOT EXISTS build_log_url TEXT,
  ADD COLUMN IF NOT EXISTS enterprise_bundle_id TEXT,
  ADD COLUMN IF NOT EXISTS last_build_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS build_requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for realtime subscription on build_status changes
CREATE INDEX IF NOT EXISTS idx_workspace_branding_build_status
  ON public.workspace_branding (workspace_id, build_status);

-- ─── 2. Facility-level brand override ───────────────────────────────────────
-- Allows sub-tenant branding (e.g., "The Kelso House" within a larger org)

ALTER TABLE public.care_facilities
  ADD COLUMN IF NOT EXISTS brand_override_color VARCHAR(7),
  ADD COLUMN IF NOT EXISTS brand_override_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_override_name VARCHAR(15);

-- ─── 3. Enable Realtime for build_status monitoring ─────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_branding;

-- ─── 4. Comments ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.workspace_branding.app_name IS
  'White-label app name (max 15 chars for OS home screen). NULL = "iWorkr".';
COMMENT ON COLUMN public.workspace_branding.app_icon_url IS
  'Supabase Storage URL for the 1024x1024 PNG app icon (no transparency).';
COMMENT ON COLUMN public.workspace_branding.build_status IS
  'Enterprise Build Factory status: none → queued → building → deployed/awaiting_store_review/failed.';
COMMENT ON COLUMN public.workspace_branding.enterprise_bundle_id IS
  'Custom iOS/Android bundle ID (e.g., com.iworkr.sunrisecare) for enterprise white-label.';
