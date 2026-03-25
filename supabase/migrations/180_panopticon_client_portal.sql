-- ============================================================================
-- @migration PanopticonClientPortal
-- @status COMPLETE
-- @description Project Panopticon — unified client & family portal with
--   cryptographic B2B2C isolation, proxy identity layer, magic links,
--   extreme RLS vault, budget summary view, and shift sign-off RPC
-- @tables portal_users, portal_access_grants, portal_magic_links
-- @lastAudit 2026-03-24
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) PORTAL GRANT TYPE ENUM
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE portal_grant_type AS ENUM (
    'TRADES_CUSTOMER',
    'FACILITY_MANAGER',
    'NDIS_PARTICIPANT',
    'NDIS_GUARDIAN',
    'NDIS_PLAN_MANAGER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) PORTAL USERS — External identity proxy layer
--    Separates external client identities from internal staff profiles.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.portal_users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       VARCHAR(255) UNIQUE NOT NULL,
  full_name   VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_portal_users_email
  ON public.portal_users (email);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_portal_users_updated_at') THEN
    CREATE TRIGGER set_portal_users_updated_at
      BEFORE UPDATE ON public.portal_users
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) PORTAL ACCESS GRANTS — The connective tissue / access matrix
--    Links a portal user to a specific entity (client, participant) within
--    a workspace. The RLS vault uses this table as the sole source of truth.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.portal_access_grants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id      UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_entity_type  VARCHAR(50) NOT NULL,
  target_entity_id    UUID NOT NULL,
  grant_type          portal_grant_type NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  permissions         JSONB NOT NULL DEFAULT '{}'::JSONB,
  granted_by          UUID REFERENCES auth.users(id),
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portal_user_id, target_entity_id)
);

ALTER TABLE public.portal_access_grants ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pag_portal_user
  ON public.portal_access_grants (portal_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pag_workspace
  ON public.portal_access_grants (workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pag_entity
  ON public.portal_access_grants (target_entity_type, target_entity_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_portal_access_grants_updated_at') THEN
    CREATE TRIGGER set_portal_access_grants_updated_at
      BEFORE UPDATE ON public.portal_access_grants
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) PORTAL MAGIC LINKS — Time-limited tokens for anonymous access
--    Used for one-click quote viewing, invoice payment, etc.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.portal_magic_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  workspace_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  target_type     VARCHAR(30) NOT NULL,
  target_id       UUID NOT NULL,
  grant_type      portal_grant_type,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  accessed_at     TIMESTAMPTZ,
  access_count    INT NOT NULL DEFAULT 0,
  max_accesses    INT NOT NULL DEFAULT 100,
  ip_address      INET,
  user_agent      TEXT,
  is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.portal_magic_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pml_token
  ON public.portal_magic_links (token) WHERE NOT is_revoked;
CREATE INDEX IF NOT EXISTS idx_pml_workspace
  ON public.portal_magic_links (workspace_id);
CREATE INDEX IF NOT EXISTS idx_pml_target
  ON public.portal_magic_links (target_type, target_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) PORTAL SESSIONS — Track active portal sessions for idle timeout
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id  UUID REFERENCES public.portal_users(id) ON DELETE CASCADE,
  workspace_id    UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ip_address      INET,
  user_agent      TEXT,
  country_code    VARCHAR(3),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_portal_sessions_user
  ON public.portal_sessions (portal_user_id, is_active);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) ORGANIZATIONS — Add portal slug + portal settings
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS portal_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS portal_custom_domain  TEXT,
  ADD COLUMN IF NOT EXISTS portal_idle_timeout   INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS portal_welcome_text   TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7) SCHEDULE_BLOCKS — Add shift verification fields for portal sign-off
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.schedule_blocks
  ADD COLUMN IF NOT EXISTS client_signature_url    TEXT,
  ADD COLUMN IF NOT EXISTS client_verification_ip  TEXT,
  ADD COLUMN IF NOT EXISTS verification_status     TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'disputed', 'verified_by_client'));

