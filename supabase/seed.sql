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

RAISE NOTICE 'Project Genesis seed completed successfully!';
END $$;
