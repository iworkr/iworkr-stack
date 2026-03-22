# 🔥 EDGE FUNCTIONS DEEP AUDIT — 2026-03-22
> **Scope**: All 95 Supabase Edge Functions + 3 shared utilities  
> **Method**: Full file read and line-by-line analysis  
> **Total Issues Found**: **343**

---

## EXECUTIVE SUMMARY

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 **CRITICAL** | **16** | Will cause data loss, security breaches, or runtime crashes in production |
| 🟠 **HIGH** | **79** | Significant bugs, security holes, or broken functionality |
| 🟡 **MEDIUM** | **140** | Incorrect behavior, missing validation, performance problems |
| 🔵 **LOW** | **108** | Code quality, minor bugs, inconsistencies |

### Top Systemic Issues (cross-cutting across 60+ functions)
1. **Wildcard CORS `*`** — 72 of 95 functions use `Access-Control-Allow-Origin: *`, exposing authenticated/financial/clinical endpoints to any browser origin
2. **Missing Authentication** — 18+ functions have zero auth, accepting any caller with any `organization_id`
3. **Missing Org Membership Checks** — Even authenticated functions rarely verify the user belongs to the target org
4. **Non-constant-time signature comparisons** — Webhook signature validation vulnerable to timing attacks
5. **Silent error swallowing** — Empty `catch {}` blocks and fire-and-forget DB writes throughout

---

## 🔴 CRITICAL (16 issues)

### C-01: `accounting-webhook` — Webhook signature bypass when env vars missing
- **Lines**: 61–63, 86
- **Category**: SECURITY
- **Description**: `validateXeroSignature` returns `true` when `XERO_WEBHOOK_KEY` is not configured. `validateQboSignature` returns `true` when `verifierToken` is empty. Any attacker can forge webhook payloads if env vars are missing.
- **Fix**: Return `false` when signature secrets are absent. Reject all unverified webhooks.

### C-02: `catalog-nightly-sync` — Encrypted API keys used as plaintext
- **Lines**: 297
- **Category**: SECURITY
- **Description**: `ws.api_key_encrypted` is passed directly to API calls as a Bearer token. If truly encrypted, this sends ciphertext (broken). If plaintext despite the name, keys are stored unencrypted in the DB.
- **Fix**: Implement proper key decryption before use, or rename the column and add encryption.

### C-03: `live-price-check` — Same encrypted key issue
- **Lines**: 270
- **Category**: SECURITY
- **Description**: `ws.api_key_encrypted` used directly as Bearer token for supplier API calls. Same issue as C-02.
- **Fix**: Same as C-02.

### C-04: `inbound-supplier-invoice` — Stack overflow on PDF processing
- **Lines**: 249
- **Category**: BUG
- **Description**: `btoa(String.fromCharCode(...pdfBuffer))` — spread operator on a large `Uint8Array` (multi-MB PDF) exceeds max call stack size. Crashes the function for any real PDF.
- **Fix**: Use chunked base64 encoding or Deno's `std/encoding/base64`.

### C-05: `polar-webhook` — Timing-unsafe signature comparison
- **Lines**: 47
- **Category**: SECURITY
- **Description**: Webhook signature is verified with simple string equality (`!==`), vulnerable to timing attacks that could allow signature forgery.
- **Fix**: Use `crypto.subtle.timingSafeEqual()`.

### C-06: `polar-webhook` — DLQ body variable out of scope
- **Lines**: 199–200
- **Category**: BUG
- **Description**: `body` is `const` scoped inside the `try` block but referenced in the `catch` block. This throws `ReferenceError`, causing the DLQ insert to silently fail.
- **Fix**: Declare `body` in the outer scope.

### C-07: `payroll-evaluator` — Zero authentication on payroll writes
- **Lines**: 4, 321–327
- **Category**: SECURITY
- **Description**: No auth at all. Any caller can invoke with arbitrary `organization_id` and `mode: "production"` to write fake pay lines to `timesheet_pay_lines`.
- **Fix**: Add JWT auth + org membership verification, or restrict to internal/cron invocation with a shared secret.

