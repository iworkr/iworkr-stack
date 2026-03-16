# iWorkr Backend Full E2E Audit (Supabase Edge + DB)

Date: 2026-03-14  
Environment: Supabase project `olqjuadvseoxpfjzlghb` (live)  
Scope: Edge Functions + PostgreSQL backend functionality (tables, triggers, constraints, RPC critical paths)

## Executive Result

- Total edge functions discovered in codebase: `47`
- Total edge functions deployed/active: `45`
- Endpoint smoke probes executed: `47/47` local slugs against live endpoint
- HTTP result distribution:
  - `200`: 7
  - `400`: 20
  - `401`: 17
  - `404`: 2
  - `500`: 1
- DB workflow tests executed: `8` major scenario groups
- Critical failures found: `3`
- High-severity failures found: `1`

## Methodology

1. Enumerated all local edge function slugs from `supabase/functions/*/index.ts`.
2. Enumerated deployed edge functions via Supabase MCP `list_edge_functions`.
3. Probed every local function endpoint on live project:
   - `OPTIONS` (CORS/method behavior)
   - `POST` with baseline body
4. Pulled edge-function logs from Supabase MCP `get_logs` to validate server-side statuses and exceptions.
5. Ran SQL E2E scenario checks for:
   - Shadow shift financial suppression trigger
   - Parent -> shadow propagation trigger
   - Mentorship graduation trigger
   - Vehicle double-booking exclusion constraint
   - Auditor OTP table lifecycle
   - Tenant integration vault RPCs
   - Queue/status sanity checks

## Edge Function Coverage Matrix

`slug | POST result | verdict`

- `accept-invite` | 400 | pass (validates required invite token)
- `aggregate-coordination-billing` | 200 | pass
- `asset-service-reminder` | 401 | pass (auth-enforced)
- `automation-worker` | 401 | pass (auth-enforced)
- `calculate-travel-financials` | 401 | pass (auth-enforced)
- `care-dashboard-snapshot` | 401 | pass (auth-enforced)
- `color-math` | 400 baseline / 200 valid payload | pass
- `convoy-daily-health-check` | 200 | pass
- `convoy-defect-escalation` | 404 | **fail** (not deployed)
- `create-checkout` | 400 | pass (required fields enforced)
- `create-terminal-intent` | 401 | pass (auth-enforced)
- `distribute-policy` | 401 | pass (auth-enforced)
- `execute-drop-and-cover` | 400 | pass (required fields enforced)
- `execute-workflow` | 401 | pass (auth-enforced)
- `fetch-participant-dossier` | 401 | pass (auth-enforced)
- `generate-pdf` | 400 | pass (required fields enforced)
- `generate-proda-payload` | 400 | pass (required fields enforced)
- `generate-sil-roc-excel` | 401 | pass (auth-enforced)
- `ingest-telemetry` | 200 | pass
- `invite-member` | 400 | pass (required fields enforced)
- `log-wallet-transaction` | 401 | pass (auth-enforced)
- `pending-critical-policies` | 401 | pass (auth-enforced)
- `polar-webhook` | 200 | pass
- `portal-link` | 400 | pass (required fields enforced)
- `process-inbound-invoice` | 400 | pass (required fields enforced)
- `process-integration-sync-queue` | 200 | pass
- `process-mail` | 200 | pass
- `process-shift-note` | 400 | pass (required fields enforced)
- `process-sync-queue` | 401 | pass (auth-enforced)
- `process-timesheet-math` | 404 | **fail** (not deployed)
- `provision-house-threads` | 400 | pass (required fields enforced)
- `resend-webhook` | 500 on `{}` / 200 on valid payload | **fail** (input-handling bug)
- `revenuecat-webhook` | 400 | pass (expected for empty payload)
- `run-automations` | 401 | pass (auth-enforced)
- `send-push` | 400 | pass (required fields enforced)
- `sentinel-scan` | 400 | pass (required fields enforced)
- `start-report-aggregation` | 401 | pass (auth-enforced)
- `stripe-webhook` | 400 | pass (signature required)
- `submit-leave-request` | 400 | pass (required fields enforced)
- `sync-chat-memberships` | 400 | pass (required fields enforced)
- `sync-leave-balances` | 400 | pass (required fields enforced)
- `sync-ndis-catalogue` | 400 | pass (required fields enforced)
- `sync-polar-status` | 401 | pass (auth-enforced)
- `terminal-token` | 401 | pass (auth-enforced)
- `trigger-daily-emails` | 401 | pass (auth-enforced)
- `validate-schedule` | 400 | pass (required fields enforced)
- `webhooks-ingest` | 200 | pass (accepts payload; provider resolution operational)

## Database E2E Scenarios

### 1) Shadow Financial Decoupling Trigger

Tested:
- Inserted shadow shift ledger with non-zero revenue and billable flag
- Trigger `enforce_shadow_financials` enforced:
  - `projected_revenue = 0`
  - `travel_revenue = 0`
  - `is_billable_to_ndis = false`
  - `payroll_gl_account = 'Expense - Staff Training & Onboarding'`

Verdict: **PASS**

### 2) Parent->Shadow Logistical Tether Trigger

Tested:
- Updated parent shift (`status=cancelled`, location changed)
- Child shadow shift auto-updated via `propagate_parent_shift_updates_to_shadow`

