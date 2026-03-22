# 🔒 API, Middleware, Auth & Stripe — Deep Security Audit
> **Date:** 2026-03-22  
> **Scope:** 45 API routes, 2 middleware files, Stripe flows, auth system, email system  
> **Auditor:** Claude Code (Comprehensive)

---

## Executive Summary

**Files Reviewed:** 45 API route handlers, 2 middleware files, `src/lib/stripe.ts`, `src/lib/rate-limit.ts`, `src/lib/email/*` (3 files)

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 7 |
| 🟠 HIGH | 12 |
| 🟡 MEDIUM | 15 |
| 🔵 LOW | 10 |
| **TOTAL** | **44** |

---

## 🔴 CRITICAL Findings

### C-01: Admin End-Impersonation Has NO Authentication
- **File:** `src/app/api/admin/end-impersonation/route.ts`
- **Lines:** 4–22
- **Category:** security
- **Description:** The endpoint accepts a `sessionId` in the POST body and ends the impersonation session with **zero authentication**. No session check, no user verification, no admin verification. Any unauthenticated request with a valid or guessed `sessionId` can end impersonation sessions. While ending impersonation is lower risk than starting it, this is a service-role-backed admin endpoint with no auth gate at all.
- **Impact:** Unauthorized session manipulation; could be used to disrupt admin impersonation sessions or as a reconnaissance tool (probing for valid session IDs).
- **Fix:** Add authentication and verify the caller is a super admin.

### C-02: GoHighLevel Webhook Has No Signature Verification
- **File:** `src/app/api/webhooks/gohighlevel/route.ts`
- **Lines:** 15–121
- **Category:** security
- **Description:** The GHL webhook endpoint accepts POST requests and upserts data into the `clients` table and fires notifications using the **service role client** — but performs **no webhook signature verification**. Anyone who discovers this endpoint can inject arbitrary client data into any mapped organization.
- **Impact:** Arbitrary client data injection, CRM poisoning, notification spam.
- **Fix:** GHL V2 webhooks support HMAC verification. Implement `x-ghl-signature` header validation.

### C-03: Google Calendar Webhook Has No Verification
- **File:** `src/app/api/webhooks/google-calendar/route.ts`
- **Lines:** 20–151
- **Category:** security
- **Description:** Google Calendar push notifications don't carry an HMAC signature, but Google recommends validating the `X-Goog-Channel-Token` header set during watch registration. This endpoint only checks `X-Goog-Channel-ID` against the DB, but never validates `X-Goog-Resource-ID` or any shared secret. The endpoint uses the **service role client** to upsert and cancel schedule blocks.
- **Impact:** Attacker who knows a channel ID can inject/cancel schedule blocks in any organization.
- **Fix:** Store and validate a shared secret token (`X-Goog-Channel-Token`) at registration time.

### C-04: Public Invoice Endpoint Uses Anon Key — RLS May Expose Data
- **File:** `src/app/api/invoices/public/[invoiceId]/route.ts`
- **Lines:** 17–19
- **Category:** security
- **Description:** Despite the doc comment saying "Uses service role to bypass RLS", the code actually uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. This means either: (a) RLS is permissive on invoices/organizations/invoice_line_items for anon access — which is dangerous, or (b) this endpoint silently fails for most queries and the comment is wrong. Additionally, the endpoint **writes** (updates invoice status to "viewed" and inserts events) using the anon key, which would fail if RLS blocks anon writes.
- **Impact:** If RLS is open for anon: any UUID-guessing attack exposes full invoice data including financial details and client PII. If RLS is closed: the endpoint is broken.
- **Fix:** Use service role key with explicit field selection, and add rate limiting to prevent invoice ID enumeration.

### C-05: Compliance Verify Endpoint Has No Authentication
- **File:** `src/app/api/compliance/verify/route.ts`
- **Lines:** 8–43
- **Category:** security
- **Description:** The document verification endpoint uses `createAdminSupabaseClient` (service role) but has **no authentication**. Anyone can upload a file and query the `document_hashes` table. While this is a read-style operation (hash lookup), using the admin client without auth is a principle violation.
- **Impact:** Unauthenticated access to document verification records; potential for abuse (hash probing, DoS via file upload).
- **Fix:** Add session-based authentication or at minimum a shared secret.