### C-08: `stripe-webhook` — Missing DLQ (acknowledged FIXME)
- **Lines**: 234
- **Category**: INCOMPLETE
- **Description**: Explicit `FIXME: HIGH` comment in code. Failed webhook events are logged to console but not persisted. Persistent errors cause permanent event loss.
- **Fix**: Route failed events to `webhook_dead_letters` table.

### C-09: `submit-leave-request` — Zero auth on leave submission
- **Lines**: 4, 16
- **Category**: SECURITY
- **Description**: Any caller can submit leave requests for any worker in any organization. Emergency sick leave is auto-approved with `approved_by: worker_id` (self-approval).
- **Fix**: Add JWT auth; verify authenticated user matches worker_id or is an admin.

### C-10: `sirs-sanitizer` — Zero auth on clinical data endpoint
- **Lines**: 4, 117–198
- **Category**: SECURITY
- **Description**: No auth guard on a compliance-sensitive NDIS function handling clinical incident data. Anyone can sanitize/overwrite SIRS submissions for any org.
- **Fix**: Add JWT auth + org membership verification.

### C-11: `synthesize-plan-review` — Zero auth on AI clinical report generation
- **Lines**: 4, 298–304
- **Category**: SECURITY
- **Description**: No auth. Anyone can trigger expensive Gemini AI generation for any org's NDIS plan review data.
- **Fix**: Add JWT auth or service-role bearer token validation.

### C-12: `trust-engine` — Zero auth on trust score manipulation
- **Lines**: 4, 31–37
- **Category**: SECURITY
- **Description**: Unauthenticated access to upsert trust scores, manipulate `workspace_count`, invoice counts, chargebacks for any client identity.
- **Fix**: Add JWT auth or service-role token validation.

### C-13: `vision-hazard-analyzer` — Zero auth on expensive AI endpoint
- **Lines**: 4, 206–214
- **Category**: SECURITY
- **Description**: No auth. Anyone can trigger multimodal AI analysis. The function also has an API key confusion bug (C-14).
- **Fix**: Add JWT auth or service-role token validation.

### C-14: `twilio-llm-negotiator` — Duration calculation always returns 0
- **Lines**: 293–296
- **Category**: BUG
- **Description**: `new Date(neg.original_datetime).getTime() - new Date(neg.original_datetime).getTime()` is always 0 (same value minus itself). Fallback `|| 3600000` always fires, making every rescheduled appointment exactly 1 hour.
- **Fix**: Calculate from actual schedule block start/end: `original_end_time - original_start_time`.

### C-15: `proda-auth` — Zero auth on government API credential dispensing
- **Lines**: 120–126
- **Category**: SECURITY
- **Description**: No authentication. Any caller with `organization_id` can request PRODA OAuth tokens for Australia's NDIS government API.
- **Fix**: Add service-role key check or admin auth. This is a compliance requirement.

### C-16: `start-report-aggregation` — Uses non-existent API
- **Lines**: 434
- **Category**: BUG
- **Description**: `EdgeRuntime.waitUntil()` is a Vercel/Cloudflare API — it does not exist in Supabase Edge Functions (Deno). This throws `ReferenceError: EdgeRuntime is not defined` at runtime.
- **Fix**: Use `queueMicrotask()` or just `await` the aggregation directly.

---

## 🟠 HIGH (79 issues)

### Authentication & Authorization (22)