Verdict: **PASS**

### 3) Mentorship Graduation Trigger

Tested:
- Inserted 3 pass evaluations for worker/participant pair
- `worker_participant_familiarity` advanced to:
  - `shadow_shifts_completed = 3`
  - `is_cleared_for_independent = true`
  - `cleared_at` populated

Verdict: **PASS**

### 4) Vehicle Double-Booking Constraint

Tested:
- First booking inserted
- Overlapping second booking rejected with exclusion violation:
  - `vehicle_bookings_vehicle_id_tstzrange_excl`

Verdict: **PASS**

### 5) Auditor OTP Lifecycle

Tested:
- OTP insert succeeded
- Attempt increment succeeded
- OTP consume timestamp update succeeded

Verdict: **PASS**

### 6) Tenant Integration Vault RPCs

Tested:
- `upsert_tenant_integration_secret(...)`
- `get_tenant_integration_secret(...)`

Observed:
- Both fail with `function pgp_sym_encrypt(...) does not exist` / `pgp_sym_decrypt(...) does not exist` in function execution context.

Verdict: **FAIL (Critical)**

### 7) Integration Sync Queue Runtime Path

Tested:
- `process-integration-sync-queue` endpoint executes (`200`) when queue empty.
- Queue currently empty (`integration_sync_queue` total = 0).

Risk:
- Xero queue jobs will fail downstream because vault decrypt RPC currently fails (see critical finding above).

Verdict: **PARTIAL PASS / BLOCKED BY VAULT FAILURE**

### 8) Convoy Data Availability

Observed live table counts:
- `fleet_vehicles`: 0
- `vehicle_bookings`: 0
- `vehicle_inspections`: 0
- `vehicle_defects`: 0

Verdict: **Data-gap (not code failure)**  
Impact: Convoy runtime paths are technically deployed but not validated against real production records.

## Findings (Ordered by Severity)

### Critical-1: Xero Vault RPCs Broken in Production

Area:
- `public.upsert_tenant_integration_secret`
- `public.get_tenant_integration_secret`

Symptom:
- Runtime errors on encryption/decryption calls:
  - `pgp_sym_encrypt(text, text) does not exist`
  - `pgp_sym_decrypt(bytea, text) does not exist`

Root Cause:
- Function execution context/search path does not resolve pgcrypto symbols used by these security-definer functions.

Business Impact:
- Multi-tenant Xero token vault is non-functional.
- Webhook enrichment and invoice refresh jobs depending on vault secrets are blocked.

Recommended Fix:
- Fully qualify pgcrypto functions (or include extensions schema in function search path), e.g.:
  - `extensions.pgp_sym_encrypt(...)`
  - `extensions.pgp_sym_decrypt(...)`
- Re-test both RPCs and full Xero webhook->queue->processor chain.

---

### Critical-2: Edge Functions Present in Repo but Missing in Live Deployment

Missing (404 live):
- `convoy-defect-escalation`
- `process-timesheet-math`

Business Impact:
- Defect escalation automation and timesheet math processing paths are dead endpoints in production.

Recommended Fix:
- Deploy both functions immediately and verify with post-deploy endpoint checks.

---

### High-1: `resend-webhook` Returns 500 for Valid JSON Shape `{}` Instead of Deterministic 4xx

Symptom:
- `POST {}` -> `500 Internal Server Error`
- `POST` with expected structure -> `200`

Likely Cause:
- Handler assumes `webhook.data` exists and dereferences fields without guard.

Business Impact:
- Malformed external webhook payloads can produce avoidable server errors/noisy logs.

Recommended Fix:
- Add strict schema validation and return `400` for malformed payloads.

---

### Medium-1: `webhooks-ingest` Returns Success with No Routed Integration

Symptom:
- Returns `success: true` even when `integration_id` unresolved and nothing queued/processed.

Impact:
- Potential silent drops (operationally ambiguous ingest outcomes).

Recommended Fix:
- Return explicit status semantics when integration mapping is absent (e.g., `accepted_unroutable`, or 422 with reason) and log hard warning.

## Evidence Snapshots

- Edge logs confirm 404 for:
  - `/functions/v1/convoy-defect-escalation`
  - `/functions/v1/process-timesheet-math`
- Edge logs confirm 500 path for `/functions/v1/resend-webhook` under malformed body case.
- SQL error traces captured for vault RPC encrypt/decrypt function resolution failures.

## Overall Backend Status

- Core platform backend skeleton is operational and many guarded endpoints behave correctly.
- Shadow-shift and mentorship DB mechanics are functioning correctly.
- Booking conflict integrity is functioning correctly.
- **Not production-flawless** due to critical integration gaps:
  1. Xero token vault RPC failure
  2. Two non-deployed edge functions required by backend workflows
  3. Webhook hardening gap (`resend-webhook` malformed payload path)

## Recommended Immediate Action Plan

1. Patch and redeploy SQL vault RPC functions (pgcrypto symbol resolution fix).
2. Deploy missing edge functions:
   - `convoy-defect-escalation`
   - `process-timesheet-math`
3. Patch `resend-webhook` payload validation and redeploy.
4. Re-run full edge probe + targeted Xero end-to-end (ingest -> queue -> processor) with seeded integration and tenant secret.
5. Seed representative convoy data in staging/prod-safe test org and re-run convoy workflow validation.
