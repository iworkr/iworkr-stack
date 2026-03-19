-- ============================================================
-- Migration 145: Project Aegis-RBAC — Granular Permission Matrices
-- Version 147.0 — "Cryptographic Abstraction & Zero-Trust Governance"
-- ============================================================

-- ── 1. System Permissions Dictionary ────────────────────────
CREATE TABLE IF NOT EXISTS public.system_permissions (
  id                VARCHAR(100) PRIMARY KEY,
  module            VARCHAR(50) NOT NULL,
  action            VARCHAR(20) NOT NULL,
  human_description TEXT,
  is_dangerous      BOOLEAN DEFAULT false,
  depends_on        VARCHAR(100) REFERENCES public.system_permissions(id),
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read system permissions" ON public.system_permissions
  FOR SELECT USING (true);

-- ── 2. Upgrade organization_roles with immutability ─────────
ALTER TABLE public.organization_roles
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_immutable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default_for_new_members BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ── 3. Role-Permission Junction Table ───────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id        UUID NOT NULL REFERENCES public.organization_roles(id) ON DELETE CASCADE,
  permission_id  VARCHAR(100) NOT NULL REFERENCES public.system_permissions(id) ON DELETE CASCADE,
  granted_at     TIMESTAMPTZ DEFAULT now(),
  granted_by     UUID REFERENCES auth.users(id),
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage role permissions" ON public.role_permissions FOR ALL
  USING (role_id IN (
    SELECT r.id FROM public.organization_roles r
    JOIN public.organization_members om ON om.organization_id = r.organization_id
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  ));

-- ── 4. Permission audit log ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permission_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id         UUID NOT NULL REFERENCES auth.users(id),
  action           VARCHAR(50) NOT NULL,
  target_role_id   UUID REFERENCES public.organization_roles(id),
  target_user_id   UUID,
  details          JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view audit log" ON public.permission_audit_log FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

-- ── 5. Seed the System Permissions Dictionary (60+ entries) ──

-- === MODULE: DASHBOARD ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, sort_order) VALUES
('dashboard:read',              'DASHBOARD', 'READ',    'View the main dashboard and telemetry widgets', false, 1),
('dashboard:read_analytics',    'DASHBOARD', 'READ',    'View analytics and reporting dashboards', false, 2)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: JOBS ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('jobs:read',           'JOBS', 'READ',    'View all jobs and job details', false, NULL, 10),
('jobs:create',         'JOBS', 'WRITE',   'Create new jobs', false, 'jobs:read', 11),
('jobs:edit',           'JOBS', 'WRITE',   'Edit existing jobs', false, 'jobs:read', 12),
('jobs:delete',         'JOBS', 'DELETE',  'Delete jobs permanently', true, 'jobs:read', 13),
('jobs:assign',         'JOBS', 'EXECUTE', 'Assign workers to jobs', false, 'jobs:read', 14),
('jobs:close',          'JOBS', 'EXECUTE', 'Close/complete jobs', false, 'jobs:read', 15)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: ROSTER / SCHEDULING ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('roster:read',         'ROSTER', 'READ',    'View the master roster and schedules', false, NULL, 20),
('roster:create',       'ROSTER', 'WRITE',   'Create shifts and schedule entries', false, 'roster:read', 21),
('roster:edit',         'ROSTER', 'WRITE',   'Edit existing shifts', false, 'roster:read', 22),
('roster:delete',       'ROSTER', 'DELETE',  'Delete shifts', true, 'roster:read', 23),
('roster:publish',      'ROSTER', 'EXECUTE', 'Publish the roster to workers', false, 'roster:read', 24),
('roster:assign',       'ROSTER', 'EXECUTE', 'Assign workers to shifts via drag-and-drop', false, 'roster:read', 25)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: CLIENTS / CONTACTS ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('clients:read',        'CLIENTS', 'READ',    'View client profiles and contacts', false, NULL, 30),
('clients:create',      'CLIENTS', 'WRITE',   'Create new clients', false, 'clients:read', 31),
('clients:edit',        'CLIENTS', 'WRITE',   'Edit client details', false, 'clients:read', 32),
('clients:delete',      'CLIENTS', 'DELETE',  'Delete client records', true, 'clients:read', 33),
('clients:export',      'CLIENTS', 'EXECUTE', 'Export client data to CSV/PDF', true, 'clients:read', 34)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: PARTICIPANTS (NDIS/Care) ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('participants:read_basic',    'PARTICIPANTS', 'READ',    'View participant name, address, phone', false, NULL, 40),
('participants:read_finance',  'PARTICIPANTS', 'READ',    'View participant NDIS funding, balance, plan details', true, 'participants:read_basic', 41),
('participants:read_clinical', 'PARTICIPANTS', 'READ',    'View participant medical notes, trauma history, diagnoses', true, 'participants:read_basic', 42),
('participants:create',        'PARTICIPANTS', 'WRITE',   'Create new participants', false, 'participants:read_basic', 43),
('participants:edit',          'PARTICIPANTS', 'WRITE',   'Edit participant details', false, 'participants:read_basic', 44),
('participants:delete',        'PARTICIPANTS', 'DELETE',  'Delete participant records', true, 'participants:read_basic', 45)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: FINANCE / BILLING ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('finance:read_invoices',    'FINANCE', 'READ',    'View invoices and billing history', false, NULL, 50),
('finance:write_invoices',   'FINANCE', 'WRITE',   'Create and edit invoice drafts', false, 'finance:read_invoices', 51),
('finance:delete_invoices',  'FINANCE', 'DELETE',  'Delete finalized invoices', true, 'finance:read_invoices', 52),
('finance:execute_sync',     'FINANCE', 'EXECUTE', 'Sync invoices to Xero/QBO and mark as paid', true, 'finance:read_invoices', 53),
('finance:read_margins',     'FINANCE', 'READ',    'View gross profit margins on jobs and quotes', true, NULL, 54),
('finance:export_csv',       'FINANCE', 'EXECUTE', 'Export financial reports to CSV', true, 'finance:read_invoices', 55),
('finance:manage_stripe',    'FINANCE', 'EXECUTE', 'Manage Stripe Connect and payout settings', true, NULL, 56),
('finance:read_payroll',     'FINANCE', 'READ',    'View payroll summaries and pay lines', true, NULL, 57),
('finance:write_payroll',    'FINANCE', 'WRITE',   'Edit payroll rules and EBA agreements', true, 'finance:read_payroll', 58)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: TIMESHEETS ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('timesheets:read_self',    'TIMESHEETS', 'READ',    'View own timesheets only', false, NULL, 60),
('timesheets:read_all',     'TIMESHEETS', 'READ',    'View all team timesheets', false, NULL, 61),
('timesheets:create',       'TIMESHEETS', 'WRITE',   'Submit timesheets', false, 'timesheets:read_self', 62),
('timesheets:approve',      'TIMESHEETS', 'EXECUTE', 'Approve or reject submitted timesheets', false, 'timesheets:read_all', 63),
('timesheets:edit',         'TIMESHEETS', 'WRITE',   'Edit any timesheet', false, 'timesheets:read_all', 64),
('timesheets:delete',       'TIMESHEETS', 'DELETE',  'Delete timesheets', true, 'timesheets:read_all', 65)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: CLINICAL (Notes, SWMS, SIRS) ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('clinical:read_notes',     'CLINICAL', 'READ',    'View shift notes and progress notes', false, NULL, 70),
('clinical:write_notes',    'CLINICAL', 'WRITE',   'Create and edit clinical notes', false, 'clinical:read_notes', 71),
('clinical:delete_notes',   'CLINICAL', 'DELETE',  'Delete clinical notes', true, 'clinical:read_notes', 72),
('clinical:read_sirs',      'CLINICAL', 'READ',    'View SIRS incident reports', true, NULL, 73),
('clinical:manage_sirs',    'CLINICAL', 'EXECUTE', 'Triage and manage SIRS submissions', true, 'clinical:read_sirs', 74),
('clinical:read_goals',     'CLINICAL', 'READ',    'View participant goals and progress', false, NULL, 75),
('clinical:write_goals',    'CLINICAL', 'WRITE',   'Create and edit goals', false, 'clinical:read_goals', 76),
('clinical:read_reviews',   'CLINICAL', 'READ',    'View plan reviews and AI syntheses', false, NULL, 77),
('clinical:write_reviews',  'CLINICAL', 'EXECUTE', 'Generate and finalize plan reviews', false, 'clinical:read_reviews', 78)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: FLEET / VEHICLES ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('fleet:read',          'FLEET', 'READ',    'View vehicles, inspections, and defects', false, NULL, 80),
('fleet:create',        'FLEET', 'WRITE',   'Add new vehicles', false, 'fleet:read', 81),
('fleet:edit',          'FLEET', 'WRITE',   'Edit vehicle details and service records', false, 'fleet:read', 82),
('fleet:delete',        'FLEET', 'DELETE',  'Remove vehicles from fleet', true, 'fleet:read', 83)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: ASSETS ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('assets:read',         'ASSETS', 'READ',    'View asset inventory', false, NULL, 90),
('assets:create',       'ASSETS', 'WRITE',   'Register new assets', false, 'assets:read', 91),
('assets:edit',         'ASSETS', 'WRITE',   'Edit asset details and service schedules', false, 'assets:read', 92),
('assets:delete',       'ASSETS', 'DELETE',  'Delete assets', true, 'assets:read', 93)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: TEAM / WORKFORCE ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('team:read',              'TEAM', 'READ',    'View team members and their profiles', false, NULL, 100),
('team:invite',            'TEAM', 'WRITE',   'Invite new members to the workspace', false, 'team:read', 101),
('team:edit',              'TEAM', 'WRITE',   'Edit team member details', false, 'team:read', 102),
('team:remove',            'TEAM', 'DELETE',  'Remove team members', true, 'team:read', 103),
('team:manage_roles',      'TEAM', 'EXECUTE', 'Assign and change member roles', true, 'team:read', 104)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: SETTINGS ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('settings:read',                'SETTINGS', 'READ',    'View workspace settings', false, NULL, 110),
('settings:write',               'SETTINGS', 'WRITE',   'Edit workspace settings', true, 'settings:read', 111),
('settings:manage_integrations', 'SETTINGS', 'EXECUTE', 'Connect and disconnect integrations (Xero, Stripe)', true, 'settings:read', 112),
('settings:manage_billing',      'SETTINGS', 'EXECUTE', 'Manage subscription and billing', true, 'settings:read', 113),
('settings:manage_roles',        'SETTINGS', 'EXECUTE', 'Create, edit, and delete custom roles', true, 'settings:read', 114),
('settings:manage_branches',     'SETTINGS', 'EXECUTE', 'Manage branches and locations', false, 'settings:read', 115)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: FORMS / AUTOMATION ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('forms:read',          'FORMS', 'READ',    'View form templates and submissions', false, NULL, 120),
('forms:create',        'FORMS', 'WRITE',   'Create and edit form templates', false, 'forms:read', 121),
('forms:delete',        'FORMS', 'DELETE',  'Delete form templates', true, 'forms:read', 122),
('automations:read',    'AUTOMATIONS', 'READ',    'View automation workflows', false, NULL, 123),
('automations:write',   'AUTOMATIONS', 'WRITE',   'Create and edit automations', false, 'automations:read', 124),
('automations:execute', 'AUTOMATIONS', 'EXECUTE', 'Trigger automations manually', false, 'automations:read', 125)
ON CONFLICT (id) DO NOTHING;

