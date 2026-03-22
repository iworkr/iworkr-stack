# Supabase Edge Functions — Comprehensive Security & Quality Audit
**Date:** 2026-03-22
**Scope:** All 95 Edge Functions, 3 shared utilities, 95 test files
**Auditor:** Claude Code (Argus Protocol)

---

## Executive Summary

**Total Functions:** 95 (excluding `_shared/` and `tests/`)
**Shared Utilities:** 3 files
**Test Files:** 95 (1:1 coverage by filename)

### Severity Distribution
| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH | 16 |
| MEDIUM | 22 |
| LOW | 12 |
| **Total** | **57** |

---

## CRITICAL FINDINGS (7)

### C-01: `panopticon-text-to-sql` — NO USER AUTHENTICATION
- **FILE:** `supabase/functions/panopticon-text-to-sql/index.ts`
- **LINES:** 106-133
- **CATEGORY:** security
- **DESCRIPTION:** This function executes arbitrary SQL queries via `execute_analytics_query` RPC using the **service role client** without ANY user authentication. No Authorization header check, no `getUser()` call. Anyone who can reach the Edge Function endpoint can run analytics queries against any workspace by supplying any `organization_id`. This is the most dangerous function in the codebase — it's an AI-powered SQL executor with zero auth gates.

### C-02: `execute-drop-and-cover` — NO AUTHENTICATION
- **FILE:** `supabase/functions/execute-drop-and-cover/index.ts`
- **LINES:** 8-45
- **CATEGORY:** security
- **DESCRIPTION:** Calls `execute_drop_and_cover_leave` RPC using service role client with **zero authentication**. Any attacker can invoke this to modify leave requests and cascade schedule changes. No auth header check, no user verification.

### C-03: `aegis-triage-router` — NO AUTHENTICATION
- **FILE:** `supabase/functions/aegis-triage-router/index.ts`
- **LINES:** 29-40
- **CATEGORY:** security
- **DESCRIPTION:** Uses service role client directly to update `incidents`, create `sentinel_alerts`, and modify SIRS priority classifications. Zero auth verification. An attacker could reclassify incident severity or create false alerts.

### C-04: `agent-outrider-arbitrator` — NO AUTHENTICATION
- **FILE:** `supabase/functions/agent-outrider-arbitrator/index.ts`
- **LINES:** 71-100
- **CATEGORY:** security
- **DESCRIPTION:** Powerful function that performs automated job reassignment and sends SMS to clients via Twilio. Uses service role client with zero auth. An attacker could trigger mass job reassignments and send SMS messages to customers.

### C-05: `convoy-daily-health-check` — NO AUTHENTICATION
- **FILE:** `supabase/functions/convoy-daily-health-check/index.ts`
- **LINES:** 9-49
- **CATEGORY:** security
- **DESCRIPTION:** Calls `convoy_ground_expired_vehicles` RPC (which grounds fleet vehicles) and triggers push notifications. Zero authentication. Anyone can invoke this to ground an entire fleet.

### C-06: `convoy-defect-escalation` — NO AUTHENTICATION
- **FILE:** `supabase/functions/convoy-defect-escalation/index.ts`
- **LINES:** 9-72
- **CATEGORY:** security
- **DESCRIPTION:** Takes a `defect_id` input, updates fleet vehicles to `out_of_service_defect`, cancels scheduled bookings, and sends push notifications. Zero authentication. An attacker with any valid defect ID could ground vehicles and cancel bookings.

### C-07: `contextual-sop-match` — NO USER AUTHENTICATION
- **FILE:** `supabase/functions/contextual-sop-match/index.ts`
- **LINES:** 46-72
- **CATEGORY:** security
- **DESCRIPTION:** Uses service role client directly (no auth). Calls OpenAI embeddings API and writes to `job_recommended_sops` table. An attacker could waste OpenAI API credits and pollute recommendation data.

---

## HIGH FINDINGS (16)

