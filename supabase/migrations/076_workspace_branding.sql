-- ============================================================================
-- @migration WorkspaceBrandingChameleon
-- @status COMPLETE
-- @description Project Chameleon — full whitelabel identity schema with custom domains
-- @tables workspace_branding
-- @lastAudit 2026-03-22
-- ============================================================================

-- ── 1. Create workspace_branding table (1:1 with organizations) ──
CREATE TABLE IF NOT EXISTS public.workspace_branding (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  -- Color identity
  primary_color_hex    VARCHAR(7) DEFAULT '#10B981',
  text_on_primary_hex  VARCHAR(7) DEFAULT '#FFFFFF',
  -- Logo assets (light = for dark bg, dark = for light bg / PDFs)
  logo_light_url       TEXT,
  logo_dark_url        TEXT,
  -- Custom email domain (Resend integration)
  custom_email_domain  VARCHAR(255),
  resend_domain_id     VARCHAR(255),
  dns_status           VARCHAR(20) DEFAULT 'unconfigured'
                       CHECK (dns_status IN ('unconfigured', 'pending', 'verified', 'failed')),
  -- DNS records cache (stored from Resend API response)
  dns_records          JSONB DEFAULT '[]'::jsonb,
  -- Metadata
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by workspace
CREATE INDEX IF NOT EXISTS idx_workspace_branding_workspace
  ON public.workspace_branding(workspace_id);

-- ── 2. Auto-provision branding row when organization is created ──
CREATE OR REPLACE FUNCTION public.auto_provision_workspace_branding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_branding (workspace_id, primary_color_hex, text_on_primary_hex)
  VALUES (NEW.id, COALESCE(NEW.brand_color_hex, '#10B981'), '#FFFFFF')
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_provision_branding ON public.organizations;
CREATE TRIGGER trg_auto_provision_branding
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_provision_workspace_branding();

-- ── 3. Back-fill existing organizations ──
INSERT INTO public.workspace_branding (workspace_id, primary_color_hex, text_on_primary_hex)
SELECT id, COALESCE(brand_color_hex, '#10B981'), '#FFFFFF'
FROM public.organizations
ON CONFLICT (workspace_id) DO NOTHING;

-- ── 4. RLS policies ──
ALTER TABLE public.workspace_branding ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated org member can view their workspace branding
CREATE POLICY "Members can view workspace branding"
  ON public.workspace_branding FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = workspace_branding.workspace_id
        AND status = 'active'
    )
  );

-- Write: only owners/admins can update branding
CREATE POLICY "Owners and admins can update branding"
  ON public.workspace_branding FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = workspace_branding.workspace_id
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Insert: service role only (auto-provisioned via trigger)
CREATE POLICY "Service role can insert branding"
  ON public.workspace_branding FOR INSERT
  WITH CHECK (true);

-- Delete: owners only
CREATE POLICY "Owners can delete branding"
  ON public.workspace_branding FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = workspace_branding.workspace_id
        AND status = 'active'
        AND role = 'owner'
    )
  );

-- ── 5. Storage bucket for brand assets ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880, -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Public read for brand assets
CREATE POLICY "Anyone can view brand assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'brand-assets');

-- Org admins can upload brand assets
CREATE POLICY "Org admins can upload brand assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = (storage.foldername(name))[1]::uuid
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Org admins can update brand assets
CREATE POLICY "Org admins can update brand assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'brand-assets'
    AND EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = (storage.foldername(name))[1]::uuid
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Org admins can delete brand assets
CREATE POLICY "Org admins can delete brand assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'brand-assets'
    AND EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid()
        AND organization_id = (storage.foldername(name))[1]::uuid
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- ── 6. Updated_at trigger ──
CREATE OR REPLACE FUNCTION public.update_workspace_branding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspace_branding_updated ON public.workspace_branding;
CREATE TRIGGER trg_workspace_branding_updated
  BEFORE UPDATE ON public.workspace_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.update_workspace_branding_timestamp();