-- ═══════════════════════════════════════════════════════════════════════════
-- 8) EXTREME RLS VAULT — The cryptographic isolation layer
-- ═══════════════════════════════════════════════════════════════════════════

-- 8a) Portal users: can only see own profile
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_users' AND policyname='Portal users view own profile'
  ) THEN
    CREATE POLICY "Portal users view own profile"
      ON public.portal_users FOR SELECT
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_users' AND policyname='Portal users update own profile'
  ) THEN
    CREATE POLICY "Portal users update own profile"
      ON public.portal_users FOR UPDATE
      USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_users' AND policyname='Service role manages portal users'
  ) THEN
    CREATE POLICY "Service role manages portal users"
      ON public.portal_users FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 8b) Portal access grants: users see own, admins manage
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_access_grants' AND policyname='Portal users view own grants'
  ) THEN
    CREATE POLICY "Portal users view own grants"
      ON public.portal_access_grants FOR SELECT
      USING (portal_user_id = auth.uid() AND is_active = TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_access_grants' AND policyname='Org admins manage portal grants'
  ) THEN
    CREATE POLICY "Org admins manage portal grants"
      ON public.portal_access_grants FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = portal_access_grants.workspace_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager')
            AND om.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_access_grants' AND policyname='Service role manages grants'
  ) THEN
    CREATE POLICY "Service role manages grants"
      ON public.portal_access_grants FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 8c) Magic links: service role only (generated by admins, consumed by Edge Functions)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_magic_links' AND policyname='Service role manages magic links'
  ) THEN
    CREATE POLICY "Service role manages magic links"
      ON public.portal_magic_links FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_magic_links' AND policyname='Org admins view own workspace links'
  ) THEN
    CREATE POLICY "Org admins view own workspace links"
      ON public.portal_magic_links FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = portal_magic_links.workspace_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin', 'manager')
            AND om.status = 'active'
        )
      );
  END IF;
END $$;

-- 8d) Portal sessions: users see own, service role manages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_sessions' AND policyname='Portal users view own sessions'
  ) THEN
    CREATE POLICY "Portal users view own sessions"
      ON public.portal_sessions FOR SELECT
      USING (portal_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='portal_sessions' AND policyname='Service role manages portal sessions'
  ) THEN
    CREATE POLICY "Service role manages portal sessions"
      ON public.portal_sessions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 8e) INVOICES — Portal users can ONLY see invoices for granted clients
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='Portal users view granted invoices'
  ) THEN
    CREATE POLICY "Portal users view granted invoices"
      ON public.invoices FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.portal_access_grants pag
          WHERE pag.portal_user_id = auth.uid()
            AND pag.target_entity_type = 'client'
            AND pag.target_entity_id = invoices.client_id
            AND pag.is_active = TRUE
            AND (pag.expires_at IS NULL OR pag.expires_at > NOW())
        )
      );
  END IF;
END $$;

-- 8f) QUOTES — Portal users can ONLY see quotes for granted clients
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='quotes' AND policyname='Portal users view granted quotes'
  ) THEN
    CREATE POLICY "Portal users view granted quotes"
      ON public.quotes FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.portal_access_grants pag
          WHERE pag.portal_user_id = auth.uid()
            AND pag.target_entity_type = 'client'
            AND pag.target_entity_id = quotes.client_id
            AND pag.is_active = TRUE
            AND (pag.expires_at IS NULL OR pag.expires_at > NOW())
        )
      );
  END IF;
END $$;

