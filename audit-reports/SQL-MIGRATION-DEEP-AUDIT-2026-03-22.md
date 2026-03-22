# SQL Migration Deep Audit — 2026-03-22
> Scope: ALL 169 migration files in `supabase/migrations/` + `seed.sql`
> Auditor: Claude Code (deep read of every critical file)
> Severity scale: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🔵 LOW · ⚪ INFO

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 5 |
| 🟠 HIGH | 9 |
| 🟡 MEDIUM | 12 |
| 🔵 LOW | 8 |
| **Total** | **34** |

The schema is fundamentally solid — core tables have proper FKs, indexes, cascades, and RLS.
The primary risk areas are: **duplicate permissive RLS policies still active**, **`custom_access_token_hook` overwritten between migrations 120↔145**, **overly permissive `FOR ALL USING (true)` on ~8 tables**, and **SECURITY DEFINER functions lacking org-scoping on write paths**.

---

## 🔴 CRITICAL — Fix Immediately

### C-1. `custom_access_token_hook` Overwritten — Conflicting Implementations
**Files:** `120_aegis_rbac_engine.sql` → `145_aegis_rbac_permission_matrix.sql`
**Issue:** Migration 120 defines a hook that injects `role`, `org_id`, `is_super_admin`, and `participant_id` into JWT claims. Migration 145 completely replaces it with a different implementation that injects `permissions[]`, `role_name`, and `active_workspace` but **drops `is_super_admin`, `participant_id`, and `role` from the hook output**. Meanwhile, the JWT helper functions (`jwt_is_super_admin()`, `jwt_participant_id()`, `jwt_role()`) from 120 still reference the OLD claim structure.
**Impact:** After migration 145, JWT claims no longer contain `role` or `is_super_admin` at the path `app_metadata.role` — they contain `role_name` and `permissions[]` instead. **Every `jwt_*()` function from migration 120 silently returns wrong/null values**, meaning the fast RLS helpers are broken.
**Fix:** Reconcile the two hooks into a single function that injects ALL fields: `role`, `org_id`, `is_super_admin`, `participant_id` (from 120) AND `permissions[]`, `role_name`, `active_workspace` (from 145).

### C-2. Permissive RLS Policies Still Active on Core Tables (OR-combine Bypass)
**Files:** `011_module_jobs.sql`, `010_module_clients.sql`, `013_module_finance.sql`
**Issue:** Migration 036 adds role-restricted policies (e.g., technicians can only see assigned jobs), and 175 drops SOME old permissive policies. But the original permissive policies from 010/011/013 (e.g., `"Members can read org jobs"`, `"Members can read org clients"`, `"Members can read org invoices"`) are **never dropped**. PostgreSQL OR-combines all `SELECT` policies, so ANY member with `status = 'active'` bypasses the role restrictions from 036.
**Impact:** A `subcontractor` can see ALL clients (should see none per 036), ALL invoices (should see none), and ALL jobs (should only see assigned). **RBAC is completely bypassed.**
**Fix:** In a new migration, explicitly drop ALL pre-036 permissive policies:
```sql
DROP POLICY IF EXISTS "Members can read org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Members can create org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Members can update org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Members can read org clients" ON public.clients;
DROP POLICY IF EXISTS "Members can create org clients" ON public.clients;
DROP POLICY IF EXISTS "Members can update org clients" ON public.clients;
DROP POLICY IF EXISTS "Members can read org invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can create org invoices" ON public.invoices;
DROP POLICY IF EXISTS "Members can update org invoices" ON public.invoices;
```

### C-3. `impersonation_sessions` — `FOR ALL USING (true) WITH CHECK (true)` 
**File:** `163_olympus_apex_admin_audit.sql` (line 74)
**Issue:** The `impersonation_sessions` table has RLS enabled but the policy grants **all operations (SELECT, INSERT, UPDATE, DELETE) to ALL authenticated users**. Any logged-in user can:
- See all active impersonation sessions (who is impersonating whom)
- Create fake impersonation records
- Delete/modify impersonation audit trail
**Fix:** Restrict to `service_role` only. Add `TO service_role` on the policy.

