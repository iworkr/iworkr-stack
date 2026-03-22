-- ============================================================
-- iWorkr Seed Data v2 — Project Genesis
-- Deterministic QA identity injection + demo data
-- ============================================================
-- Phase 1: Deterministic auth injection (pgcrypto)
-- Phase 2: Public schema RBAC wiring
-- Phase 3: Demo FSM data (clients, jobs, invoices, schedule)
-- ============================================================

-- ── pgcrypto (required for password hashing) ───────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ══════════════════════════════════════════════════════════
-- PHASE 1: DETERMINISTIC AUTH INJECTION
-- UUIDs are zero-padded for stable Playwright selectors.
-- ══════════════════════════════════════════════════════════

-- ── QA Owner: qa-test@iworkrapp.com ───────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'qa-test@iworkrapp.com',
  crypt('QATestPass123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "QA Admin"}'::jsonb,
  NOW(), NOW(), '', '', '', ''
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('QATestPass123!', gen_salt('bf')),
  email_confirmed_at = NOW(),
  updated_at = NOW();

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  format('{"sub": "%s", "email": "%s"}', '00000000-0000-0000-0000-000000000001', 'qa-test@iworkrapp.com')::jsonb,
  'email', 'qa-test@iworkrapp.com', NOW(), NOW(), NOW()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ── QA Worker: qa-worker@iworkrapp.com ────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated',
  'qa-worker@iworkrapp.com',
  crypt('QATestPass123!', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"full_name": "QA Worker"}'::jsonb,
  NOW(), NOW(), '', '', '', ''
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = crypt('QATestPass123!', gen_salt('bf')),
  email_confirmed_at = NOW(),
  updated_at = NOW();

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  format('{"sub": "%s", "email": "%s"}', '00000000-0000-0000-0000-000000000002', 'qa-worker@iworkrapp.com')::jsonb,
  'email', 'qa-worker@iworkrapp.com', NOW(), NOW(), NOW()
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════
-- PHASE 2: PUBLIC SCHEMA RBAC WIRING
-- ══════════════════════════════════════════════════════════

INSERT INTO public.profiles (id, email, full_name, onboarding_completed, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'qa-test@iworkrapp.com',   'QA Admin',  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'qa-worker@iworkrapp.com', 'QA Worker', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  email               = EXCLUDED.email,
  full_name           = EXCLUDED.full_name,
  onboarding_completed = true,
  updated_at          = NOW();

INSERT INTO public.organizations (id, slug, name, trade, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'qa-e2e-workspace',
  'QA E2E Workspace',
  'care',
  NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organization_members (organization_id, user_id, role, status, joined_at)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'owner',      'active', NOW()),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'technician', 'active', NOW())
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  status = 'active',
  role   = EXCLUDED.role;

-- ══════════════════════════════════════════════════════════
-- PHASE 3: DEMO FSM DATA (original seed — runs on first org)
-- ══════════════════════════════════════════════════════════

DO $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid; v_c6 uuid; v_c7 uuid;
  v_j1 uuid; v_j2 uuid; v_j3 uuid; v_j4 uuid; v_j5 uuid;
  v_j6 uuid; v_j7 uuid; v_j8 uuid; v_j9 uuid; v_j10 uuid;
  v_inv1 uuid; v_inv2 uuid; v_inv3 uuid; v_inv4 uuid;
BEGIN

-- Use the QA org as primary seed target (deterministic)
v_org_id  := '00000000-0000-0000-0000-000000000010';
v_user_id := '00000000-0000-0000-0000-000000000001';

RAISE NOTICE 'Seeding org: %  user: %', v_org_id, v_user_id;

-- ═══════════════════════════════════════════════════════
-- CLIENTS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.clients (id, organization_id, name, email, phone, status, type, address, address_lat, address_lng, tags, since) VALUES
  (gen_random_uuid(), v_org_id, 'David Park',     'david@parkresidence.com',    '+61 400 123 456', 'active',   'residential', '42 Creek Rd, Brisbane CBD 4000',          -27.4698, 153.0251, ARRAY['VIP','Residential','Net14'],     '2024-01-15'::timestamptz),
  (gen_random_uuid(), v_org_id, 'Sarah Mitchell', 'sarah.m@outlook.com',        '+61 400 234 567', 'active',   'residential', '54 High St, Fortitude Valley 4006',        -27.4575, 153.0355, ARRAY['Residential','Referral'],        '2024-06-01'::timestamptz),
  (gen_random_uuid(), v_org_id, 'Lisa Chen',      'lisa.chen@gmail.com',        '+61 400 345 678', 'active',   'residential', '18 Stanley St, South Brisbane 4101',       -27.4785, 153.0190, ARRAY['Residential','Recurring'],       '2024-09-01'::timestamptz),
  (gen_random_uuid(), v_org_id, 'Tom Andrews',    'tom@andrewsprops.com.au',    '+61 400 456 789', 'active',   'commercial',  '7 Albert St, Brisbane CBD 4000',            -27.4710, 153.0260, ARRAY['Commercial','Net30'],            '2024-03-01'::timestamptz),
  (gen_random_uuid(), v_org_id, 'Rachel Kim',     'rachel.kim@email.com',       '+61 400 567 890', 'active',   'residential', '33 Grey St, South Bank 4101',               -27.4795, 153.0210, ARRAY['Residential'],                  '2025-11-01'::timestamptz),
  (gen_random_uuid(), v_org_id, 'John Harris',    'j.harris@bigpond.com',       '+61 400 678 901', 'active',   'residential', '12 Edward St, Brisbane CBD 4000',           -27.4688, 153.0240, ARRAY['Residential','Emergency'],       '2024-08-01'::timestamptz),
  (gen_random_uuid(), v_org_id, 'Emma Wilson',    'emma.w@icloud.com',          '+61 400 789 012', 'inactive', 'residential', '88 Wickham St, Fortitude Valley 4006',      -27.4560, 153.0380, ARRAY['Residential'],                  '2026-01-01'::timestamptz)
ON CONFLICT DO NOTHING;

SELECT id INTO v_c1 FROM public.clients WHERE organization_id = v_org_id AND name = 'David Park'     LIMIT 1;
SELECT id INTO v_c2 FROM public.clients WHERE organization_id = v_org_id AND name = 'Sarah Mitchell' LIMIT 1;
SELECT id INTO v_c3 FROM public.clients WHERE organization_id = v_org_id AND name = 'Lisa Chen'      LIMIT 1;
SELECT id INTO v_c4 FROM public.clients WHERE organization_id = v_org_id AND name = 'Tom Andrews'    LIMIT 1;
SELECT id INTO v_c5 FROM public.clients WHERE organization_id = v_org_id AND name = 'Rachel Kim'     LIMIT 1;
SELECT id INTO v_c6 FROM public.clients WHERE organization_id = v_org_id AND name = 'John Harris'    LIMIT 1;
SELECT id INTO v_c7 FROM public.clients WHERE organization_id = v_org_id AND name = 'Emma Wilson'    LIMIT 1;

INSERT INTO public.client_contacts (client_id, name, role, email, phone, is_primary) VALUES
  (v_c1, 'David Park',      'Owner',             'david@parkresidence.com',     '+61 400 123 456', true),
  (v_c1, 'Jenny Park',      'Co-owner',          'jenny@parkresidence.com',     '+61 400 123 457', false),
  (v_c2, 'Sarah Mitchell',  'Homeowner',         'sarah.m@outlook.com',         '+61 400 234 567', true),
  (v_c3, 'Lisa Chen',       'Owner',             'lisa.chen@gmail.com',         '+61 400 345 678', true),
  (v_c4, 'Tom Andrews',     'Director',          'tom@andrewsprops.com.au',     '+61 400 456 789', true),
  (v_c5, 'Rachel Kim',      'Homeowner',         'rachel.kim@email.com',        '+61 400 567 890', true),
  (v_c6, 'John Harris',     'Owner',             'j.harris@bigpond.com',        '+61 400 678 901', true),
  (v_c7, 'Emma Wilson',     'Tenant',            'emma.w@icloud.com',           '+61 400 789 012', true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- JOBS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.jobs (id, organization_id, display_id, title, description, status, priority, client_id, assignee_id, due_date, location, location_lat, location_lng, labels, revenue, cost, estimated_hours, actual_hours, created_by) VALUES
  (gen_random_uuid(), v_org_id, 'JOB-401', 'Water heater installation — 50L Rheem',   'Install new 50L Rheem Stellar hot water system.',    'in_progress', 'high',   v_c1, v_user_id, now(),                   '42 Creek Rd, Brisbane CBD',  -27.4698, 153.0251, ARRAY['Install'],              2850, 1420, 6,   3.5, v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-402', 'Kitchen repipe — copper to PEX',           'Full kitchen repipe from copper to PEX.',            'todo',        'urgent', v_c2, v_user_id, now(),                   '54 High St, Fortitude Valley',-27.4575, 153.0355, ARRAY['Plumbing','Urgent'],    4850, 1890, 8,   0,   v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-403', 'Blocked drain investigation',              'Investigate and clear blockage.',                    'in_progress', 'medium', v_c3, v_user_id, now() + interval '1 day','18 Stanley St, South Brisbane',-27.4785, 153.0190, ARRAY['Drainage'],            680,  120,  3,   1.5, v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-404', 'Gas compliance certificate renewal',       'Annual gas compliance inspection.',                  'todo',        'high',   v_c4, v_user_id, now() + interval '3 days','7 Albert St, Brisbane CBD',   -27.4710, 153.0260, ARRAY['Gas','Compliance'],    450,  60,   2,   0,   v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-405', 'Boiler service — annual maintenance',      'Annual boiler service.',                             'backlog',     'medium', v_c5, v_user_id, now() + interval '5 days','33 Grey St, South Bank',      -27.4795, 153.0210, ARRAY['Maintenance'],         380,  45,   1.5, 0,   v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-406', 'Emergency burst pipe — bathroom',          'Emergency call — burst pipe.',                       'in_progress', 'urgent', v_c6, v_user_id, now(),                   '12 Edward St, Brisbane CBD',  -27.4688, 153.0240, ARRAY['Emergency','Plumbing'],1200, 280,  3,   1,   v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-407', 'Tap replacement — kitchen mixer',          'Replace kitchen mixer tap.',                         'todo',        'low',    v_c7, v_user_id, now() + interval '7 days','88 Wickham St, Fortitude Valley',-27.4560,153.0380, ARRAY['Install'],            220,  30,   1,   0,   v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-408', 'Hot water system inspection',              'Pre-purchase plumbing inspection.',                  'done',        'medium', v_c1, v_user_id, now() - interval '1 day','42 Creek Rd, Brisbane CBD',   -27.4698, 153.0251, ARRAY['Inspection'],          180,  0,    1,   0.75,v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-409', 'Toilet replacement — ensuite',             'Remove existing toilet and install Caroma Luna.',    'backlog',     'low',    v_c3, NULL,       now() + interval '10 days','18 Stanley St, South Brisbane',-27.4785, 153.0190,ARRAY['Install'],            350,  40,   1.5, 0,   v_user_id),
  (gen_random_uuid(), v_org_id, 'JOB-410', 'Stormwater drainage — driveway regrading', 'Regrade stormwater drainage at driveway entrance.', 'todo',        'high',   v_c4, v_user_id, now() + interval '4 days','7 Albert St, Brisbane CBD',   -27.4710, 153.0260, ARRAY['Drainage','Outdoor'],  3200, 1100, 8,   0,   v_user_id)
ON CONFLICT DO NOTHING;

SELECT id INTO v_j1  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-401' LIMIT 1;
SELECT id INTO v_j2  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-402' LIMIT 1;
SELECT id INTO v_j3  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-403' LIMIT 1;
SELECT id INTO v_j4  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-404' LIMIT 1;
SELECT id INTO v_j5  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-405' LIMIT 1;
SELECT id INTO v_j6  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-406' LIMIT 1;
SELECT id INTO v_j7  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-407' LIMIT 1;
SELECT id INTO v_j8  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-408' LIMIT 1;
SELECT id INTO v_j9  FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-409' LIMIT 1;
SELECT id INTO v_j10 FROM public.jobs WHERE organization_id = v_org_id AND display_id = 'JOB-410' LIMIT 1;

INSERT INTO public.job_subtasks (job_id, title, completed, sort_order) VALUES
  (v_j1, 'Isolate existing water heater',      true,  0),
  (v_j1, 'Remove old unit and dispose',         true,  1),
  (v_j1, 'Run new gas line from meter box',     false, 2),
  (v_j1, 'Install 50L Rheem Stellar',           false, 3),
  (v_j1, 'Test pressure and temperature',       false, 4),
  (v_j2, 'Turn off mains water supply',         false, 0),
  (v_j2, 'Remove existing copper pipework',     false, 1),
  (v_j2, 'Install PEX manifold system',         false, 2),
  (v_j3, 'Locate drain access points',          true,  0),
  (v_j3, 'Attempt jet blast clearing',          true,  1),
  (v_j3, 'CCTV inspection if required',         false, 2),
  (v_j6, 'Locate burst section',                true,  0),
  (v_j6, 'Cut out damaged pipe',                false, 1),
  (v_j6, 'Install repair coupling',             false, 2),
  (v_j8, 'Inspect anode rod condition',         true,  0),
  (v_j8, 'Check valve operation',               true,  1),
  (v_j8, 'Generate inspection report',          true,  2)
ON CONFLICT DO NOTHING;

INSERT INTO public.job_activity (job_id, type, text, user_id, user_name, created_at) VALUES
  (v_j1, 'creation',     'created this job from Quote #398',        NULL,       'System', now() - interval '2 days'),
  (v_j1, 'assignment',   'assigned this job',                       v_user_id,  'System', now() - interval '1 day'),
  (v_j1, 'status_change','changed status to In Progress',           v_user_id,  'You',    now() - interval '2 hours'),
  (v_j2, 'comment',      'Quote approved — $4,850 incl. GST',      v_user_id,  'You',    now() - interval '15 minutes'),
  (v_j6, 'creation',     'created from emergency call',             NULL,       'System', now() - interval '2 hours'),
  (v_j6, 'status_change','changed status to In Progress',           v_user_id,  'You',    now() - interval '30 minutes')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- INVOICES
-- ═══════════════════════════════════════════════════════

INSERT INTO public.invoices (id, organization_id, display_id, client_id, job_id, client_name, client_email, client_address, status, issue_date, due_date, paid_date, subtotal, tax, total, notes, created_by) VALUES
  (gen_random_uuid(), v_org_id, 'INV-1250', v_c2, v_j2, 'Sarah Mitchell', 'sarah.m@outlook.com',     '54 High St, Fortitude Valley 4006', 'sent',    '2026-02-15', '2026-03-01', NULL,         4850, 485, 5335, 'Payment due within 14 days.', v_user_id),
  (gen_random_uuid(), v_org_id, 'INV-1249', v_c6, v_j6, 'John Harris',   'j.harris@bigpond.com',    '12 Edward St, Brisbane CBD 4000',   'paid',    '2026-02-14', '2026-02-28', '2026-02-14', 1240, 124, 1364, NULL,                          v_user_id),
  (gen_random_uuid(), v_org_id, 'INV-1248', v_c1, v_j8, 'David Park',    'david@parkresidence.com', '42 Creek Rd, Brisbane CBD 4000',    'paid',    '2026-02-13', '2026-02-27', '2026-02-13', 180,  18,  198,  NULL,                          v_user_id),
  (gen_random_uuid(), v_org_id, 'INV-1246', v_c4, v_j10,'Tom Andrews',   'tom@andrewsprops.com.au', '7 Albert St, Brisbane CBD 4000',    'overdue', '2026-02-08', '2026-02-12', NULL,         3400, 340, 3740, NULL,                          v_user_id)
ON CONFLICT DO NOTHING;

SELECT id INTO v_inv1 FROM public.invoices WHERE organization_id = v_org_id AND display_id = 'INV-1250' LIMIT 1;
SELECT id INTO v_inv2 FROM public.invoices WHERE organization_id = v_org_id AND display_id = 'INV-1249' LIMIT 1;
SELECT id INTO v_inv3 FROM public.invoices WHERE organization_id = v_org_id AND display_id = 'INV-1248' LIMIT 1;
SELECT id INTO v_inv4 FROM public.invoices WHERE organization_id = v_org_id AND display_id = 'INV-1246' LIMIT 1;

INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, sort_order) VALUES
  (v_inv1, 'Kitchen repipe — copper to PEX',  1, 3800, 0),
  (v_inv1, 'Materials — PEX tubing 50m',      1, 650,  1),
  (v_inv2, 'Emergency burst pipe repair',     1, 950,  0),
  (v_inv2, 'Emergency call-out surcharge',    1, 110,  1),
  (v_inv3, 'Hot water system inspection',     1, 180,  0),
  (v_inv4, 'Stormwater drainage repair',      1, 2800, 0),
  (v_inv4, 'Materials — PVC pipe 100mm',      4, 150,  1)
ON CONFLICT DO NOTHING;

INSERT INTO public.invoice_events (invoice_id, type, text) VALUES
  (v_inv1, 'created', 'Invoice created'),
  (v_inv1, 'sent',    'Sent to sarah.m@outlook.com'),
  (v_inv2, 'created', 'Invoice created'),
  (v_inv2, 'paid',    'Payment received via Stripe'),
  (v_inv3, 'created', 'Invoice created'),
  (v_inv3, 'paid',    'Payment received via Stripe'),
  (v_inv4, 'created', 'Invoice created'),
  (v_inv4, 'reminder','Payment reminder sent')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- SCHEDULE BLOCKS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.schedule_blocks (organization_id, job_id, technician_id, title, client_name, location, start_time, end_time, status, travel_minutes) VALUES
  (v_org_id, v_j1, v_user_id, 'Water heater install',    'David Park', '42 Creek Rd',  now()::date + interval '7 hours',   now()::date + interval '9 hours',   'complete',    15),
  (v_org_id, v_j3, v_user_id, 'Blocked drain',           'Lisa Chen',  '18 Stanley St',now()::date + interval '9.5 hours', now()::date + interval '11 hours',  'in_progress', 20),
  (v_org_id, v_j6, v_user_id, 'Emergency burst pipe',    'John Harris','12 Edward St', now()::date + interval '12 hours',  now()::date + interval '14 hours',  'en_route',    25),
  (v_org_id, v_j8, v_user_id, 'Hot water inspection',    'David Park', '42 Creek Rd',  now()::date + interval '15 hours',  now()::date + interval '16 hours',  'scheduled',   15)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- ASSETS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.assets (organization_id, name, category, status, assigned_to, make, model, year, serial_number, location, purchase_cost, last_service, next_service) VALUES
  (v_org_id, 'Service Van #1',          'vehicle',   'assigned',  v_user_id, 'Toyota',     'HiAce',      2023, 'VAN-001', 'On site — 42 Creek Rd', 52000, '2025-12-01', '2026-06-01'),
  (v_org_id, 'Service Van #2',          'vehicle',   'available', NULL,      'Ford',        'Transit',    2022, 'VAN-002', 'Depot',                 48000, '2025-11-15', '2026-05-15'),
  (v_org_id, 'Ridgid SeeSnake (CCTV)',  'equipment', 'assigned',  v_user_id, 'Ridgid',      'SeeSnake CSx',2024,'EQ-001', 'Van #1',                 8500, '2025-10-01', '2026-04-01'),
  (v_org_id, 'Milwaukee M18 Drill',     'tool',      'assigned',  v_user_id, 'Milwaukee',  'M18 FUEL',   2024, 'TL-001', 'Van #1',                   450, NULL,         NULL),
  (v_org_id, 'Pipe Wrench Set (Ridgid)','tool',      'available', NULL,      'Ridgid',      'Various',    2023, 'TL-002', 'Depot',                    280, NULL,         NULL)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.notifications (organization_id, user_id, type, title, body, sender_name, context, read, related_job_id, created_at) VALUES
  (v_org_id, v_user_id, 'job_assigned',  'New job assigned to you',   'JOB-406: Emergency burst pipe has been assigned to you.',           'System',       'Job #406',        false, v_j6, now() - interval '2 minutes'),
  (v_org_id, v_user_id, 'quote_approved','Quote #402 approved',       'Sarah Mitchell approved your quote ($4,850). Job auto-created.',    'Sarah Mitchell','Quote #402',      false, v_j2, now() - interval '15 minutes'),
  (v_org_id, v_user_id, 'system',        'Part delivery confirmed',   'Copper pipe 22mm x 3m delivered to warehouse.',                    'System',        'Inventory',       true,  NULL, now() - interval '5 hours')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- AUTOMATIONS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.automation_flows (organization_id, name, description, category, status, run_count, last_run, created_by, trigger_config, blocks) VALUES
  (v_org_id, 'Auto-Invoice on Job Complete', 'Creates invoice when job is marked done.',         'billing',    'active', 127, now() - interval '1 day',  v_user_id, '{"event":"job.status_change","condition":"status=done"}'::jsonb, '[{"type":"action","action":"create_invoice"}]'::jsonb),
  (v_org_id, 'Welcome Email for New Clients','Sends welcome email when a new client is created.','marketing',  'active', 43,  now() - interval '3 days', v_user_id, '{"event":"client.created"}'::jsonb,                            '[{"type":"action","action":"send_email","template":"welcome_client"}]'::jsonb),
  (v_org_id, 'Low Stock Alert',              'Notifies when inventory drops below minimum.',     'operations', 'active', 8,   now() - interval '2 hours',v_user_id, '{"event":"inventory.quantity_change","condition":"quantity<min_quantity"}'::jsonb,'[{"type":"action","action":"create_notification","severity":"warning"}]'::jsonb)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- CARE SECTOR: PARTICIPANT PROFILES
-- ═══════════════════════════════════════════════════════

INSERT INTO public.clients (id, organization_id, name, email, phone, status, type, address, address_lat, address_lng, tags, since) VALUES
  ('c0000000-0000-0000-0000-000000000101', v_org_id, 'Margaret Thompson',  'marg.t@ndis.gov.au',     '+61 400 101 001', 'active', 'residential', '15 Jacaranda Dr, Ashgrove 4060',     -27.4355, 152.9870, ARRAY['NDIS','SIL'], '2024-06-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000102', v_org_id, 'James Wright',       'j.wright@outlook.com',   '+61 400 101 002', 'active', 'residential', '22 Laurel Ave, Gordon Park 4031',     -27.4210, 153.0120, ARRAY['NDIS','Community'], '2024-09-15'::timestamptz),
  ('c0000000-0000-0000-0000-000000000103', v_org_id, 'Aisha Patel',        'aisha.p@gmail.com',      '+61 400 101 003', 'active', 'residential', '8 Sunrise Ct, Nundah 4012',           -27.3890, 153.0320, ARRAY['NDIS','Respite'], '2025-01-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000104', v_org_id, 'William O''Brien',   'w.obrien@yahoo.com.au',  '+61 400 101 004', 'active', 'residential', '44 Boundary Rd, Bardon 4065',         -27.4590, 152.9710, ARRAY['NDIS','SIL'], '2024-03-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000105', v_org_id, 'Sophia Nguyen',      's.nguyen@outlook.com',   '+61 400 101 005', 'active', 'residential', '67 Meridian St, Toowong 4066',        -27.4850, 152.9830, ARRAY['NDIS','Community'], '2025-03-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000106', v_org_id, 'Robert Chen',        'r.chen@icloud.com',      '+61 400 101 006', 'active', 'residential', '91 Skyline Dr, Paddington 4064',      -27.4610, 152.9920, ARRAY['NDIS','SDA'], '2024-11-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000107', v_org_id, 'Emily Watson',       'e.watson@bigpond.com',   '+61 400 101 007', 'active', 'residential', '3 Rosemary Ln, Red Hill 4059',        -27.4520, 152.9940, ARRAY['NDIS','Community'], '2025-02-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000108', v_org_id, 'Daniel Morrison',    'd.morrison@gmail.com',   '+61 400 101 008', 'active', 'residential', '28 Heritage Pl, Kelvin Grove 4059',   -27.4470, 153.0040, ARRAY['NDIS','SIL'], '2024-08-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000109', v_org_id, 'Grace Kowalski',     'g.kowalski@hotmail.com', '+61 400 101 009', 'active', 'residential', '55 Valley View Rd, Indooroopilly 4068',-27.4990, 152.9730,ARRAY['NDIS','Respite'], '2025-05-01'::timestamptz),
  ('c0000000-0000-0000-0000-000000000110', v_org_id, 'Michael Santos',     'm.santos@gmail.com',     '+61 400 101 010', 'active', 'residential', '12 Bayside Tce, Wynnum 4178',         -27.4430, 153.1580, ARRAY['NDIS','Community'], '2024-12-01'::timestamptz)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.participant_profiles (id, client_id, organization_id, ndis_number, date_of_birth, primary_diagnosis, mobility_requirements, communication_preferences, support_categories, emergency_contacts, notes) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000101', v_org_id, '430111222', '1955-03-15', 'Acquired brain injury', 'Wheelchair — powered', 'Uses AAC device', ARRAY['Core','Capacity Building'], '[{"name":"Peter Thompson","phone":"+61400999001","relationship":"Son"}]'::jsonb, 'Lives in SIL house. Requires 24h support.'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000102', v_org_id, '430222333', '1988-07-22', 'Autism Spectrum Disorder', 'Independent', 'Prefers written communication', ARRAY['Core','Social Participation'], '[{"name":"Sarah Wright","phone":"+61400999002","relationship":"Sister"}]'::jsonb, 'Community access participant. Attends day program Mon/Wed/Fri.'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000103', v_org_id, '430333444', '2001-11-08', 'Intellectual disability', 'Independent with supervision', 'Verbal, easy to understand', ARRAY['Core','Daily Activities'], '[{"name":"Raj Patel","phone":"+61400999003","relationship":"Father"}]'::jsonb, 'Respite care weekends. Attends supported employment.'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000104', v_org_id, '430444555', '1970-01-30', 'Multiple sclerosis', 'Walker and manual wheelchair', 'Verbal', ARRAY['Core','Assistive Technology'], '[{"name":"Patricia O''Brien","phone":"+61400999004","relationship":"Wife"}]'::jsonb, 'SIL resident. Progressive condition — review plan quarterly.'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000105', v_org_id, '430555666', '1995-05-18', 'Cerebral palsy', 'Powered wheelchair', 'Verbal — mild dysarthria', ARRAY['Core','Capacity Building','Social Participation'], '[{"name":"Linh Nguyen","phone":"+61400999005","relationship":"Mother"}]'::jsonb, 'Community access. Active social calendar.'),
  ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000106', v_org_id, '430666777', '1962-09-04', 'Stroke — left hemiplegia', 'Manual wheelchair', 'Verbal but slow', ARRAY['Core','Daily Activities'], '[{"name":"Mary Chen","phone":"+61400999006","relationship":"Wife"}]'::jsonb, 'SDA resident. Requires PEG feeding support.'),
  ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000107', v_org_id, '430777888', '2003-12-25', 'Down syndrome', 'Independent', 'Verbal — Makaton signs', ARRAY['Core','Social Participation','Employment'], '[{"name":"David Watson","phone":"+61400999007","relationship":"Father"}]'::jsonb, 'Supported employment. Community access 3x/week.'),
  ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000108', v_org_id, '430888999', '1980-06-11', 'Spinal cord injury (C5)', 'Powered wheelchair', 'Verbal', ARRAY['Core','Assistive Technology','Daily Activities'], '[{"name":"Jennifer Morrison","phone":"+61400999008","relationship":"Sister"}]'::jsonb, 'SIL house resident. Requires 24h support. Ventilator at night.'),
  ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000109', v_org_id, '430999111', '1998-02-14', 'Psychosocial disability', 'Independent', 'Verbal — prefers 1:1', ARRAY['Core','Capacity Building'], '[{"name":"Stefan Kowalski","phone":"+61400999009","relationship":"Brother"}]'::jsonb, 'Respite weekends. Behaviour support plan in place.'),
  ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000110', v_org_id, '430111333', '1992-08-07', 'Traumatic brain injury', 'Walker', 'Verbal — fatigue affects clarity', ARRAY['Core','Daily Activities','Social Participation'], '[{"name":"Rosa Santos","phone":"+61400999010","relationship":"Mother"}]'::jsonb, 'Community access participant. Goal: independent travel.')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- CARE SECTOR: CARE PLANS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.care_plans (id, organization_id, participant_id, title, status, start_date, review_date, next_review_date, domains, assessor_name, assessor_role, notes) VALUES
  ('e0000000-0000-0000-0000-000000000001', v_org_id, 'd0000000-0000-0000-0000-000000000001', 'Margaret Thompson — Annual Plan', 'active', '2025-07-01', '2025-07-01', '2026-07-01', '{"daily_living": {"budget": 45000, "used": 18200}, "community": {"budget": 12000, "used": 4800}, "capacity_building": {"budget": 8000, "used": 2100}}'::jsonb, 'Dr. Sarah Lane', 'Plan Manager', 'Core supports dominant. Review SIL ratio Q2.'),
  ('e0000000-0000-0000-0000-000000000002', v_org_id, 'd0000000-0000-0000-0000-000000000002', 'James Wright — Community Access Plan', 'active', '2025-09-01', '2025-09-01', '2026-09-01', '{"community": {"budget": 15000, "used": 6200}, "capacity_building": {"budget": 10000, "used": 3500}}'::jsonb, 'Maria Lopez', 'Support Coordinator', 'Focus on social skills and community integration.'),
  ('e0000000-0000-0000-0000-000000000003', v_org_id, 'd0000000-0000-0000-0000-000000000003', 'Aisha Patel — Respite Plan', 'active', '2025-01-01', '2025-01-01', '2026-01-01', '{"core_support": {"budget": 20000, "used": 9500}, "respite": {"budget": 8000, "used": 3200}}'::jsonb, 'Tom Bradley', 'Case Manager', 'Weekend respite focus. Family carer burnout risk.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.care_goals (id, care_plan_id, organization_id, participant_id, title, description, target_outcome, status, priority) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', v_org_id, 'd0000000-0000-0000-0000-000000000001', 'Improve mobility', 'Physiotherapy exercises 3x weekly to maintain upper body strength', 'Maintain current mobility level for 12 months', 'in_progress', 1),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', v_org_id, 'd0000000-0000-0000-0000-000000000001', 'Social engagement', 'Attend community group 2x weekly', '80% attendance rate', 'in_progress', 2),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', v_org_id, 'd0000000-0000-0000-0000-000000000002', 'Independent travel', 'Learn to use public transport independently', 'Complete 5 solo trips by end of plan', 'in_progress', 1),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000003', v_org_id, 'd0000000-0000-0000-0000-000000000003', 'Employment readiness', 'Supported employment program participation', 'Maintain 3 days/week attendance', 'not_started', 1)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- CARE SECTOR: MEDICATIONS (eMAR)