| # | Function | Lines | Category | Description | Fix |
|---|----------|-------|----------|-------------|-----|
| H-01 | `calculate-dynamic-yield` | 1–8 | SECURITY | `@auth UNSECURED` — calculates pricing margins, any anonymous user can invoke with any org_id | Add auth guard |
| H-02 | `contextual-sop-match` | 1–8 | SECURITY | `@auth UNSECURED` — exposes proprietary SOPs and triggers billable OpenAI calls | Add auth guard |
| H-03 | `evaluate-halcyon-state` | 4 | SECURITY | `@auth UNSECURED` — accepts arbitrary `user_id` without auth | Add auth guard |
| H-04 | `outrider-en-route-notify` | 60–63 | SECURITY | No user auth verification — any valid JSON request updates job statuses and sends SMS | Add auth gate |
| H-05 | `process-shift-note` | 4, 51–74 | SECURITY | `@auth UNSECURED` — anyone can submit shift notes with care/NDIS data | Add auth |
| H-06 | `process-timesheet-math` | 4, 360–366 | SECURITY | `@auth UNSECURED` — anyone can trigger award interpretation writes | Add auth |
| H-07 | `sync-leave-balances` | 4 | SECURITY | No auth — anyone can overwrite leave balances | Add auth |
| H-08 | `sync-outbound` | 4, 175 | SECURITY | No auth — anyone can trigger Xero sync for any invoice | Add webhook secret or service key check |
| H-09 | `provision-house-threads` | 33–158 | SECURITY | No auth — anyone can provision care chat channels for any org | Add auth |
| H-10 | `sentinel-scan` | 45–311 | SECURITY | No auth — anyone can trigger sentinel scans and generate alerts | Add service-role key check |
| H-11 | `semantic-voice-router` | 426–607 | SECURITY | No auth — anyone can trigger transcription/LLM routing on audio files | Add auth |
| H-12 | `submit-internal-feedback` | 2, 37–43 | SECURITY | Claims `@auth SECURED` but has NO auth check. Trusts body `user_id`. DoS vector via hard-lock. | Add JWT auth |
| H-13 | `verify-s8-witness` | 32–56 | SECURITY | Claims `@auth SECURED` but has NO JWT validation. Drug double-signing function. | Add JWT validation |
| H-14 | `catalog-nightly-sync` | 1–8 | SECURITY | No auth — any anonymous user can trigger full catalog sync, rate limiting with suppliers | Add service key check |
| H-15 | `invite-member` | 70–77 | BUG | "Already a member" check is fundamentally broken — uses UUID `"000..."` fallback, never matches | Fix profile lookup logic |
| H-16 | `twilio-voice-inbound` | 164–178 | SECURITY | Signature validation skipped entirely when `TWILIO_AUTH_TOKEN` is empty | Default to rejecting when token is not configured |
| H-17 | `twilio-voice-status` | 134–148 | SECURITY | Same signature bypass when auth token is empty | Same fix |
| H-18 | `webhooks-ingest` | 186–194 | SECURITY | Signature verification skipped when env secret not configured — all webhooks accepted | Default to rejecting if secret not configured |
| H-19 | `stripe-webhook` | 88 | SECURITY | In test mode, signature verification completely bypassed. If `IS_TEST_ENV=true` leaks to production, arbitrary webhook injection. | Use separate test webhook secret |
| H-20 | `stripe-webhook` | 29–62 | SECURITY | Custom signature verifier doesn't validate timestamp freshness — no replay protection | Add timestamp tolerance check (5 min) |
| H-21 | `resend-webhook` | 40–46 | SECURITY | Svix HMAC secret likely not decoded from base64. Signature verification may silently pass/fail incorrectly. | Decode `whsec_`-prefixed base64 secret per Svix docs |
| H-22 | `sync-polar-status` | 29 | SECURITY | Service-role key compared via plain string equality — timing attack vulnerability | Use constant-time comparison |

### Bugs (28)