### C-4. `inbound_webhooks_queue` — `FOR ALL USING (true) WITH CHECK (true)` 
**File:** `153_aegis_zero_webhook_store_and_forward.sql` (line 66-67)
**Issue:** Despite being server-to-server, the policy grants full access to ALL users (no role restriction). While there IS a second `SELECT`-only policy for super admins, the first `FOR ALL` policy supersedes it — any authenticated user can INSERT/UPDATE/DELETE webhook queue entries. Could be exploited to:
- Inject fake webhook payloads (billing manipulation via Stripe/Polar spoofing)
- Delete pending webhooks (suppress payment confirmations)
**Fix:** Replace `USING (true)` with `USING (auth.role() = 'service_role')` or add `TO service_role`.

### C-5. `analytics_refresh_log` — `FOR ALL USING (true)` (No Role Check)
**File:** `146_panopticon_bi_warehouse.sql` (line 311-312)
**Issue:** Any authenticated user can read, update, and delete analytics refresh log entries. Low direct risk but violates principle of least privilege — log tampering is possible.
**Fix:** Restrict to `service_role`.

---

## 🟠 HIGH — Fix Before Next Release

### H-1. `system_telemetry` — `FOR ALL USING (true) WITH CHECK (true)`
**File:** `162_argus_panopticon_telemetry.sql` (line 46-50)
**Issue:** Telemetry table is world-readable AND writable by any authenticated user. Comment says "service role only" but the policy doesn't enforce it. A malicious user could flood telemetry with garbage data or read all system events.
**Fix:** Add `TO service_role` or restrict `USING` clause.

### H-2. `admin_audit_logs` — `FOR SELECT USING (true)` and `FOR INSERT WITH CHECK (true)` 
**File:** `163_olympus_apex_admin_audit.sql` (lines 35-37)
**Issue:** Any authenticated user can read ALL admin audit logs (including impersonation records, admin actions, IP addresses) and insert fake audit entries. The DELETE/UPDATE deny policies are correct, but the SELECT/INSERT are too permissive.
**Fix:** Restrict SELECT to super admins. Restrict INSERT to `service_role`.

### H-3. `global_trade_seed` — `FOR SELECT USING (true)` (Public Read)
**File:** `134_hephaestus_cpq_engine.sql` (line 83)
**Issue:** Global trade data is readable by ALL users including anonymous. If this contains pricing/margin data, it's a business intelligence leak.
**Fix:** Restrict to authenticated users at minimum.

### H-4. `user_has_role()` — Role Ordering Bug with `office_admin`
**File:** `007_core_rls_helpers.sql` (line 44-47)
**Issue:** The `role_order` array places `office_admin` AFTER `subcontractor`:
```sql
array['owner', 'admin', 'manager', 'senior_tech', 'technician', 'apprentice', 'subcontractor', 'office_admin']
```
This means `office_admin` has the LOWEST priority. Calling `user_has_role(org_id, 'technician')` for an `office_admin` user returns `false` because `office_admin` is at position 8, which is > position 5 (`technician`). But in `036_rbac_enforcement.sql`, `office_admin` is treated as equivalent to `manager` level.
**Impact:** Any RLS policy using `user_has_role()` with `office_admin` users will fail unexpectedly. The function considers `office_admin` as less privileged than `subcontractor`.
**Fix:** Reorder to: `['owner', 'admin', 'manager', 'office_admin', 'senior_tech', 'technician', 'apprentice', 'subcontractor']`

### H-5. `get_user_org_role()` vs `get_user_role()` — Duplicate Functions, Different Return Types
**Files:** `007_core_rls_helpers.sql` defines `get_user_role(uuid) → org_role`, `036_rbac_enforcement.sql` defines `get_user_org_role(uuid) → text`
**Issue:** Two functions that do the same thing but return different types. The 036 version casts implicitly to `text` and is used in the CASE statements. If a developer calls the wrong one, type mismatches could occur.
**Fix:** Consolidate to a single function. Deprecate one.