### C-06: Stripe `create-subscription` Logs Partial Secret Key
- **File:** `src/app/api/stripe/create-subscription/route.ts`
- **Line:** 110
- **Category:** security
- **Description:** On error, the route logs `process.env.STRIPE_SECRET_KEY?.slice(0, 10)`. While only 10 chars, this leaks the key prefix (including `sk_live_` or `sk_test_`) into server logs, which may be accessible via log aggregation services.
- **Impact:** Partial key exposure in logs aids targeted attacks against Stripe credentials.
- **Fix:** Remove the `stripeKey starts with=` logging entirely.

### C-07: Cron POST Handler Has Conditional Auth Bypass
- **File:** `src/app/api/automation/cron/route.ts`
- **Lines:** 223–228
- **Category:** security
- **Description:** The POST handler checks `if (cronSecret && authHeader !== ...)`. If `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are both undefined/empty, the condition `cronSecret` is falsy, and the auth check is **completely skipped**. The endpoint then processes arbitrary cron jobs (including `stale-job-cleanup` which hard-deletes data) without any authentication.
- **Impact:** If env vars are misconfigured, unauthenticated callers can trigger data deletion, edge function invocation, and more.
- **Fix:** Fail closed: if `cronSecret` is not set, return 500 immediately.

---

## 🟠 HIGH Findings

### H-01: E2E Seed Endpoint — Insufficient Production Guard
- **File:** `src/app/api/e2e/seed-staging/route.ts`
- **Lines:** 180–182
- **Category:** security
- **Description:** The production guard only checks `VERCEL_ENV === "production"`. If deployed to a non-Vercel host (AWS, Fly.io, self-hosted), or if the env var is unset, the guard passes. Combined with the E2E_SEED_SECRET check this provides defense-in-depth, but the seeder can **destructively delete** production data across many tables.
- **Fix:** Add `NODE_ENV === "production"` as an additional guard. Consider an allowlist of environments rather than a blocklist.

### H-02: Xero OAuth Callback — No CSRF State Validation
- **File:** `src/app/api/auth/xero/callback/route.ts`
- **Lines:** 14, 65
- **Category:** security
- **Description:** The `state` parameter is used to pass `workspace_id`, but there is no HMAC signature or nonce verification on it. An attacker could craft a callback URL with a malicious `state` value to bind Xero tokens to a workspace they control, enabling data exfiltration from the victim's Xero account.
- **Impact:** OAuth CSRF — Xero account binding to attacker-controlled workspace.
- **Fix:** Sign the state parameter with HMAC (as done in `src/app/api/integrations/callback/route.ts`).

### H-03: Team Signup-Invite Enumerates All Users
- **File:** `src/app/api/team/signup-invite/route.ts`
- **Lines:** 48–49
- **Category:** security | performance
- **Description:** `listUsers()` fetches ALL users from Supabase Auth to check if an email exists. On a system with many users, this is extremely slow and returns all user data to the server. It's also unnecessary — `getUserByEmail` or `signUp` with proper error handling would suffice.
- **Impact:** Performance degradation at scale; unnecessarily loads all user records into memory.
- **Fix:** Use `supabase.auth.admin.getUserByEmail(email)` or `listUsers({ filter: email })` with server-side pagination.

### H-04: Quote Accept/Decline Token Comparison Is Not Timing-Safe
- **File:** `src/app/api/quotes/[id]/accept/route.ts` (line 47) and `src/app/api/quotes/[id]/decline/route.ts` (line 45)
- **Category:** security
- **Description:** The token comparison `token !== quote.secure_token` uses JavaScript's `!==` operator, which is vulnerable to timing attacks. An attacker can compare character-by-character by measuring response times.
- **Impact:** Potential brute-force of secure_token via timing side-channel.
- **Fix:** Use `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(quote.secure_token))`.

### H-05: In-Memory Rate Limiter Doesn't Work Across Serverless Instances
- **File:** `src/lib/rate-limit.ts`
- **Lines:** 14–23
- **Category:** security | performance
- **Description:** The rate limiter uses an in-memory `Map`. In serverless environments (Vercel), each request may hit a different instance with its own memory, making the rate limiter **effectively non-functional**. Aggressive attackers can bypass it entirely.
- **Impact:** Rate limiting provides no real protection in production serverless deployment.
- **Fix:** Use Upstash Redis or Vercel KV for distributed rate limiting.

### H-06: Revalidate Endpoint — Timing-Unsafe Secret Comparison
- **File:** `src/app/api/revalidate/route.ts`
- **Lines:** 6–8
- **Category:** security
- **Description:** `secret !== process.env.REVALIDATE_SECRET` is vulnerable to timing attacks. Also, if `REVALIDATE_SECRET` is unset, the check becomes `value !== undefined` which will always be true (safe), but the intent is unclear.
- **Fix:** Use `timingSafeEqual` and fail closed if secret is not configured.

### H-07: Stripe Connect Payment Intent — Double Payment Intent Creation Bug
- **File:** `src/app/api/stripe/connect/payment-intent/route.ts`
- **Lines:** 99–118
- **Category:** error | inconsistency
- **Description:** When a connected account exists (`stripeAccountId && chargesEnabled`), the code creates a PaymentIntent with BOTH `transfer_data.destination` AND `{ stripeAccount: stripeAccountId }` as the second arg. This creates a **destination charge on the connected account itself**, which is incorrect. Destination charges should be created on the platform account (no `stripeAccount` option), with `transfer_data` routing funds. The current code may cause Stripe API errors or double-counting.
- **Impact:** Payment creation may fail for Connect merchants; funds routing may be incorrect.
- **Fix:** Remove `{ stripeAccount: stripeAccountId }` from the `create` call when using `transfer_data.destination`.

### H-08: Vault 2FA Session Secret Fallback Chain
- **File:** `src/app/api/compliance/vault/route.ts`
- **Lines:** 20–22
- **Category:** security
- **Description:** `getSessionSecret()` falls back to `SUPABASE_SERVICE_ROLE_KEY` and then to the hardcoded string `"dev-vault-secret"`. If `VAULT_2FA_SESSION_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are both unset, sessions are signed with a publicly known secret.
- **Impact:** Anyone can forge vault 2FA sessions if env vars are missing.
- **Fix:** Throw an error if no proper secret is available; never fall back to a hardcoded string.

