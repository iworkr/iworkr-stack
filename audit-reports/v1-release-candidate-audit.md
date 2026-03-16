# iWorkr V1.0 Release Candidate Audit

Date: 2026-03-15  
Codename: Project Monolith (The Final Gateway)

## Matrix Snapshot

| Layer | Command | Status |
| --- | --- | --- |
| Supabase RLS/DB | `npm run test:db:rls` | pass (8/8) |
| Web Golden Thread | `npm run test:e2e:golden-thread` | pass |
| Full Web E2E | `npm run test:e2e` | pass |
| Flutter Integration | `npm run test:mobile` | pass |

## Monolith Standardization Outcomes

- Added deterministic Patrol wrapper `scripts/run-patrol-tests.sh`:
  - boots and waits for an available iOS simulator
  - forces Patrol device targeting by simulator UDID
  - avoids accidental physical-device binding
- Kept Patrol import-shim bootstrapping via `flutter/scripts/prepare_patrol_env.sh`.
- Added root aliases for unified DX in `package.json`:
  - `test:mobile`
  - `test:mobile:all`
  - `test:all`
- Aligned CI parity in `.github/workflows/zenith-gate.yml`:
  - mobile gate now uses `npm run test:mobile`
  - local and CI share the same execution path end-to-end
- Maintained iOS Patrol infrastructure:
  - `RunnerUITests` target + shared scheme
  - `flutter/ios/RunnerUITests.m` runner bridge
  - Podfile integration for UI test target inheritance

## Notes

- Final release command chain validated with standardized aliases:
  - `npm run test:all`
  - `npm run audit:zenith`
- Local DX verification complete:
  - `npm run test:mobile` exits `0` from repository root and runs all three Patrol suites on simulator UDID targeting.
