-- ============================================================================
-- @migration GatewayIntake
-- @status COMPLETE
-- @description Project Gateway-Intake: Embeddable smart booking widgets with
--   autonomous lead routing, CRM deduplication, PostGIS territory assignment,
--   and Hermes-Matrix dispatch alerts.
-- @tables intake_widgets, territory_zones, leads
-- @enums lead_status_enum, lead_urgency_enum, widget_sector_type
-- @lastAudit 2026-03-24
-- ============================================================================

-- ─── 0. Ensure PostGIS ───────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─── 1. Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status_enum') THEN
    CREATE TYPE public.lead_status_enum AS ENUM (
      'NEW', 'VIEWED', 'CONTACTED', 'CONVERTED', 'JUNK'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_urgency_enum') THEN
    CREATE TYPE public.lead_urgency_enum AS ENUM (
      'LOW', 'STANDARD', 'URGENT', 'EMERGENCY'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'widget_sector_type') THEN
    CREATE TYPE public.widget_sector_type AS ENUM (
      'TRADES', 'CARE', 'GENERAL'
    );
  END IF;
END $$;

-- ─── 2. Intake Widgets (Configuration) ──────────────────────────────────────
-- Each workspace can create multiple widgets with different configurations.
-- The embed script fetches config by widget ID.

CREATE TABLE IF NOT EXISTS public.intake_widgets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  sector            public.widget_sector_type NOT NULL DEFAULT 'TRADES',
  theme_color       VARCHAR(7) DEFAULT '#10B981',
  logo_url          TEXT,
  welcome_message   TEXT DEFAULT 'How can we help you today?',
  success_message   TEXT DEFAULT 'Thank you! We will be in touch shortly.',

  allowed_domains   TEXT[] NOT NULL DEFAULT '{}',
  config_jsonb      JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_active         BOOLEAN DEFAULT true,
  embed_token       UUID DEFAULT gen_random_uuid(),

  submissions_count INTEGER DEFAULT 0,
  last_submission   TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_widgets_org
  ON public.intake_widgets (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_intake_widgets_embed_token
  ON public.intake_widgets (embed_token);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_intake_widgets_updated_at') THEN
    CREATE TRIGGER set_intake_widgets_updated_at
      BEFORE UPDATE ON public.intake_widgets
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 3. Territory Zones (Dispatch Polygons) ─────────────────────────────────
-- Geographic zones for lead routing. Each zone has an assigned dispatcher.

CREATE TABLE IF NOT EXISTS public.territory_zones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name              VARCHAR(100) NOT NULL,
  color             VARCHAR(7) DEFAULT '#3B82F6',
  polygon_geometry  GEOGRAPHY(POLYGON, 4326),
  assigned_user_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active         BOOLEAN DEFAULT true,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_territory_zones_org
  ON public.territory_zones (organization_id);
CREATE INDEX IF NOT EXISTS idx_territory_zones_geo
  ON public.territory_zones USING GIST (polygon_geometry);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_territory_zones_updated_at') THEN
    CREATE TRIGGER set_territory_zones_updated_at
      BEFORE UPDATE ON public.territory_zones
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 4. Leads Table ─────────────────────────────────────────────────────────
-- The core lead capture table. Every widget submission creates a lead.

CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  widget_id         UUID REFERENCES public.intake_widgets(id) ON DELETE SET NULL,

  client_id         UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  territory_id      UUID REFERENCES public.territory_zones(id) ON DELETE SET NULL,

  status            public.lead_status_enum NOT NULL DEFAULT 'NEW',
  urgency           public.lead_urgency_enum NOT NULL DEFAULT 'STANDARD',

  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(255),
  phone             VARCHAR(30),
  address_string    TEXT,
  location          GEOGRAPHY(POINT, 4326),

  captured_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_urls        TEXT[] DEFAULT '{}',

  source_domain     VARCHAR(255),
  source_ip         VARCHAR(45),

  converted_job_id  UUID,
  converted_participant_id UUID,

  viewed_at         TIMESTAMPTZ,
  contacted_at      TIMESTAMPTZ,
  converted_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_org_status
  ON public.leads (organization_id, status) WHERE status = 'NEW';
CREATE INDEX IF NOT EXISTS idx_leads_widget
  ON public.leads (widget_id);
CREATE INDEX IF NOT EXISTS idx_leads_territory
  ON public.leads (territory_id);
CREATE INDEX IF NOT EXISTS idx_leads_client
  ON public.leads (client_id);
CREATE INDEX IF NOT EXISTS idx_leads_created
  ON public.leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_location
  ON public.leads USING GIST (location);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_leads_updated_at') THEN
    CREATE TRIGGER set_leads_updated_at
      BEFORE UPDATE ON public.leads
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.intake_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- intake_widgets
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'intake_widgets' AND policyname = 'Org members can view intake widgets') THEN
    CREATE POLICY "Org members can view intake widgets"
      ON public.intake_widgets FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'intake_widgets' AND policyname = 'Admins can manage intake widgets') THEN
    CREATE POLICY "Admins can manage intake widgets"
      ON public.intake_widgets FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = intake_widgets.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- territory_zones
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'territory_zones' AND policyname = 'Org members can view territory zones') THEN
    CREATE POLICY "Org members can view territory zones"
      ON public.territory_zones FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'territory_zones' AND policyname = 'Admins can manage territory zones') THEN
    CREATE POLICY "Admins can manage territory zones"
      ON public.territory_zones FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = territory_zones.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- leads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'Org members can view leads') THEN
    CREATE POLICY "Org members can view leads"
      ON public.leads FOR SELECT
      USING (organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND status = 'active'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'Admins can manage leads') THEN
    CREATE POLICY "Admins can manage leads"
      ON public.leads FOR ALL
      USING (
        (SELECT role FROM public.organization_members
         WHERE organization_id = leads.organization_id
           AND user_id = auth.uid()
           AND status = 'active') IN ('owner', 'admin', 'manager', 'office_admin')
      );
  END IF;
