# Project Zenith Release Audit

Generated: 2026-03-14T16:37:34.969Z

## Matrix Snapshot

| Layer | Command | Status |
|---|---|---|
| Supabase RLS/DB | `npm run test:db:rls` | pass (8/8) |
| Web Golden Thread | `npm run test:e2e:golden-thread` | pass |
| Full Web E2E | `npm run test:e2e` | pass |
| Flutter Integration | `patrol test -t integration_test` | fail |

## Mandatory Gates

- [x] Seed defect resolved in `e2e/global-setup.ts`
- [x] Supabase startup/reset stability hardened in `scripts/run-pgtap.sh`
- [x] DLQ routing e2e test added (`e2e/aegis-dlq.spec.ts`)
- [x] Gateway and Convoy web e2e suites added
- [x] RLS suite remains green after Zenith changes

## Notes

- This report is generated automatically by `scripts/generate-zenith-audit.mjs`.