-- === MODULE: SAFETY (SWMS) ===
INSERT INTO public.system_permissions (id, module, action, human_description, is_dangerous, depends_on, sort_order) VALUES
('safety:read',         'SAFETY', 'READ',    'View SWMS templates and records', false, NULL, 130),
('safety:create',       'SAFETY', 'WRITE',   'Create SWMS templates', false, 'safety:read', 131),
('safety:submit',       'SAFETY', 'EXECUTE', 'Complete and submit on-site SWMS', false, 'safety:read', 132),
('safety:manage',       'SAFETY', 'EXECUTE', 'Manage safety compliance radar', true, 'safety:read', 133)
ON CONFLICT (id) DO NOTHING;

-- ── 6. RPC: Get permissions for JWT injection ───────────────
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID, p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_permissions TEXT[];
  v_role_id UUID;
  v_role_name TEXT;
  v_is_owner BOOLEAN;
BEGIN
  -- Get the user's role in this org
  SELECT om.role_id, om.role::text = 'owner'
  INTO v_role_id, v_is_owner
  FROM public.organization_members om
  WHERE om.user_id = p_user_id AND om.organization_id = p_org_id AND om.status = 'active';

  -- Owners get ALL permissions (superadmin)
  IF v_is_owner THEN
    SELECT array_agg(sp.id ORDER BY sp.sort_order)
    INTO v_permissions
    FROM public.system_permissions sp;

    RETURN json_build_object(
      'permissions', v_permissions,
      'role_name', 'Owner',
      'is_owner', true
    );
  END IF;

  -- If role_id is set, get from junction table
  IF v_role_id IS NOT NULL THEN
    SELECT r.name INTO v_role_name
    FROM public.organization_roles r WHERE r.id = v_role_id;

    SELECT array_agg(rp.permission_id ORDER BY sp.sort_order)
    INTO v_permissions
    FROM public.role_permissions rp
    JOIN public.system_permissions sp ON sp.id = rp.permission_id
    WHERE rp.role_id = v_role_id;

    RETURN json_build_object(
      'permissions', COALESCE(v_permissions, ARRAY[]::TEXT[]),
      'role_name', COALESCE(v_role_name, 'Custom'),
      'is_owner', false
    );
  END IF;

  -- Fallback: map legacy ENUM to basic permissions
  SELECT CASE om.role::text
    WHEN 'admin' THEN (SELECT array_agg(id) FROM public.system_permissions)
    WHEN 'manager' THEN (SELECT array_agg(id) FROM public.system_permissions WHERE NOT is_dangerous)
    WHEN 'office_admin' THEN (SELECT array_agg(id) FROM public.system_permissions WHERE module IN ('DASHBOARD','JOBS','CLIENTS','FINANCE','TIMESHEETS','ROSTER','FORMS'))
    WHEN 'senior_tech' THEN ARRAY['dashboard:read','jobs:read','jobs:edit','roster:read','timesheets:read_self','timesheets:create','clinical:read_notes','clinical:write_notes','safety:read','safety:submit','fleet:read','assets:read']
    WHEN 'technician' THEN ARRAY['dashboard:read','jobs:read','roster:read','timesheets:read_self','timesheets:create','clinical:read_notes','clinical:write_notes','safety:read','safety:submit']
    WHEN 'apprentice' THEN ARRAY['dashboard:read','jobs:read','roster:read','timesheets:read_self','timesheets:create','safety:read','safety:submit']
    WHEN 'subcontractor' THEN ARRAY['dashboard:read','jobs:read','timesheets:read_self','timesheets:create']
    ELSE ARRAY['dashboard:read']
  END INTO v_permissions
  FROM public.organization_members om
  WHERE om.user_id = p_user_id AND om.organization_id = p_org_id AND om.status = 'active';

  RETURN json_build_object(
    'permissions', COALESCE(v_permissions, ARRAY[]::TEXT[]),
    'role_name', 'Legacy',
    'is_owner', false
  );