### H-6. `schedule_blocks` Missing RBAC Restriction for Technicians
**File:** `012_module_schedule.sql`
**Issue:** Schedule blocks use permissive "any org member" policies (from 012). Migration 036 does NOT add role-based restrictions for schedule_blocks (only jobs, clients, invoices, and members). A subcontractor can see ALL schedule blocks in the org, including other workers' schedules.
**Impact:** Privacy violation — workers can see colleagues' schedules, locations, and client assignments.
**Fix:** Add role-based SELECT policy: technicians/apprentices/subcontractors should only see their own `technician_id = auth.uid()` blocks.

### H-7. `generate_ndis_claim_batch()` Granted to `authenticated` — No Org Check
**File:** `174_zenith_ndis_claim_engine.sql` (line 422)
**Issue:** Any authenticated user can call `generate_ndis_claim_batch(org_id, ...)` with ANY org_id. The function is `SECURITY DEFINER` and does NOT verify the caller is a member of the specified organization. A user from Org-A could generate claims against Org-B's data.
**Fix:** Add org membership verification at the start of the function:
```sql
IF NOT EXISTS (SELECT 1 FROM organization_members WHERE user_id = auth.uid() AND organization_id = p_organization_id AND status = 'active') THEN
  RAISE EXCEPTION 'Unauthorized';
END IF;
```

### H-8. `resolve_webhook()`, `fail_webhook()`, `replay_webhook()` — No Auth Check
**File:** `153_aegis_zero_webhook_store_and_forward.sql`
**Issue:** These SECURITY DEFINER functions can be called by ANY authenticated user (default `GRANT EXECUTE` is to `public`). There's no explicit `REVOKE` or role check. Any user could mark webhooks as processed, failed, or replay them.
**Fix:** Add `REVOKE EXECUTE ... FROM authenticated, anon, public; GRANT EXECUTE ... TO service_role;`

### H-9. Plaintext PII Persists After Citadel Encryption
**File:** `171_aegis_citadel_encryption_vault.sql`
**Issue:** The migration encrypts data into `_enc` shadow columns but **never NULLs out the original plaintext columns** (`bank_account_name`, `bank_bsb`, `bank_account_number`, `home_address`, etc.). Encryption is rendered moot because the plaintext is still in the table. The auto-encrypt trigger also continues to set BOTH the plaintext and encrypted columns on update.
**Fix:** After encryption migration succeeds, NULL out source columns:
```sql
UPDATE staff_profiles SET bank_account_name = NULL, bank_bsb = NULL, ... WHERE bank_account_name_enc IS NOT NULL;
```

---

## 🟡 MEDIUM — Address in Next Sprint

### M-1. `FOR ALL` Policies Grant DELETE Where Not Intended
**Files:** Multiple — `081_care_phase2_phase3_tables.sql` (9 tables), `082_unified_payroll_timesheets.sql` (4 tables), `083_care_house_threads.sql` (4 tables)
**Issue:** Using `FOR ALL` grants SELECT, INSERT, UPDATE, **and DELETE** to any org member. For sensitive tables like `behaviour_support_plans`, `restrictive_practices`, `policy_register`, `timesheets`, and `payroll_exports`, any team member (including apprentices) can delete records.
**Fix:** Replace `FOR ALL` with separate policies per operation with role restrictions.

### M-2. `clients` Table Missing Unique Constraint on `(organization_id, email)`
**File:** `010_module_clients.sql`
**Issue:** No unique constraint on email per org. Duplicate client records with the same email can exist within a workspace.
**Fix:** Add partial unique index: `CREATE UNIQUE INDEX idx_clients_org_email ON clients (organization_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;`

### M-3. `invoices.due_date` Has `NOT NULL` but No Check Constraint
**File:** `013_module_finance.sql`
**Issue:** `due_date` is `NOT NULL` but there's no check that `due_date >= issue_date`. Invoices can have due dates before their issue date.
**Fix:** `ALTER TABLE invoices ADD CONSTRAINT chk_invoice_dates CHECK (due_date >= issue_date);`