### H-01: `evaluate-halcyon-state` — NO AUTHENTICATION, service role for user data
- **FILE:** `supabase/functions/evaluate-halcyon-state/index.ts`
- **LINES:** 36-39
- **CATEGORY:** security
- **DESCRIPTION:** Accepts `user_id` in request body and queries `user_feedback_metrics` with service role. No auth check. Any attacker can check any user's app review eligibility.

### H-02: `color-math` — NO AUTHENTICATION (low risk but principle violation)
- **FILE:** `supabase/functions/color-math/index.ts`
- **LINES:** 85-157
- **CATEGORY:** security
- **DESCRIPTION:** Stateless utility with no auth. Low data risk but exposes an unauthenticated compute endpoint. Could be abused for DoS.

### H-03: `polar-webhook` — FIXME: No Dead Letter Queue
- **FILE:** `supabase/functions/polar-webhook/index.ts`
- **LINE:** 180
- **CATEGORY:** incomplete
- **DESCRIPTION:** Explicitly marked `FIXME: HIGH — No DLQ routing. Failed Polar webhook payloads are lost.` Failed subscription events (create/update/cancel) are silently lost, potentially leaving subscriptions in inconsistent states.

### H-04: `stripe-webhook` — FIXME: No Dead Letter Queue
- **FILE:** `supabase/functions/stripe-webhook/index.ts`
- **LINE:** 226
- **CATEGORY:** incomplete
- **DESCRIPTION:** Explicitly marked `FIXME: HIGH — No DLQ routing. Failed Stripe webhook payloads are lost.` Payment failures, subscription changes, and Connect events can be silently lost.

### H-05: `revenuecat-webhook` — FIXME: No Dead Letter Queue
- **FILE:** `supabase/functions/revenuecat-webhook/index.ts`
- **LINE:** 146
- **CATEGORY:** incomplete
- **DESCRIPTION:** Explicitly marked `FIXME: HIGH — No DLQ routing. Failed RevenueCat webhook payloads are lost.` Mobile subscription events can be silently dropped.

### H-06: `resend-webhook` — FIXME: No Dead Letter Queue
- **FILE:** `supabase/functions/resend-webhook/index.ts`
- **LINE:** 229
- **CATEGORY:** incomplete
- **DESCRIPTION:** Explicitly marked `FIXME: MEDIUM` but impact is HIGH — email delivery status updates (bounces, complaints) silently lost.

### H-07: `aggregate-coordination-billing` — NO AUTHENTICATION for billing aggregation
- **FILE:** `supabase/functions/aggregate-coordination-billing/index.ts`
- **LINES:** 56-70
- **CATEGORY:** security
- **DESCRIPTION:** Creates invoices and claim line items using service role. No user authentication. An attacker could trigger invoice creation for any workspace. While it may be intended for pg_cron, the lack of any service-role token check is dangerous.

### H-08: `catalog-nightly-sync` — NO AUTHENTICATION for supplier sync
- **FILE:** `supabase/functions/catalog-nightly-sync/index.ts`
- **LINES:** 237-248
- **CATEGORY:** security
- **DESCRIPTION:** Iterates all workspace suppliers and syncs catalogs. Zero authentication. An attacker could trigger unnecessary API calls to external supplier B2B APIs, potentially causing rate limiting.

### H-09: `calculate-dynamic-yield` — NO AUTHENTICATION for pricing engine
- **FILE:** `supabase/functions/calculate-dynamic-yield/index.ts`
- **LINES:** 74-100
- **CATEGORY:** security
- **DESCRIPTION:** Dynamic pricing engine that accesses yield profiles, fleet utilization, and weather APIs with zero authentication. While it requires `organization_id`, anyone can supply any org ID to extract competitive pricing intelligence.

### H-10: `dispatch-arrival-sms` — NO AUTHENTICATION for SMS dispatch
- **FILE:** `supabase/functions/dispatch-arrival-sms/index.ts`
- **LINES:** 39-46
- **CATEGORY:** security
- **DESCRIPTION:** Sends SMS to clients via Twilio using service role with zero auth. While designed for DB triggers, the function can be called directly. An attacker could spam clients with SMS.