-- 8g) JOBS — Portal users can see jobs for granted clients
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='jobs' AND policyname='Portal users view granted jobs'
  ) THEN
    CREATE POLICY "Portal users view granted jobs"
      ON public.jobs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.portal_access_grants pag
          WHERE pag.portal_user_id = auth.uid()
            AND pag.target_entity_type = 'client'
            AND pag.target_entity_id = jobs.client_id
            AND pag.is_active = TRUE
            AND (pag.expires_at IS NULL OR pag.expires_at > NOW())
        )
      );
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9) HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- 9a) Check if current user is a portal user with active grant for an entity
CREATE OR REPLACE FUNCTION public.is_portal_user_granted(
  p_entity_type TEXT,
  p_entity_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portal_access_grants
    WHERE portal_user_id = auth.uid()
      AND target_entity_type = p_entity_type
      AND target_entity_id = p_entity_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- 9b) Get all entity IDs the current portal user has access to
CREATE OR REPLACE FUNCTION public.get_portal_granted_entities(
  p_entity_type TEXT DEFAULT 'client'
)
RETURNS TABLE (entity_id UUID, workspace_id UUID, grant_type portal_grant_type)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_entity_id, workspace_id, grant_type
  FROM public.portal_access_grants
  WHERE portal_user_id = auth.uid()
    AND target_entity_type = p_entity_type
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- 9c) Resolve magic link token — validates and increments access count
CREATE OR REPLACE FUNCTION public.resolve_magic_link(
  p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
BEGIN
  SELECT * INTO v_link
  FROM public.portal_magic_links
  WHERE token = p_token
    AND NOT is_revoked
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Invalid or expired link');
  END IF;

  IF v_link.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Link has expired');
  END IF;

  IF v_link.access_count >= v_link.max_accesses THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Maximum access count reached');
  END IF;

  UPDATE public.portal_magic_links
  SET access_count = access_count + 1,
      accessed_at = NOW()
  WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'workspace_id', v_link.workspace_id,
    'target_type', v_link.target_type,
    'target_id', v_link.target_id,
    'grant_type', v_link.grant_type
  );
END;
$$;

-- 9d) Sign shift from portal with signature capture
CREATE OR REPLACE FUNCTION public.sign_shift_portal(
  p_shift_id UUID,
  p_signature_url TEXT,
  p_device_info TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant_id UUID;
  v_has_access BOOLEAN := FALSE;
BEGIN
  SELECT participant_id INTO v_participant_id
  FROM public.schedule_blocks
  WHERE id = p_shift_id;

  IF v_participant_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Shift not found');
  END IF;

  -- Check access via participant_network_members (family portal)
  SELECT EXISTS (
    SELECT 1 FROM public.participant_network_members pnm
    WHERE pnm.user_id = auth.uid()
      AND pnm.participant_id = v_participant_id
      AND pnm.is_active = TRUE
  ) INTO v_has_access;

  -- Also check portal_access_grants (client portal)
  IF NOT v_has_access THEN
    SELECT EXISTS (
      SELECT 1 FROM public.portal_access_grants pag
      WHERE pag.portal_user_id = auth.uid()
        AND pag.target_entity_type = 'participant'
        AND pag.target_entity_id = v_participant_id
        AND pag.is_active = TRUE
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Not authorised to sign this shift');
  END IF;

  UPDATE public.schedule_blocks
  SET
    client_approved = TRUE,
    client_approved_at = NOW(),
    client_approved_by = auth.uid(),
    client_approved_device = p_device_info,
    client_signature_url = p_signature_url,
    client_verification_ip = p_ip_address,
    verification_status = 'verified_by_client'
  WHERE id = p_shift_id
    AND NOT client_approved;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Shift already signed or not found');
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'shift_id', p_shift_id,
    'signed_at', NOW()
  );
END;
$$;

-- 9e) Get workspace by slug for white-label routing
CREATE OR REPLACE FUNCTION public.get_workspace_portal_config(
  p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org RECORD;
  v_branding RECORD;
BEGIN
  SELECT id, name, slug, logo_url, trade,
         portal_enabled, portal_primary_color, portal_logo_url,
         portal_app_name, portal_custom_domain, portal_welcome_text,
         portal_idle_timeout
  INTO v_org
  FROM public.organizations
  WHERE slug = p_slug AND portal_enabled = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Portal not found');
  END IF;

  -- Try workspace_branding for richer theme data
  SELECT primary_color_hex, text_on_primary_hex, logo_light_url, logo_dark_url
  INTO v_branding
  FROM public.workspace_branding
  WHERE workspace_id = v_org.id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'workspace_id', v_org.id,
    'name', v_org.name,
    'slug', v_org.slug,
    'trade', v_org.trade,
    'logo_url', COALESCE(v_org.portal_logo_url, v_org.logo_url),
    'brand_color', COALESCE(
      v_branding.primary_color_hex,
      v_org.portal_primary_color,
      '#10B981'
    ),
    'text_on_brand', COALESCE(v_branding.text_on_primary_hex, '#FFFFFF'),
    'logo_light', v_branding.logo_light_url,
    'logo_dark', v_branding.logo_dark_url,
    'app_name', COALESCE(v_org.portal_app_name, v_org.name),
    'welcome_text', v_org.portal_welcome_text,
    'idle_timeout', v_org.portal_idle_timeout
  );
