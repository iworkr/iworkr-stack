# Supabase SQL Migration & Schema Integrity Audit
**Date:** 2026-03-22  
**Scope:** 168 migration files + BUNDLED_ALL_MIGRATIONS.sql + seed.sql + config.toml  
**Auditor:** Claude Agent — Deep Schema Analysis  

---

## Executive Summary

Reviewed **168 individual migration files**, the bundled migration, seed data, and Supabase config. The schema is generally **well-structured** with consistent RLS patterns across core tables. However, there are **45 findings** including critical security gaps (functions without SECURITY DEFINER bypassing RLS), column reference bugs in RPC functions, credential storage in plaintext, and seed data referencing potentially missing columns.

| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 12 |
| MEDIUM | 16 |
| LOW | 10 |

---

## CRITICAL Findings

### C-01: Integration credentials stored in plaintext JSONB
- **FILE:** `supabase/migrations/017_module_integrations.sql`
- **LINE:** 15
- **CATEGORY:** security
- **DESCRIPTION:** The `integrations` table stores OAuth credentials in a plain `jsonb` column: `credentials jsonb default '{}'`. This means Xero tokens, Stripe keys, and other secrets are stored unencrypted in the database. Any org member with SELECT access to `integrations` (granted by the RLS policy on line 75-79) can read these credentials. This is a **data breach waiting to happen**. Credentials must be encrypted at rest (use `vault.secrets` or `pgcrypto` encryption) and the column should never be exposed to client-side queries.

### C-02: Budget functions missing SECURITY DEFINER — bypass RLS
- **FILE:** `supabase/migrations/069_budget_allocations.sql`
- **LINES:** 252-311 (`quarantine_shift_budget`), 315-345 (`release_shift_quarantine`), 349-380 (`consume_shift_quarantine`)
- **CATEGORY:** security
- **DESCRIPTION:** Three critical financial functions operate on budget data **without SECURITY DEFINER**. These functions are declared as `LANGUAGE plpgsql` without any security qualifier, which means they run as `SECURITY INVOKER` by default. Since RLS is enabled on `budget_allocations` and `budget_quarantine_ledger`, these functions will **fail for non-admin users** who need to call them (e.g., workers completing shifts). This is either a security gap (if called via service_role) or a **runtime failure** (if called as authenticated user).

### C-03: `get_member_stats()` references non-existent column `assigned_to`
- **FILE:** `supabase/migrations/027_team_rbac_enhancements.sql`
- **LINE:** 130
- **CATEGORY:** error
- **DESCRIPTION:** `get_member_stats()` queries `public.jobs WHERE assigned_to = p_user_id AND status = 'completed'`. The `jobs` table uses `assignee_id` (not `assigned_to`) and the job_status enum has `done` (not `completed`). This function **will always return 0** for jobs_done, making team member stats permanently broken. Two bugs in one line.

### C-04: `log_job_activity()` trigger inserts invalid enum value `'update'`
- **FILE:** `supabase/migrations/021_jobs_enhancements.sql`  
- **LINE:** 134
- **CATEGORY:** error
- **DESCRIPTION:** The `log_job_activity()` trigger function inserts `'update'` as the `type` value for priority changes into `job_activity`. But the `activity_type` enum (defined in `011_module_jobs.sql` line 63) only includes: `'status_change', 'comment', 'photo', 'invoice', 'creation', 'assignment', 'note'`. The value `'update'` is not in the enum, so **every priority change will throw a runtime error** and the UPDATE transaction will fail.

### C-05: `check_low_stock_trigger()` inserts notifications missing required `organization_id`
- **FILE:** `supabase/migrations/025_assets_enhancements.sql`
- **LINE:** 319-337
- **CATEGORY:** error
- **DESCRIPTION:** The `check_low_stock_trigger()` function inserts into `notifications` with columns `(user_id, type, title, body, metadata)` but **omits `organization_id`**, which is declared as `NOT NULL` on the notifications table (migration 016, line 13). This trigger will **always fail** with a NOT NULL violation, silently swallowing low-stock alerts.

