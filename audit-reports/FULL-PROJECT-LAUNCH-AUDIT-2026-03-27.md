# Full Project Launch Readiness Audit — iWorkr Stack

**Date:** 2026-03-27 · **Updated:** 2026-03-28 (status headers **full stack**: `src/`, Flutter, Electron, **Supabase migrations + Edge Functions**, **e2e**, **scripts**, **root configs**, **`tests/`**)  
**Scope:** Entire monorepo — Next.js web (`src/`), Supabase (`supabase/`), Flutter (`flutter/`), Electron (`electron/`), tooling, tests, and operational risk.  
**Method:** Parallel codebase exploration (swarm-style agents), targeted `grep`, migration ordering review, and cross-reference with known product areas (Loom-Space, Moneta-Canvas, Gateway-Intake, auth).

This document is a **launch-blocker and risk inventory**. It does not claim every line was executed; items are **evidence-based** from repository inspection. Severity uses **P0** (ship blocker / security-critical), **P1** (high), **P2** (medium), **P3** (low / hygiene / product gap).

**Companion (incompletions & code-review backlog):** [CODE-REVIEW-INCOMPLETIONS-2026-03-28.md](CODE-REVIEW-INCOMPLETIONS-2026-03-28.md)

**Master index (all audits + consolidated backlog):** [INDEX-MASTER-AUDIT-2026-03-28.md](INDEX-MASTER-AUDIT-2026-03-28.md)

---

## Executive summary

| Domain | Highest risks |
|--------|----------------|
| **Supabase / DB** | `BUNDLED_ALL_MIGRATIONS.sql` sorts **after** all timestamped migrations and can **re-run core DDL** on `db reset` → duplicate type/table errors or split brain vs numbered migrations. |
| **Web / Edge** | Middleware can **skip session refresh** when Supabase env vars are missing (`src/lib/supabase/middleware.ts`). Hardcoded **super-admin fallback email** in middleware. |
| **Loom-Space / Sites** | Public **form-schema** GET exposes template structure by UUID; **form-submit** relies on validation + service role without visible **rate limiting**. Analytics failures **silent**. |
| **Multi-tenant sites** | `sites.ts` workspace resolution uses `organization_members` **without `status = 'active'`** + **`limit(1)`** → **nondeterministic** org for multi-org users. |
| **Flutter** | Few literal `TODO`s; larger risks are **INCOMPLETE** flows (PDF invoice preview), **demo AI**, **HTML/video** placeholders in knowledge, **sync** hard failures offline. |
| **Electron** | Shell loads **remote web**; CSP/header rewriting is **fragile** if hosting changes; no offline product. |
| **Repo hygiene** | `.gitignore` lists `e2e/.auth/` but **not** `playwright/.auth/` — if Playwright auth lives under `playwright/.auth/`, those JSON files can be **tracked accidentally** (session artifacts must not ship). |

**Recommendation before production:** Fix or quarantine **P0** migration strategy; verify **middleware env** fail-closed; remove or secure **super-admin bypass**; align **sites** workspace selection with auth cookie; add **rate limits** and **schema reload** runbooks for public site APIs.

---

## 1. Supabase & PostgreSQL

### P0 — Migration bundle collision

- **Finding:** `supabase/migrations/BUNDLED_ALL_MIGRATIONS.sql` is included in the migrations folder. Supabase applies **all** `*.sql` files in **lexicographic order**. This file sorts **last** (after `202603270001_loom_space_schema.sql`) and historically bundles **full** DDL (enums, core tables) that duplicate standalone numbered migrations.
- **Impact:** Fresh `supabase db reset` / clean CI may hit **“already exists”** errors, or maintain **two sources of truth** if only one file is updated.
- **Evidence:** Directory sort ends with `BUNDLED_ALL_MIGRATIONS.sql`; agent read shows non-idempotent `CREATE TYPE` style DDL at top of bundle.

**Remediation:** Remove `BUNDLED_ALL_MIGRATIONS.sql` from `supabase/migrations/` for CLI-driven workflows, or replace with a **no-op** / doc-only artifact outside migrations; enforce single migration pipeline in CI.

### P1 — Naming & ordering hazards

