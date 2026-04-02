# Project-wide code review — incompletions & follow-ups

**Date:** 2026-03-28  
**Master index:** [INDEX-MASTER-AUDIT-2026-03-28.md](INDEX-MASTER-AUDIT-2026-03-28.md) (navigation + consolidated backlog)  
**Companion:** [FULL-PROJECT-LAUNCH-AUDIT-2026-03-27.md](FULL-PROJECT-LAUNCH-AUDIT-2026-03-27.md) (security / launch blockers).  
This document is a **product-engineering backlog**: explicit gaps, weak error handling, and **INCOMPLETE** trails left in source.

---

## 1. Explicit `INCOMPLETE` / `TODO` in source (verified)

| Area | File | Marker | Remediation |
|------|------|--------|-------------|
| Mobile finance | `flutter/lib/features/finance/screens/create_invoice_screen.dart` | `INCOMPLETE:` PDF preview — Edge Function | Wire PDF generation to Supabase Edge or shared web pipeline; align with `generate-pdf` / Moneta. |
| Mobile knowledge | `flutter/lib/features/knowledge/screens/article_viewer_screen.dart` | `TODO:` `flutter_html`, video placeholder | Add `flutter_html` or WebView; `video_player` for embeds. |
| Mobile feedback | `flutter/lib/features/feedback/services/halcyon_feedback_service.dart` | `TODO:` `package_info_plus` for `app_version` | Replace hardcoded `1.0.0` for accurate support telemetry. |
| Public sites API | `src/app/api/sites/form-schema/route.ts` | `@status INCOMPLETE` (file header) | Authenticate or sign URLs; stop unauthenticated admin reads by `templateId`. |
| Loom server actions | `src/app/actions/sites.ts` | `getWorkspaceId()` (see §2) | Align org with session/cookie + `status = 'active'`. |

---

## 2. High-priority logic gaps (no TODO marker)

### 2.1 `getWorkspaceId()` — `sites.ts`

- Picks **first** `organization_members` row for user with **no** `status = 'active'` and **no** match to **active workspace** from auth/cookies.
- **Impact:** Wrong workspace for users in multiple orgs.

**Target behavior:** Use same source as `switch-context` / `auth-store` active org (and filter active membership).

### 2.2 Silent `.catch(() => {})` (sample)

Operations continue without logs; hardest cases affect **money**, **domains**, **telemetry**.

| File | Concern |
|------|---------|
| `src/app/actions/aegis-contract.ts` | Ledger side-effect after contract update |
| `src/app/actions/site-domains.ts` | Vercel DELETE after DB intent |
| `src/app/api/invoices/public/[invoiceId]/route.ts` | Secondary async work |
| `src/app/site-render/.../page.tsx` | Analytics |
| `src/lib/finance-store.ts`, `schedule-store.ts` | Refresh failures |

**Recommendation:** Structured `logger.warn` + optional Sentry; never empty catch on financial writes.

### 2.3 Middleware / env

- `src/lib/supabase/middleware.ts` — empty Supabase env → **no** session refresh (fail-open). **Production:** fail closed or 503.

### 2.4 Automation bearer

- `src/app/api/automation/execute/route.ts` — `AUTOMATION_SECRET` fallback to service role key. **Set** `AUTOMATION_SECRET` in prod.

### 2.5 Super-admin bootstrap emails — **addressed (2026-03-28)**

Centralized in **`src/lib/super-admin.ts`**: `isSuperAdminEmail()` / `getSuperAdminEmails()` read **`SUPER_ADMIN_EMAILS`** (comma-separated) with a single code default. Wired into middleware, telemetry actions, Olympus actions, and `api/telemetry/export`.

**Follow-up:** ~~Shared **`verifySuperAdmin()`**~~ — implemented as **`verifySuperAdminServer()`** in `src/lib/super-admin-server.ts` (used by telemetry, superadmin, Olympus comms/mobile, `api/telemetry/export`).

---

## 3. Flutter — additional risks (from prior audits)

| Topic | Notes |
|-------|--------|
| Sync | `sync_engine.dart` — hard `throw` on conflicts; needs UX + retry policy. |
| Models | Unsafe casts in `fleet_position.dart`; `DateTime.parse` without guard in `health_observation.dart`. |
| Cerberus | `cerberus_blocker_modal.dart` — placeholder hash, not production crypto. |
| Supabase defaults | `supabase_service.dart` — baked prod URL/anon; OK for public keys; use defines for staging. |

---

## 4. Web — UX “coming soon” (non-blocking)

Scattered copy in dashboard (knowledge receipts, get-app QR, bulk actions, etc.). Track in product backlog; no single file index — search `coming soon` / `Coming soon` in `src/app/dashboard` if grooming.

---

## 5. Supabase / ops

| Item | Action |
|------|--------|
| `BUNDLED_ALL_MIGRATIONS.sql` | Do not rely on for new schema; see launch audit §1. |
| Edge `verify_jwt` | Confirm per function in **Dashboard** (not all in repo). |
| `playwright/.auth/` | Gitignored; rotate any leaked storage state. |

---

## 6. Verification checklist (after fixes)

- [ ] Multi-org user: sites editor uses **correct** org after switching workspace.
- [ ] `form-schema` cannot enumerate arbitrary templates without auth.
- [ ] `AUTOMATION_SECRET` set; automation cron uses dedicated secret.
- [ ] Flutter: invoice PDF path tested on device; article HTML renders primary tags.
- [ ] Replace empty catches on **aegis-contract** and **site-domains** with logging.

---

*Generated as part of project-wide audit continuation; update when items close.*
