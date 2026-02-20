# iWorkr Comprehensive Test Report

**Generated:** 2026-02-19  
**Scope:** Full system — Next.js (Web), Flutter (Mobile), Qase integration, Project Panopticon  
**Environment:** Local (macOS) + CI reference

---

## 1. Executive Summary

| Layer      | Suite                     | Tests | Passed | Failed | Notes                                            |
| ---------- | ------------------------- | ----- | ------ | ------ | ------------------------------------------------ |
| **Web**    | Vitest (unit)             | 10    | 10     | 0      | format, validation, StatusPill                   |
| **Web**    | Playwright setup          | 1     | 1\*    | 0\*    | \*Fails with E2E_USE_GOLDEN=1 (cookie size)      |
| **Web**    | Playwright smoke-core     | 1     | 1      | 0      | 14 core routes                                   |
| **Web**    | Playwright smoke-settings | 1     | 1      | 0      | 17 settings routes                               |
| **Web**    | Playwright auth-flow      | 5     | 5      | 0      | Login, magic link, redirect, Google              |
| **Web**    | Playwright functional     | 8     | 8      | 0      | Nav, command palette, widgets, job flow          |
| **Web**    | Playwright comprehensive  | 21    | 10     | 11     | CRUD 7 pass; spider + visual need baseline       |
| **Mobile** | Flutter unit + widget     | 12    | 12     | 0      | Auth, jobs, schedule, StatusPip, SchedulePreview |
| **Mobile** | Flutter integration       | 24    | —      | —      | Run on device/emulator; Qase reporter active     |

**Overall:** Web core (setup + smoke + auth + functional) **15/15** with default qa-test user. Comprehensive and visual require baseline run. Flutter unit/widget **12/12**. Integration tests require Android/iOS or macOS with credentials.

---

## 2. Test Inventory

### 2.1 Web — Vitest (Unit)

**Command:** `npm run test`

| File                                     | Tests                   |
| ---------------------------------------- | ----------------------- |
| `src/lib/format.test.ts`                 | 4 (formatCurrency)      |
| `src/lib/validation.test.ts`             | 2 (validateEmail)       |
| `src/components/ui/status-pill.test.tsx` | 4 (StatusPill variants) |

---

### 2.2 Web — Playwright (E2E)

**Commands:**

- Full core: `npx playwright test --project=setup --project=smoke-core --project=smoke-settings --project=auth-flow --project=functional`
- With Qase: `QASE_MODE=testops npx playwright test ...`
- Comprehensive: `npx playwright test --project=comprehensive` (after setup once)
- Golden User: `E2E_USE_GOLDEN=1` — **currently breaks setup** (Invalid cookie fields; token too large)

| Project            | File(s)                                  | Tests | Purpose                                                                                      |
| ------------------ | ---------------------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| **setup**          | `e2e/global-setup.ts`                    | 1     | Authenticate via Supabase, save `e2e/.auth/user.json`                                        |
| **smoke-core**     | `e2e/smoke-core.spec.ts`                 | 1     | SMOKE-001-CORE: 14 dashboard routes, no crash                                                |
| **smoke-settings** | `e2e/smoke-settings.spec.ts`             | 1     | SMOKE-001-SETTINGS: 17 settings routes                                                       |
| **auth-flow**      | `e2e/auth.spec.ts`                       | 5     | AUTH-001–005: login UI, email, magic link, redirect, Google                                  |
| **functional**     | `e2e/functional.spec.ts`                 | 8     | FUNC-001–008: nav, search, command palette, sidebar, shortcuts, refresh, widgets, job status |
| **comprehensive**  | `e2e/comprehensive/spider.spec.ts`       | 1     | SPIDER-001: scrape all `<a>`, visit each, assert 200 / no 404                                |
| **comprehensive**  | `e2e/comprehensive/crud_master.spec.ts`  | 7     | Jobs CRUD (Qase 1–4), Clients/Assets/Forms Read (Qase 5–7)                                   |
| **comprehensive**  | `e2e/comprehensive/visual_audit.spec.ts` | 12    | 10 screen snapshots (&lt;1% diff) + Obsidian background + typography                         |

**Total Playwright (listed):** 36 tests across 8 files.

---

### 2.3 Mobile — Flutter Unit & Widget

**Command:** `cd flutter && flutter test test/`