- Non-standard names: `042b_*`, `076a_*` — order is **string sort**, not numeric (e.g. `042_` vs `042b_`).
- Mixed eras: numeric `001`–`200`, dated `20240320*`, `20260326*`, `20260327*` — cross-dependencies are hard to audit without a dependency graph.

### P1 — Encryption fallback (integrations vault)

- Migrations `104_crucible_tenant_xero_vault_and_auditor_otp.sql` / `105_aegis_core_pgcrypto_vault_patch.sql` document fallback to a **static dev key** when `app.settings` keys are unset.
- **Impact:** Production misconfiguration → **weak encryption** for OAuth tokens at rest.

### P2 — SECURITY DEFINER concentration

- Large surface of `SECURITY DEFINER` RPCs (RBAC, vault, Panopticon, ledger). Normal for Supabase but **high blast radius** if `search_path` or role checks are wrong.

### P2 — Hermes / cron calling app with service key

- `038_hermes_email_engine.sql` (per agent): cron posts with bearer from DB settings — **tight coupling** and secret-handling risk.

### P2 — Schema drift vs app (Moneta + Loom)

- **Invoices:** `202603260160_moneta_canvas_blocks.sql` vs app usage of `blocks_json` / editor fields.
- **Sites:** `202603270001_loom_space_schema.sql` vs `src/app/actions/sites.ts` — environments that skip migrations see **PostgREST “schema cache” / missing table** errors (documented in app error strings).

### P3 — `config.toml` / local API flags

- `supabase/config.toml` may set `[api] enabled = false` — confirm intentional for local vs hosted.

---

## 2. Next.js web app & middleware

### P0 — Auth/session bypass when env missing

- **`src/lib/supabase/middleware.ts`:** If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is absent, middleware **returns early** without `updateSession` — **unauthenticated access** to matched routes in misconfigured deploys.

### P0 / P1 — Super-admin email fallback

- **`SUPER_ADMIN_EMAILS`** (e.g. `theo@iworkrapp.com`) used in middleware and other paths — **operational security** risk if list is stale or account compromised; also violates least-privilege for production.

### P1 — Partial edge RBAC

- Only prefixes listed in `RBAC_ROUTES` get role-based checks; other `/dashboard/*` routes rely on app + RLS — **inconsistent** hardening story.

### P1 — Citadel / “impossible travel”

- Revocation path depends on **`SUPABASE_SERVICE_ROLE_KEY`**; if missing, behavior may be **inconsistent** (per agent read).

### P1 — Public marketing / tenant site routing

- **`src/middleware.ts`:** Non-iWorkr hosts rewrite to `/site-render/...`. Depends on DNS, `resolvePublicSite`, and published rows — **misconfiguration** = wrong site or 404.

### P2 — Silent error handling in actions

- **`src/app/actions/aegis-contract.ts`:** Ledger insert `.catch(() => {})` after contract update — **silent** financial/audit inconsistency.
- **`src/app/actions/site-domains.ts`:** Vercel `DELETE` `.catch(() => {})` — DB cleared but domain may remain on Vercel (or inverse).

### P2 — `sites` workspace selection

- **`getWorkspaceId()`** in `sites.ts`: `organization_members` without `status = 'active'`, `limit(1)` — **wrong org** possible for users in multiple workspaces.

### P2 — Public site analytics

- **`recordAnalyticsHit` + caller** — failures swallowed (`.catch` in site-render page per agent).

### P2 — Widespread `any` in server actions

- ESLint disables and `(supabase as any)` reduce **compile-time** safety — runtime errors and bad writes more likely under schema drift.

### P3 — Product “coming soon” / placeholders (non-blocking)

Examples (not exhaustive):

- Knowledge: read receipts “Coming Soon” (`src/app/dashboard/knowledge/page.tsx`).
- Get App: QR placeholder (`src/app/dashboard/get-app/page.tsx`).
- Settings: MYOB, WebAuthn copy.
- Jobs: bulk assign toast “coming soon”.
- Timesheets / assets: map/QR placeholder comments.

---

## 3. Public Loom-Space / site APIs

| Item | Severity | Notes |
|------|----------|--------|
| `GET /api/sites/form-schema` | P1 | Unauthenticated read of form **structure** by `templateId` — recon / disclosure. |
| `POST /api/sites/form-submit` | P2 | Service-role insert; validate workspace ownership — still need **abuse controls** (rate limit, CAPTCHA, IP throttling). |
| Analytics | P2 | Fire-and-forget; failures invisible to operators. |

