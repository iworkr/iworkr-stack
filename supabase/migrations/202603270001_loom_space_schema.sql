-- ============================================================================
-- @migration LoomSpaceSchema
-- @status COMPLETE
-- @description Project Loom-Space: Multi-tenant website builder engine.
--   Sites stored as JSONB ASTs, served via Edge Middleware hostname rewrite.
-- @tables sites, site_pages, site_analytics
-- @lastAudit 2026-03-27
-- ============================================================================

-- ─── 1. Sites ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sites (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  subdomain         VARCHAR(63) UNIQUE,
  custom_domain     VARCHAR(255) UNIQUE,
  theme_id          VARCHAR(50),
  global_styles_jsonb JSONB NOT NULL DEFAULT '{
    "primaryColor": "#10B981",
    "secondaryColor": "#0D9488",
    "fontHeading": "Inter",
    "fontBody": "Inter",
    "buttonRadius": 8,
    "headerStyle": "sticky",
    "footerStyle": "standard"
  }'::jsonb,
  seo_defaults_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published      BOOLEAN NOT NULL DEFAULT false,
  domain_verified   BOOLEAN NOT NULL DEFAULT false,
  domain_dns_records JSONB DEFAULT '[]'::jsonb,
  vercel_domain_config JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sites_workspace ON public.sites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sites_subdomain ON public.sites(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_custom_domain ON public.sites(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sites_published ON public.sites(is_published) WHERE is_published = true;

CREATE TRIGGER set_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── 2. Site Pages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  slug              VARCHAR(255) NOT NULL DEFAULT '/',
  title             VARCHAR(255) NOT NULL DEFAULT 'Home',
  seo_metadata_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  layout_jsonb      JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order        INT NOT NULL DEFAULT 0,
  is_draft          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_site_pages_site ON public.site_pages(site_id);
CREATE INDEX IF NOT EXISTS idx_site_pages_site_slug ON public.site_pages(site_id, slug);

CREATE TRIGGER set_site_pages_updated_at
  BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── 3. Site Analytics (cookie-less) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.site_analytics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id           UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  page_path         VARCHAR(512) NOT NULL DEFAULT '/',
  visitor_hash      VARCHAR(64) NOT NULL,
  referrer          TEXT,
  country           VARCHAR(3),
  city              VARCHAR(100),
  device_type       VARCHAR(10) DEFAULT 'desktop',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_site_analytics_site ON public.site_analytics(site_id);
CREATE INDEX IF NOT EXISTS idx_site_analytics_site_date ON public.site_analytics(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_visitor ON public.site_analytics(site_id, visitor_hash);

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;

-- Sites: org members can CRUD
DROP POLICY IF EXISTS "Members can manage sites" ON public.sites;
CREATE POLICY "Members can manage sites"
  ON public.sites FOR ALL
  USING (workspace_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- Sites: public read for published sites (renderer route uses service role but this is a safety net)
DROP POLICY IF EXISTS "Published sites are publicly readable" ON public.sites;
CREATE POLICY "Published sites are publicly readable"
  ON public.sites FOR SELECT
  USING (is_published = true);

-- Site Pages: org members can CRUD
DROP POLICY IF EXISTS "Members can manage site pages" ON public.site_pages;
CREATE POLICY "Members can manage site pages"
  ON public.site_pages FOR ALL
  USING (site_id IN (
    SELECT id FROM public.sites WHERE workspace_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- Site Pages: public read for published site pages
DROP POLICY IF EXISTS "Published site pages are publicly readable" ON public.site_pages;
CREATE POLICY "Published site pages are publicly readable"
  ON public.site_pages FOR SELECT
  USING (
    is_draft = false
    AND site_id IN (SELECT id FROM public.sites WHERE is_published = true)
  );

-- Analytics: insert-only for service role (no auth user insert)
DROP POLICY IF EXISTS "Members can read site analytics" ON public.site_analytics;
CREATE POLICY "Members can read site analytics"
  ON public.site_analytics FOR SELECT
  USING (site_id IN (
    SELECT id FROM public.sites WHERE workspace_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  ));

-- ─── 5. Realtime ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'sites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sites;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'site_pages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_pages;
  END IF;
END $$;

-- ─── 6. Helper RPC: site lookup by domain ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_site_by_domain(p_hostname TEXT)
RETURNS TABLE(
  site_id UUID,
  workspace_id UUID,
  site_name VARCHAR,
  global_styles JSONB,
  seo_defaults JSONB,
  theme_id VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subdomain TEXT;
BEGIN
  -- Try custom domain first
  RETURN QUERY
    SELECT s.id, s.workspace_id, s.name, s.global_styles_jsonb, s.seo_defaults_jsonb, s.theme_id
    FROM public.sites s
    WHERE s.custom_domain = p_hostname AND s.is_published = true
    LIMIT 1;

  IF FOUND THEN RETURN; END IF;

  -- Try subdomain (strip .iworkrsites.com)
  v_subdomain := regexp_replace(p_hostname, '\.iworkrsites\.com$', '');
  RETURN QUERY
    SELECT s.id, s.workspace_id, s.name, s.global_styles_jsonb, s.seo_defaults_jsonb, s.theme_id
    FROM public.sites s
    WHERE s.subdomain = v_subdomain AND s.is_published = true
    LIMIT 1;
END;
$$;