### H-11: `polar-webhook` — Non-constant-time signature comparison
- **FILE:** `supabase/functions/polar-webhook/index.ts`
- **LINES:** 35-42
- **CATEGORY:** security
- **DESCRIPTION:** Webhook signature comparison uses `===` string comparison instead of constant-time comparison. Vulnerable to timing attacks. Compare with `accounting-webhook` which correctly implements constant-time comparison.

### H-12: `stripe-webhook` — Missing CORS headers on responses
- **FILE:** `supabase/functions/stripe-webhook/index.ts`
- **LINES:** 74-235
- **CATEGORY:** inconsistency
- **DESCRIPTION:** No CORS headers on any response. While webhooks from Stripe don't need CORS, the function handles OPTIONS incorrectly (returns 405 Method Not Allowed for non-POST) which breaks Supabase Edge Function CORS preflight.

### H-13: `polar-webhook` — Missing CORS headers on all responses
- **FILE:** `supabase/functions/polar-webhook/index.ts`
- **LINES:** 5-188
- **CATEGORY:** inconsistency
- **DESCRIPTION:** No CORS headers on any response. The function also doesn't handle OPTIONS preflight at all.

### H-14: `accounting-webhook` — Unbounded recursive token refresh
- **FILE:** `supabase/functions/accounting-webhook/index.ts`
- **LINES:** 119-122
- **CATEGORY:** performance
- **DESCRIPTION:** `getValidToken()` recursively calls itself if `result.locked_by_other` is true, with only a 1-second delay. If the lock is never released (dead process), this creates an infinite recursion that will eventually crash with stack overflow.

### H-15: `care-dashboard-snapshot` — Excessive parallel queries (11 concurrent)
- **FILE:** `supabase/functions/care-dashboard-snapshot/index.ts`
- **LINES:** 43-78
- **CATEGORY:** performance
- **DESCRIPTION:** Fires 11 parallel queries via `Promise.all`. While fast, this can overwhelm the database connection pool for a single request, especially if multiple users hit this endpoint simultaneously. Uses RLS (anon key), so each query goes through policy evaluation.

### H-16: Pervasive `any` type usage across functions
- **FILE:** Multiple (18+ files have `: any` usage)
- **CATEGORY:** error
- **DESCRIPTION:** At least 18 Edge Functions use explicit `any` types, with `care-dashboard-snapshot` having 17 instances, `catalog-nightly-sync` having 2, `accounting-webhook` having 5, and `dispatch-invoices` having 1. This suppresses TypeScript safety and can mask runtime errors.

---

## MEDIUM FINDINGS (22)

### M-01: `_shared/mockClients.ts` — Test mocks gated only by env variable
- **FILE:** `supabase/functions/_shared/mockClients.ts`
- **LINES:** 1
- **CATEGORY:** security
- **DESCRIPTION:** `isTestEnv` checks `IS_TEST_ENV === "true"`. If an attacker sets this env variable on a deployed function (unlikely but not impossible via Supabase dashboard compromise), all Stripe, Resend, and OpenAI calls would be mocked. The MockStripe.webhooks.constructEvent returns `{}`, bypassing all signature verification.

### M-02: `accept-invite` — Uses deprecated `serve()` import
- **FILE:** `supabase/functions/accept-invite/index.ts`
- **LINE:** 1
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Uses `import { serve } from "https://deno.land/std@0.177.0/http/server.ts"` while newer functions use `Deno.serve()`. Inconsistent pattern across the codebase — roughly half use old `serve()`, half use `Deno.serve()`.

### M-03: `aggregate-coordination-billing` — Week window calculation bug
- **FILE:** `supabase/functions/aggregate-coordination-billing/index.ts`
- **LINES:** 28-37
- **CATEGORY:** error
- **DESCRIPTION:** `getPreviousWeekWindow()` calculates "previous week Monday" by subtracting 6 from Sunday, which is incorrect. Sunday minus 6 is Monday of the SAME week, not the previous week. The `prevWeekSunday` is then used as the end date. This logic produces the wrong billing window.