### H-09: Stripe Webhook — No IP Allowlisting
- **File:** `src/app/api/stripe/webhook/route.ts`
- **Category:** security
- **Description:** While the signature verification is properly implemented, there's no IP-based filtering for Stripe webhook IPs. As defense-in-depth, Stripe recommends restricting webhook endpoints to Stripe's published IP ranges.
- **Impact:** Reduces defense-in-depth; relies solely on signature verification.
- **Fix:** Add Stripe IP allowlist as middleware or route-level check (optional defense-in-depth).

### H-10: Compliance Dossier — No Org Membership Verification
- **File:** `src/app/api/compliance/dossier/route.ts`
- **Lines:** 12–33
- **Category:** security
- **Description:** The dossier endpoint verifies the user is authenticated but never checks if the user is a member of `organization_id` passed as a query parameter. The subsequent queries use the user's Supabase session (RLS), but if RLS is permissive on `progress_notes`, `incidents`, or `shift_financial_ledgers`, any authenticated user could generate dossiers for any organization.
- **Impact:** Potential cross-organization data access.
- **Fix:** Add explicit org membership check before data queries.

### H-11: Policy Dossier — Delegated Auth Check May Fail Silently
- **File:** `src/app/api/compliance/policies/dossier/route.ts`
- **Lines:** 20–28
- **Category:** security
- **Description:** Auth is delegated to `getPolicyDossierDataAction`. If the action throws for a non-auth reason, it falls through to `throw authErr` which returns a 500 with the raw error message. Also, there's no explicit session check before calling the action.
- **Impact:** Error messages may leak internal details; auth bypass if action doesn't properly check.
- **Fix:** Add explicit session check before calling the action.

### H-12: Middleware Super Admin Email Hardcoded
- **File:** `src/lib/supabase/middleware.ts`
- **Line:** 29
- **Category:** security
- **Description:** `SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"]` is hardcoded. If this email account is compromised, the attacker has permanent super admin access that can't be revoked without a code deployment.
- **Impact:** Single point of compromise for super admin access.
- **Fix:** Move to a database-backed super admin list or environment variable.

---

## 🟡 MEDIUM Findings

### M-01: No Rate Limiting on Most API Routes
- **Files:** Most routes in `src/app/api/`
- **Category:** security
- **Description:** Only 3 routes implement rate limiting: `set-password`, `automation/execute`, `automation/cron`. The remaining 42 routes have no rate limiting at all, including sensitive endpoints like:
  - `POST /api/stripe/create-subscription` (Stripe API calls)
  - `POST /api/team/invite` (email sending)
  - `POST /api/team/signup-invite` (user creation)
  - `POST /api/compliance/vault` (2FA/OTP endpoints)
  - `POST /api/invoices/generate-pdf` (CPU-intensive PDF generation)