### M-4. `job_display_seq` Is Global, Not Per-Org
**File:** `011_module_jobs.sql` (line 39)
**Issue:** `CREATE SEQUENCE public.job_display_seq;` is a single global sequence. Display IDs (`JOB-401`) will not be sequential within an org if multiple orgs are creating jobs concurrently. Org-A might get JOB-501, then Org-B gets JOB-502, then Org-A gets JOB-503.
**Fix:** This is by design for simplicity, but document it. Alternatively, use per-org sequences or a counter column on `organizations`.

### M-5. `notifications.type` Enum May Be Missing Values Used in Code
**File:** `016_module_notifications.sql`, `170_notification_type_enum_expansion.sql`
**Issue:** The notification_type enum has been expanded in 170 to add `job_cancelled`, `job_rescheduled`, `message_received`, `compliance_warning`. But code may use other values not in the enum. The `check_low_stock_trigger()` in 175 inserts with `type = 'system'` which is valid, but verify all code paths.
**Fix:** Audit all notification INSERT paths in code for enum compliance.

### M-6. `telemetry_events` (085) — Partition Only Has Initial Set, No Auto-Management
**File:** `085_panopticon_telemetry.sql`
**Issue:** Unlike the later `162_argus_panopticon_telemetry.sql` which has auto-partition management, the original `telemetry_events` partitioned table has no maintenance function. Old partitions will never be cleaned up and new ones won't be created.
**Fix:** Add a `manage_telemetry_events_partitions()` cron function similar to 162's approach.

### M-7. `workspace_branding` — INSERT `WITH CHECK (true)` Allows Any Org ID
**File:** `076_workspace_branding.sql`
**Issue:** The INSERT policy has `WITH CHECK (true)` — any authenticated user can create branding records for any org.
**Fix:** Restrict INSERT to org membership check.

### M-8. `client_activity_logs` — INSERT `WITH CHECK (true)` Allows Any Org ID
**File:** `047_client_activity_logs.sql`
**Issue:** Same pattern as M-7. INSERT is unrestricted.
**Fix:** Add org membership check.

### M-9. `automation_runs` Uses `workspace_id` Instead of `organization_id`
**File:** `049_automata_engine.sql`
**Issue:** The `automation_runs` table uses column name `workspace_id` while all other tables use `organization_id`. The RLS fix in `060_fix_locked_rls_tables.sql` correctly references `workspace_id`, but this inconsistency is a maintenance burden.
**Fix:** Consider adding an alias column or renaming in a future migration.

### M-10. `schads_award_rates` — `FOR SELECT USING (true)` 
**File:** `077_staff_profiles.sql` (line 125)
**Issue:** Award rates are publicly readable. While not directly sensitive, it exposes pay structure.
**Fix:** Restrict to authenticated users with org membership.

### M-11. `tracking_sessions` — Public SELECT Without Org Check
**File:** `148_glasshouse_arrival_tracking.sql` (line 108)
**Issue:** `FOR SELECT USING (true)` — any authenticated user can view ALL tracking sessions across ALL organizations.
**Fix:** Add org membership restriction.

### M-12. `public_holidays` Table Defined Twice
**Files:** `072_schads_award_rules.sql` (line 55) AND `174_zenith_ndis_claim_engine.sql` (line 365)
**Issue:** Both migrations create `public_holidays` with slightly different schemas. The second uses `IF NOT EXISTS` so it's safe, but the first has `organization_id` nullable while the second also adds it. Could cause confusion about which schema is canonical.
**Fix:** Document canonical definition.

---

## 🔵 LOW — Track and Address

### L-1. `audit_log.organization_id` Uses `ON DELETE SET NULL` Instead of CASCADE
**File:** `006_core_audit_log.sql`
**Issue:** If an org is deleted, audit entries lose their org reference but remain. This is arguably correct (audit preservation) but should be documented.

### L-2. No Index on `profiles.phone` 
**File:** `003_core_profiles.sql`
**Issue:** Phone number searches require full table scan. If phone-based lookup is common, add an index.