### M-04: `dispatch-invoices` — Hardcoded fallback NDIS number
- **FILE:** `supabase/functions/dispatch-invoices/index.ts`
- **LINE:** 86
- **CATEGORY:** error
- **DESCRIPTION:** Falls back to `"NDIS-XXXX-XXXX-XXXX"` when no NDIS number is found. This fake number would appear on dispatched invoices sent to plan managers, which is unprofessional and potentially non-compliant with NDIS requirements.

### M-05: `schads-interpreter` — TODO: Hardcoded state filter
- **FILE:** `supabase/functions/schads-interpreter/index.ts`
- **LINE:** 400
- **CATEGORY:** incomplete
- **DESCRIPTION:** `TODO: resolve org state from settings` — currently hardcoded to `.or('state.eq.NAT,state.eq.NSW')`. Organizations in VIC, QLD, SA, WA, TAS, ACT, NT will get incorrect SCHADS award interpretations.

### M-06: `generate-plan-report` — Auth bypass with service role
- **FILE:** `supabase/functions/generate-plan-report/index.ts`
- **LINES:** 20-26
- **CATEGORY:** security
- **DESCRIPTION:** Creates supabase client with service role key but then calls `auth.getUser(token)` on it. The service role client bypasses RLS, so even if the user is verified, the data query has no RLS protection. Should use anon key for the auth client and service role only for data operations after verification.

### M-07: `send-push` — No authentication on push notification dispatch
- **FILE:** `supabase/functions/send-push/index.ts`
- **LINES:** 19-32
- **CATEGORY:** security
- **DESCRIPTION:** Accepts any `record` with `user_id` and `title`, looks up FCM tokens, and sends push notifications with zero authentication. While typically invoked by DB triggers, direct invocation could spam users with notifications.

### M-08: `automation-worker` — Uncontrolled SSRF via webhook action
- **FILE:** `supabase/functions/automation-worker/index.ts`
- **LINES:** 306-325
- **CATEGORY:** security
- **DESCRIPTION:** The `webhook` action type accepts an arbitrary URL from the automation config and POSTs to it. No URL validation, allowlist, or SSRF protection. Could be used to scan internal networks or exfiltrate data.

### M-09: `generate-pdf` — Public URL for invoice PDFs
- **FILE:** `supabase/functions/generate-pdf/index.ts`
- **LINES:** 373-376
- **CATEGORY:** security
- **DESCRIPTION:** Uses `getPublicUrl()` for uploaded PDFs, making them accessible without authentication. Invoice PDFs contain sensitive financial data. Should use signed URLs with expiration.

### M-10: `calculate-dynamic-yield` — Fire-and-forget async refresh
- **FILE:** `supabase/functions/calculate-dynamic-yield/index.ts`
- **LINES:** 151-153
- **CATEGORY:** error
- **DESCRIPTION:** `supabase.rpc("refresh_fleet_utilization_cache", ...).then(() => {})` — fire-and-forget async without error handling. If the RPC fails, the error is silently swallowed.

### M-11: `create-terminal-intent` — PaymentIntent created on connected account AND as destination charge
- **FILE:** `supabase/functions/create-terminal-intent/index.ts`
- **LINES:** 107-126
- **CATEGORY:** error
- **DESCRIPTION:** Creates a PaymentIntent with `transfer_data.destination` but also passes `{ stripeAccount: stripeAccountId }` as the second argument to `paymentIntents.create()`. This creates the PaymentIntent ON the connected account with a destination transfer TO the same connected account — likely an API error.

### M-12: `dispatch-invoices` — Plan manager fallback email
- **FILE:** `supabase/functions/dispatch-invoices/index.ts`
- **LINE:** 148
- **CATEGORY:** error
- **DESCRIPTION:** Falls back to `"invoices@planmanager.com.au"` when no plan manager email is found. This is a real domain that could receive actual invoices with sensitive participant data.