### C-06: `get_ndis_rate()` function lacks SECURITY DEFINER — will fail with RLS
- **FILE:** `supabase/migrations/068_ndis_catalogue.sql`
- **LINE:** 98
- **CATEGORY:** security
- **DESCRIPTION:** The `get_ndis_rate()` function queries `ndis_catalogue` and `ndis_region_modifiers`, both of which have RLS enabled (lines 60-61). The function is `LANGUAGE plpgsql STABLE` without SECURITY DEFINER, so it runs as the invoker. While the RLS policy allows all authenticated users to read, this means **anonymous or service_role callers cannot use this function** unless they have the right JWT role. Missing SECURITY DEFINER could cause silent failures in Edge Functions.

### C-07: Seed data references `policy_register` and `policy_acknowledgements` — potential table name mismatch
- **FILE:** `supabase/seed.sql`
- **LINES:** 381-393
- **CATEGORY:** error
- **DESCRIPTION:** The seed file inserts into `public.policy_register` and `public.policy_acknowledgements`. However, migration `100_solon_policy_ack_engine.sql` creates `public.policy_versions` (not `policy_register`). The table `policy_register` is likely created in `081_care_phase2_phase3_tables.sql`, but if schema has been refactored, this seed will **fail on db reset** with "relation does not exist".

---

## HIGH Findings

### H-01: `update_updated_at()` function lacks `set search_path`
- **FILE:** `supabase/migrations/003_core_profiles.sql`
- **LINES:** 27-35
- **CATEGORY:** security
- **DESCRIPTION:** The `update_updated_at()` function is created with `SECURITY INVOKER` (default) and no `SET search_path`. It's used by 30+ triggers across the schema. While the function itself is simple (`new.updated_at = now()`), best practice for any function used in triggers is to set `search_path = ''` or `search_path = 'public'` to prevent search_path hijacking attacks.

### H-02: RLS policy conflicts — migration 036 drops + recreates policies that coexist with originals
- **FILE:** `supabase/migrations/036_rbac_enforcement.sql` vs `008_core_rls_policies.sql`/`011_module_jobs.sql`
- **LINES:** Multiple
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Migration 036 creates new granular role-based policies (e.g., `jobs_select_policy` with role-based CASE) but also **does not drop the original broad policies** from migrations 008/011 (e.g., `"Members can read org jobs"`). PostgreSQL RLS uses OR logic between policies — so even though 036 restricts technicians to `assignee_id = auth.uid()`, the original policy still allows all org members to read all jobs. The role-based restrictions in 036 are **completely ineffective** because the permissive original policies remain.

### H-03: `terminal_connection_tokens` table missing ON DELETE CASCADE for `organization_id`
- **FILE:** `supabase/migrations/037_stripe_connect.sql`
- **LINE:** 112
- **CATEGORY:** schema
- **DESCRIPTION:** The `terminal_connection_tokens` table references `public.organizations(id)` without `ON DELETE CASCADE`. If an organization is deleted, orphaned terminal tokens remain. Every other table with an `organization_id` FK uses `ON DELETE CASCADE`.

### H-04: `payments` table — `invoice_id` FK added conditionally; may silently skip
- **FILE:** `supabase/migrations/037_stripe_connect.sql`
- **LINES:** 57-67
- **CATEGORY:** schema
- **DESCRIPTION:** The FK from `payments.invoice_id` to `invoices(id)` is added inside a DO block with `EXCEPTION WHEN OTHERS THEN NULL`. This means if _any_ error occurs (not just "already exists"), it's silently swallowed. The `WHEN OTHERS` catch-all could hide real schema errors.

### H-05: `automation_queue` has no INSERT RLS policy — workers can't create queue entries
- **FILE:** `supabase/migrations/018_automation_scheduling.sql`
- **LINES:** 30-37
- **CATEGORY:** incomplete
- **DESCRIPTION:** The `automation_queue` table has RLS enabled with only a SELECT policy. There is no INSERT, UPDATE, or DELETE policy. This means only `service_role` can write to this table. While this may be intentional (Edge Functions manage the queue), it's not documented, and any client-side automation trigger will silently fail.