| # | Function | Lines | Category | Description | Fix |
|---|----------|-------|----------|-------------|-----|
| H-23 | `accounting-webhook` | 127–129 | BUG | Unbounded recursive `getValidToken` on `locked_by_other` — infinite recursion if lock never released | Add max retry counter |
| H-24 | `agent-outrider-arbitrator` | 399–404 | BUG | Dead ternary: both branches return `"NEGOTIATING_CLIENT"`. Partial-resolution scenario missing. | Add `"PARTIALLY_RESOLVED"` status |
| H-25 | `create-terminal-intent` | 115–133 | BUG | Stripe payment intent uses both `transfer_data.destination` AND `stripeAccount` — conflicting charge routing | Remove `{ stripeAccount }` from options |
| H-26 | `aggregate-coordination-billing` | 37–45 | BUG | `getPreviousWeekWindow` date math produces wrong Monday/Sunday for certain days of week | Rewrite week boundary calculation |
| H-27 | `process-inbound-invoice` | 148–151 | BUG | Sends PDF base64 as `image_url` to GPT-4o Vision. PDFs not supported as image_url inputs — extraction will fail. | Convert PDF pages to images first |
| H-28 | `generate-proda-payload` | 288–291 | BUG | Upload error is logged but execution continues — batch record created and claims marked "submitted" even though CSV never uploaded | Return error and abort if upload fails |
| H-29 | `smart-roster-match` | 296–298 | BUG | `-1000` house score penalty effectively hard-blocks all non-house workers even when insufficient house staff exists | Use smaller penalty or conditional application |
| H-30 | `sync-engine` | 84–87 | BUG | Unbounded recursion in `getValidToken` on `locked_by_other` — same issue as accounting-webhook | Add max retry counter |
| H-31 | `sync-ndis-catalogue` | 249–259 | BUG | Race condition in temporal versioning — concurrent uploads can create duplicate catalogue rows | Use DB transaction/advisory lock |
| H-32 | `submit-internal-feedback` | 88–95 | BUG | Race condition in counter increment — concurrent submissions lose increments | Use Postgres atomic increment via RPC |
| H-33 | `twilio-voice-status` | 206 | BUG | `voipRecord.notes` accessed but never selected in query — always `undefined` | Add `notes` to the select clause |
| H-34 | `twilio-webhook` | 174, 186–195 | BUG | Twilio signature validated against Zod-parsed payload instead of raw form params — signature check may fail | Validate against `ctx.rawBody` |
| H-35 | `vision-hazard-analyzer` | 18 | BUG | `GEMINI_API_KEY` fallback to `OPENAI_API_KEY!` — if neither is set, `undefined` with non-null assertion | Use proper fallback with empty string check |
| H-36 | `vision-hazard-analyzer` | 185 | BUG | OpenAI path uses `GEMINI_API_KEY` as Bearer token — wrong key for wrong API | Use separate `OPENAI_API_KEY` variable |
| H-37 | `send-push` | 120–121 | BUG | FCM v1: `tokenData.access_token` not checked for existence before use | Add null check |
| H-38 | `regulatory-rag-intercept` | 14 | BUG | Module-level `!` assertion on `OPENAI_API_KEY` — crashes all requests if env var missing | Lazy-load at request time |
| H-39 | `semantic-voice-router` | 15 | BUG | Same module-level `!` assertion crash | Lazy-load at request time |
| H-40 | `stripe-webhook` | 252–253 | BUG | `handleSubscriptionChange` from checkout path receives `undefined` sub object — all fields become undefined/null | Fetch subscription from Stripe API first |
| H-41 | `stripe-webhook` | 16–23 | BUG | `PLAN_MAP` has placeholder price IDs (`price_starter_monthly`) — not real Stripe IDs | Replace with actual Stripe price IDs |
| H-42 | `process-timesheet-math` | 195–217 | BUG | Overtime hours added on top of ordinary without deducting — workers get paid for more than actual hours | Deduct overtime hours from ordinary category |
| H-43 | `twilio-llm-negotiator` | 350 | BUG | `accept_delay` sets `accepted_datetime: null` instead of `args.confirmed_eta` | Set to `args.confirmed_eta` |
| H-44 | `submit-leave-request` | 66–67 | BUG | Emergency sick leave auto-approved with `approved_by: worker_id` (self-approval) | Route to pending_emergency_review |
| H-45 | `trigger-daily-emails` | 36 | BUG | `authHeader!` non-null assertion on potentially null value | Check for null first |
| H-46 | `trust-engine` | 137 | BUG | Insert failure makes `identityId` undefined, function continues with bad data | Check insert error |
| H-47 | `update-member-role` | 107–111 | BUG | No `status: "active"` filter — can change role of deactivated members | Add status filter |
| H-48 | `pace-check-budget` | 114–135 | SECURITY | Returns **mock financial data** in production on any error (no env gate) | Gate behind environment check |
| H-49 | `pace-submit-claim` | 385–419 | SECURITY | Simulates successful PRODA submission in production when no token available | Gate behind environment check |
| H-50 | `proda-auth` | 212–235 | SECURITY | Generates mock PRODA tokens in production when vault not configured | Only allow mock tokens with explicit env flag |