### M-13: Test suite — Overly permissive assertions
- **FILE:** All 95 test files in `supabase/functions/tests/`
- **CATEGORY:** incomplete
- **DESCRIPTION:** Nearly all auto-generated tests accept status codes `[200, 400, 422, 500]` as passing. The "happy path" test doesn't actually verify success — it accepts 500 errors as long as the error has a message. These tests provide near-zero confidence in functional correctness.

### M-14: Test suite — No negative path tests for security-critical functions
- **FILE:** `supabase/functions/tests/execute-drop-and-cover.test.ts` (and similar)
- **CATEGORY:** incomplete
- **DESCRIPTION:** The auto-generated test for `execute-drop-and-cover` asserts that an unauthenticated request returns 401 — but the actual function has NO auth check and would return 200/400/500. This means the test would FAIL if run against the actual function. Test assertions are disconnected from function behavior.

### M-15: `accounting-webhook` — `processXeroEvents` uses `any[]` for events
- **FILE:** `supabase/functions/accounting-webhook/index.ts`
- **LINE:** 210
- **CATEGORY:** error
- **DESCRIPTION:** `events: any[]` — no validation of individual event structure. Malformed events could cause silent failures or unexpected behavior.

### M-16: `automation-worker` — JSON Logic engine defaults to `true` for unknown operators
- **FILE:** `supabase/functions/automation-worker/index.ts`
- **LINES:** 104-107
- **CATEGORY:** error
- **DESCRIPTION:** The `default` case in `applyJsonLogic` returns `true`. Unknown operators silently evaluate as truthy, meaning conditions with typos or unsupported operators will always pass.

### M-17: `generate-proda-payload` — Hardcoded NDIS line item rates
- **FILE:** `supabase/functions/generate-proda-payload/index.ts`
- **LINES:** 209, 225, 248
- **CATEGORY:** error
- **DESCRIPTION:** Hardcoded unit prices: `65.47` for provider travel time, `0.96` for per-km rates. NDIS prices change annually. These should be fetched from the NDIS catalogue or configuration.

### M-18: `CORS: Access-Control-Allow-Origin: *` on most functions
- **FILE:** ~80+ functions
- **CATEGORY:** security
- **DESCRIPTION:** Nearly all functions use `Access-Control-Allow-Origin: *`. While acceptable for public webhooks, user-facing functions should restrict to the application domain. Only `create-terminal-intent` and `send-push` implement proper origin checking.

### M-19: Mixed `serve()` vs `Deno.serve()` patterns
- **FILE:** Multiple
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Approximately half the functions use deprecated `serve()` from `deno.land/std`, others use native `Deno.serve()`. Should standardize on `Deno.serve()`.

### M-20: `aggregate-coordination-billing` — `isTestEnv` limits processing to 1 group
- **FILE:** `supabase/functions/aggregate-coordination-billing/index.ts`
- **LINE:** 115
- **CATEGORY:** incomplete
- **DESCRIPTION:** In test mode, `groupedEntries.slice(0, 1)` only processes the first billing group. This means tests never verify batch processing behavior.

### M-21: `dispatch-invoices` — Double `req.json()` call
- **FILE:** `supabase/functions/dispatch-invoices/index.ts`
- **LINES:** 33, 36
- **CATEGORY:** error
- **DESCRIPTION:** The auth check calls `supabase.auth.getUser(token)` with the token, but then the body is parsed with `await req.json()`. The request body stream was already consumed by the auth client? Actually on closer look the auth uses the header, not body — but the pattern of creating an admin client BEFORE auth check (line 22-25) means the service role client is initialized even for unauthorized requests.

### M-22: `_shared/withZodInterceptor.ts` — Logs raw request headers and payload to telemetry
- **FILE:** `supabase/functions/_shared/withZodInterceptor.ts`
- **LINES:** 138-141
- **CATEGORY:** security
- **DESCRIPTION:** On validation failure, logs `request_headers: Object.fromEntries(req.headers.entries())` and `raw_payload: payload` to `system_telemetry`. This could persist sensitive data (auth tokens, API keys in headers) to the database.

---

## LOW FINDINGS (12)

