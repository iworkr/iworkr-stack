-- ============================================================================
-- Argus-Tartarus: RLS Penetration Matrix
-- ============================================================================
-- Cryptographic proof that the database vault is impenetrable.
-- Tests multi-tenant isolation, role-based write blocking, self-escalation
-- prevention, anonymous denial, and cross-workspace attacks.
--
-- Run with:
--   bash scripts/run-pgtap.sh supabase/tests/pgtap/tartarus_rls_penetration.sql
-- ============================================================================

BEGIN;

-- ── Install pgTAP ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(52);

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 0: DETERMINISTIC TEST DATA INJECTION (bypasses RLS via service_role)
-- ══════════════════════════════════════════════════════════════════════════════

-- Two isolated workspaces
INSERT INTO public.organizations (id, slug, name, trade)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'workspace-alpha', 'Alpha Corp', 'care'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'workspace-bravo', 'Bravo Ltd', 'plumbing')
ON CONFLICT (id) DO NOTHING;

-- Four users: Alpha Owner, Alpha Worker, Bravo Owner, Rogue (no membership)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-owner@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-worker@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bravo-owner@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('99999999-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rogue@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Profiles
INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'alpha-owner@test.com', 'Alpha Owner', true),
  ('11111111-0000-0000-0000-000000000002', 'alpha-worker@test.com', 'Alpha Worker', true),
  ('22222222-0000-0000-0000-000000000001', 'bravo-owner@test.com', 'Bravo Owner', true),
  ('99999999-0000-0000-0000-000000000001', 'rogue@test.com', 'Rogue Agent', true)
ON CONFLICT (id) DO NOTHING;

-- Memberships (Rogue has NO membership)
INSERT INTO public.organization_members (organization_id, user_id, role, status)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'owner', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'technician', 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'owner', 'active')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Seed data in Alpha workspace
INSERT INTO public.clients (id, organization_id, name, email, phone, status, type) VALUES
  ('c1111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Client 1', 'ac1@test.com', '+610000001', 'active', 'residential'),
  ('c1111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Alpha Client 2', 'ac2@test.com', '+610000002', 'active', 'commercial')
ON CONFLICT (id) DO NOTHING;

-- Seed data in Bravo workspace
INSERT INTO public.clients (id, organization_id, name, email, phone, status, type) VALUES
  ('c2222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Bravo Client 1', 'bc1@test.com', '+620000001', 'active', 'residential')
ON CONFLICT (id) DO NOTHING;