### Performance (11)

| # | Function | Lines | Category | Description | Fix |
|---|----------|-------|----------|-------------|-----|
| H-51 | `agent-outrider-arbitrator` | 200–309 | PERFORMANCE | N+1: each job triggers 4+ sequential DB calls in a loop | Batch fetch upfront, parallelize |
| H-52 | `agent-outrider-arbitrator` | 312–396 | PERFORMANCE | N+1: each failed job triggers 3+ sequential DB reads for SMS | Batch-fetch all client data |
| H-53 | `dispatch-invoices` | 69–248 | PERFORMANCE | Sequential loop over invoiceIds — each does 3-5 DB + Stripe + Resend calls | Use Promise.all with concurrency limit |
| H-54 | `inbound-supplier-invoice` | 313–372 | PERFORMANCE | N+1: each line item triggers 2 DB queries for fuzzy matching | Batch into single RPC call |
| H-55 | `oracle-claim-predict` | 119 | PERFORMANCE | N+1: sequential RPC per claim in array | Batch RPC or Promise.all |
| H-56 | `provision-house-threads` | 70–91 | PERFORMANCE | N+1: per-participant 2+ queries in batch mode | Bulk fetch first |
| H-57 | `sync-chat-memberships` | 90–93 | PERFORMANCE | Sequential per-participant processing with 5+ queries each | Parallel batches with concurrency limit |
| H-58 | `trigger-daily-emails` | 54–57 | PERFORMANCE | Fetches ALL organizations, 5+ queries per org in sequential loop | Add filters, batch/paginate |
| H-59 | `care-dashboard-snapshot` | 63–86 | PERFORMANCE | 11 parallel queries, some fetch full tables instead of using counts | Use aggregation RPCs |
| H-60 | `inbound-supplier-invoice` | 196–198 | SECURITY | `body.pdf_url` fetched server-side without URL validation — SSRF vector | Validate against domain allowlist |
| H-61 | `generate-pdf` | 382–384 | SECURITY | `getPublicUrl` makes financial PDFs world-readable | Use `createSignedUrl` with expiration |

### Security (18)

| # | Function | Lines | Category | Description | Fix |
|---|----------|-------|----------|-------------|-----|
| H-62 | `ingest-telemetry` | 30–38 | SECURITY | CORS reflects any Origin with `credentials: true` — enables cross-site data exfiltration | Validate origin against allowlist |
| H-63 | `synthesize-plan-review` | 178 | SECURITY | Gemini API key in URL query string — leaks in logs | Use header-based authentication |
| H-64 | `vision-hazard-analyzer` | 124 | SECURITY | Same Gemini key in URL | Use header |
| H-65 | `automation-worker` | 314 | SECURITY | SSRF: webhook action sends POST to arbitrary user-supplied URL | Validate URL, block private IPs |
| H-66 | `run-automations` | 122–140 | SECURITY | Same SSRF via webhook blocks | Same fix |
| H-67 | `generate-swms-pdf` | 421–424 | INCOMPLETE | Named "generate-swms-pdf" but generates HTML. Status PARTIAL. | Implement actual PDF generation |
| H-68 | `generate-swms-pdf` | 447–449 | SECURITY | Compliance documents publicly accessible via `getPublicUrl` | Use signed URLs |
| H-69 | `revenuecat-webhook` | 155–161 | INCOMPLETE | Explicit FIXME: no DLQ. Failed payloads permanently lost. | Implement DLQ routing |
| H-70 | `generate-plan-report` | 29–33 | SECURITY | Service-role client bypasses RLS, no org membership check | Add org membership verification |
| H-71 | `asset-service-reminder` | 29 | SECURITY | Service-role key compared as Bearer token — conflates auth mechanisms | Separate cron auth from user auth |
| H-72 | `generate-proda-payload` | 22–28 | SECURITY | Wildcard CORS on bulk NDIS claim payload endpoint | Restrict origin |
| H-73 | `generate-sil-roc-excel` | 14–16 | SECURITY | Wildcard CORS on NDIS financial document endpoint | Restrict origin |
| H-74 | `panopticon-text-to-sql` | 20–24 | SECURITY | Wildcard CORS on SQL execution endpoint | Restrict origin |
| H-75 | `payroll-evaluator` | 19–22 | SECURITY | Wildcard CORS + no auth on payroll endpoint | Restrict + add auth |
| H-76 | `generate-swms-pdf` | 151 | SECURITY | SVG signature injected directly into HTML — XSS if SVG contains `<script>` | Sanitize SVG content |
| H-77 | `process-mail` | 171 | SECURITY | `logoUrl` inserted directly into HTML `<img src>` — injection vector | Sanitize/encode URL |
| H-78 | `sentinel-scan` | 81 | SECURITY | `organization_id` interpolated into `.or()` filter string — potential filter injection | Use parameterized filter |
| H-79 | `verify-s8-witness` | 98–99 | SECURITY | Clinical PIN uses SHA-256 without salt — rainbow table vulnerable | Implement bcrypt/argon2 with per-user salt |

