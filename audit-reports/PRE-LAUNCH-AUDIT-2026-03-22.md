# 🚀 iWorkr Pre-Launch Audit — What STILL Needs to Be Done

**Date:** 2026-03-22 | **Auditor:** Hyperion-Vanguard System Audit  
**Scope:** Full codebase — 95 Edge Functions, 99 Server Action files (~960 functions), 45 API Routes, 140 Dashboard Pages, 176 SQL Migrations, 24 Zustand Stores, 9 CI Workflows, Auth/Config/Deployment

---

## 🔴 CRITICAL — Must Fix Before ANY Production Traffic

### 1. DATABASE MIGRATIONS NOT APPLIED TO PRODUCTION
> **Impact:** The entire Hyperion-Vanguard security remediation exists only in code, not in the live database.

Migrations **170–176** have NOT been applied to the iWorkr production Supabase instance (`olqjuadvseoxpfjzlghb`). This means:
- **S-01 (RLS Purge) is NOT live** — `jobs`, `clients`, `invoices` still have permissive `USING(true)` policies in production. Any authenticated user can read/write ANY org's data.
- **S-06 (JWT Hook) is NOT live** — The `custom_access_token_hook` fix (writing both `role` and `role_name`) is not deployed.
- **S-07/S-08 (Infrastructure Tables) are NOT live** — `impersonation_sessions` and `inbound_webhooks_queue` are still wide open.

**Action:** Run `supabase db push` against the production project, or apply migrations 170–176 via the Supabase Dashboard SQL Editor. This is the **#1 blocker**.

---

