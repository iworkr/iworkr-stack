# iWorkr Full Codebase Audit (Next.js + Flutter + Supabase)

Date: 2026-03-14  
Auditor: Codex agent (automated full-repo sweep + targeted manual verification)

## 1) Scope and Coverage

This audit traversed the full repository inventory and scanned all discovered files in the three requested codebases:

- Next.js/Web (`src`): **502 files**
- Flutter (`flutter/lib`): **226 files**
- Supabase (`supabase` migrations + functions): **144 files**

Coverage approach:

1. Full file inventory via recursive glob scans.
2. Whole-repo marker scan (`INCOMPLETE`, `TODO`, `FIXME`, `HACK`, `XXX`).
3. Static checks:
   - `pnpm lint`
   - `pnpm test` (Vitest)
   - `flutter analyze`
4. Targeted manual validation of active incomplete/integration comments.
5. Supabase schema/status verification and trigger presence checks.

## 2) Executive Status

Overall platform status: **Partially production-ready with known controlled gaps**.

- Test health: **Good** (`493/493` Vitest tests passing).
- Web compile health: **Build passes**, but lint baseline is currently very noisy.
- Flutter health: **Compiles/analyzes with 17 analyzer findings** (mixed info/warnings).
- Supabase backend: **Feature-rich and migration-heavy; key integrations marked with explicit `INCOMPLETE` trails where expected**.

## 3) Critical Findings (Highest Priority)

### A. Web lint baseline is high-risk for maintainability and release confidence

- `pnpm lint` result: **818 problems (359 errors, 459 warnings)**.
- Dominant issue class: `@typescript-eslint/no-explicit-any` (**238 occurrences** in lint output).
- Additional structural quality issues:
  - `react-hooks/set-state-in-effect` (**59 occurrences**)
  - `react-hooks/immutability` / purity patterns (**42 occurrences**)

Impact:

- Raises regression risk and slows safe refactoring.
- Hides new defects in noise.
- Makes CI gate hard to enforce incrementally.

### B. Training/operations workflows still contain active integration gaps

Confirmed incomplete gaps remain in production code paths:

- Convoy/Doppelgänger-adjacent UI features pending full UX completion.
- Compliance + webhook integrations depend on provider credentials and enrichment follow-up.
- Some mobile care execution screens still rely on placeholders for runtime context.

## 4) Automated Check Results

### Next.js / Web

- `pnpm test`: **PASS**
  - 8 test files, 493 tests all passing.
- `pnpm lint`: **FAIL**
  - 818 total findings (359 errors, 459 warnings).

### Flutter

- `flutter analyze`: **FAIL (17 findings)**, including:
  - `use_build_context_synchronously` in multiple screens
  - deprecated API usage in theme/background sync
  - some unused imports/params

### Supabase

- Migration graph is extensive and up to date through recent project migrations.
- Existing integration blockers are explicitly documented in-code with `INCOMPLETE` markers where external dependencies are required.

## 5) Incompletion and Integration Gap Register (Source-of-truth markers)

### Web (`src`)

1. `src/app/download/page.tsx`  
   `INCOMPLETE:TODO` Linux desktop artifact pipeline missing.
2. `src/app/dashboard/fleet/vehicles/page.tsx`  
   `INCOMPLETE:CONVOY` 360 inspection editor + Gantt canvas pending.
3. `src/app/api/compliance/dossier/route.ts`  
   `INCOMPLETE:PARTIAL` self-referential PDF hashing caveat.
4. `src/app/dashboard/compliance/audits/page.tsx`  
   `INCOMPLETE:PARTIAL` SMS second factor not fully wired.
5. `src/app/actions/fleet-convoy.ts`  
   `INCOMPLETE:CONVOY` live in-use GPS replay pending.
6. `src/app/actions/plan-reviews.ts`  
   `INCOMPLETE:SYNTHESIS` citation hover overlays pending.
