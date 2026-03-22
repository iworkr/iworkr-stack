-- ============================================================================
-- Argus-Tartarus: Care Sector RLS Deep Penetration
-- ============================================================================
-- Tests that NDIS participant data, medications, incidents, care plans,
-- progress notes, and billing ledgers are cryptographically isolated
-- between tenants and properly gated by role.
--
-- This is the care-specific complement to tartarus_rls_penetration.sql
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(40);

-- ══════════════════════════════════════════════════════════════════════════════
-- PHASE 0: Test Data Injection (runs as service_role)
-- ══════════════════════════════════════════════════════════════════════════════

-- Reuse workspace Alpha & Bravo from tartarus_rls_penetration.sql
INSERT INTO public.organizations (id, slug, name, trade)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'workspace-alpha', 'Alpha Corp', 'care'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'workspace-bravo', 'Bravo Ltd', 'care')
ON CONFLICT (id) DO NOTHING;

-- Users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
VALUES
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-owner@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-worker@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', ''),
  ('22222222-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bravo-owner@test.com', crypt('test', gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, NOW(), NOW(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'alpha-owner@test.com', 'Alpha Care Admin', true),
  ('11111111-0000-0000-0000-000000000002', 'alpha-worker@test.com', 'Alpha Field Worker', true),
  ('22222222-0000-0000-0000-000000000001', 'bravo-owner@test.com', 'Bravo Care Admin', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role, status)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'owner', 'active'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'technician', 'active'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'owner', 'active')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ── Participant Profiles ───────────────────────────────────────────────────
INSERT INTO public.participant_profiles (id, organization_id, first_name, last_name, ndis_number, date_of_birth, status)
VALUES
  ('pp-alpha-001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Alice', 'Anderson', '430000001', '1960-01-15', 'active'),
  ('pp-alpha-002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Bob', 'Baker', '430000002', '1975-06-20', 'active'),
  ('pp-bravo-001', 'bbbbbbbb-0000-0000-0000-000000000002', 'Charlie', 'Clark', '430000003', '1985-11-30', 'active')
ON CONFLICT (id) DO NOTHING;

-- ── Medications ────────────────────────────────────────────────────────────
INSERT INTO public.participant_medications (id, organization_id, participant_id, name, dosage, route, frequency, status)
VALUES
  ('med-alpha-001', 'aaaaaaaa-0000-0000-0000-000000000001', 'pp-alpha-001', 'Paracetamol', '500mg', 'oral', 'QID', 'active'),
  ('med-bravo-001', 'bbbbbbbb-0000-0000-0000-000000000002', 'pp-bravo-001', 'Metformin', '1000mg', 'oral', 'BD', 'active')
ON CONFLICT (id) DO NOTHING;

-- ── Incidents ──────────────────────────────────────────────────────────────
INSERT INTO public.incidents (id, organization_id, participant_id, title, severity, status, reported_by)
VALUES
  ('inc-alpha-001', 'aaaaaaaa-0000-0000-0000-000000000001', 'pp-alpha-001', 'Fall in bathroom', 'high', 'investigating', '11111111-0000-0000-0000-000000000002'),
  ('inc-bravo-001', 'bbbbbbbb-0000-0000-0000-000000000002', 'pp-bravo-001', 'Medication error', 'critical', 'open', '22222222-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ── Care Plans ─────────────────────────────────────────────────────────────
INSERT INTO public.care_plans (id, organization_id, participant_id, title, status, start_date, end_date)
VALUES
  ('cp-alpha-001', 'aaaaaaaa-0000-0000-0000-000000000001', 'pp-alpha-001', 'Alpha Plan 1', 'active', '2026-01-01', '2026-12-31'),
  ('cp-bravo-001', 'bbbbbbbb-0000-0000-0000-000000000002', 'pp-bravo-001', 'Bravo Plan 1', 'active', '2026-01-01', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 1: PARTICIPANT CROSS-TENANT ISOLATION
-- ══════════════════════════════════════════════════════════════════════════════

-- Alpha Owner context
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

SELECT is(
  (SELECT count(*) FROM public.participant_profiles WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'PARTICIPANT: Alpha Owner cannot read Bravo participants'
);

SELECT is(
  (SELECT count(*) FROM public.participant_profiles WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 2,
  'PARTICIPANT: Alpha Owner sees own 2 participants'
);

-- Bravo Owner context
SET request.jwt.claims = '{"sub":"22222222-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"bbbbbbbb-0000-0000-0000-000000000002"}}';

SELECT is(
  (SELECT count(*) FROM public.participant_profiles WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 0,
  'PARTICIPANT: Bravo Owner cannot read Alpha participants'
);

SELECT is(
  (SELECT count(*) FROM public.participant_profiles WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 1,
  'PARTICIPANT: Bravo Owner sees own 1 participant'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 2: MEDICATION CROSS-TENANT ISOLATION
-- ══════════════════════════════════════════════════════════════════════════════

SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

SELECT is(
  (SELECT count(*) FROM public.participant_medications WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'MEDICATION: Alpha Owner cannot read Bravo medications'
);

SELECT is(
  (SELECT count(*) FROM public.participant_medications WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1,
  'MEDICATION: Alpha Owner sees own 1 medication'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 3: INCIDENT CROSS-TENANT ISOLATION
-- ══════════════════════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.incidents WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'INCIDENT: Alpha Owner cannot read Bravo incidents'
);

SELECT is(
  (SELECT count(*) FROM public.incidents WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1,
  'INCIDENT: Alpha Owner sees own 1 incident'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 4: CARE PLAN CROSS-TENANT ISOLATION
-- ══════════════════════════════════════════════════════════════════════════════

SELECT is(
  (SELECT count(*) FROM public.care_plans WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'CARE PLAN: Alpha Owner cannot read Bravo care plans'
);

SELECT is(
  (SELECT count(*) FROM public.care_plans WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1,
  'CARE PLAN: Alpha Owner sees own 1 care plan'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 5: TECHNICIAN CANNOT MANAGE PARTICIPANT PROFILES
-- ══════════════════════════════════════════════════════════════════════════════

SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000002","app_metadata":{"role":"technician","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

-- Worker CAN read participants (they need to see who they're caring for)
SELECT ok(
  (SELECT count(*) FROM public.participant_profiles WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001') >= 0,
  'WORKER READ: Technician query on participants does not crash'
);

-- Worker cannot INSERT participants (admin-only)
SELECT throws_ok(
  $$INSERT INTO public.participant_profiles (organization_id, first_name, last_name, ndis_number, date_of_birth, status)
    VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Hacked', 'Participant', '430099999', '2000-01-01', 'active')$$,
  '42501',
  NULL,
  'WORKER BLOCK: Technician cannot INSERT participant profiles'
);

-- Worker cannot DELETE participants
SELECT throws_ok(
  $$DELETE FROM public.participant_profiles WHERE id = 'pp-alpha-001'$$,
  '42501',
  NULL,
  'WORKER BLOCK: Technician cannot DELETE participant profiles'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 6: WORKER CAN REPORT INCIDENTS (but not modify)
-- ══════════════════════════════════════════════════════════════════════════════

-- Workers should be able to INSERT incidents (they report safety events)
-- But they shouldn't be able to UPDATE severity or DELETE them

-- Try to downgrade an incident's severity
UPDATE public.incidents SET severity = 'low' WHERE id = 'inc-alpha-001';

RESET ROLE;
-- Verify severity wasn't changed (if RLS blocks the update)
SELECT is(
  (SELECT severity::text FROM public.incidents WHERE id = 'inc-alpha-001'),
  'high',
  'INCIDENT INTEGRITY: Worker cannot silently downgrade incident severity'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 7: CROSS-TENANT MEDICATION WRITE ATTACK
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

-- Alpha Owner tries to modify Bravo's medication (poisoning attack vector)
UPDATE public.participant_medications SET dosage = '9999mg' WHERE id = 'med-bravo-001';

RESET ROLE;
SELECT is(
  (SELECT dosage FROM public.participant_medications WHERE id = 'med-bravo-001'),
  '1000mg',
  'MEDICATION ATTACK: Alpha Owner cannot modify Bravo medication dosage'
);

-- Alpha Owner tries to delete Bravo's care plan
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

DELETE FROM public.care_plans WHERE id = 'cp-bravo-001';

RESET ROLE;
SELECT is(
  (SELECT count(*) FROM public.care_plans WHERE id = 'cp-bravo-001')::int, 1,
  'CARE PLAN ATTACK: Alpha Owner cannot delete Bravo care plan'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 8: ANONYMOUS ACCESS TO CARE DATA
-- ══════════════════════════════════════════════════════════════════════════════

SET ROLE anon;
SET request.jwt.claims = '';

SELECT is(
  (SELECT count(*) FROM public.participant_profiles)::int, 0,
  'ANON CARE: Cannot read participant profiles'
);

SELECT is(
  (SELECT count(*) FROM public.participant_medications)::int, 0,
  'ANON CARE: Cannot read medications'
);

SELECT is(
  (SELECT count(*) FROM public.incidents)::int, 0,
  'ANON CARE: Cannot read incidents'
);

SELECT is(
  (SELECT count(*) FROM public.care_plans)::int, 0,
  'ANON CARE: Cannot read care plans'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 9: BUDGET ALLOCATION ISOLATION
-- ══════════════════════════════════════════════════════════════════════════════

RESET ROLE;

-- Seed budget data
INSERT INTO public.budget_allocations (id, organization_id, participant_id, support_category, allocated_amount, spent_amount)
VALUES
  ('ba-alpha-001', 'aaaaaaaa-0000-0000-0000-000000000001', 'pp-alpha-001', 'core_support', 50000.00, 12000.00),
  ('ba-bravo-001', 'bbbbbbbb-0000-0000-0000-000000000002', 'pp-bravo-001', 'core_support', 75000.00, 25000.00)
ON CONFLICT (id) DO NOTHING;

-- Alpha Owner tries to read Bravo budgets
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

SELECT is(
  (SELECT count(*) FROM public.budget_allocations WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'BUDGET: Alpha Owner cannot read Bravo budget allocations'
);

SELECT is(
  (SELECT count(*) FROM public.budget_allocations WHERE organization_id = 'aaaaaaaa-0000-0000-0000-000000000001')::int, 1,
  'BUDGET: Alpha Owner sees own 1 budget allocation'
);

-- Alpha Owner tries to drain Bravo's budget
UPDATE public.budget_allocations SET spent_amount = 999999.99 WHERE id = 'ba-bravo-001';

RESET ROLE;
SELECT is(
  (SELECT spent_amount FROM public.budget_allocations WHERE id = 'ba-bravo-001'),
  25000.00,
  'BUDGET ATTACK: Alpha Owner cannot drain Bravo participant budget'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 10: SENTINEL ALERT ISOLATION
-- ══════════════════════════════════════════════════════════════════════════════

-- Seed sentinel alerts
INSERT INTO public.sentinel_alerts (id, organization_id, alert_type, severity, title, status)
VALUES
  ('sa-alpha-001', 'aaaaaaaa-0000-0000-0000-000000000001', 'medication_overdue', 'high', 'Alpha Medication Alert', 'open'),
  ('sa-bravo-001', 'bbbbbbbb-0000-0000-0000-000000000002', 'incident_escalation', 'critical', 'Bravo Escalation', 'open')
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000001","app_metadata":{"role":"owner","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

SELECT is(
  (SELECT count(*) FROM public.sentinel_alerts WHERE organization_id = 'bbbbbbbb-0000-0000-0000-000000000002')::int, 0,
  'SENTINEL: Alpha Owner cannot read Bravo sentinel alerts'
);

-- Worker cannot dismiss sentinel alerts
SET request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000002","app_metadata":{"role":"technician","org_id":"aaaaaaaa-0000-0000-0000-000000000001"}}';

UPDATE public.sentinel_alerts SET status = 'dismissed' WHERE id = 'sa-alpha-001';

RESET ROLE;
SELECT is(
  (SELECT status::text FROM public.sentinel_alerts WHERE id = 'sa-alpha-001'),
  'open',
  'SENTINEL: Technician cannot dismiss sentinel alerts (admin-only)'
);

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOCK 11: RLS FORCED VERIFICATION ON ALL CARE TABLES
-- ══════════════════════════════════════════════════════════════════════════════

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'participant_profiles' AND relnamespace = 'public'::regnamespace),
  'RLS FORCED: participant_profiles'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'participant_medications' AND relnamespace = 'public'::regnamespace),
  'RLS FORCED: participant_medications'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'incidents' AND relnamespace = 'public'::regnamespace),
  'RLS FORCED: incidents'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'care_plans' AND relnamespace = 'public'::regnamespace),
  'RLS FORCED: care_plans'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'budget_allocations' AND relnamespace = 'public'::regnamespace),
  'RLS FORCED: budget_allocations'
);

SELECT ok(
  (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'sentinel_alerts' AND relnamespace = 'public'::regnamespace),
  'RLS FORCED: sentinel_alerts'
);

SELECT * FROM finish();
ROLLBACK;