### L-01: `_shared/crucible_registry.ts` — Only 4 schemas registered
- **FILE:** `supabase/functions/_shared/crucible_registry.ts`
- **LINES:** 1-17
- **CATEGORY:** incomplete
- **DESCRIPTION:** Only `twilio-webhook`, `webhooks-ingest`, `automation-worker`, and `outrider-en-route-notify` have Zod schemas. 91 functions have no schema validation via this registry.

### L-02: `color-math` — Function could be a client-side utility
- **FILE:** `supabase/functions/color-math/index.ts`
- **CATEGORY:** performance
- **DESCRIPTION:** Pure computation (hex→RGB→contrast) with no database or external API calls. Wastes an Edge Function invocation. Should be moved to client-side utility.

### L-03: `generate-pdf` — jsPDF import from ESM CDN
- **FILE:** `supabase/functions/generate-pdf/index.ts`
- **LINE:** 15
- **CATEGORY:** performance
- **DESCRIPTION:** `import { jsPDF } from "https://esm.sh/jspdf@2.5.2"` — large library imported from CDN on every cold start. Consider bundling or using a lighter PDF approach.

### L-04: `dispatch-arrival-sms` — Pinned to old Deno std version
- **FILE:** `supabase/functions/dispatch-arrival-sms/index.ts`
- **LINE:** 10
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Uses `deno.land/std@0.168.0` while most others use `0.177.0` or native `Deno.serve()`.

### L-05: `evaluate-halcyon-state` — Pinned to old supabase-js version
- **FILE:** `supabase/functions/evaluate-halcyon-state/index.ts`
- **LINE:** 13
- **CATEGORY:** inconsistency
- **DESCRIPTION:** Uses `supabase-js@2.39.0` while most others use unversioned `@supabase/supabase-js@2`.

### L-06: `accounting-webhook` — Verbose logging in production
- **FILE:** `supabase/functions/accounting-webhook/index.ts`
- **LINES:** Multiple
- **CATEGORY:** performance
- **DESCRIPTION:** Extensive `console.log` and `console.error` calls throughout. No log-level gating.

### L-07: `generate-proda-payload` — Short claim reference from UUID truncation
- **FILE:** `supabase/functions/generate-proda-payload/index.ts`
- **LINE:** 172
- **CATEGORY:** error
- **DESCRIPTION:** `cl.id.substring(0, 8).toUpperCase()` — using first 8 chars of UUID as claim reference. With enough claims, collision probability increases.

### L-08: `aggregate-coordination-billing` — Sequential invoice creation
- **FILE:** `supabase/functions/aggregate-coordination-billing/index.ts`
- **LINES:** 116-224
- **CATEGORY:** performance
- **DESCRIPTION:** Creates invoices sequentially in a for loop. For large batches this could timeout the Edge Function.

### L-09: `agent-outrider-arbitrator` — Sequential job reassignment
- **FILE:** `supabase/functions/agent-outrider-arbitrator/index.ts`
- **LINES:** 173-282
- **CATEGORY:** performance
- **DESCRIPTION:** Iterates impacted jobs sequentially, each with multiple DB queries. Could timeout for large blast radius scenarios.

### L-10: Test files use hardcoded local Supabase JWT
- **FILE:** All `supabase/functions/tests/*.test.ts`
- **LINE:** ~14
- **CATEGORY:** security
- **DESCRIPTION:** All test files contain the standard Supabase demo service role JWT. While this is the well-known local dev token, it appears in committed code. Not a real risk but poor practice.

### L-11: `contextual-sop-match` — Verbose step-by-step logging
- **FILE:** `supabase/functions/contextual-sop-match/index.ts`
- **LINES:** Multiple
- **CATEGORY:** performance
- **DESCRIPTION:** Logs every step of the matching process. Good for debugging but verbose for production.

### L-12: `panopticon-text-to-sql` — SSE stream not properly ended on error
- **FILE:** `supabase/functions/panopticon-text-to-sql/index.ts`
- **LINES:** 268-272
- **CATEGORY:** error
- **DESCRIPTION:** In the SSE stream's catch block, `controller.close()` is called after `send("error", ...)` but there's no guarantee the client receives the error event before the stream closes.