7. `src/app/dashboard/care/plan-reviews/build/page.tsx`  
   `INCOMPLETE:SYNTHESIS` inline manager comments pending.
8. `src/app/dashboard/ai-agent/[agentId]/page.tsx`  
   `INCOMPLETE:TODO` extra AI agent type configuration UIs pending.
9. `src/app/vault/[token]/page.tsx`  
   `INCOMPLETE:PARTIAL` telephony/SMS OTP second factor pending.

### Flutter (`flutter/lib`)

1. `flutter/lib/features/care/screens/shift_debrief_screen.dart`  
   `INCOMPLETE:PARTIAL` fallback Rosetta template in use when assigned template absent.
2. `flutter/lib/features/care/screens/fleet_checkout_screen.dart`  
   `INCOMPLETE:CONVOY` 360 SVG defect map + mandatory photo capture pending.
3. `flutter/lib/features/finance/screens/create_invoice_screen.dart`  
   `INCOMPLETE` PDF preview edge-function wiring pending.

### Supabase Functions (`supabase/functions`)

1. `supabase/functions/webhooks-ingest/index.ts`  
   `INCOMPLETE:BLOCKED` provider webhook creds per tenant required.
2. `supabase/functions/webhooks-ingest/index.ts`  
   `INCOMPLETE:PARTIAL` Xero webhook enrichment follow-up call pending.
3. `supabase/functions/process-integration-sync-queue/index.ts`  
   `INCOMPLETE:BLOCKED` Xero token vault + tenant routing required.

## 6) New In-Code Audit Comments Added in This Audit

To satisfy explicit audit-trail requirements, standardized `INCOMPLETE` comments were added/normalized in active code:

1. `src/app/actions/sms.ts`
   - Replaced plain TODO with `INCOMPLETE:PARTIAL` for production store URL wiring.
2. `flutter/lib/features/care/screens/active_shift_hud_screen.dart`
   - Added `INCOMPLETE:PARTIAL` for placeholder `timeEntryId` usage.
3. `flutter/lib/features/care/screens/record_observation_screen.dart`
   - Added `INCOMPLETE:PARTIAL` for missing participant context wiring.
4. `flutter/lib/features/care/screens/sentinel_screen.dart`
   - Added `INCOMPLETE:TODO` for settings/history action not wired.

## 7) Integration Status Matrix

- Stripe/Billing flows: implemented and present; standard runtime/env dependencies apply.
- Care ecosystem modules (Rosetta/Aegis/Sentinel/Convoy): broadly integrated, with specific UX/data-path incompletions noted above.
- Xero/3rd-party sync: partially integrated; hard blockers remain at credential + tenant token routing layer.
- Compliance vault/audits: functional core present; second-factor hardening still partially wired.
- Fleet + mentorship coupling: architecture present, but certain advanced visuals and telemetry UX remain pending.

## 8) Recommended Remediation Plan (Ordered)

### P0 (Immediate)

1. Establish lint debt strategy (baseline snapshot + no-new-debt gate) and reduce critical errors in shared stores/hooks first.
2. Resolve `timeEntryId` placeholder path in active shift HUD before broader mobile rollout.
3. Complete tenant credential/token routing for Xero webhook/sync pathways.

### P1 (Near-term)

1. Finish Convoy visual inspection tooling (mobile 360 defect logging + web Gantt/inspection canvas).
2. Complete compliance second-factor end-to-end provider wiring.
3. Replace fallback Rosetta template path with guaranteed assigned-template contract.

### P2 (Planned)

1. Linux desktop build distribution artifacts.
2. Expanded AI agent type configuration panels.
3. Sentinel settings/history UX route wiring.

## 9) Audit Conclusion

The codebase is large, active, and functionally broad. The architecture across Next.js, Flutter, and Supabase is substantially implemented, with explicit transparency around known gaps. The main technical risk is current web lint debt volume; the main product risks are the identified integration blockers and incomplete UX modules already marked in code.

This report should be treated as the current authoritative audit snapshot for 2026-03-14.
