# Project Panopticon QA Audit

Generated: 2026-03-14T13:44:29.646Z

## Matrix Snapshot

| Layer | Command | Status |
|---|---|---|
| Supabase RLS/DB | `npm run test:db:rls` | pass (8/8) |
| Web Golden Thread | `npm run test:e2e:golden-thread` | pass |
| Full Web E2E | `npm run test:e2e` | pending |
| Flutter Integration | `flutter test integration_test/app_test.dart` | pending |

## Mandatory Gates

- [x] Zero critical RLS bypasses in pgTAP suite
- [x] Golden thread web tests pass
- [ ] Flutter integration suite passes for critical ops
- [ ] DLQ malformed payload routing verified

## Findings (Current)

1. `resolved` Critical RLS boundary failures were remediated.
   - `npm run test:db:rls` now passes `8/8`.
   - Vault/audit/DLQ surfaces are now deny-by-default for `anon` and non-privileged access.

2. `resolved` Vault RPC hardening completed.
   - `SECURITY DEFINER` retained with explicit `search_path`.
   - `integration_encryption_key` and tenant secret RPCs are now gated to service-role execution path.

3. `low` Golden-thread setup emitted a non-fatal seed warning.
   - Warning: `...single(...).catch is not a function` in `e2e/global-setup.ts` seed path.
   - Impact: golden-thread still passes; seed fallback path may skip optional fixture rows.

## Execution Evidence

- `npm run test:db:rls` => pass (`8/8`).
- `npm run test:e2e:golden-thread` => pass (`2 passed`).
- `npm run test:panopticon` => pass (DB + web golden-thread).

## Production Deployment

- Supabase production migration applied via MCP:
  - Project: `olqjuadvseoxpfjzlghb` (`iWorkr`)
  - Migration: `107_panopticon_rls_hardening`
  - Result: success
- Vercel production deployment:
  - Inspect: `https://vercel.com/aiva-io/iworkr-stack/9zE6PGBsDxQUeqwu5a1SLUkNbcTw`
  - Production URL: `https://iworkr-stack-cunfoi2kf-aiva-io.vercel.app`

## Notes

- This report is generated automatically by `scripts/generate-panopticon-audit.mjs` and enriched with live run results.