---

## SHARED UTILITIES FINDINGS

### `_shared/mockClients.ts`
- **MockStripe.webhooks.constructEvent** returns `{}` — if `isTestEnv` leaks to production, ALL webhook signature verification is bypassed (returns empty object).
- **MockResend** has two interfaces: `emails.send()` and `send()` — inconsistent with actual Resend SDK. May mask API integration bugs.
- No `MockOpenAI` chat response validation — always returns the same hardcoded response regardless of input.

### `_shared/withZodInterceptor.ts`
- Well-implemented validation middleware with proper error formatting.
- **Issue M-22** (logs sensitive data to telemetry) documented above.
- Only used by `automation-worker` and `webhooks-ingest` — 93 functions lack this protection.

### `_shared/crucible_registry.ts`
- Only 4 function schemas defined. Minimal coverage.

---

## TEST SUITE FINDINGS

### Systematic Issues Across All 95 Test Files

1. **Auto-generated template** — All tests follow identical structure from `scripts/generate-edge-tests.mjs (Argus-Tartarus)`. While better than no tests, they are shallow.

2. **Overly permissive status assertions** — `assertEquals(true, [200, 400, 422, 500].includes(status))` accepts almost any response as "passing."

3. **No functional assertions** — Happy path tests never verify response body structure, data correctness, or side effects.

4. **Auth test mismatch** — Many tests assert `status === 401` for unauthenticated requests, but the underlying functions have NO auth check (e.g., `execute-drop-and-cover`, `aegis-triage-router`). These tests would fail when actually run.

5. **No edge case testing** — No tests for:
   - Concurrent access / race conditions
   - Large payload handling
   - Timeout behavior
   - Specific webhook signature validation
   - SQL injection via `panopticon-text-to-sql`
   - SSRF via `automation-worker` webhook action

6. **Hand-crafted tests only for `polar-webhook` and `stripe-webhook`** — These are the only two with meaningful security tests (signature rejection, empty body, malformed JSON). All other 93 tests are auto-generated templates.

---

## RECOMMENDATIONS (Priority Order)

### P0 — Immediate (CRITICAL Security)
1. **Add authentication to all 10+ unauthenticated functions** that perform writes or sensitive reads. At minimum: `panopticon-text-to-sql`, `execute-drop-and-cover`, `aegis-triage-router`, `agent-outrider-arbitrator`, `convoy-daily-health-check`, `convoy-defect-escalation`, `contextual-sop-match`, `evaluate-halcyon-state`, `send-push`.
2. For cron-triggered functions, add service-role token verification: `authHeader === Bearer ${serviceRoleKey}`.

### P1 — This Sprint (HIGH)
3. Implement dead letter queue for all 4 webhook handlers (polar, stripe, revenuecat, resend).
4. Fix `accounting-webhook` recursive token refresh to add max retry limit.
5. Fix `polar-webhook` signature to use constant-time comparison.
6. Add SSRF protection to `automation-worker` webhook action (URL allowlist).
7. Switch `generate-pdf` from `getPublicUrl()` to signed URLs.

### P2 — Next Sprint (MEDIUM)
8. Fix `aggregate-coordination-billing` week window calculation.
9. Remove hardcoded NDIS number fallback in `dispatch-invoices`.
10. Remove hardcoded plan manager email fallback.
11. Fix SCHADS interpreter state filter (resolve from org settings).
12. Restrict CORS to application domain for user-facing functions.
13. Standardize on `Deno.serve()` across all functions.
14. Remove sensitive data logging from `withZodInterceptor`.
15. Fix hardcoded NDIS rates in `generate-proda-payload`.

### P3 — Backlog (LOW)
16. Move `color-math` to client-side utility.
17. Expand `withZodInterceptor` to all functions.
18. Replace auto-generated tests with meaningful functional tests.
19. Add `any` type elimination pass across all functions.
20. Implement per-function log-level configuration.

---

*End of audit. 57 findings across 95 Edge Functions.*
