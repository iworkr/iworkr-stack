# Project Aegis-Core Production Remediation Audit

Date: 2026-03-14  
Project Ref: `olqjuadvseoxpfjzlghb`  
Vercel Project: `iworkr-stack` (`prj_qEAE3zdi9ObXEsTlbxSJEtdWdM00`)

## Summary

Project Aegis-Core was implemented and deployed across Supabase + Vercel with live verification.

- Vault RPC runtime encryption/decryption failures: fixed
- Missing edge functions returning 404: fixed and deployed
- Deterministic malformed webhook handling for Resend: fixed
- DLQ architecture for unresolved webhook routing: implemented and verified
- CI/CD workflow for edge deployments: added

## Code Changes

- Added migration: `supabase/migrations/105_aegis_core_pgcrypto_vault_patch.sql`
  - Ensures `pgcrypto` in `extensions` schema
  - Patches `integration_encryption_key()`
  - Patches `upsert_tenant_integration_secret(...)` and `get_tenant_integration_secret(...)`
  - Uses explicit `extensions.pgp_sym_encrypt` / `extensions.pgp_sym_decrypt`
- Added migration: `supabase/migrations/106_aegis_core_webhook_dlq.sql`
  - Creates `webhook_dead_letters` table
  - Adds unresolved index + source/event index
  - Adds RLS + service-role policy
- Updated: `supabase/functions/resend-webhook/index.ts`
  - Added strict Zod validation gate
  - Returns deterministic `400` on malformed payloads (including `{}`)
  - Preserves signature validation and internal error handling
- Updated: `supabase/functions/webhooks-ingest/index.ts`
  - Adds DLQ routing for unresolved integration mapping
  - Adds DLQ routing for queue enqueue failures
  - Returns explicit `status: "dlq_routed"` for unresolved integration conditions
- Added CI workflow: `.github/workflows/deploy-supabase-functions.yml`
  - Deploys critical functions on push to `main` for `supabase/functions/**`
  - Handles public webhook functions with `--no-verify-jwt`
- Added DLQ triage + replay operations surface:
  - `src/app/olympus/system/dlq/page.tsx`
  - `src/app/actions/superadmin.ts` (`listWebhookDeadLetters`, `replayWebhookDeadLetter`)
  - linked from `src/app/olympus/system/page.tsx`

## Production Deployment Actions

### Supabase (MCP)

- Applied migrations through MCP:
  - `105_aegis_core_pgcrypto_vault_patch`
  - `106_aegis_core_webhook_dlq`
- Deployed edge functions via MCP `deploy_edge_function`:
  - `convoy-defect-escalation` (new active deployment)
  - `process-timesheet-math` (new active deployment)
  - `resend-webhook` (updated to version 2)
  - `webhooks-ingest` (updated to version 2)

Note: direct CLI deploy remained blocked by `403 Forbidden resource`; MCP deployment path succeeded.

### Vercel

- Triggered production deployment:
  - Production URL: `https://iworkr-stack-c4lkzxipo-aiva-io.vercel.app`
  - Inspect URL: `https://vercel.com/aiva-io/iworkr-stack/2A8uhKYGzpzXhDzYzdFgLwYuC1MQ`
- Confirmed deployment is `READY` via Vercel MCP `list_deployments`.

## Acceptance Verification

### 1) Cryptographic Vault

Result: PASS

- Upsert/decrypt round trip succeeded for test tenant.
- Encrypted columns confirmed as ciphertext byte arrays (`octet_length > 0`).

### 2) Missing Function Deployment

Result: PASS

- `convoy-defect-escalation` now active and callable (no longer 404; returns input validation `400`).
- `process-timesheet-math` now active and callable (no longer 404; returns input validation `400`).

### 3) Zod Payload Guards (Resend)

Result: PASS

- `POST {}` to `resend-webhook` now returns:
  - HTTP `400`
  - structured validation details for missing required fields

### 4) DLQ Routing for Unresolved Tenant

Result: PASS

- Sent mocked Xero webhook with fabricated tenant header.
- `webhooks-ingest` returned:
  - HTTP `200`
  - body with `status: "dlq_routed"` and `reason: "UNRESOLVED_INTEGRATION_ID"`
- Verified row inserted in `webhook_dead_letters`:
  - `source = xero`
  - `failure_reason = UNRESOLVED_INTEGRATION_ID:fabricated-tenant-id`
  - `is_resolved = false`

### 5) DLQ Triage UI + Replay Path

Result: PASS

- New super-admin route available at `/olympus/system/dlq`.
- Route renders unresolved DLQ rows, headers, payload viewer, and replay action.
- Replay action invokes `webhooks-ingest` and auto-resolves only when replay no longer returns `dlq_routed`.

## Residual Blocker / Note

- Attempt to set DB-level `app.settings.vault_key` using:
  - `ALTER DATABASE postgres SET "app.settings.vault_key" = ...`
- Outcome: permission denied in this execution context.
- Current behavior remains functional due `integration_encryption_key()` fallback chain.
- Recommended operational follow-up: run the database setting command with elevated project owner permissions if strict key policy is required.

## Final State

All Aegis-Core implementation objectives in scope were completed and validated in production, with one privileged configuration action (database setting write) requiring owner-level follow-up permissions.