---

## 4. Flutter (mobile)

### Medium — INCOMPLETE / placeholders

- **`create_invoice_screen.dart`:** `INCOMPLETE:` PDF preview — Edge Function integration.
- **`article_viewer_screen.dart`:** `TODO` full HTML (`flutter_html`); video placeholder.
- **`ai_provider.dart`:** Demo/local AI until Edge LLM wired.

### Medium — Version / packaging

- **`halcyon_feedback_service.dart`:** Hardcoded `app_version` `1.0.0` vs `package_info_plus` TODO.
- **`pubspec.yaml`:** `sqlite3_flutter_libs: ^0.6.0+eol` — **EOL** packaging track.

### Medium — Sync / offline

- **`sync_engine.dart` / background sync:** Conflict paths throw — **hard failures** vs web always-online.

### Medium — Push / maps / payments

- FCM/APNs, Google Maps keys, Stripe Terminal — **device-only** failure modes.

### Medium — Automotive bridge

- `automotive_bridge_service.dart` — **MethodChannel** requires native implementations; web cannot validate.

### Low — Tests

- **`integration_test/test_bundle.dart`:** Imports internal `test_api` APIs — fragile on upgrades.

---

## 5. Electron (desktop)

### Critical — Architecture

- Loads **production URL** in embedded BrowserWindow — **no offline** product; total dependency on web availability and CSP.

### High — CSP / header rewriting

- **`main.ts` / `window.ts` / `protocol.ts`:** Strips `X-Frame-Options`, rewrites `frame-ancestors` for allowlisted hosts — **breaks** if production headers change.

### Medium — Auto-update

- **`updater.ts`:** Misconfigured publish metadata → users stuck on old shell.

---

## 6. Tests, CI, and repository hygiene

### P1 — Auth artifacts in repo

- **Playwright storage state** under `playwright/.auth/*.json` — **session tokens**. Root `.gitignore` only ignores `e2e/.auth/`; add **`playwright/.auth/`** (or align all E2E auth to one path) so tokens are never committed. Rotate any keys that were ever pushed.

### P2 — Lint / test scale

- Prior runs reported **very large** ESLint issue counts — **quality gate** may be ineffective without baseline or phased cleanup.

### P2 — E2E scope

- Playwright projects are **modular**; full regression may not cover all dashboard routes before launch.

---

## 7. Consolidated remediation backlog (suggested order)

1. **P0:** Remove or relocate `BUNDLED_ALL_MIGRATIONS.sql` from active migrations; document canonical migration path for CI and hosted Supabase.
2. **P0:** Middleware **fail closed** when Supabase URL/anon key missing (return 503 or redirect to `/setup` with clear log).
3. **P0/P1:** Replace or gate **super-admin email** bypass with env-only allowlist + audit logging; remove hardcoded personal email from default builds.
4. **P1:** `sites.ts` — align `getWorkspaceId()` with **active membership** + **cookie-selected org** (same source as `auth-store` / `switch-context`).
5. **P1:** Harden public **form-schema** (signed token, site_id + template ownership check, or disable enumeration).
6. **P2:** Add **rate limiting** (edge or API) for `form-submit` and similar public endpoints.
7. **P2:** Replace silent `.catch(() => {})` in financial/domain actions with **structured logging** + user-visible failure when consistency matters.
8. **P2:** PostgREST **schema reload** runbook after DDL; monitor for PGRST205 in production.
9. **P3:** Track UI “coming soon” items in product roadmap; avoid marketing them as GA.

---

## 8. Appendix — Files referenced frequently

| Area | Paths |
|------|--------|
| Middleware | `src/middleware.ts`, `src/lib/supabase/middleware.ts` |
| Sites / Loom | `src/app/actions/sites.ts`, `src/app/site-render/**`, `src/app/api/sites/**` |
| Migrations | `supabase/migrations/202603270001_loom_space_schema.sql`, `supabase/migrations/BUNDLED_ALL_MIGRATIONS.sql` |
| Job / invoice modals | `src/components/app/create-job-modal.tsx`, `src/components/app/create-invoice-modal.tsx` |
| Org resolution | `src/lib/hooks/use-org.ts`, `src/lib/auth-store.ts` |
| Flutter gaps | `flutter/lib/features/finance/screens/create_invoice_screen.dart`, `flutter/lib/features/knowledge/screens/article_viewer_screen.dart` |
| Electron | `electron/src/main/main.ts`, `electron/src/main/window.ts` |