---

## 🟡 MEDIUM (140 issues) — Top 50 Listed

| # | Function | Lines | Category | Description |
|---|----------|-------|----------|-------------|
| M-01 | `accept-invite` | 92–95 | ERROR_HANDLING | Invite status update ignores errors — member added but invite stays "pending" |
| M-02 | `accept-invite` | 24 | ERROR_HANDLING | `req.json()` throws 500 on invalid JSON instead of 400 |
| M-03 | `accounting-webhook` | 325–330 | BUG | JSONB path operator in string filter may silently fail |
| M-04 | `accounting-webhook` | 161–166 | BUG | `refresh_failure_count` increment uses stale value |
| M-05 | `aegis-triage-router` | 70 | SECURITY | No org membership check — any user can trigger triage on any incident |
| M-06 | `aggregate-coordination-billing` | 216–228 | ERROR_HANDLING | "Aggregated" status update unchecked — could create duplicate invoices |
| M-07 | `aggregate-coordination-billing` | 48–61 | BUG | `nextDisplayId` race condition — concurrent runs get same ID |
| M-08 | `automation-worker` | 728–729 | BUG | `run_count` increment uses stale value in race condition |
| M-09 | `asset-service-reminder` | 35 | BUG | `authHeader!` non-null assertion on potentially null value |
| M-10 | `calculate-dynamic-yield` | 159–161 | BUG | Fire-and-forget Promise — unhandled rejection can crash isolate |
| M-11 | `care-dashboard-snapshot` | 67 | BUG | Non-timezone-aware date string comparison |
| M-12 | `catalog-nightly-sync` | 330 | PERFORMANCE | 50-page safety limit could mean 25,000 items per supplier |
| M-13 | `contextual-sop-match` | 246 | BUG | `ignoreDuplicates: true` prevents updating stale recommendations |
| M-14 | `convoy-daily-health-check` | 1–8 | INCONSISTENCY | Claims `@auth SECURED` but is a cron function that can't provide user auth |
| M-15 | `convoy-defect-escalation` | 66–78 | BUG | No org membership check — any user can escalate any org's defects |
| M-16 | `create-terminal-intent` | 108 | BUG | `parseFloat("0") || 1.0` — legitimate 0% fee becomes 1% |
| M-17 | `dispatch-arrival-sms` | 106–112 | ERROR_HANDLING | Returns 200 with `success: false` — masks errors |
| M-18 | `dispatch-invoices` | 116 | BUG | `null * null = NaN` renders as `$NaN` in email |
| M-19 | `dispatch-invoices` | 150 | ERROR_HANDLING | Silent catch on Stripe payment link failure |
| M-20 | `dispatch-invoices` | 156 | BUG | Fallback to hardcoded placeholder email `"invoices@planmanager.com.au"` |
| M-21 | `distribute-policy` | 152 | BUG | Upsert overwrites acknowledged policies back to "pending" |
| M-22 | `evaluate-halcyon-state` | 60–63 | ERROR_HANDLING | RPC error returns 200 — callers don't realize it failed |
| M-23 | `execute-workflow` | 304–324 | BUG | TOCTOU: entity could change between auth check and handler execution |
| M-24 | `generate-proda-payload` | 219, 235 | INCOMPLETE | Hardcoded NDIS unit prices that change annually |
| M-25 | `generate-proda-payload` | 322–331 | BUG | Broad filter marks unrelated travel logs as exported |
| M-26 | `generate-sil-roc-excel` | 58–63 | BUG | No check if quote exists — blank Excel generated with no error |
| M-27 | `get-participant-timeline` | 129, 171 | BUG | UUID used as date fallback — `new Date(uuid)` produces NaN |
| M-28 | `inbound-email-webhook` | 474–475 | BUG | Binary attachments corrupted by re-encoding as UTF-8 |
| M-29 | `inbound-email-webhook` | 48–73 | BUG | Multipart parser destroys binary data — should use `req.formData()` |
| M-30 | `ingest-regulation` | 110–143 | INCOMPLETE | PDF text extraction is naive regex — fails on most real PDFs |
| M-31 | `ingest-regulation` | 151–168 | INCONSISTENCY | Auth present but no admin/org membership check (docblock says "admin-only") |
| M-32 | `ingest-regulation` | 290–296 | ERROR_HANDLING | `ingestion_status` not set to "failed" on error — stuck in "embedding" forever |
| M-33 | `ingest-telemetry` | 91–121 | SECURITY | Batch mode bypasses rate limiting — unlimited events per request |
| M-34 | `invite-member` | 169 | ERROR_HANDLING | Email send failure silently swallowed; `email_sent` reports true even on error |
| M-35 | `live-price-check` | 278–289 | PERFORMANCE | N+1: individual UPDATE per SKU in cache update loop |
| M-36 | `oracle-claim-predict` | 133–136 | BUG | On RPC error, confidence set to 100% success — lets bad claims through |
| M-37 | `panopticon-text-to-sql` | 281–284 | BUG | `message_count` read may return null with `count: "exact"` |
| M-38 | `panopticon-text-to-sql` | 329–349 | INCONSISTENCY | Non-streaming path has no retry logic unlike streaming |
| M-39 | `payroll-evaluator` | 311 | BUG | Merged blocks drop fixed allowances from total |
| M-40 | `process-inbound-invoice` | 84–89 | ERROR_HANDLING | Storage upload error unchecked — creates record pointing to nothing |
| M-41 | `process-integration-sync-queue` | 52–60 | BUG | Race condition: no check on update result, duplicate processing possible |
| M-42 | `process-integration-sync-queue` | 148 | BUG | `attempt_count` double-incremented — max_attempts reached one attempt early |
| M-43 | `process-mail` | 326–329 | PERFORMANCE | 5 sequential queries per mail item — 100 queries for 20 items |
| M-44 | `process-outbound` | 71 | BUG | SMS truncated to 160 chars silently — user unaware of content loss |
| M-45 | `process-payout` | 74 | BUG | `amountCents || available.amount` — 0 is falsy, no upper-bound validation |
| M-46 | `process-payout` | 68 | BUG | Hardcoded to AUD — non-Australian workspaces always get "No available balance" |
| M-47 | `process-shift-note` | 152–153 | BUG | `job_id: payload.shift_id` — wrong entity stored in wrong column |
| M-48 | `process-sync-queue` | 59–69 | SECURITY | No field-level validation — arbitrary fields written to DB via update |
| M-49 | `process-sync-queue` | 92–94 | PERFORMANCE | No limit on mutations array size |
| M-50 | `process-timesheet-math` | 258–341 | INCONSISTENCY | Trades interpreter doesn't handle overnight shifts (SCHADS does) |