### H-06: `payouts` table missing INSERT/UPDATE RLS policies
- **FILE:** `supabase/migrations/013_module_finance.sql`
- **LINES:** 92, 144-148
- **CATEGORY:** incomplete
- **DESCRIPTION:** The `payouts` table has RLS enabled with only a SELECT policy. There are no INSERT or UPDATE policies. Added DELETE in migration 061. If any client-side code tries to create/update payouts, it will fail. Needs explicit documentation that writes are service_role only.

### H-07: `get_job_details()` has no org-scoping — returns any job by ID
- **FILE:** `supabase/migrations/021_jobs_enhancements.sql`
- **LINES:** 324-368
- **CATEGORY:** security
- **DESCRIPTION:** The `get_job_details()` RPC takes `p_job_id uuid` and returns full job data without checking if the calling user is a member of the job's organization. Since it's `SECURITY DEFINER`, it bypasses RLS entirely. Any authenticated user who guesses/knows a job UUID can read any organization's job details including client info, financial data, and activity logs. Needs an org membership check.

### H-08: `get_invoice_detail()` has no org-scoping — returns any invoice by ID
- **FILE:** `supabase/migrations/024_finance_enhancements.sql`
- **LINES:** 290-325
- **CATEGORY:** security
- **DESCRIPTION:** Same issue as H-07. The `get_invoice_detail()` RPC takes `p_invoice_id uuid` and returns full invoice data (including client details) without org membership verification. `SECURITY DEFINER` bypasses RLS.

### H-09: `get_client_details()` has no org-scoping — returns any client by ID
- **FILE:** `supabase/migrations/023_clients_enhancements.sql`
- **LINES:** 154-214
- **CATEGORY:** security
- **DESCRIPTION:** Same pattern. `get_client_details()` returns full client data for any UUID. No org membership check. With `SECURITY DEFINER`, any authenticated user can read any organization's client data.

### H-10: `get_dashboard_stats()` and related RPCs don't validate caller org membership
- **FILE:** `supabase/migrations/019_dashboard_rpc.sql`
- **LINES:** 8-88 (`get_dashboard_stats`), 92-125 (`get_daily_revenue_chart`), 168-271 (`get_ai_insights`), 275-337 (`get_team_status`), 341-381 (`get_live_dispatch`)
- **CATEGORY:** security
- **DESCRIPTION:** All dashboard RPCs take `p_org_id uuid` as parameter and query data for that org. They are all `SECURITY DEFINER`. None validate that `auth.uid()` is a member of `p_org_id`. Any authenticated user can pass any org UUID to get revenue data, team status, AI insights, and live dispatch data for **any organization**.

### H-11: `get_my_schedule()` doesn't validate p_user_id belongs to caller
- **FILE:** `supabase/migrations/019_dashboard_rpc.sql`
- **LINES:** 129-164
- **CATEGORY:** security
- **DESCRIPTION:** `get_my_schedule(p_user_id uuid)` returns schedule blocks for any user. It does not check `p_user_id = auth.uid()`. Any authenticated user can view another user's schedule.

### H-12: `move_schedule_block()` — no org membership check
- **FILE:** `supabase/migrations/022_schedule_enhancements.sql`
- **LINES:** 215-300
- **CATEGORY:** security
- **DESCRIPTION:** `move_schedule_block()` can move/reassign any schedule block in any org. It's `SECURITY DEFINER` with no org membership validation. Could be used by one org's user to manipulate another org's schedule.

---

## MEDIUM Findings

### M-01: Global `job_display_seq` sequence — shared across all orgs
- **FILE:** `supabase/migrations/011_module_jobs.sql`
- **LINE:** 37
- **CATEGORY:** inconsistency
- **DESCRIPTION:** A single `public.job_display_seq` sequence is created but never used (the display ID trigger in 021 uses MAX+1 instead). This orphaned sequence wastes schema space and could confuse developers.