### 2. MISSING PERFORMANCE INDEX FOR RLS
> **Impact:** Every row access on `jobs`, `clients`, and `invoices` calls `is_org_member()` which queries `organization_members` — without a proper index, this becomes a sequential scan.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_members_user_org_active 
ON public.organization_members(user_id, organization_id) 
WHERE status = 'active';
```

**Action:** Add this index in a new migration or execute directly. Without it, page loads will degrade significantly at scale.

---

### 3. SUPABASE AUTH CONFIG — Email Confirmations Disabled
> **Impact:** Anyone can sign up with ANY email (including `ceo@competitor.com`) without proving ownership.

In `supabase/config.toml` (and likely mirrored in production dashboard):
| Setting | Current | Required |
|---------|---------|----------|
| `enable_confirmations` | `false` | `true` |
| `minimum_password_length` | `6` | `8+` |
| `password_requirements` | `""` (none) | `letters_digits` |
| `double_confirm_changes` | `false` | `true` |
| `mfa.totp.enroll_enabled` | `false` | `true` |
| `mfa.totp.verify_enabled` | `false` | `true` |

**Action:** Update in the Supabase Dashboard → Authentication → Settings.

---

### 4. NO "FORGOT PASSWORD" FLOW
> **Impact:** Users who sign in with email+password have NO way to reset their password. They are locked out forever.

The `/auth` page has email + password sign-in but **no "Forgot your password?" link**. The `resetPasswordForEmail` function is only callable by super admins.

**Action:** Add a "Forgot password?" link to the auth page that calls `supabase.auth.resetPasswordForEmail()`.

---

### 5. XSS IN COMMUNICATIONS PAGE
> **Impact:** Email HTML from external senders is rendered via `dangerouslySetInnerHTML` without sanitization. Malicious emails could execute JavaScript in the admin's browser.

**File:** `src/app/dashboard/communications/page.tsx:745`
```tsx
dangerouslySetInnerHTML={{ __html: detailEmail.body_html }}
```

**Action:** Wrap with `DOMPurify.sanitize(detailEmail.body_html)`.

---

### 6. UNAUTHENTICATED SERVER ACTIONS EXPOSING FINANCIAL DATA
> **Impact:** Critical financial functions callable without any session.

| File | Functions | Risk |
|------|-----------|------|
| **`iworkr-connect.ts`** | `getConnectStatus`, `getConnectPayouts`, `getConnectStats`, `exportStatementCsv` | Stripe financial data exfiltration |
| **`system-telemetry.ts`** | ALL 4 functions | Internal platform health/error data exposed |
| **`sms.ts`** | `sendAppDownloadLink` | Twilio billing abuse |
| **`clients.ts`** | `getClientsWithStats`, `getClientDetails` | Client PII exposure |
| **`schedule.ts`** | `checkFatigueCompliance`, `getWorkerWeeklyHours` | Worker data exposure |

**Action:** Add `supabase.auth.getUser()` checks to all listed functions.

---

### 7. PUBLIC INVOICE IDOR
> **Impact:** Anyone can enumerate invoice IDs and trigger status changes (mark as "viewed") on arbitrary invoices.

**File:** `src/app/api/invoices/public/[invoiceId]/route.ts`  
Uses anon key and performs WRITE operations (status update, event insertion) without any token verification.

**Action:** Add secure_token verification (like the quotes accept/decline routes).

---

### 8. GoHighLevel WEBHOOK ACCEPTS UNAUTHENTICATED PAYLOADS
> **Impact:** If `GHL_WEBHOOK_SECRET` is not set, anyone can inject fake client records into the database.

**File:** `src/app/api/webhooks/gohighlevel/route.ts`  
Signature verification is bypassed when the env var is missing.

**Action:** Return 500 if `GHL_WEBHOOK_SECRET` is not configured. Never process without verification.

---

### 9. 81 OF 95 EDGE FUNCTIONS NOT IN CI DEPLOYMENT PIPELINE
> **Impact:** No guarantee production Edge Functions match the repository code. Manual deployments required.

Only 14 of 95 functions are deployed via GitHub Actions. Critical functions like `stripe-connect-onboard`, `invite-member`, `generate-pdf`, `twilio-webhook`, `run-automations` require manual `supabase functions deploy`.

**Action:** Add all production Edge Functions to `.github/workflows/deploy-supabase-functions.yml`, or create a deploy-all script.

---

## 🟠 HIGH — Should Fix Before GA Launch

### 10. Webhook DLQ Missing on Money-Critical Handlers
`stripe-webhook` and `revenuecat-webhook` have `FIXME: HIGH — No DLQ routing` comments. Failed webhook payloads are lost, causing subscription state divergence.

### 11. PII Endpoints with Fallback Wildcard CORS
`fetch-participant-dossier` and `get-participant-timeline` fall back to `"Access-Control-Allow-Origin": "*"` when `APP_URL` env var is not set. These contain clinical/participant PII.

### 12. `outrider-en-route-notify` — Falsely Annotated as SECURED
This function has no actual auth gate. Any caller can update job status and trigger SMS to clients.

### 13. In-Memory Rate Limiter Ineffective on Vercel
`src/lib/rate-limit.ts` uses `Map` in process memory. On serverless, each cold start resets the counter, making rate limiting non-functional.

### 14. In-Memory Cache Leaks Between Workspaces
`_memoryCache` Map in `cache-utils.ts` is NOT cleared on workspace switch. Could show Org A data when user switches to Org B.

### 15. `continue-on-error: true` on TypeScript Compilation
`aegis-chaos.yml:56` — Type errors silently pass CI. This masks real bugs.

### 16. Error Messages Leak Internal Details
9 API routes leak raw Supabase/Stripe error messages to the client (table names, constraint names, API version info).

### 17. Missing Rate Limiting on Auth/Payment Routes
`team/signup-invite`, `stripe/create-subscription`, `stripe/connect/payment-intent`, `quotes/[id]/accept` — all lack rate limiting.

### 18. `analytics_refresh_log` Wide Open
Migration 146 — `FOR ALL USING (true)` without `TO service_role` restriction. Any authenticated user has full CRUD.

### 19. `admin_audit_logs` Writable by Any User
Migration 163 — `INSERT WITH CHECK (true)` allows any user to forge audit entries.

---

## 🟡 MEDIUM — Should Address Before Scaling

### 20. Placeholder App Store URLs in SMS
`sms.ts` has `INCOMPLETE: PARTIAL — App links still point to placeholder store URLs`.

### 21. `alert()` / `window.alert()` Used in Production Pages
7 pages use native browser alerts instead of toast: `proda-claims` (7 instances), `participants/[id]`, `sync-errors`, `roster/dispatch`, `settings/integrations`.

### 22. Noop Buttons — Click Does Nothing
- `workforce/team/[id]` — "Message" button has `onClick={() => {}}`
- `care/participants/[id]` — MoreHorizontal icon has no handler

### 23. Hardcoded Invoice Catalog
`finance/invoices/new/page.tsx` has 10 hardcoded service items (plumbing-specific). Should be database-sourced.

### 24. `cron/route.ts` Falls Back to Service Role Key
If `CRON_SECRET` is not set, `SUPABASE_SERVICE_ROLE_KEY` becomes the bearer token — could be exposed in logs.

### 25. Missing Env Vars Not Documented
`CRON_SECRET`, `CITADEL_ENCRYPTION_KEY`, `SUPABASE_ACCESS_TOKEN`, `IS_TEST_ENV`, `SLACK_WEBHOOK_URL` are used but not in `.env.local.example`.

### 26. Package Manager Inconsistency
`security-gate.yml` uses `pnpm` while all other workflows use `npm`. Could cause dependency resolution differences.

### 27. Deprecated Dependencies
- `@tremor/react` — Archived/unmaintained. Used in 3 files.
- `html2canvas` — Last release 2022. Used in 1 file.
- Two competing DnD libraries installed (`@dnd-kit/core` + `@hello-pangea/dnd`).

---

## 🟢 LOW — Polish Items

### 28. 40+ Pages Use `console.error` in Production
While not user-visible, these leak stack traces in browser devtools.

### 29. ~750+ `as any` Casts Across Server Actions
Mostly Supabase SDK ergonomic issues, but masks potential type bugs.

### 30. "Coming Soon" Sections Visible to Users
- `settings/security` — WebAuthn/FIDO2 placeholder
- `knowledge` — "Rich editor coming soon", "Read Receipts — Coming Soon"
- `ai-agent/[agentId]` — All non-phone agents show "coming soon"
- `jobs` — Bulk assign shows toast "coming soon"

### 31. `compliance/audits` Default Title
Default form value is `"NDIS Sample Audit Data Room"` — looks test-like.

### 32. 6 Edge Functions Marked @status PARTIAL
`live-price-check`, `revenuecat-webhook`, `pace-check-budget`, `ingest-regulation`, `pace-submit-claim`, `generate-swms-pdf`.

### 33. Migration 176 Not Idempotent
`CREATE POLICY` statements will error on re-run. Safe but noisy. Should add `DROP POLICY IF EXISTS "hyperion_..."` before each create for clean re-runs.

---

## ✅ What's In Great Shape

| Area | Status |
|------|--------|
| **24/24 Zustand stores** have `reset()` methods | ✅ |
| **SlideOver** persists edits to DB via `updateJob` server action | ✅ |
| **Sidebar badges** wired to real Zustand store data | ✅ |
| **Auth page** covers Google OAuth, Magic Link, and Email+Password | ✅ |
| **121 of 140 dashboard pages** are production-ready | ✅ |
| **next.config.ts** has strong security headers + CSP | ✅ |
| **No hardcoded secrets** in source code | ✅ |
| **.gitignore** properly excludes all `.env` files | ✅ |
| **Stripe Connect** fixed (no more double-account crash) | ✅ |
| **PRODA export** prevents duplicate government claims | ✅ |
| **TOTP QR code** rendered client-side (no 3rd party leak) | ✅ |
| **DOMPurify** sanitizes AI-generated HTML in clinical reviews | ✅ |
| **70/95 Edge Functions** use centralized CORS | ✅ |
| **All core CRUD server actions** (jobs, schedule, finance, team) have auth | ✅ |
| **Zod validation** on all major mutation paths | ✅ |
| **Soft deletes** with `deleted_at` timestamps | ✅ |
| **Dependencies** are modern: Next 16, React 19, Zod 4, Tailwind 4 | ✅ |

---

## 📋 Priority Execution Order

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| **Phase 0: Database** | Apply migrations 170–176 to prod + add `is_org_member` index | 30 min | Closes ALL RLS vulnerabilities |
| **Phase 1: Auth Config** | Enable email confirmation, strengthen passwords, enable MFA in Supabase Dashboard | 15 min | Closes account creation abuse |
| **Phase 2: Auth UX** | Add "Forgot Password" link to `/auth` page | 30 min | Unblocks locked-out users |
| **Phase 3: Server Action Auth** | Add auth checks to 15 unauthenticated functions | 2 hrs | Closes financial data exposure |
| **Phase 4: XSS + IDOR** | Sanitize communications page + add invoice token check | 30 min | Closes XSS and data manipulation |
| **Phase 5: Webhooks** | Enforce GHL secret + add DLQ to stripe/revenuecat | 1 hr | Closes data injection + lost webhooks |
| **Phase 6: Edge Functions** | Add all 95 EFs to deployment pipeline or create deploy-all script | 1 hr | Ensures prod matches code |
| **Phase 7: Polish** | Replace `alert()`, wire noop buttons, fix CORS fallbacks | 2 hrs | Professional UX |

**Total estimated effort to reach launch-ready: ~8 hours of focused work.**