---

## 9. Sign-off checklist (pre–production)

- [ ] `supabase db push` / migration history reconciled with hosted project (or SQL Editor baseline documented).
- [ ] All required env vars set on Vercel + Supabase; **no** silent auth bypass.
- [ ] `playwright/.auth` and similar secrets **gitignored** (see §6) and absent from remote.
- [ ] **`pnpm db:push`** / CLI migration history matches hosted Supabase; if histories diverge, use Dashboard SQL + documented baseline rather than blind push.
- [ ] Pen-test or internal review of **public** site APIs and **Edge** functions with `verify_jwt` / secrets configuration.
- [ ] Runbook for **PostgREST reload** after schema migrations.
- [ ] Mobile: release checklist for **push**, **maps**, **payments**, **sync** on staging devices.

---

## 10. Swarm batch + codebase review (2026-03-28)

Second pass: parallel agents on web critical paths, Supabase tree, Flutter + Electron. Items below **extend** earlier sections; dedupe where noted.

### 10.1 Web — additional P0 / P1

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| W1 | **P0** | `GET /api/sites/form-schema` uses **admin client** with **no caller auth** — any `templateId` UUID can disclose form structure | `src/app/api/sites/form-schema/route.ts` |
| W2 | **P1** | `resolvePublicSite` builds `.or(\`custom_domain.eq.${hostname}\`)` — **hostname** must be validated/normalized before query | `src/app/actions/sites.ts` |
| W3 | **P1** | `POST /api/automation/execute`: `AUTOMATION_SECRET \|\| serviceKey` — if secret unset, bearer **equals service role material** | `src/app/api/automation/execute/route.ts` |
| W4 | **P2** | `src/lib/supabase/server.ts` — `setAll` swallows cookie write errors (session refresh may fail silently in RSC contexts) | `server.ts` |
| W5 | **P2** | `src/lib/supabase/client.ts` — localStorage parse failure ignored; workspace header may be wrong on cold start | `client.ts` |
| W6 | **P2** | Root `src/middleware.ts` — non–iWorkr hosts rewrite to `/site-render/...` **without** `updateSession` (intentional for public sites; document as boundary) | `src/middleware.ts` |
| W7 | **P2** | Edge treats `/api/*` as public at middleware layer — **each route** must enforce auth | `src/lib/supabase/middleware.ts` |

### 10.2 Supabase — config vs hosted

| ID | Severity | Finding |
|----|----------|---------|
| S1 | **P1** | **No `[functions.*]`** in `supabase/config.toml` — **JWT verification** for Edge Functions must be verified in **Supabase Dashboard** (not provable from repo alone). |
| S2 | **P1** | **Lexicographic ordering** nuance: e.g. `20240320000062_*` sorts **before** `20240320000130_*` at character positions — do not assume timestamp semantics. |
| S3 | **P2** | DB trigger → Edge (`send-push` etc.) — confirm anon JWT + function policy in hosted project. |

### 10.3 Flutter — crash / secrets / placeholders (sample)

| Area | Notes |
|------|--------|
| **Models** | `fleet_position.dart` — unsafe `as num` casts; `health_observation.dart` — `DateTime.parse` without `tryParse`. |
| **Sync** | `sync_engine.dart` — `StateError` / hard throws on conflict paths. |
| **Compliance** | `cerberus_blocker_modal.dart` — `_sha256` placeholder (not cryptographic SHA-256). |
| **Supabase** | `supabase_service.dart` — production URL + anon key **defaults** when defines empty (public keys; still fixed-project coupling). |
| **UI** | `create_invoice_screen`, `article_viewer_screen`, `halcyon_feedback_service` — documented INCOMPLETE/TODO (see §4). |

### 10.4 Electron — ops / security