- **Impact:** Abuse vectors including billing abuse, email flooding, brute-force, and resource exhaustion.
- **Fix:** Add rate limiting to all public and sensitive endpoints.

### M-02: Stripe Error Messages Exposed to Client
- **Files:** `src/app/api/stripe/create-subscription/route.ts` (line 112), `src/app/api/stripe/manage/route.ts` (line 94)
- **Category:** security
- **Description:** Stripe error messages are returned directly to the client: `error: err.message || "Stripe subscription creation failed"`. These can contain internal Stripe details.
- **Fix:** Return generic error messages; log the full error server-side.

### M-03: Inconsistent Response Formats Across API Routes
- **Category:** inconsistency
- **Description:** API responses use inconsistent shapes:
  - `{ error: "msg" }` — most routes
  - `{ error: "Type", message: "detail" }` — payment-intent, quotes
  - `{ success: true }` vs `{ ok: true }` — mixed
  - `{ valid: false, error: "msg" }` — validate-invite (returns 200 for failures)
- **Impact:** Frontend must handle multiple response shapes; error handling is fragile.
- **Fix:** Standardize on `{ error: string, code?: string }` for errors and `{ data: T }` for success.

### M-04: Validate-Invite Returns 200 for All Error States
- **File:** `src/app/api/team/validate-invite/route.ts`
- **Lines:** 52–93
- **Category:** inconsistency
- **Description:** When a token is invalid, expired, or revoked, the endpoint returns `{ valid: false, error: "..." }` with HTTP 200. The client must parse the response body to determine failure. This violates REST conventions and makes monitoring difficult.
- **Fix:** Return appropriate HTTP status codes (404, 410, etc.) for different error states.

### M-05: Switch-Context GET Endpoint Exposes Cookie Values Without Auth
- **File:** `src/app/api/auth/switch-context/route.ts`
- **Lines:** 132–148
- **Category:** security
- **Description:** The GET handler returns the active workspace and branch IDs without authentication. While the cookies are HttpOnly and can't be read by JavaScript, the API endpoint exposes them to any authenticated or unauthenticated caller.
- **Fix:** Add session verification before returning workspace context.

### M-06: Desktop Version — Hardcoded Supabase URL
- **File:** `src/app/api/desktop/version/route.ts`
- **Lines:** 3–5
- **Category:** security
- **Description:** Contains a hardcoded fallback Supabase URL: `"https://olqjuadvseoxpfjzlghb.supabase.co/..."`. This exposes the production Supabase project ID.
- **Fix:** Fail gracefully instead of falling back to hardcoded URLs.

### M-07: No CORS Headers on Any API Route
- **Category:** security
- **Description:** None of the 45 API routes set explicit CORS headers. While Next.js handles CORS for same-origin requests, routes intended for cross-origin use (mobile app, desktop app, public invoice pages) need explicit CORS configuration.
- **Fix:** Add CORS configuration to `next.config.ts` or individual routes that serve cross-origin clients.

### M-08: Stripe Portal Fallback URL Hardcoded
- **File:** `src/app/api/stripe/portal/route.ts`
- **Line:** 53
- **Category:** inconsistency
- **Description:** `return_url` defaults to `"https://iworkrapp.com"` if `NEXT_PUBLIC_APP_URL` is unset. Other routes use different fallback patterns (`"http://localhost:3000"`). This inconsistency means the Stripe portal could redirect to the wrong domain in staging.
- **Fix:** Standardize fallback URL handling across all routes.

### M-09: Stripe Connect Onboard Stores Account ID in `settings` JSONB
- **File:** `src/app/api/stripe/connect/onboard/route.ts`
- **Lines:** 48–51
- **Category:** inconsistency
- **Description:** The `stripe_account_id` is stored inside `organizations.settings` JSONB, while the webhook handler (line 374) updates `organizations.stripe_account_id` as a top-level column. This dual storage creates data inconsistency — the onboard route reads from `settings.stripe_account_id` while other code may read from the top-level column.
- **Fix:** Consolidate to a single storage location for `stripe_account_id`.

### M-10: Payment Intent Route — `amountCents` Not Validated as Positive Integer
- **File:** `src/app/api/stripe/connect/payment-intent/route.ts`
- **Lines:** 26–33
- **Category:** security
- **Description:** `amountCents` is checked for truthiness but not validated as a positive integer. Values like `-100`, `0.5`, or `"abc"` could be passed. Stripe will reject most invalid values, but the error handling exposes raw Stripe errors.
- **Fix:** Validate `amountCents > 0 && Number.isInteger(amountCents)`.

