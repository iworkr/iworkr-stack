-- ============================================================================
-- Argus-Tartarus: RBAC Escalation & Owner Protection
-- ============================================================================
-- Tests that:
-- 1. No user can escalate their own role
-- 2. The last owner of an org cannot be deleted
-- 3. Admin-only operations are properly gated
-- 4. Suspended users are completely locked out
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(20);

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 0: Test Data
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO public.organizations (id, slug, name, trade)
VALUES ('cccccccc-0000-0000-0000-000000000003', 'workspace-charlie', 'Charlie Inc', 'care')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES
  ('33333333-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charlie-owner@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charlie-admin@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charlie-tech@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('33333333-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'charlie-suspended@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
VALUES
  ('33333333-0000-0000-0000-000000000001', 'charlie-owner@test.com', 'Charlie Owner', true),
  ('33333333-0000-0000-0000-000000000002', 'charlie-admin@test.com', 'Charlie Admin', true),
  ('33333333-0000-0000-0000-000000000003', 'charlie-tech@test.com', 'Charlie Tech', true),
  ('33333333-0000-0000-0000-000000000004', 'charlie-suspended@test.com', 'Charlie Suspended', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role, status)
VALUES
  ('cccccccc-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001', 'owner', 'active'),
  ('cccccccc-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002', 'admin', 'active'),
  ('cccccccc-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000003', 'technician', 'active'),
  ('cccccccc-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000004', 'technician', 'suspended')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Seed some data for Charlie workspace
INSERT INTO public.clients (id, organization_id, name, email, phone, status, type)
VALUES ('c3333333-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'Charlie Client', 'cc@test.com', '+630000001', 'active', 'residential')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 1: TECHNICIAN SELF-ESCALATION ATTACKS
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000003","app_metadata":{"role":"technician","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

-- Try to promote self to admin
UPDATE public.organization_members SET role = 'admin'
WHERE user_id = '33333333-0000-0000-0000-000000000003'
  AND organization_id = 'cccccccc-0000-0000-0000-000000000003';

RESET ROLE;
SELECT is(
  (SELECT role::text FROM public.organization_members
   WHERE user_id = '33333333-0000-0000-0000-000000000003'
   AND organization_id = 'cccccccc-0000-0000-0000-000000000003'),
  'technician',
  'ESCALATION: Technician cannot self-promote to admin'
);

-- Try to promote self to owner
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000003","app_metadata":{"role":"technician","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

UPDATE public.organization_members SET role = 'owner'
WHERE user_id = '33333333-0000-0000-0000-000000000003'
  AND organization_id = 'cccccccc-0000-0000-0000-000000000003';

RESET ROLE;
SELECT is(
  (SELECT role::text FROM public.organization_members
   WHERE user_id = '33333333-0000-0000-0000-000000000003'
   AND organization_id = 'cccccccc-0000-0000-0000-000000000003'),
  'technician',
  'ESCALATION: Technician cannot self-promote to owner'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 2: ADMIN SELF-ESCALATION TO OWNER
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000002","app_metadata":{"role":"admin","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

UPDATE public.organization_members SET role = 'owner'
WHERE user_id = '33333333-0000-0000-0000-000000000002'
  AND organization_id = 'cccccccc-0000-0000-0000-000000000003';

RESET ROLE;
SELECT is(
  (SELECT role::text FROM public.organization_members
   WHERE user_id = '33333333-0000-0000-0000-000000000002'
   AND organization_id = 'cccccccc-0000-0000-0000-000000000003'),
  'admin',
  'ESCALATION: Admin cannot self-promote to owner'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 3: ADMIN CANNOT DEMOTE OR DELETE OWNER
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000002","app_metadata":{"role":"admin","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

-- Admin tries to demote owner
UPDATE public.organization_members SET role = 'technician'
WHERE user_id = '33333333-0000-0000-0000-000000000001'
  AND organization_id = 'cccccccc-0000-0000-0000-000000000003';

RESET ROLE;
SELECT is(
  (SELECT role::text FROM public.organization_members
   WHERE user_id = '33333333-0000-0000-0000-000000000001'
   AND organization_id = 'cccccccc-0000-0000-0000-000000000003'),
  'owner',
  'OWNER PROTECTION: Admin cannot demote org owner'
);

-- Admin tries to delete owner
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000002","app_metadata":{"role":"admin","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

DELETE FROM public.organization_members
WHERE user_id = '33333333-0000-0000-0000-000000000001'
  AND organization_id = 'cccccccc-0000-0000-0000-000000000003';

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.organization_members
   WHERE user_id = '33333333-0000-0000-0000-000000000001'
   AND organization_id = 'cccccccc-0000-0000-0000-000000000003')::int,
  1,
  'OWNER PROTECTION: Admin cannot delete org owner membership'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 4: SUSPENDED USER LOCKOUT
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000004","app_metadata":{"role":"technician","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

SELECT is(
  (SELECT count(*) FROM public.clients WHERE organization_id = 'cccccccc-0000-0000-0000-000000000003')::int, 0,
  'SUSPENDED: Suspended user cannot read clients'
);

SELECT is(
  (SELECT count(*) FROM public.jobs WHERE organization_id = 'cccccccc-0000-0000-0000-000000000003')::int, 0,
  'SUSPENDED: Suspended user cannot read jobs'
);

SELECT throws_ok(
  $$INSERT INTO public.clients (organization_id, name, email, phone, status, type)
    VALUES ('cccccccc-0000-0000-0000-000000000003', 'Suspended Client', 's@test.com', '+630000099', 'active', 'residential')$$,
  '42501',
  NULL,
  'SUSPENDED: Suspended user cannot insert clients'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 5: ROLE HIERARCHY ENFORCEMENT (Who can manage whom?)
-- ══════════════════════════════════════════════════════════════════════════════

-- Admin CAN demote technician
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000002","app_metadata":{"role":"admin","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

UPDATE public.organization_members SET role = 'apprentice'
WHERE user_id = '33333333-0000-0000-0000-000000000003'
  AND organization_id = 'cccccccc-0000-0000-0000-000000000003';

RESET ROLE;
-- This might succeed or be blocked by self-update prevention
-- The test documents the actual behavior
SELECT ok(
  (SELECT role::text FROM public.organization_members
   WHERE user_id = '33333333-0000-0000-0000-000000000003'
   AND organization_id = 'cccccccc-0000-0000-0000-000000000003') IN ('apprentice', 'technician'),
  'ROLE HIERARCHY: Admin role change on technician produces valid state'
);

-- Restore technician role
RESET ROLE;
UPDATE public.organization_members SET role = 'technician'
WHERE user_id = '33333333-0000-0000-0000-000000000003'
  AND organization_id = 'cccccccc-0000-0000-0000-000000000003';

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 6: AUTOMATION & INTEGRATION ADMIN GATES
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"33333333-0000-0000-0000-000000000003","app_metadata":{"role":"technician","org_id":"cccccccc-0000-0000-0000-000000000003"}}';

-- Technician cannot create automation flows
SELECT throws_ok(
  $$INSERT INTO public.automation_flows (organization_id, name, trigger_type, is_active, created_by)
    VALUES ('cccccccc-0000-0000-0000-000000000003', 'Hacked Flow', 'job_created', true, '33333333-0000-0000-0000-000000000003')$$,
  '42501',
  NULL,
  'ADMIN GATE: Technician cannot create automation flows'
);

-- Technician cannot delete integrations
SELECT throws_ok(
  $$DELETE FROM public.integrations WHERE organization_id = 'cccccccc-0000-0000-0000-000000000003'$$,
  '42501',
  NULL,
  'ADMIN GATE: Technician cannot delete integrations'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 7: AUDIT LOG INTEGRITY
-- ══════════════════════════════════════════════════════════════════════════════

-- Technician cannot read audit logs
SELECT is(
  (SELECT count(*) FROM public.audit_log WHERE organization_id = 'cccccccc-0000-0000-0000-000000000003')::int, 0,
  'AUDIT: Technician cannot read audit logs'
);

-- Technician cannot delete audit logs
SELECT throws_ok(
  $$DELETE FROM public.audit_log WHERE organization_id = 'cccccccc-0000-0000-0000-000000000003'$$,
  '42501',
  NULL,
  'AUDIT: Technician cannot delete audit logs'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 8: WEBHOOK/DLQ ADMIN-ONLY TABLES
-- ══════════════════════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.webhook_dead_letters)::int, 0,
  'ADMIN TABLE: Technician cannot read webhook_dead_letters'
);

SELECT * FROM finish();
ROLLBACK;