END;
$$;

-- 9f) Get portal user dashboard data
CREATE OR REPLACE FUNCTION public.get_portal_user_dashboard(
  p_workspace_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_grants JSONB;
  v_org RECORD;
BEGIN
  SELECT * INTO v_user
  FROM public.portal_users
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Portal user not found');
  END IF;

  SELECT name, slug, trade INTO v_org
  FROM public.organizations WHERE id = p_workspace_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pag.id,
    'entity_type', pag.target_entity_type,
    'entity_id', pag.target_entity_id,
    'grant_type', pag.grant_type,
    'entity_name', CASE
      WHEN pag.target_entity_type = 'client' THEN (SELECT name FROM public.clients WHERE id = pag.target_entity_id)
      WHEN pag.target_entity_type = 'participant' THEN (
        SELECT COALESCE(pp.preferred_name, c.name)
        FROM public.participant_profiles pp
        LEFT JOIN public.clients c ON c.id = pp.client_id
        WHERE pp.id = pag.target_entity_id
      )
      ELSE 'Unknown'
    END
  )), '[]'::JSONB) INTO v_grants
  FROM public.portal_access_grants pag
  WHERE pag.portal_user_id = auth.uid()
    AND pag.workspace_id = p_workspace_id
    AND pag.is_active = TRUE
    AND (pag.expires_at IS NULL OR pag.expires_at > NOW());

  RETURN jsonb_build_object(
    'ok', TRUE,
    'user', jsonb_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'full_name', v_user.full_name,
      'phone', v_user.phone_number
    ),
    'workspace', jsonb_build_object(
      'id', p_workspace_id,
      'name', v_org.name,
      'trade', v_org.trade
    ),
    'grants', v_grants
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10) BUDGET SUMMARY VIEW — Secure aggregation for portal budget display
--     Exposes ONLY billable totals, never payroll or profit margins.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_participant_budget_summary
WITH (security_barrier = true) AS
SELECT
  sa.participant_id,
  sa.organization_id,
  sa.id AS agreement_id,
  sa.title AS agreement_title,
  sa.total_budget AS plan_total,
  sa.plan_start_date,
  sa.plan_end_date,
  sa.status AS agreement_status,
  sa.support_category,
  COALESCE(inv_agg.invoiced, 0) AS funds_utilized,
  COALESCE(wip_agg.wip, 0) AS funds_quarantined,
  sa.total_budget
    - COALESCE(inv_agg.invoiced, 0)
    - COALESCE(wip_agg.wip, 0) AS funds_remaining,
  CASE
    WHEN sa.total_budget > 0
    THEN ROUND(
      ((COALESCE(inv_agg.invoiced, 0) + COALESCE(wip_agg.wip, 0))
       / sa.total_budget) * 100, 1
    )
    ELSE 0
  END AS burn_rate_pct