END $$;

-- ─── 6. Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;

-- ─── 7. Storage Bucket ───────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-media',
  'lead-media',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload lead media"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'lead-media');

CREATE POLICY "Authenticated users can read lead media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'lead-media');

-- ─── 8. Territory Match RPC ──────────────────────────────────────────────────
-- Given coordinates, find which territory zone contains the point.

CREATE OR REPLACE FUNCTION public.match_territory_zone(
  p_organization_id UUID,
  p_lng DOUBLE PRECISION,
  p_lat DOUBLE PRECISION
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_territory_id UUID;
BEGIN
  SELECT id INTO v_territory_id
  FROM public.territory_zones
  WHERE organization_id = p_organization_id
    AND is_active = true
    AND ST_Intersects(
      polygon_geometry,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    )
  LIMIT 1;

  RETURN v_territory_id;
END;
$$;

-- ─── 9. Widget Config Fetch (Public RPC) ─────────────────────────────────────
-- Unauthenticated clients fetch widget config by embed_token.

CREATE OR REPLACE FUNCTION public.get_widget_config(p_embed_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', id,
    'organization_id', organization_id,
    'name', name,
    'sector', sector,
    'theme_color', theme_color,
    'logo_url', logo_url,
    'welcome_message', welcome_message,
    'success_message', success_message,
    'allowed_domains', allowed_domains,
    'config_jsonb', config_jsonb,
    'is_active', is_active
  ) INTO v_result
  FROM public.intake_widgets
  WHERE embed_token = p_embed_token
    AND is_active = true;

  RETURN v_result;
END;
$$;

-- ─── 10. Increment Widget Counter ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_widget_submissions(p_widget_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.intake_widgets
  SET submissions_count = submissions_count + 1,
      last_submission = now()
  WHERE id = p_widget_id;
END;
$$;

-- ─── 11. Comments ────────────────────────────────────────────────────────────

COMMENT ON TABLE public.intake_widgets IS
  'Project Gateway-Intake: Embeddable widget configuration. Each workspace can deploy multiple widgets with sector-specific forms.';
COMMENT ON TABLE public.territory_zones IS
  'Geographic dispatch zones. PostGIS polygons for automated lead routing to assigned dispatchers.';
COMMENT ON TABLE public.leads IS
  'Structured lead capture from embeddable widgets. Autonomous CRM dedup, geocoding, and territory assignment.';