| ID | Severity | Finding |
|----|----------|---------|
| E1 | **P1** | `protocol.ts` logs **full protocol URL** — OAuth/callback query strings may contain **tokens in logs**. |
| E2 | **P2** | `main.ts` — dev `electron-store` uses **unencrypted** storage when `encryptionKey` undefined. |
| E3 | **P2** | `updater.ts` — auto-download behavior; confirm release channel policy. |

---

## 11. Code status headers — convention & rollout

**Reality:** `src/` alone has **~894** `*.ts`/`*.tsx` files. “Comment every file fully” is a **rolling program**, not a single commit.

### 11.1 Standard block (TypeScript / TSX)

Place at **file top** (after shebang if any, before imports):

```text
/**
 * @module path/from/src/or/name
 * @status COMPLETE | STABLE | WIP | INCOMPLETE | DEPRECATED
 * @description One line — what this module owns
 * @risk P0|P1|P2|P3|none — optional; omit if none
 * @lastReview YYYY-MM-DD
 */
```

**Status glossary**

| Value | Meaning |
|-------|---------|
| `COMPLETE` | Behavior matches spec; reviewed for current release. |
| `STABLE` | Production-safe; minor gaps non-blocking. |
| `WIP` | Active development; may be feature-flagged. |
| `INCOMPLETE` | Known missing work — must pair with issue or `INCOMPLETE:` trail in code. |
| `DEPRECATED` | Scheduled removal; call out replacement. |

### 11.2 Dart / SQL / Electron

- **Dart:** `///` file-level block with same `@module` / `@status` / `@risk` / `@lastReview`.
- **SQL migrations:** Leading `--` block with `@migration`, `@depends_on` (conceptual), `@idempotent` yes/no.
- **Electron:** JSDoc `/** ... */` as TypeScript.

### 11.3 Rollout priority (suggested waves)

1. **Wave A** — Auth, middleware, Supabase clients, admin client, public API routes (`src/lib/supabase/*`, `src/middleware.ts`, `src/app/api/**` high-risk). **Done** (session 2026-03-28).
2. **Wave B** — Server actions (`src/app/actions/**`). **Done** for remaining files without headers: `site-domains.ts`, `vault-track.ts`, `*.test.ts` (finance, schedule, superadmin); all other action modules already had `@module` blocks.
3. **Wave C** — Shared components: **`src/components/finance/editor/**` (38 files), `src/components/site-editor/**` (49 files), `src/components/site-renderer/**` (22 files)** — all received `@component` headers (2026-03-28). Remaining stragglers under `components/branches`, `chat`, `forms`, `layout`, `tracking`, `ui` (14 files) — **done**. **`src/lib/stores/site-editor-store.ts`**, **`invoice-editor-store.ts`** — `@module` headers added.
4. **Wave D** — **`src/app/**` (all routes, layouts, loading/error boundaries)** — **done** (101 files). **`src/lib/**`** — **done** (38 remaining util modules). **`flutter/lib/**/*.dart`** — **done** (273 files; file headers use `// @module` / `// @status` to avoid Dart `dangling_library_doc_comments`). **`electron/src/**/*.ts`** — **done** (remaining 9 files; `main.ts` / `protocol.ts` were already tagged).

**Out of scope for automated tagging:** `supabase/migrations/*.sql` (use filename + `BUNDLED` audit §1), generated `*.g.dart`, e2e scripts, root config files.

This report’s **instrumented files** (session 2026-03-28) are listed in §12.

---

## 12. Files instrumented (status headers added or enriched) — 2026-03-28

### 12.1 Core / API / infra (first batch)

| File | Change |
|------|--------|
| `src/app/actions/sites.ts` | Full `@module` block + `@risk` (multi-org, hostname queries). |
| `src/app/api/sites/form-schema/route.ts` | Header + `@risk P0` (unauthenticated admin read). |
| `src/app/api/sites/form-submit/route.ts` | Header + `@risk P1` (public POST + service role). |
| `src/app/api/automation/execute/route.ts` | `@risk` line added (secret fallback). |
| `src/lib/supabase/middleware.ts` | `@risk` + `@lastAudit` refresh. |
| `src/lib/supabase/server.ts` | `@risk` (cookie setAll swallow). |
| `src/lib/supabase/client.ts` | `@risk` (localStorage / workspace header). |
| `src/middleware.ts` | `@risk` (public site host rewrite boundary). |
| `electron/src/main/main.ts` | Entry header (remote shell, store encryption). |
| `electron/src/main/protocol.ts` | Entry header (token-in-URL logging risk). |
| `flutter/lib/core/services/supabase_service.dart` | Dart doc block (defaults + risk). |
| `.gitignore` | `playwright/.auth/` added. |