*Plus 90 additional MEDIUM issues across the remaining functions.*

---

## 🔵 LOW (108 issues) — Systemic Patterns

### Pattern L-A: Wildcard CORS (72 functions)
Nearly every function uses `Access-Control-Allow-Origin: *`. Financial, clinical, and admin endpoints are all browser-accessible from any origin.

### Pattern L-B: Legacy `serve()` imports (12 functions)
`accept-invite`, `dispatch-arrival-sms`, `aggregate-coordination-billing`, `evaluate-halcyon-state`, `inbound-email-webhook`, `submit-internal-feedback`, `sync-chat-memberships`, `sync-outbound`, and others use deprecated `deno.land/std@0.168.0` or `@0.177.0` `serve()` instead of `Deno.serve()`.

### Pattern L-C: Non-null assertions on env vars (30+ functions)
`Deno.env.get("SUPABASE_URL")!` — if env var is missing, function crashes with opaque error.

### Pattern L-D: `req.headers.get("Authorization")!` assertions (15+ functions)
Non-null assertion on potentially missing auth header causes confusing errors instead of clean 401.

### Pattern L-E: Unchecked DB write results (40+ functions)
`.insert()`, `.update()`, `.upsert()` results not checked for errors — silent data loss.

### Pattern L-F: `btoa(String.fromCharCode(...data))` (5 functions)
`push-dispatcher`, `send-push`, `vision-hazard-analyzer`, `inbound-supplier-invoice`, `proda-auth` — spread operator on large arrays causes stack overflow.