### M-02: Global `invoice_display_seq` sequence with hardcoded start
- **FILE:** `supabase/migrations/013_module_finance.sql`
- **LINE:** 35
- **CATEGORY:** inconsistency
- **DESCRIPTION:** `invoice_display_seq` starts at 1251 but is never referenced. The `create_invoice_full` RPC (migration 024) generates display IDs via MAX+1. Same issue as M-01.

### M-03: `notification_replies` missing organization_id column — can't scope by org
- **FILE:** `supabase/migrations/029_notification_replies.sql`
- **LINES:** 6-12
- **CATEGORY:** schema
- **DESCRIPTION:** The `notification_replies` table has no `organization_id` column, making it impossible to efficiently query or audit replies by org. The RLS relies solely on `user_id` matching, which works but prevents admin-level org auditing.

### M-04: `clients.billing_terms` uses free-text instead of enum
- **FILE:** `supabase/migrations/023_clients_enhancements.sql`
- **LINE:** 9
- **CATEGORY:** schema
- **DESCRIPTION:** `billing_terms text default 'due_on_receipt'` should be an enum or have a CHECK constraint. Currently accepts any string, leading to potential data inconsistency (e.g., "net_30" vs "Net30" vs "net30").

### M-05: `automation_queue.status` uses plain text instead of enum
- **FILE:** `supabase/migrations/018_automation_scheduling.sql`
- **LINE:** 14
- **CATEGORY:** schema
- **DESCRIPTION:** `status text default 'pending'` with comment listing valid values but no CHECK constraint or enum type. Allows arbitrary status strings.

### M-06: `automation_logs.status` uses plain text instead of enum
- **FILE:** `supabase/migrations/017_module_integrations.sql`
- **LINE:** 59
- **CATEGORY:** schema
- **DESCRIPTION:** `status text not null default 'running'` with no constraint. The stats RPC in 028 filters by `status = 'success'` and `status = 'failed'`, but nothing enforces these values at the schema level.

### M-07: `payments.status` and `payment_method` use CHECK instead of enum
- **FILE:** `supabase/migrations/037_stripe_connect.sql`
- **LINES:** 44-47
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Uses inline CHECK constraints rather than enum types, which is inconsistent with the rest of the schema (which uses `CREATE TYPE ... AS ENUM`). While functionally equivalent, this breaks the pattern and makes schema introspection harder.

### M-08: `care_facilities` table in 093 has no `organization_id` reference
- **FILE:** `supabase/migrations/093_choreography_task_management_engine.sql`
- **LINE:** 5-23
- **CATEGORY:** schema
- **DESCRIPTION:** Need to verify this table has proper org scoping. If `care_facilities` lacks `organization_id`, the RLS policies won't properly scope data.

### M-09: `mobile_telemetry_events` partitioned table — RLS on parent only
- **FILE:** `supabase/migrations/108_panopticon_mobile_black_box.sql`
- **LINES:** 6-41
- **CATEGORY:** security
- **DESCRIPTION:** RLS is enabled on the `mobile_telemetry_events` parent table. For partitioned tables in PostgreSQL, RLS on the parent applies to child partitions. However, if partitions are queried directly (bypassing the parent), RLS may not apply. Need to verify partition access is always through the parent.

### M-10: Seed data uses hardcoded UUIDs for care data that could conflict
- **FILE:** `supabase/seed.sql`
- **LINES:** 307-329 (clients), 319-330 (participant_profiles), 337-347 (care_plans/goals), 353-365 (medications/MAR)
- **CATEGORY:** inconsistency
- **DESCRIPTION:** The seed uses hardcoded UUIDs like `c0000000-0000-0000-0000-000000000101` through `c0000000-0000-0000-0000-000000000110`. While zero-padded for stability (as documented), these could conflict if any production migration inadvertently uses similar UUIDs. All inserts use `ON CONFLICT DO NOTHING` which mitigates but doesn't alert.