END;
$$;

-- ── 7. Auth Hook: Custom Access Token (JWT Injector) ────────
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_claims JSONB;
  v_org_id UUID;
  v_perms_result JSON;
  v_permissions TEXT[];
BEGIN
  v_user_id := (event->>'user_id')::uuid;
  v_claims := event->'claims';

  -- Get the user's active workspace
  v_org_id := (v_claims->'app_metadata'->>'active_workspace')::uuid;

  -- If no active workspace, try to find their primary one
  IF v_org_id IS NULL THEN
    SELECT om.organization_id INTO v_org_id
    FROM public.organization_members om
    WHERE om.user_id = v_user_id AND om.status = 'active'
    ORDER BY om.joined_at ASC
    LIMIT 1;
  END IF;

  IF v_org_id IS NOT NULL THEN
    -- Get compiled permissions
    v_perms_result := public.get_user_permissions(v_user_id, v_org_id);

    -- Inject into JWT claims
    v_claims := jsonb_set(v_claims, '{app_metadata,permissions}',
      COALESCE((v_perms_result->>'permissions')::jsonb, '[]'::jsonb));
    v_claims := jsonb_set(v_claims, '{app_metadata,role_name}',
      to_jsonb(v_perms_result->>'role_name'));
    v_claims := jsonb_set(v_claims, '{app_metadata,active_workspace}',
      to_jsonb(v_org_id::text));
  ELSE
    v_claims := jsonb_set(v_claims, '{app_metadata,permissions}', '[]'::jsonb);
  END IF;

  event := jsonb_set(event, '{claims}', v_claims);
  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin (required for Auth Hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT ALL ON TABLE public.system_permissions TO supabase_auth_admin;
GRANT ALL ON TABLE public.organization_members TO supabase_auth_admin;
GRANT ALL ON TABLE public.organization_roles TO supabase_auth_admin;
GRANT ALL ON TABLE public.role_permissions TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ── 8. RPC: Get RBAC dashboard stats ────────────────────────
CREATE OR REPLACE FUNCTION public.get_rbac_stats(p_org_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total_roles INT;
  v_total_perms INT;
  v_custom_roles INT;
  v_members_with_roles INT;
  v_members_without INT;
BEGIN
  SELECT COUNT(*) INTO v_total_roles FROM public.organization_roles WHERE organization_id = p_org_id;
  SELECT COUNT(*) INTO v_total_perms FROM public.system_permissions;
  SELECT COUNT(*) INTO v_custom_roles FROM public.organization_roles WHERE organization_id = p_org_id AND is_system_role = false;
  SELECT COUNT(*) INTO v_members_with_roles FROM public.organization_members WHERE organization_id = p_org_id AND role_id IS NOT NULL AND status = 'active';
  SELECT COUNT(*) INTO v_members_without FROM public.organization_members WHERE organization_id = p_org_id AND role_id IS NULL AND status = 'active';

  RETURN json_build_object(
    'total_roles', v_total_roles,
    'total_permissions', v_total_perms,
    'custom_roles', v_custom_roles,
    'members_with_custom_roles', v_members_with_roles,
    'members_on_legacy_roles', v_members_without
  );
END;
$$;

-- ── 9. Enable realtime for role changes ─────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