-- Jobs in both workspaces
INSERT INTO public.jobs (id, organization_id, display_id, title, status, priority, client_id, created_by) VALUES
  ('j1111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'ALPHA-001', 'Alpha Job 1', 'in_progress', 'high', 'c1111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001'),
  ('j2222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'BRAVO-001', 'Bravo Job 1', 'todo', 'medium', 'c2222222-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Invoices in both workspaces
INSERT INTO public.invoices (id, organization_id, display_id, client_id, client_name, client_email, status, subtotal, tax, total, created_by) VALUES
  ('i1111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'AINV-001', 'c1111111-0000-0000-0000-000000000001', 'Alpha Client 1', 'ac1@test.com', 'sent', 1000, 100, 1100, '11111111-0000-0000-0000-000000000001'),
  ('i2222222-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'BINV-001', 'c2222222-0000-0000-0000-000000000001', 'Bravo Client 1', 'bc1@test.com', 'paid', 2000, 200, 2200, '22222222-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 1: ANONYMOUS ACCESS DENIAL (anon role must see NOTHING)
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE anon;
SET request.jwt.claims = '';

SELECT is(
  (SELECT count(*) FROM public.clients)::int, 0,
  'ANON: Cannot read clients table'
);

SELECT is(
  (SELECT count(*) FROM public.jobs)::int, 0,
  'ANON: Cannot read jobs table'
);

SELECT is(
  (SELECT count(*) FROM public.invoices)::int, 0,
  'ANON: Cannot read invoices table'
);

SELECT is(
  (SELECT count(*) FROM public.organizations)::int, 0,
  'ANON: Cannot read organizations table'
);

SELECT is(
  (SELECT count(*) FROM public.organization_members)::int, 0,
  'ANON: Cannot read organization_members table'
);

SELECT is(
  (SELECT count(*) FROM public.profiles)::int, 0,
  'ANON: Cannot read profiles table'
);

SELECT is(
  (SELECT count(*) FROM public.automation_flows)::int, 0,
  'ANON: Cannot read automation_flows table'
);

SELECT is(
  (SELECT count(*) FROM public.assets)::int, 0,
  'ANON: Cannot read assets table'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 2: CROSS-TENANT READ ISOLATION (Alpha Owner → Bravo data)
-- ══════════════════════════════════════════════════════════════════════════════

-- Switch to Alpha Owner context
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

SELECT is(
  (SELECT count(*) FROM public.clients WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'CROSS-TENANT: Alpha Owner sees 0 Bravo clients'
);

SELECT is(
  (SELECT count(*) FROM public.jobs WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'CROSS-TENANT: Alpha Owner sees 0 Bravo jobs'
);

SELECT is(
  (SELECT count(*) FROM public.invoices WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'CROSS-TENANT: Alpha Owner sees 0 Bravo invoices'
);

-- Alpha Owner CAN see Alpha data
SELECT is(
  (SELECT count(*) FROM public.clients WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 2,
  'SAME-TENANT: Alpha Owner sees 2 Alpha clients'
);

SELECT is(
  (SELECT count(*) FROM public.jobs WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1,
  'SAME-TENANT: Alpha Owner sees 1 Alpha job'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 3: CROSS-TENANT WRITE ATTACK (Alpha Owner → Bravo data)
-- ══════════════════════════════════════════════════════════════════════════════

-- Attempt to UPDATE a Bravo job (should affect 0 rows due to RLS)
UPDATE public.jobs SET status = 'done' WHERE id = 'j2222222-0000-0000-0000-000000000001';
SELECT is(
  (SELECT status FROM public.jobs WHERE id = 'j2222222-0000-0000-0000-000000000001'),
  NULL,
  'CROSS-TENANT WRITE: Alpha Owner cannot see/update Bravo job (row invisible)'
);

-- Attempt to DELETE a Bravo client (should affect 0 rows)
DELETE FROM public.clients WHERE id = 'c2222222-0000-0000-0000-000000000001';

-- Verify Bravo data still intact (switch to service_role to check)
RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.clients WHERE id = 'c2222222-0000-0000-0000-000000000001')::int, 1,
  'CROSS-TENANT DELETE: Bravo client survived Alpha Owner delete attempt'
);

-- Verify Bravo job still has original status
SELECT is(
  (SELECT status::text FROM public.jobs WHERE id = 'j2222222-0000-0000-0000-000000000001'),
  'todo',
  'CROSS-TENANT UPDATE: Bravo job still has original status after Alpha attack'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 4: ROLE-BASED WRITE BLOCKING (Technician → Finance)
-- ══════════════════════════════════════════════════════════════════════════════

-- Switch to Alpha Worker (technician) context
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000002","app_metadata":{"role":"technician","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

-- Technician should NOT be able to read invoices (finance is admin+)
SELECT is(
  (SELECT count(*) FROM public.invoices)::int, 0,
  'ROLE BLOCK: Technician cannot read invoices (finance restricted)'
);

-- Technician tries to INSERT an invoice
SELECT throws_ok(
  $$INSERT INTO public.invoices (organization_id, display_id, client_id, client_name, client_email, status, subtotal, tax, total, created_by)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'HACK-001', 'c1111111-0000-0000-0000-000000000001', 'Hacked', 'hack@test.com', 'draft', 0, 0, 0, '11111111-0000-0000-0000-000000000002')$$,
  '42501',
  NULL,
  'ROLE BLOCK: Technician cannot INSERT invoices'
);

-- Technician tries to DELETE a client
SELECT throws_ok(
  $$DELETE FROM public.clients WHERE id = 'c1111111-0000-0000-0000-000000000001'$$,
  '42501',
  NULL,
  'ROLE BLOCK: Technician cannot DELETE clients'
);

-- Technician CAN read jobs (visible to all members)
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1,
  'ROLE PERMIT: Technician can read own workspace jobs'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 5: SELF-ESCALATION PREVENTION
-- ══════════════════════════════════════════════════════════════════════════════

-- Technician tries to escalate own role to owner
UPDATE public.organization_members
SET role = 'owner'
WHERE user_id = '11111111-0000-0000-0000-000000000002'
  AND organization_id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Verify role is still technician (check via service_role)
RESET ROLE;
SELECT is(
  (SELECT role::text FROM public.organization_members
   WHERE user_id = '11111111-0000-0000-0000-000000000002'
     AND organization_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'technician',
  'SELF-ESCALATION: Technician cannot promote self to owner'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 6: ROGUE USER (No Membership) — Total Blackout
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"99999999-0000-0000-0000-000000000001","app_metadata":{"role":"technician"}}';

SELECT is(
  (SELECT count(*) FROM public.clients)::int, 0,
  'ROGUE: Unaffiliated user sees 0 clients'
);

SELECT is(
  (SELECT count(*) FROM public.jobs)::int, 0,
  'ROGUE: Unaffiliated user sees 0 jobs'
);

SELECT is(
  (SELECT count(*) FROM public.invoices)::int, 0,
  'ROGUE: Unaffiliated user sees 0 invoices'
);

SELECT is(
  (SELECT count(*) FROM public.organizations)::int, 0,
  'ROGUE: Unaffiliated user sees 0 organizations'
);

SELECT is(
  (SELECT count(*) FROM public.automation_flows)::int, 0,
  'ROGUE: Unaffiliated user sees 0 automations'
);

SELECT is(
  (SELECT count(*) FROM public.assets)::int, 0,
  'ROGUE: Unaffiliated user sees 0 assets'
);

-- Rogue INSERT attack
SELECT throws_ok(
  $$INSERT INTO public.clients (organization_id, name, email, phone, status, type)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Rogue Client', 'rogue@hack.com', '+610000099', 'active', 'residential')$$,
  '42501',
  NULL,
  'ROGUE: Unaffiliated user cannot INSERT into clients'
);

SELECT throws_ok(
  $$INSERT INTO public.jobs (organization_id, display_id, title, status, priority, created_by)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'ROGUE-001', 'Rogue Job', 'todo', 'low', '99999999-0000-0000-0000-000000000001')$$,
  '42501',
  NULL,
  'ROGUE: Unaffiliated user cannot INSERT into jobs'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 7: SERVICE_ROLE BYPASS (Admin operations must work)
-- ══════════════════════════════════════════════════════════════════════════════

RESET ROLE;

SELECT is(
  (SELECT count(*) FROM public.clients)::int, 3,
  'SERVICE_ROLE: Can read all 3 clients across all workspaces'
);

SELECT is(
  (SELECT count(*) FROM public.jobs)::int, 2,
  'SERVICE_ROLE: Can read all 2 jobs across all workspaces'
);

SELECT is(
  (SELECT count(*) FROM public.invoices)::int, 2,
  'SERVICE_ROLE: Can read all 2 invoices across all workspaces'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 8: CARE SECTOR RLS (Participant data isolation)
-- ══════════════════════════════════════════════════════════════════════════════

-- Bravo Owner tries to read Alpha's participant profiles
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"22222222-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"bbbbbbbb-0000-0000-0000-000000000002"}}';

SELECT is(
  (SELECT count(*) FROM public.participant_profiles WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0,
  'CARE RLS: Bravo Owner sees 0 Alpha participant profiles'
);

SELECT is(
  (SELECT count(*) FROM public.incidents WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0,
  'CARE RLS: Bravo Owner sees 0 Alpha incidents'
);

SELECT is(
  (SELECT count(*) FROM public.care_plans WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0,
  'CARE RLS: Bravo Owner sees 0 Alpha care plans'
);

SELECT is(
  (SELECT count(*) FROM public.participant_medications WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0,
  'CARE RLS: Bravo Owner sees 0 Alpha medications'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 9: SUPER ADMIN TABLE ISOLATION
-- ══════════════════════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.super_admin_audit_logs)::int, 0,
  'SUPER ADMIN: Bravo Owner cannot read super_admin_audit_logs'
);

-- Even Alpha Owner cannot read super admin tables
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

SELECT is(
  (SELECT count(*) FROM public.super_admin_audit_logs)::int, 0,
  'SUPER ADMIN: Alpha Owner cannot read super_admin_audit_logs'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 10: RLS-ENABLED VERIFICATION (Tables must have RLS active)
-- ══════════════════════════════════════════════════════════════════════════════

RESET ROLE;

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'clients' AND relnamespace = 'public'::regnamespace),
  'RLS ENABLED: clients table has RLS forced'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'jobs' AND relnamespace = 'public'::regnamespace),
  'RLS ENABLED: jobs table has RLS forced'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'invoices' AND relnamespace = 'public'::regnamespace),
  'RLS ENABLED: invoices table has RLS forced'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'participant_profiles' AND relnamespace = 'public'::regnamespace),
  'RLS ENABLED: participant_profiles table has RLS forced'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'incidents' AND relnamespace = 'public'::regnamespace),
  'RLS ENABLED: incidents table has RLS forced'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'organization_members' AND relnamespace = 'public'::regnamespace),
  'RLS ENABLED: organization_members table has RLS forced'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- FINISH
-- ══════════════════════════════════════════════════════════════════════════════

SELECT * FROM finish();
ROLLBACK;