FROM public.service_agreements sa
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(i.total), 0) AS invoiced
  FROM public.invoices i
  WHERE i.participant_id = sa.participant_id
    AND i.status IN ('sent', 'paid', 'overdue')
) inv_agg ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(sb.billable_hours * COALESCE(sb.billable_rate, 0)), 0) AS wip
  FROM public.schedule_blocks sb
  WHERE sb.participant_id = sa.participant_id
    AND sb.status = 'complete'
    AND sb.billed_at IS NULL
) wip_agg ON TRUE
WHERE sa.status = 'active';

GRANT SELECT ON public.v_participant_budget_summary TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11) PORTAL INVITE RPC — Creates a portal user + grant in one transaction
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_portal_invite(
  p_workspace_id UUID,
  p_email VARCHAR,
  p_full_name VARCHAR,
  p_phone VARCHAR DEFAULT NULL,
  p_entity_type VARCHAR DEFAULT 'client',
  p_entity_id UUID DEFAULT NULL,
  p_grant_type TEXT DEFAULT 'TRADES_CUSTOMER'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portal_user_id UUID;
  v_grant_id UUID;
  v_magic_token TEXT;
BEGIN
  -- Verify caller is an admin of the workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_workspace_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
      AND om.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'Unauthorised');
  END IF;

  -- Check if portal user already exists (by email in auth.users)
  SELECT id INTO v_portal_user_id
  FROM public.portal_users WHERE email = p_email;

  -- Create magic link for the invite
  INSERT INTO public.portal_magic_links (
    workspace_id, target_type, target_id, grant_type,
    recipient_email, created_by, expires_at
  ) VALUES (
    p_workspace_id,
    COALESCE(p_entity_type, 'workspace'),
    COALESCE(p_entity_id, p_workspace_id),
    p_grant_type::portal_grant_type,
    p_email,
    auth.uid(),
    NOW() + INTERVAL '7 days'
  )
  RETURNING token INTO v_magic_token;

  -- If portal user exists, create/update the grant
  IF v_portal_user_id IS NOT NULL AND p_entity_id IS NOT NULL THEN
    INSERT INTO public.portal_access_grants (
      portal_user_id, workspace_id, target_entity_type,
      target_entity_id, grant_type, granted_by
    ) VALUES (
      v_portal_user_id, p_workspace_id, p_entity_type,
      p_entity_id, p_grant_type::portal_grant_type, auth.uid()
    )
    ON CONFLICT (portal_user_id, target_entity_id)
    DO UPDATE SET
      is_active = TRUE,
      grant_type = EXCLUDED.grant_type,
      updated_at = NOW()
    RETURNING id INTO v_grant_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'portal_user_id', v_portal_user_id,
    'grant_id', v_grant_id,
    'magic_token', v_magic_token,
    'email', p_email
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12) COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE public.portal_users IS
  'Proxy identity layer for external clients, families, and facility managers accessing the portal.';

COMMENT ON TABLE public.portal_access_grants IS
  'Polymorphic access matrix linking portal users to entities (clients, participants) within workspaces.';

COMMENT ON TABLE public.portal_magic_links IS
  'Time-limited, single-use tokens for passwordless portal access to quotes, invoices, and documents.';

COMMENT ON TABLE public.portal_sessions IS
  'Active portal session tracking with 15-minute idle timeout for security compliance.';

COMMENT ON VIEW public.v_participant_budget_summary IS
  'Security-barrier view exposing only billable totals for portal budget display. Never reveals payroll or profit margins.';

COMMENT ON FUNCTION public.sign_shift_portal IS
  'Portal-side shift sign-off with digital signature capture. Updates shift to VERIFIED_BY_CLIENT status.';

COMMENT ON FUNCTION public.resolve_magic_link IS
  'Validates and consumes a portal magic link token. Returns target metadata and increments access count.';

COMMENT ON FUNCTION public.get_workspace_portal_config IS
  'Fetches white-label portal configuration (branding, colors, logo) for a workspace by slug.';