### M-11: `config.toml` has `api.enabled = false`
- **FILE:** `supabase/config.toml`
- **LINE:** 8
- **CATEGORY:** inconsistency
- **DESCRIPTION:** `[api] enabled = false` will disable the PostgREST API locally. This is likely an error or leftover from debugging — the entire application depends on the Supabase REST API. With this setting, `supabase start` won't expose the API on port 54321 locally.

### M-12: `config.toml` minimum password length is 6
- **FILE:** `supabase/config.toml`
- **LINE:** 175
- **CATEGORY:** security
- **DESCRIPTION:** `minimum_password_length = 6` is weak. The CLAUDE.md mentions test password `QATestPass123!` (13 chars) but production users could set 6-char passwords. Recommend `minimum_password_length = 8` and `password_requirements = "lower_upper_letters_digits"`.

### M-13: `config.toml` email rate limit is 2 per hour
- **FILE:** `supabase/config.toml`
- **LINE:** 182
- **CATEGORY:** inconsistency
- **DESCRIPTION:** `email_sent = 2` limits to 2 emails/hour. For a production app with team invites, password resets, and notification emails, this is extremely restrictive. This is fine for local dev but should be documented as needing adjustment for staging/production.

### M-14: BUNDLED_ALL_MIGRATIONS.sql duplicates individual migrations
- **FILE:** `supabase/migrations/BUNDLED_ALL_MIGRATIONS.sql`
- **LINES:** All (~5000+)
- **CATEGORY:** inconsistency
- **DESCRIPTION:** This file duplicates content from migrations 001-029+ into a single file. If both this and individual migrations run (based on Supabase migration tracking), it will cause duplicate CREATE errors. Needs to be excluded from normal migration flow or individual files need to be removed.

### M-15: `081_care_phase2_phase3_tables.sql` creates tables without FK constraints
- **FILE:** `supabase/migrations/081_care_phase2_phase3_tables.sql`
- **LINES:** 12, 54, 91, 287
- **CATEGORY:** schema
- **DESCRIPTION:** Tables like `participant_id uuid NOT NULL` without `REFERENCES` clauses. These lack referential integrity enforcement, meaning orphaned records can accumulate.

### M-16: `validate_invite_token()` exposes org details to unauthenticated callers
- **FILE:** `supabase/migrations/036_rbac_enforcement.sql`
- **LINES:** 181-219
- **CATEGORY:** security
- **DESCRIPTION:** `validate_invite_token()` is `SECURITY DEFINER` and returns org name, slug, inviter name to anyone with a valid token. While necessary for the invite flow, it means a leaked/brute-forced token reveals org metadata. Consider rate-limiting at the Edge Function level.

---

## LOW Findings

### L-01: `organizations.trade` uses plain text instead of enum
- **FILE:** `supabase/migrations/004_core_organizations.sql`
- **LINE:** 11
- **CATEGORY:** schema
- **DESCRIPTION:** `trade text` allows any string. Given the app targets specific trades (plumbing, HVAC, electrical, etc.), this should be an enum or have seed data validation.

### L-02: `organizations.settings` uses monolithic JSONB
- **FILE:** `supabase/migrations/004_core_organizations.sql`
- **LINES:** 14-22
- **CATEGORY:** schema
- **DESCRIPTION:** Settings like `timezone`, `currency`, `date_format`, `default_tax_rate` are stored in a single JSONB blob. This makes schema validation, indexing, and querying harder than dedicated columns.

### L-03: `profiles.notification_preferences` uses JSONB without validation
- **FILE:** `supabase/migrations/003_core_profiles.sql`
- **LINES:** 13-18
- **CATEGORY:** schema
- **DESCRIPTION:** The notification_preferences JSONB has no CHECK constraint validating the structure. Invalid keys or values won't be caught at the database level.