| File                                            | Tests             |
| ----------------------------------------------- | ----------------- |
| `test/unit/auth_provider_test.dart`             | 3                 |
| `test/unit/jobs_provider_test.dart`             | 3                 |
| `test/unit/schedule_provider_test.dart`         | 1                 |
| `test/widget/status_pip_golden_test.dart`       | 3                 |
| `test/widget/schedule_preview_golden_test.dart` | 4 (1 placeholder) |
| `test/widget_test.dart`                         | 1 (placeholder)   |

---

### 2.4 Mobile — Flutter Integration (Qase-enabled)

**Command:** `cd flutter && flutter test integration_test/app_test.dart`  
**With Qase:** Set `QASE_API_TOKEN` in environment.

| Suite               | File                           | Tests                                          |
| ------------------- | ------------------------------ | ---------------------------------------------- |
| Authentication      | `tests/auth_test.dart`         | 6 (AUTH-001–006)                               |
| Navigation          | `tests/navigation_test.dart`   | 7 (NAV-001–007)                                |
| Critical Operations | `tests/critical_ops_test.dart` | 7 (OPS-001–007)                                |
| Day in the Life     | `tests/day_in_life_test.dart`  | 2 (DAY-001–002)                                |
| Panopticon          | `tests/panopticon_test.dart`   | 2 (PAN-001 Widget Walker, PAN-002 Golden Path) |

**Golden Path** reports each step to Qase: Step 1 Login → Step 6 Back to list.  
**Test user:** `theo.caleb.lewis@gmail.com` / `lowerUPPER#123` (in `integration_test/config/test_config.dart`).

---

## 3. Run Commands Reference

| Goal                       | Command                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Web unit only              | `npm run test`                                                                                                               |
| Web E2E (core)             | `npx playwright test --project=setup --project=smoke-core --project=smoke-settings --project=auth-flow --project=functional` |
| Web E2E + Qase             | `QASE_MODE=testops npx playwright test --project=setup --project=smoke-core --project=auth-flow --project=functional`        |
| Web comprehensive          | `npx playwright test --project=comprehensive` (run after one successful setup)                                               |
| Web visual baselines       | `npx playwright test e2e/comprehensive/visual_audit.spec.ts --project=comprehensive --update-snapshots`                      |
| Flutter unit/widget        | `cd flutter && flutter test test/`                                                                                           |
| Flutter integration        | `cd flutter && flutter test integration_test/app_test.dart`                                                                  |
| Flutter integration + Qase | `QASE_API_TOKEN=xxx cd flutter && flutter test integration_test/app_test.dart`                                               |

---

## 4. Qase Integration

- **Project code:** IWORKR
- **Web:** `playwright-qase-reporter` in `playwright.config.ts`; run with `QASE_MODE=testops` and `QASE_API_TOKEN` (or from `.env.local`).
- **Mobile:** `integration_test/utils/qase_reporter.dart` — `createRun()`, `addResult()`, `completeRun()`; `qaseTestWidgets()` wraps each test; Golden Path sends step-wise results.
- **CI:** GitHub Secrets `QASE_API_TOKEN`; workflows pass it for Playwright and Flutter integration jobs.

---

## 5. Known Issues & Triage

| Issue                                     | Impact                                       | Workaround                                                                                                         |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **E2E_USE_GOLDEN=1** causes setup failure | Cookie value too large (Golden User session) | Use default qa-test user for CI; use Golden only where cookie size is acceptable or fix cookie splitting.          |
| **Spider (SPIDER-001)** can fail          | Timeout or link to broken route              | Run with existing auth; increase timeout if needed.                                                                |
| **Visual audit** 11 failures              | No golden snapshots yet                      | Run once: `npx playwright test e2e/comprehensive/visual_audit.spec.ts --project=comprehensive --update-snapshots`. |
| **Flutter integration on macOS**          | Keychain -34018 possible                     | Handled in `workspace_provider.dart`; run on Android/iOS for full pass.                                            |

---

## 6. CI / Nightly

- **Playwright:** `.github/workflows/playwright.yml` — setup, smoke-core, smoke-settings, smoke, auth-flow, functional, settings-audit, visual, dashboard/jobs/inbox/schedule/clients/finance/assets/forms/team/automations/integrations audits.
- **Flutter:** `.github/workflows/integration_tests.yml` — unit/widget on Ubuntu; integration on Android (API 34); iOS on push to main.
- **Qase:** Both workflows pass `QASE_API_TOKEN` when secret is set; results appear under project IWORKR.

---

## 7. Document History

| Date       | Change                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-19 | Initial comprehensive report: Vitest, Playwright (core + comprehensive), Flutter unit/widget + integration inventory; Qase; run commands; known issues. |

---

_End of report._
