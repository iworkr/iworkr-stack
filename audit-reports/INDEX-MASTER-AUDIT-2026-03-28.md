# Master audit index — iWorkr full application

**Last consolidated:** 2026-03-28  
**Purpose:** Single entry point for **launch risk**, **security**, **incompletions**, and **domain audits**. Use this file to navigate; deep dives live in linked documents.

---

## 1. Canonical audits (read these first)

| Document | Focus |
|----------|--------|
| [FULL-PROJECT-LAUNCH-AUDIT-2026-03-27.md](FULL-PROJECT-LAUNCH-AUDIT-2026-03-27.md) | **P0–P3** launch blockers: migrations bundle, middleware env, public site APIs, multi-tenant `sites`, Flutter/Electron, CI hygiene |
| [CODE-REVIEW-INCOMPLETIONS-2026-03-28.md](CODE-REVIEW-INCOMPLETIONS-2026-03-28.md) | **Explicit INCOMPLETE/TODO**, silent `.catch` index, `getWorkspaceId` gap, verification checklist |
| [API-SECURITY-AUDIT-2026-03-22.md](API-SECURITY-AUDIT-2026-03-22.md) | API / route hardening (historical; cross-check with current `src/app/api`) |
| [SQL-MIGRATION-DEEP-AUDIT-2026-03-22.md](SQL-MIGRATION-DEEP-AUDIT-2026-03-22.md) / [SUPABASE-MIGRATION-SCHEMA-AUDIT-2026-03-22.md](SUPABASE-MIGRATION-SCHEMA-AUDIT-2026-03-22.md) | Schema / migration ordering |
| [EDGE-FUNCTIONS-DEEP-AUDIT-2026-03-22.md](EDGE-FUNCTIONS-DEEP-AUDIT-2026-03-22.md) | Supabase Edge Functions behavior |
| [FLUTTER-FULL-AUDIT-2026-03-26.md](FLUTTER-FULL-AUDIT-2026-03-26.md) | Mobile app gaps |

---

## 2. Domain & feature audits (51 files in `audit-reports/`)

Area-specific reports include: **finance**, **forms**, **jobs**, **schedule**, **team**, **assets**, **integrations**, **inbox**, **automations**, **clients**, **dashboard**, plus **Argus** / **Aegis** / **Zenith** / **Panopticon** themed reviews.  
See [Glob listing](.) or search `audit-reports/*audit*.md` — filenames are self-describing (`finance-audit.md`, `DEEP-SERVER-ACTIONS-AUDIT-2026-03-22.md`, etc.).

---

## 3. Full-app coverage matrix (2026-03-28 snapshot)

| Layer | Audited in docs | Code status headers | Open risks (summary) |
|-------|-----------------|----------------------|------------------------|
| **Next.js `src/`** | Launch + API + server actions | Yes (waves A–E) | Middleware fail-open; partial edge RBAC; `any` in actions |
| **Supabase SQL** | Migration audits | `-- @migration` on migrations | `BUNDLED_ALL_MIGRATIONS.sql`; lexicographic order |
| **Edge Functions** | Edge audits | JSDoc `@module` | JWT policy in Dashboard; high function count |
| **Flutter `lib/`** | Flutter full audit | `// @module` file tags | PDF/HTML INCOMPLETE; sync throws |
| **Electron** | Launch audit | JSDoc | Remote shell; protocol URL logging |
| **E2E / tests** | Testing report, golden threads | `@module` | Coverage ≠ all routes |
| **Scripts / CI** | Various | Tagged | Lint baseline may mask drift |

---

## 4. Security inventory — `createAdminSupabaseClient` (web)

The **service-role** client bypasses RLS. Acceptable only behind **super-admin checks**, **signed webhooks**, or **validated public workflows** (e.g. form submit after template/workspace check).

**High-attention call sites (non-exhaustive):**

| Pattern | Examples | Risk if mis-gated |
|---------|----------|---------------------|
| Super-admin / Olympus | `superadmin.ts`, `aegis.ts`, `telemetry.ts`, `olympus-*.ts` | Cross-tenant data exposure |
| Public / embedded | `api/sites/form-schema` (**P0** — unauthenticated read), `api/sites/form-submit` (validated but abuse) | Enumeration, spam |
| Compliance | `api/compliance/vault`, `verify` | Must verify org + auth |
| Telemetry export | `api/telemetry/export` | Uses `verifySuperAdmin` + **duplicate** `SUPER_ADMIN_EMAILS` list (`theo@iworkrapp.com`) — **should match single source** (`middleware` / env) |

**Action:** Centralize super-admin allowlist (`process.env` + DB `is_super_admin`); remove hardcoded emails from multiple files.

---

## 5. Public & webhook-style API routes (inventory)

These are **intentionally** low-session or secret-based; each must stay documented and tested:

- **Token / signed:** `api/invoices/public/*`, `api/quotes/*/accept|decline`, portal magic links  
- **Stripe / billing:** `api/stripe/*`, webhooks  
- **Twilio / Comms:** `api/twilio/*`  
- **Automation:** `api/automation/execute`, `cron` — **set `AUTOMATION_SECRET`**  
- **E2E only:** `api/e2e/seed-staging` — blocked in production (`VERCEL_ENV`)  
- **Revalidate / internal:** `api/revalidate` — secret header  

Cross-check [API-SECURITY-AUDIT-2026-03-22.md](API-SECURITY-AUDIT-2026-03-22.md) when changing routes.

---

## 6. Automated verification (from `package.json`)

| Command | What it exercises |
|---------|-------------------|
| `pnpm build` | Next.js production compile |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (unit) |
| `pnpm test:e2e` | Playwright (subset projects) |
| `pnpm test:db:rls` | pgTap RLS (`scripts/run-pgtap.sh`) |
| `pnpm test:aegis:edge` | Edge function Vitest config |
| `flutter analyze` / `flutter test` | Mobile (run in `flutter/`) |

**Note:** No single command proves “full app” — combine build + lint + targeted e2e + RLS tests before release.

---

## 7. Consolidated open backlog (priority order)

1. **P0:** Public `form-schema` authentication / signing; migration strategy for `BUNDLED_ALL_MIGRATIONS.sql`.  
2. **P0:** Middleware **fail-closed** when Supabase env missing.  
3. **P1:** `sites.ts` `getWorkspaceId` — active org + membership (see CODE-REVIEW incompletions).  
4. **P1:** ~~Single **super-admin** configuration~~ — **done** (`src/lib/super-admin.ts` + `SUPER_ADMIN_EMAILS` env). ~~Shared verify~~ — **done** (`src/lib/super-admin-server.ts` → `verifySuperAdminServer()`).  
5. **P1:** `AUTOMATION_SECRET` in production.  
6. **P2:** Replace silent catches on ledger / domains / analytics (listed in CODE-REVIEW doc).  
7. **P2:** Flutter invoice PDF + knowledge HTML + `package_info_plus` version.  
8. **P3:** Dashboard “coming soon” copy — product tracking.

---

## 8. Document maintenance

When you close an item: update [CODE-REVIEW-INCOMPLETIONS-2026-03-28.md](CODE-REVIEW-INCOMPLETIONS-2026-03-28.md) and trim §7 here.  
When a new **P0** appears: add to **FULL-PROJECT-LAUNCH-AUDIT** executive summary first.

---

*End of master index.*