### L-04: Missing index on `notifications.organization_id` + `type`
- **FILE:** `supabase/migrations/016_module_notifications.sql`
- **LINES:** 32-35
- **CATEGORY:** schema
- **DESCRIPTION:** There's an index on `(organization_id)` and `(user_id, read, archived)` but no composite index for org-level type filtering, which is common for notification dashboards.

### L-05: `audit_log` table missing INSERT policies — documentation gap
- **FILE:** `supabase/migrations/008_core_rls_policies.sql`
- **LINE:** 105
- **CATEGORY:** incomplete
- **DESCRIPTION:** Comment says "Insert via service_role or security definer functions only" but this isn't enforced or documented formally. A developer might try client-side audit inserts and get silent failures.

### L-06: `clients.deleted_at` soft-delete pattern not enforced by DB constraint
- **FILE:** `supabase/migrations/010_module_clients.sql`
- **LINE:** 27
- **CATEGORY:** schema
- **DESCRIPTION:** The soft-delete pattern (`deleted_at timestamptz`) relies on application code always filtering `WHERE deleted_at IS NULL`. A DB-level view or policy would be more robust.

### L-07: `assets.year` uses `int` — allows negative and far-future values
- **FILE:** `supabase/migrations/014_module_assets.sql`
- **LINE:** 21
- **CATEGORY:** schema
- **DESCRIPTION:** `year int` has no CHECK constraint. Could store year 0, -500, or 9999. Should be `CHECK (year BETWEEN 1900 AND 2100)`.

### L-08: Naming inconsistency — `deleted_at` vs no soft delete
- **FILE:** Multiple
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Core tables (clients, jobs, invoices, assets, forms) use `deleted_at` for soft delete. But many care-sector tables (participant_profiles, incidents, progress_notes, medications, etc.) have no soft delete mechanism. Hard deletes on clinical records are problematic for audit compliance.

### L-09: `organization_members` has both `role` (enum) and `role_id` (FK to organization_roles)
- **FILE:** `supabase/migrations/004_core_organizations.sql` + `027_team_rbac_enhancements.sql`
- **LINES:** 39 (role enum), 24 (role_id FK)
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Two parallel RBAC systems: the original `role` enum column and the newer `role_id` FK to `organization_roles`. Some policies use the enum, others use the permissions JSONB from `organization_roles`. This creates confusion about which is authoritative.

### L-10: `schads_award_rates.id` uses `serial` instead of `uuid`
- **FILE:** `supabase/migrations/077_staff_profiles.sql`
- **LINE:** 63
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Every other table in the schema uses `uuid PRIMARY KEY DEFAULT gen_random_uuid()`. This table uses `serial PRIMARY KEY`. While functionally fine, it breaks the universal UUID pattern.

---

## Summary of Severity Distribution by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW |
|----------|----------|------|--------|-----|
| security | 3 | 7 | 3 | 0 |
| error | 3 | 0 | 0 | 0 |
| schema | 0 | 2 | 5 | 5 |
| incomplete | 0 | 2 | 0 | 2 |
| inconsistency | 1 | 1 | 8 | 3 |

---

## Recommended Priority Actions

1. **IMMEDIATE (CRITICAL):** Fix all SECURITY DEFINER-less RPC functions that modify financial data (C-02), add org-scoping to all detail RPCs (H-07 through H-12), and encrypt integration credentials (C-01).

2. **URGENT (HIGH):** Remove or reconcile duplicate RLS policies from 036 vs originals (H-02) — the current state gives a false sense of role-based security while original permissive policies remain active.

3. **SHORT-TERM (MEDIUM):** Fix `api.enabled = false` in config.toml (M-11), add CHECK constraints to free-text status columns (M-04 through M-06), and audit BUNDLED_ALL_MIGRATIONS.sql deduplication (M-14).

4. **BACKLOG (LOW):** Standardize UUID vs serial, add soft-delete to care tables, add year range constraints.

---

*This audit covers schema structure and migration integrity. Runtime behavior may vary depending on Supabase version, migration ordering, and whether BUNDLED_ALL_MIGRATIONS.sql is excluded from the migration runner.*