### M-11: Schedule Validate — Date Parsing Not Validated
- **File:** `src/app/api/schedule/validate/route.ts`
- **Lines:** 65–67
- **Category:** error
- **Description:** `start_time` and `end_time` are parsed with `new Date()` without validation. Invalid date strings will produce `NaN` timestamps, leading to incorrect conflict detection results rather than clear errors.
- **Fix:** Validate date strings before parsing; return 400 for invalid dates.

### M-12: Cleaning Log — No Org Membership Check
- **File:** `src/app/api/care/facilities/[facilityId]/cleaning-log/route.ts`
- **Lines:** 27–31
- **Category:** security
- **Description:** The endpoint verifies authentication but doesn't explicitly check org membership. It queries with `organization_id` from query params, relying on RLS. If the `care_facilities` or `task_instances` tables have permissive RLS for authenticated users, cross-org data access is possible.
- **Fix:** Add explicit org membership verification.

### M-13: GHL Webhook Creates Module-Level Supabase Client
- **File:** `src/app/api/webhooks/gohighlevel/route.ts`
- **Lines:** 4–7
- **Category:** security | performance
- **Description:** `supabaseAdmin` is created at module scope (import time) using `createClient`. In serverless environments, this client persists across warm invocations. While not critically dangerous, it means the client never refreshes and auth state may become stale.
- **Fix:** Create the client inside the handler function.

### M-14: Vault OTP Passcode Uses SHA-256 Without Salt
- **File:** `src/app/api/compliance/vault/route.ts`
- **Lines:** 8–10
- **Category:** security
- **Description:** `hashPasscode()` uses plain SHA-256 without a salt. If the `passcode_hash` column is ever leaked, rainbow table attacks are trivial.
- **Fix:** Use bcrypt or argon2 for passcode hashing, or at minimum add a per-portal salt.

### M-15: Webhook Polar Route Still Exists (Attack Surface)
- **File:** `src/app/api/webhook/polar/route.ts`
- **Category:** security
- **Description:** Deprecated endpoint that returns 200 for all requests. While harmless, it increases attack surface and may cause confusion with monitoring.
- **Fix:** Consider removing entirely or returning 410 Gone.

---

## 🔵 LOW Findings

### L-01: Inconsistent Use of `as any` Type Casts
- **Files:** Multiple routes
- **Category:** error
- **Description:** Heavy use of `(supabase as any)` throughout routes to bypass TypeScript type checking. This disables compile-time safety for database queries.
- **Fix:** Generate and use proper Supabase types from `database.types.ts`.

### L-02: Team Invite — Email Regex Insufficient
- **File:** `src/app/api/team/invite/route.ts`
- **Line:** 28
- **Category:** error
- **Description:** Email validation regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is too permissive (allows `a@b.c`) and doesn't check TLD validity. While not exploitable, it allows malformed emails.
- **Fix:** Use a proper email validation library (like `zod.string().email()`).

### L-03: Stripe Webhook Logs Plan Mapping — Potential Info Leak
- **File:** `src/app/api/stripe/webhook/route.ts`
- **Line:** 195
- **Category:** security
- **Description:** Console logging of subscription details including org IDs in webhook handlers. In environments with centralized logging, this could expose business relationships.
- **Fix:** Use structured logging with appropriate log levels.

### L-04: Invoice PDF — `save_to_storage` Creates Public URL
- **File:** `src/app/api/invoices/generate-pdf/route.ts`
- **Lines:** 157–159
- **Category:** security
- **Description:** `getPublicUrl` generates a publicly accessible URL for the stored PDF. Anyone with the URL can access the invoice PDF without authentication.
- **Fix:** Use signed URLs with expiration instead of public URLs.

### L-05: Desktop Version — YAML Parsing Regex May Be Exploitable
- **File:** `src/app/api/desktop/version/route.ts`
- **Lines:** 36–39
- **Category:** security
- **Description:** `extractYamlValue` uses a regex to parse YAML. While the data source is controlled (Supabase Storage), this could be exploited if the manifest file is tampered with.
- **Fix:** Use a proper YAML parser or add Content-Type validation.

### L-06: Email Send Function Returns Success Even on Partial Failure
- **File:** `src/lib/email/send.ts`
- **Lines:** 56–78
- **Category:** error
- **Description:** If Resend returns an error, the function returns `{ success: false }` but doesn't throw. Callers that don't check the return value will silently lose emails.
- **Fix:** Document the return type and ensure all callers handle the error case.

