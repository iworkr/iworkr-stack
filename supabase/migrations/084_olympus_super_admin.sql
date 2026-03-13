-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 084: Project Olympus — Super Admin Control Plane
-- Adds is_super_admin flag, immutable audit logs, organization feature flags,
-- and subscription override infrastructure.
-- SAFE: All statements use IF NOT EXISTS / DO blocks.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Super Admin flag on profiles ─────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_super_admin boolean DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.is_super_admin IS 'God-mode flag. Only settable via direct DB access or migration seed. Gates /olympus/* routes.';

-- ─── 2. Super Admin Audit Logs (Immutable) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.super_admin_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL,
  admin_email     text NOT NULL,

  action_type     text NOT NULL CHECK (action_type IN (
    'VIEW_WORKSPACE', 'UPDATE_WORKSPACE', 'DELETE_WORKSPACE', 'FREEZE_WORKSPACE',
    'VIEW_USER', 'IMPERSONATE_USER', 'FORCE_LOGOUT', 'RESET_PASSWORD', 'VERIFY_EMAIL',
    'UPDATE_SUBSCRIPTION', 'OVERRIDE_PLAN', 'REPLAY_WEBHOOK',
    'VIEW_TABLE', 'INSERT_ROW', 'UPDATE_ROW', 'DELETE_ROW',
    'TOGGLE_FEATURE', 'UPDATE_QUOTA',
    'SYSTEM_ACTION'
  )),

  target_table    text,
  target_record_id text,                -- uuid as text to support composite keys
  target_org_id   uuid,

  previous_state  jsonb,                -- Snapshot before mutation
  new_state       jsonb,                -- Snapshot after mutation
  mutation_payload jsonb,               -- Raw request payload

  ip_address      text,
  user_agent      text,
  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Immutable: RLS enabled with INSERT-only policy, NO delete/update policies
ALTER TABLE public.super_admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'super_admin_audit_logs' AND policyname = 'Super admins insert audit logs') THEN
    EXECUTE 'CREATE POLICY "Super admins insert audit logs" ON public.super_admin_audit_logs FOR INSERT WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'super_admin_audit_logs' AND policyname = 'Super admins read audit logs') THEN
    EXECUTE 'CREATE POLICY "Super admins read audit logs" ON public.super_admin_audit_logs FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
    )';
  END IF;
END $$;

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_admin ON public.super_admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target ON public.super_admin_audit_logs (target_table, target_record_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON public.super_admin_audit_logs (target_org_id) WHERE target_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_time ON public.super_admin_audit_logs (created_at DESC);

COMMENT ON TABLE public.super_admin_audit_logs IS 'Immutable audit trail for all Super Admin actions. No UPDATE or DELETE policies — forensic compliance (SOC2/ISO27001).';

-- ─── 3. Organization Feature Flags ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_features (
  organization_id       uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Beta feature toggles
  beta_proda_claims     boolean DEFAULT false,
  beta_ai_scheduling    boolean DEFAULT false,
  beta_advanced_analytics boolean DEFAULT false,
  beta_mobile_offline   boolean DEFAULT false,
  beta_family_portal    boolean DEFAULT false,

  -- Quota overrides
  max_storage_gb        integer DEFAULT 10,
  max_sms_monthly       integer DEFAULT 100,
  max_api_calls_daily   integer DEFAULT 5000,

  -- Manual subscription override (bypasses Stripe)
  manual_tier_override  text CHECK (manual_tier_override IN (
    'free', 'starter', 'standard', 'enterprise', NULL
  )),
  override_reason       text,
  override_expires_at   timestamptz,
  override_set_by       uuid,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_features' AND policyname = 'Super admins manage features') THEN
    EXECUTE 'CREATE POLICY "Super admins manage features" ON public.organization_features FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_super_admin = true
      )
    )';
  END IF;

  -- Org owners can read their own feature flags
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_features' AND policyname = 'Org members read own features') THEN
    EXECUTE 'CREATE POLICY "Org members read own features" ON public.organization_features FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE organization_members.organization_id = organization_features.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = ''active''
      )
    )';
  END IF;
END $$;

COMMENT ON TABLE public.organization_features IS 'Per-tenant feature flags, quota overrides, and manual subscription overrides. Managed via Project Olympus.';

-- ─── 4. Trigger for updated_at on organization_features ─────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_organization_features_updated_at') THEN
    CREATE TRIGGER set_organization_features_updated_at
      BEFORE UPDATE ON public.organization_features
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- ─── 5. Seed the super admin account ────────────────────────────────────────
-- This updates the profile if it already exists, or does nothing if user
-- hasn't been created via auth yet. The actual user creation happens via
-- Supabase Auth (seed script or manual).

DO $$ BEGIN
  UPDATE public.profiles
  SET is_super_admin = true
  WHERE email = 'theo@iworkrapp.com';
END $$;