### Pattern L-G: Race conditions on counter increments (8 functions)
`run_count`, `attempt_count`, `refresh_failure_count`, `total_negative_sentiments` all use stale-read-then-write instead of atomic Postgres increments.

### Pattern L-H: `send-push` superseded by `push-dispatcher`
Both functions may be deployed and triggered, causing duplicate push notifications.

---

## RECOMMENDATIONS — Priority Order

### P0: Fix Today (CRITICAL)
1. **Add auth** to all 18 unauthenticated functions (C-07, C-09, C-10, C-11, C-12, C-13, C-15 + H-01 through H-14)
2. **Fix webhook signature bypasses** when env vars missing (C-01, H-16, H-17, H-18)
3. **Fix stack overflow** on PDF base64 encoding (C-04)
4. **Fix duration calculation** returning 0 in twilio-llm-negotiator (C-14)
5. **Fix `EdgeRuntime.waitUntil`** in start-report-aggregation (C-16)
6. **Fix polar-webhook** body scoping and timing-safe comparison (C-05, C-06)

### P1: Fix This Week (HIGH)
7. **Replace wildcard CORS** with app-specific origins across all 72 functions
8. **Fix SSRF** in automation-worker and run-automations webhook actions
9. **Fix N+1 query patterns** in agent-outrider-arbitrator, dispatch-invoices, oracle-claim-predict
10. **Gate mock/simulated data** behind environment checks (pace-check-budget, pace-submit-claim, proda-auth)
11. **Fix Stripe integration** bugs (create-terminal-intent routing, stripe-webhook subscription handling)
12. **Implement DLQ** for stripe-webhook and revenuecat-webhook
13. **Fix overtime double-counting** in process-timesheet-math

### P2: Fix This Sprint (MEDIUM)
14. **Add org membership checks** to all authenticated functions
15. **Fix race conditions** on counter increments — use Postgres atomic operations
16. **Fix error handling** — eliminate empty `catch {}` blocks, stop returning 200 on failure
17. **Fix binary attachment corruption** in inbound-email-webhook
18. **Replace hardcoded NDIS prices** with configurable values
19. **Fix encrypted key usage** in catalog-nightly-sync and live-price-check

### P3: Ongoing (LOW)
20. Migrate deprecated `serve()` imports to `Deno.serve()`
21. Remove non-null assertions on env vars
22. Check DB write results everywhere
23. Decommission `send-push` (superseded by `push-dispatcher`)
24. Implement proper PDF generation in `generate-swms-pdf`

---

*Audit performed: 2026-03-22 | 95 functions analyzed | 27,710 total lines of code*