### 12.2 Wave B — server actions (completion)

| File | Change |
|------|--------|
| `src/app/actions/site-domains.ts` | `@module` + `@risk` (Vercel vs DB drift). |
| `src/app/actions/vault-track.ts` | `@module` (inventory vault). |
| `src/app/actions/finance.test.ts` | `@module` (Vitest). |
| `src/app/actions/schedule.test.ts` | `@module` (Vitest). |
| `src/app/actions/superadmin.test.ts` | `@module` (Vitest). |

### 12.3 Wave C — components & stores (batch)

| Scope | Count | Pattern |
|-------|-------|---------|
| `src/components/finance/editor/**` | 38 | `@component` + Moneta description |
| `src/components/site-editor/**` | 49 | `@component` + Loom description |
| `src/components/site-renderer/**` | 22 | `@component` + public render |
| Stragglers (`branches`, `chat`, `forms`, `finance/TravelActionBar`, `layout`, `tracking`, `ui`) | 14 | `@component` per folder |
| `src/lib/stores/site-editor-store.ts`, `invoice-editor-store.ts` | 2 | `@module` Zustand |

**Note:** Every non-test `*.ts` / `*.tsx` under `src/components/` has `@component` or `@module` in the **first 15 lines** (verified 2026-03-28). **Entire `src/`** (non-test) is tagged (verified 2026-03-28). **Flutter `lib/`** uses `//` status lines at file top (not `///`, to satisfy the Dart analyzer).

### 12.4 Wave D — `src/app`, `src/lib`, Flutter, Electron (completion)

| Scope | Files | Notes |
|-------|------:|--------|
| `src/app/**` | 101 | `@page` / `@layout` / `@route` / `@error` + path |
| `src/lib/**` (remainder) | 38 | `@module` — automation, desktop, email, schemas, telemetry, etc. |
| `flutter/lib/**` | 273 | `// @module` … `// @lastReview` (excludes `.g.dart` / generated) |
| `electron/src/**` | 9 | JSDoc `@module electron/...` on ipc, window, tray, preload, etc. |

### 12.5 Wave E — Supabase, Playwright, tooling (2026-03-28)

| Scope | Files | Notes |
|-------|------:|--------|
| `supabase/migrations/*.sql` | 3 added / aligned | `181_*`, `200_*`, `BUNDLED_ALL_MIGRATIONS.sql` now include `-- @migration` (bundle tagged **LEGACY** + audit pointer); **~201** others already had `@migration` blocks |
| `supabase/functions/**/*.ts` | 96 | JSDoc `@module supabase/functions/...` — Edge handlers + tests; functions that already had rich headers were skipped |
| `e2e/**/*.ts` | 52 | `@module e2e/...` — inserted into existing `/**` blocks or prepended |
| `scripts/*.{ts,mjs,cjs}` | 12 | `@module` / `// @module` |
| Root configs | 6 | `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `tests/edge-functions/vitest.edge.config.ts` |
| `tests/**/*.ts` (repo root) | 13 | `@module tests/...` `@status TEST` |

**Excluded by design:** `.env*`, `node_modules`, generated `*.g.dart`, `playwright-report/`, `public/` assets, `supabase/migrations/BUNDLED_ALL_MIGRATIONS.sql` body (header only).

---

## 13. Project-wide tagging — complete

As of **2026-03-28**, first-class source trees carry **module / route / status** metadata at file top:

- **Web:** `src/**` (non-test)
- **Mobile:** `flutter/lib/**` (non-generated Dart)
- **Desktop:** `electron/src/**`
- **Backend:** `supabase/migrations` (SQL), `supabase/functions` (Deno/TS)
- **QA:** `e2e/**`, `tests/**` (integration / Vitest)
- **Tooling:** `scripts/**`, root `*.config.*`

*End of report.*