-- ═══════════════════════════════════════════════════════

INSERT INTO public.participant_medications (id, organization_id, participant_id, medication_name, generic_name, dosage, route, frequency, time_slots, prescribing_doctor, pharmacy, start_date, is_prn, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', v_org_id, 'd0000000-0000-0000-0000-000000000001', 'Panadol', 'Paracetamol', '500mg', 'oral', 'twice_daily', ARRAY['08:00','20:00'], 'Dr. Sarah Lane', 'Terry White Ashgrove', '2025-01-01', false, true),
  ('10000000-0000-0000-0000-000000000002', v_org_id, 'd0000000-0000-0000-0000-000000000001', 'Endep', 'Amitriptyline', '25mg', 'oral', 'once_daily', ARRAY['20:00'], 'Dr. Sarah Lane', 'Terry White Ashgrove', '2025-03-01', false, true),
  ('10000000-0000-0000-0000-000000000003', v_org_id, 'd0000000-0000-0000-0000-000000000004', 'Baclofen', 'Baclofen', '10mg', 'oral', 'three_times_daily', ARRAY['07:00','13:00','21:00'], 'Dr. James Koh', 'Priceline Bardon', '2024-06-01', false, true),
  ('10000000-0000-0000-0000-000000000004', v_org_id, 'd0000000-0000-0000-0000-000000000004', 'Nurofen Plus', 'Ibuprofen + Codeine', '200mg/12.8mg', 'oral', 'prn', ARRAY[]::text[], 'Dr. James Koh', 'Priceline Bardon', '2024-06-01', true, true),
  ('10000000-0000-0000-0000-000000000005', v_org_id, 'd0000000-0000-0000-0000-000000000006', 'Aspirin', 'Aspirin', '100mg', 'oral', 'once_daily', ARRAY['08:00'], 'Dr. Wei Lin', 'Chemist Warehouse Paddington', '2024-09-01', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.medication_administration_records (id, organization_id, medication_id, participant_id, worker_id, outcome, administered_at, notes) VALUES
  ('11000000-0000-0000-0000-000000000001', v_org_id, '10000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'given', now() - interval '2 hours', 'Morning dose administered with breakfast.'),
  ('11000000-0000-0000-0000-000000000002', v_org_id, '10000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'given', now() - interval '14 hours', 'Evening dose administered.'),
  ('11000000-0000-0000-0000-000000000003', v_org_id, '10000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'refused', now() - interval '3 hours', 'Participant refused morning dose. Reported to RN.')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- CARE SECTOR: INCIDENTS & SIRS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.incidents (id, organization_id, participant_id, worker_id, category, severity, status, title, description, location, occurred_at, reported_at, immediate_actions, is_reportable) VALUES
  ('12000000-0000-0000-0000-000000000001', v_org_id, 'd0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'fall', 'medium', 'reported', 'Fall in bathroom — no injury', 'Participant slipped on wet floor in ensuite. No visible injury. Ambulance NOT required.', '15 Jacaranda Dr, Ashgrove', now() - interval '1 day', now() - interval '23 hours', 'Applied ice pack to elbow. Monitored for 2 hours. No signs of injury.', false),
  ('12000000-0000-0000-0000-000000000002', v_org_id, 'd0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'medication_error', 'high', 'under_review', 'Wrong medication time — Baclofen', 'Baclofen 10mg administered at 15:00 instead of 13:00 due to scheduling error.', '44 Boundary Rd, Bardon', now() - interval '2 days', now() - interval '47 hours', 'Notified RN. No adverse effects observed. Dose schedule reviewed.', true),
  ('12000000-0000-0000-0000-000000000003', v_org_id, 'd0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000002', 'behavioral', 'low', 'resolved', 'Verbal aggression during outing', 'Participant became verbally aggressive at shopping centre. De-escalated with sensory break.', '55 Valley View Rd, Indooroopilly', now() - interval '5 days', now() - interval '5 days', 'Removed from environment. Applied BSP strategies. Calm within 15 mins.', false)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- GOVERNANCE: POLICIES & ACKNOWLEDGEMENTS
-- ═══════════════════════════════════════════════════════

INSERT INTO public.policy_register (id, organization_id, title, category, version, status, content, effective_date, review_date, requires_acknowledgement) VALUES
  ('13000000-0000-0000-0000-000000000001', v_org_id, 'Workplace Health and Safety Policy', 'safety', '2.1', 'current', 'This policy outlines the WHS obligations of all workers...', '2025-01-01', '2026-01-01', true),
  ('13000000-0000-0000-0000-000000000002', v_org_id, 'NDIS Code of Conduct', 'governance', '1.0', 'current', 'All workers must adhere to the NDIS Code of Conduct...', '2024-06-01', '2025-06-01', true),
  ('13000000-0000-0000-0000-000000000003', v_org_id, 'Medication Administration Procedure', 'clinical', '3.0', 'current', 'Procedure for safe medication administration including S8 handling...', '2025-03-01', '2026-03-01', true),
  ('13000000-0000-0000-0000-000000000004', v_org_id, 'Privacy and Confidentiality Policy', 'privacy', '1.5', 'current', 'Personal information must be handled in accordance with APPs...', '2025-01-01', '2026-01-01', true),
  ('13000000-0000-0000-0000-000000000005', v_org_id, 'Incident Reporting and SIRS Procedure', 'safety', '2.0', 'current', 'All reportable incidents must be logged within 24 hours...', '2025-06-01', '2026-06-01', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.policy_acknowledgements (organization_id, policy_id, user_id, acknowledged_at, policy_version) VALUES
  (v_org_id, '13000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now() - interval '30 days', '2.1'),
  (v_org_id, '13000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', now() - interval '60 days', '1.0'),
  (v_org_id, '13000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', now() - interval '25 days', '2.1')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- CARE SECTOR: SCHEDULE BLOCKS (SHIFTS)
-- ═══════════════════════════════════════════════════════

INSERT INTO public.schedule_blocks (organization_id, technician_id, participant_id, title, client_name, location, start_time, end_time, status, travel_minutes) VALUES
  (v_org_id, '00000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Morning personal care — Margaret',  'Margaret Thompson', '15 Jacaranda Dr, Ashgrove', now()::date + interval '6 hours',  now()::date + interval '8 hours',  'scheduled', 20),
  (v_org_id, '00000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'Community access — James',          'James Wright',      '22 Laurel Ave, Gordon Park', now()::date + interval '9 hours',  now()::date + interval '13 hours', 'scheduled', 15),
  (v_org_id, '00000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'Respite care — Aisha',             'Aisha Patel',       '8 Sunrise Ct, Nundah',      (now()::date + interval '1 day')::timestamptz + interval '8 hours', (now()::date + interval '1 day')::timestamptz + interval '16 hours', 'scheduled', 30),
  (v_org_id, '00000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'Evening medication & personal care','William O''Brien',  '44 Boundary Rd, Bardon',    now()::date + interval '18 hours', now()::date + interval '20 hours', 'scheduled', 25)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- ADDITIONAL CLIENTS (scale to 50+)
-- ═══════════════════════════════════════════════════════

INSERT INTO public.clients (organization_id, name, email, phone, status, type, address, tags, since) VALUES
  (v_org_id, 'Peter Grant',        'p.grant@email.com',       '+61400201001', 'active', 'commercial',  '120 Eagle St, Brisbane 4000',         ARRAY['Commercial','Net30'],   '2024-01-15'::timestamptz),
  (v_org_id, 'Sandra Lee',         's.lee@email.com',         '+61400201002', 'active', 'residential', '45 Coorparoo St, Coorparoo 4151',     ARRAY['Residential'],          '2024-02-01'::timestamptz),
  (v_org_id, 'Michael Brown',      'm.brown@email.com',       '+61400201003', 'active', 'residential', '78 Caxton St, Paddington 4064',       ARRAY['Residential','VIP'],    '2024-03-15'::timestamptz),
  (v_org_id, 'Jennifer Adams',     'j.adams@email.com',       '+61400201004', 'active', 'commercial',  '200 Ann St, Brisbane 4000',           ARRAY['Commercial'],           '2024-04-01'::timestamptz),
  (v_org_id, 'Christopher Taylor', 'c.taylor@email.com',      '+61400201005', 'active', 'residential', '33 Lytton Rd, East Brisbane 4169',    ARRAY['Residential'],          '2024-05-15'::timestamptz),
  (v_org_id, 'Amanda Davis',       'a.davis@email.com',       '+61400201006', 'lead',   'residential', '15 Park Rd, Milton 4064',             ARRAY['Lead'],                 '2025-01-01'::timestamptz),
  (v_org_id, 'Robert Wilson Jr',   'r.wilson@email.com',      '+61400201007', 'active', 'residential', '62 Vulture St, West End 4101',        ARRAY['Residential'],          '2024-07-01'::timestamptz),
  (v_org_id, 'Karen Anderson',     'k.anderson@email.com',    '+61400201008', 'active', 'commercial',  '88 Creek St, Brisbane 4000',          ARRAY['Commercial','Net14'],   '2024-08-15'::timestamptz),
  (v_org_id, 'Steven Martinez',    's.martinez@email.com',    '+61400201009', 'active', 'residential', '21 Montague Rd, South Brisbane 4101', ARRAY['Residential'],          '2024-09-01'::timestamptz),
  (v_org_id, 'Michelle Garcia',    'm.garcia@email.com',      '+61400201010', 'inactive','residential','50 Kelvin Grove Rd, Kelvin Grove 4059',ARRAY['Residential'],         '2024-10-15'::timestamptz),
  (v_org_id, 'Brian Robinson',     'b.robinson@email.com',    '+61400201011', 'active', 'commercial',  '15 Turbot St, Brisbane 4000',         ARRAY['Commercial'],           '2024-11-01'::timestamptz),
  (v_org_id, 'Lisa Thompson',      'l.thompson@email.com',    '+61400201012', 'active', 'residential', '77 Enoggera Rd, Newmarket 4051',      ARRAY['Residential','Referral'], '2024-12-15'::timestamptz),
  (v_org_id, 'Kevin White',        'k.white@email.com',       '+61400201013', 'active', 'residential', '4 Waterworks Rd, The Gap 4061',       ARRAY['Residential'],          '2025-01-01'::timestamptz),
  (v_org_id, 'Nancy Lewis',        'n.lewis@email.com',       '+61400201014', 'active', 'commercial',  '300 Queen St, Brisbane 4000',         ARRAY['Commercial','VIP'],     '2025-02-15'::timestamptz),
  (v_org_id, 'Paul Walker',        'p.walker@email.com',      '+61400201015', 'active', 'residential', '99 Gladstone Rd, Dutton Park 4102',   ARRAY['Residential'],          '2025-03-01'::timestamptz),
  (v_org_id, 'Dorothy Hall',       'd.hall@email.com',        '+61400201016', 'lead',   'residential', '11 Coronation Dr, Toowong 4066',      ARRAY['Lead'],                 '2025-04-01'::timestamptz),
  (v_org_id, 'George Allen',       'g.allen@email.com',       '+61400201017', 'active', 'residential', '23 Merthyr Rd, New Farm 4005',        ARRAY['Residential'],          '2024-06-15'::timestamptz),
  (v_org_id, 'Helen Young',        'h.young@email.com',       '+61400201018', 'active', 'residential', '68 Commercial Rd, Teneriffe 4005',    ARRAY['Residential','VIP'],    '2024-07-15'::timestamptz),
  (v_org_id, 'Frank Scott',        'f.scott@email.com',       '+61400201019', 'active', 'commercial',  '555 Coronation Dr, Toowong 4066',     ARRAY['Commercial'],           '2024-08-01'::timestamptz),
  (v_org_id, 'Barbara King',       'b.king@email.com',        '+61400201020', 'active', 'residential', '9 Moggill Rd, Taringa 4068',          ARRAY['Residential','Recurring'], '2024-09-15'::timestamptz),
  (v_org_id, 'Thomas Green',       't.green@email.com',       '+61400201021', 'active', 'residential', '140 Boundary St, West End 4101',      ARRAY['Residential'],          '2024-10-01'::timestamptz),
  (v_org_id, 'Margaret Baker',     'm.baker@email.com',       '+61400201022', 'active', 'residential', '25 Kurilpa St, West End 4101',        ARRAY['Residential'],          '2024-11-15'::timestamptz),
  (v_org_id, 'Joseph Nelson',      'j.nelson@email.com',      '+61400201023', 'active', 'commercial',  '75 Mary St, Brisbane 4000',           ARRAY['Commercial','Net30'],   '2024-12-01'::timestamptz),
  (v_org_id, 'Patricia Carter',    'p.carter@email.com',      '+61400201024', 'active', 'residential', '31 Latrobe Tce, Paddington 4064',     ARRAY['Residential'],          '2025-01-15'::timestamptz),
  (v_org_id, 'Charles Mitchell',   'c.mitchell@email.com',    '+61400201025', 'active', 'residential', '47 Prospect Tce, Kelvin Grove 4059',  ARRAY['Residential','Emergency'], '2025-02-01'::timestamptz),
  (v_org_id, 'Linda Campbell',     'l.campbell@email.com',    '+61400201026', 'active', 'residential', '82 Gregory Tce, Spring Hill 4000',    ARRAY['Residential'],          '2025-03-15'::timestamptz),
  (v_org_id, 'Daniel Turner',      'd.turner@email.com',      '+61400201027', 'active', 'commercial',  '10 Felix St, Brisbane 4000',          ARRAY['Commercial'],           '2025-04-01'::timestamptz),
  (v_org_id, 'Susan Phillips',     's.phillips@email.com',    '+61400201028', 'lead',   'residential', '58 Chalk St, Lutwyche 4030',          ARRAY['Lead'],                 '2025-05-15'::timestamptz),
  (v_org_id, 'Mark Evans',         'm.evans@email.com',       '+61400201029', 'active', 'residential', '19 Rode Rd, Wavell Heights 4012',     ARRAY['Residential'],          '2024-04-15'::timestamptz),
  (v_org_id, 'Jessica Collins',    'j.collins@email.com',     '+61400201030', 'active', 'residential', '36 Hamilton Rd, Moorooka 4105',       ARRAY['Residential'],          '2024-05-01'::timestamptz),
  (v_org_id, 'William Stewart',    'w.stewart@email.com',     '+61400201031', 'active', 'residential', '71 Abbotsford Rd, Bowen Hills 4006',  ARRAY['Residential','VIP'],    '2024-06-01'::timestamptz),
  (v_org_id, 'Elizabeth Morgan',   'e.morgan@email.com',      '+61400201032', 'active', 'commercial',  '180 Ann St, Brisbane 4000',           ARRAY['Commercial'],           '2024-07-01'::timestamptz),
  (v_org_id, 'Richard Bell',       'r.bell@email.com',        '+61400201033', 'active', 'residential', '42 Oriel Rd, Clayfield 4011',         ARRAY['Residential'],          '2024-08-01'::timestamptz)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Argus-Resilience: Full seed completed — Trades + Care + 50 clients + 10 participants + medications + incidents + policies!';
END $$;