### L-07: Multiple Supabase Client Creation Patterns
- **Files:** Various routes
- **Category:** inconsistency
- **Description:** Routes use at least 4 different patterns to create Supabase clients:
  1. `createServerSupabaseClient()` — standard pattern
  2. `createAdminSupabaseClient()` — admin pattern  
  3. `createClient(url, serviceKey)` — inline service role
  4. Module-level `createClient()` — persistent client
- **Fix:** Standardize on `createServerSupabaseClient()` for auth'd routes and `createAdminSupabaseClient()` for service-role operations.

### L-08: Cron GET Handler Returns Processing Results
- **File:** `src/app/api/automation/cron/route.ts`
- **Lines:** 208–213
- **Category:** security
- **Description:** The cron endpoint returns detailed processing results including queue counts, error messages, and internal state. This leaks operational details.
- **Fix:** Return minimal response; send details to monitoring/logging.

### L-09: Checkout Route Legacy — No Auth Required
- **File:** `src/app/api/stripe/checkout/route.ts`
- **Category:** security
- **Description:** The legacy checkout redirect route has no authentication. While it only returns a URL, it still represents unnecessary attack surface.
- **Fix:** Add auth or deprecation notice.

### L-10: Telemetry Export — Duplicate Super Admin Email Check
- **File:** `src/app/api/telemetry/export/route.ts`
- **Lines:** 14, 7
- **Category:** inconsistency
- **Description:** `SUPER_ADMIN_EMAILS` is duplicated from the middleware file. If the list changes in one place, it won't update in the other.
- **Fix:** Extract to a shared constant.

---

## Summary by Category

| Category | CRITICAL | HIGH | MEDIUM | LOW | Total |
|----------|----------|------|--------|-----|-------|
| **security** | 6 | 10 | 10 | 6 | 32 |
| **error** | 0 | 1 | 2 | 2 | 5 |
| **inconsistency** | 0 | 1 | 3 | 2 | 6 |
| **performance** | 1 | 0 | 0 | 0 | 1 |

## Priority Remediation Roadmap

### Week 1 (CRITICAL — Do Now)
1. **C-01:** Add auth to admin end-impersonation
2. **C-02:** Add GHL webhook signature verification  
3. **C-03:** Add Google Calendar webhook token verification
4. **C-04:** Fix public invoice endpoint (use service role, add rate limiting)
5. **C-05:** Add auth to compliance verify
6. **C-06:** Remove Stripe key logging
7. **C-07:** Fix cron POST conditional auth bypass

### Week 2 (HIGH — Do This Sprint)
1. **H-02:** Add HMAC state to Xero OAuth callback
2. **H-03:** Fix listUsers() enumeration in signup-invite
3. **H-04:** Use timingSafeEqual for quote tokens
4. **H-05:** Migrate rate limiter to Redis/Upstash
5. **H-07:** Fix Stripe Connect double payment intent bug
6. **H-08:** Remove vault 2FA hardcoded fallback secret

### Week 3 (MEDIUM — Next Sprint)
1. **M-01:** Roll out rate limiting across all routes
2. **M-02:** Sanitize Stripe error messages
3. **M-03/M-04:** Standardize response formats
4. **M-05:** Add auth to switch-context GET
5. **M-09:** Consolidate stripe_account_id storage
6. **M-10:** Validate payment amounts as positive integers

### Ongoing (LOW — Technical Debt)
1. Eliminate `as any` casts across routes
2. Standardize Supabase client patterns
3. Use signed URLs for invoice PDFs
4. Consolidate super admin email list

---

## What's Done Well ✅

1. **Stripe Webhook** — Proper signature verification with idempotent store-and-forward pattern
2. **Middleware RBAC** — Well-structured edge RBAC with JWT fast-path + DB fallback
3. **Impossible Travel Detection** — Creative velocity anomaly detection using Vercel geo headers
4. **Team Invite Flow** — Comprehensive pipeline with proper role checks, audit logging, and branded emails
5. **Automation Execute** — Timing-safe auth with `timingSafeEqual`
6. **Integrations Callback** — Proper HMAC-signed state parameter for OAuth flows
7. **Set Password** — One of the few routes with proper rate limiting
8. **Vault 2FA** — Well-implemented OTP flow with attempt limiting and session management
9. **E2E Seed** — Good production guardrails (env check + secret header)
10. **Email System** — Clean architecture with template separation, queue fallback, and branded sending
