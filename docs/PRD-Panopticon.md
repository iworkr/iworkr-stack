# PRD: Project Panopticon (Global QA Matrix)

Document version: 2026-03-14  
Codename: Project Panopticon (The All-Seeing Eye)

## Scope

- Agentic testing protocols with deterministic state setup.
- Supabase database and RLS validation using pgTAP.
- Next.js golden-thread E2E validation with Playwright.
- Flutter critical-path integration enforcement.
- CI/CD quality gate that blocks unsafe merges.
- Automated audit briefing artifact generation.

## Implemented Deliverables

1. **Supabase RLS/DB test suite**
   - Added `supabase/tests/pgtap/panopticon_rls.sql`.
   - Added `scripts/run-pgtap.sh` to start local Supabase, reset schema, and execute pgTAP.
   - Added `npm run test:db:rls`.

2. **Web golden-thread suite**
   - Added `e2e/golden-threads/doppelganger-to-xero.spec.ts`.
   - Added Playwright project `panopticon-golden` in `playwright.config.ts`.
   - Added `npm run test:e2e:golden-thread`.

3. **Quality gate workflow**
   - Added `.github/workflows/panopticon-quality-gate.yml`.
   - Stages:
     - Supabase RLS pgTAP
     - Web golden-thread E2E
     - Flutter critical integration
     - Audit artifact generation

4. **Audit protocol**
   - Added `scripts/generate-panopticon-audit.mjs`.
   - Added `npm run audit:panopticon`.
   - Live report generated at `audit-reports/panopticon-audit-2026-03-14.md`.

## Current Verification Status

- Golden-thread web test: pass.
- Supabase RLS suite: blocked by local migration dependency ordering (`gin_trgm_ops` requires `pg_trgm` before index creation).
- Full web and mobile matrix: wired in CI and pending full run after DB migration blocker is corrected.

## Definition of Done Mapping

- [x] Dedicated QA quality gate workflow in CI.
- [x] Deterministic web golden-thread E2E test in repository.
- [x] Deterministic DB/RLS test harness in repository.
- [x] Automated audit generation integrated into workflow.
- [ ] Local DB migrations fully green for pgTAP execution.
- [ ] Full CI run with all Panopticon jobs green.