### L-3. `invoice_display_seq` Starts at 1251
**File:** `013_module_finance.sql` (line 38)
**Issue:** `CREATE SEQUENCE public.invoice_display_seq start with 1251;` — hardcoded start value. New orgs will start invoices at INV-1251, which looks odd.

### L-4. `citadel_encrypt()` Marked as `STABLE` but Performs Encryption
**File:** `171_aegis_citadel_encryption_vault.sql`
**Issue:** `STABLE` tells Postgres the function returns the same result for the same input within a transaction. PGP encryption includes random padding, so the output changes each call. Should be `VOLATILE`.

### L-5. `log_job_activity()` References `auth.uid()` in Trigger — May Be NULL for System Ops
**File:** `175_zenith_critical_fixes.sql`
**Issue:** The function calls `auth.uid()` to populate `user_id`. For background/cron operations where no user is authenticated, this will be NULL. The COALESCE only handles `full_name`, not the user_id itself.

### L-6. `check_velocity_anomaly` Doesn't Set `organization_id` on Security Events
**File:** `173_aegis_citadel_auth_hardening.sql`
**Issue:** When logging velocity anomalies, the function inserts into `security_events` without setting `organization_id`. This means org admins can't see these events via the RLS policy (which filters by org_id).

### L-7. `seed.sql` Uses Hardcoded Credentials
**File:** `supabase/seed.sql`
**Issue:** Password `QATestPass123!` is hardcoded in plaintext. Fine for local dev, but if this seed runs in any shared/staging environment, it's a credential leak.

### L-8. `care_plans`, `care_goals` Seed Data References Participant IDs Directly
**File:** `supabase/seed.sql`
**Issue:** Seed data inserts care_plans and care_goals with hardcoded UUIDs (`e0000000-...`, `f0000000-...`). These will conflict with production data if seed accidentally runs in prod. The `ON CONFLICT DO NOTHING` prevents crashes but silently skips data.

---

## Structural Observations (⚪ INFO)

### RLS Coverage Summary
- **~90 tables** have proper `ENABLE ROW LEVEL SECURITY` with policies
- **8-10 tables** have RLS enabled but overly permissive policies (`USING (true)`)
- **No tables** found completely missing RLS that should have it (good!)

### Migration Naming Consistency ✅
- All migrations follow `NNN_descriptive_name.sql` except two timestamped ones (`20240320000062`, `20240320000130`) and one `BUNDLED_ALL_MIGRATIONS.sql`

### Foreign Key Integrity ✅
- All core tables have proper cascade deletes
- Child tables (job_subtasks, invoice_line_items, etc.) correctly cascade from parent
- Profile references use `ON DELETE SET NULL` (correct for preserving history)

### Index Coverage ✅ 
- All frequently-queried columns have indexes
- Partial indexes with `WHERE deleted_at IS NULL` used consistently for soft deletes
- GIN trigram index on `clients.name` for search (good)

### Trigger Architecture ✅ 
- `update_updated_at()` trigger applied consistently to all tables with `updated_at`
- Job activity logging trigger correctly uses IS DISTINCT FROM for null-safe comparison
- Low-stock trigger correctly scopes to org members

---

## Priority Fix Sequence

1. **C-2** (30 min) — Drop old permissive RLS policies on jobs/clients/invoices
2. **C-1** (1 hr) — Reconcile `custom_access_token_hook` between migrations 120 and 145
3. **C-3/C-4/C-5** (30 min) — Fix `USING (true)` on impersonation, webhooks, analytics
4. **H-4** (10 min) — Fix `office_admin` role ordering in `user_has_role()`
5. **H-7/H-8** (30 min) — Add auth checks to NDIS claim generation and webhook RPCs
6. **H-1/H-2** (20 min) — Fix telemetry and admin audit log permissions
7. **H-6** (20 min) — Add role-based schedule_blocks RLS
8. **H-9** (30 min) — NULL out plaintext after Citadel encryption

**Estimated total: ~4 hours for all CRITICAL + HIGH fixes.**
