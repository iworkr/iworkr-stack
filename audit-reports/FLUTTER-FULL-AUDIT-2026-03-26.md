# iWorkr Flutter Full Audit
Date: 2026-03-26
Scope: `flutter/lib`, `flutter/integration_test`
Method: static analyzer sweep + targeted architectural/code review

## Executive Status
- **Build health:** Failing.
- **Analyzer result:** `flutter analyze lib` reports **129 issues** (including multiple blocking compile errors).
- **Primary risk:** Current Flutter app state is not release-safe due to compile-time blockers in core infra and key feature modules.

## Severity Legend
- **P0:** Shipping blocker / compile-break / runtime security or data-integrity risk.
- **P1:** High-risk defect or major capability gap.
- **P2:** Quality debt that increases regressions or maintenance cost.

---

## P0 Findings (Ship Blockers)

### P0-1: Drift schema/generation mismatch breaks core database layer
**Area:** Offline DB + sync foundation  
**Files:** `flutter/lib/core/database/app_database.dart`, `flutter/lib/core/database/app_database.g.dart`, `flutter/lib/core/database/sync_engine.dart`

**What is happening**
- `LocalComplianceRules` table is referenced in handwritten DB code and sync hydration.
- Generated drift file does not include `localComplianceRules` table accessor/types.
- This causes undefined symbols and type resolution failures across DB and sync paths.

**Impact**
- Compile failure.
- Offline sync and compliance hydration pipeline is broken.
- Any feature depending on compliance rules cannot reliably run offline.

**Observed symptoms**
- `Undefined name 'localComplianceRules'`
- Missing `LocalComplianceRuleData` and `LocalComplianceRulesCompanion` types.

---

### P0-2: RASP integration is non-compiling and uses placeholder production values
**Area:** Security hardening / anti-tamper  
**Files:** `flutter/lib/core/services/rasp_service.dart`, `flutter/lib/core/services/supabase_service.dart`

**What is happening**
- `ThreatCallback` is called with named params not present in current `freerasp` API version (compile break).
- Security-critical placeholders are still committed (`PLACEHOLDER_SIGNING_CERT_HASH`, `PLACEHOLDER_TEAM_ID`, cert hash placeholder in Supabase pinning comments).

**Impact**
- Compile failure in app security module.
- If adjusted to compile without replacing placeholders, security claims are misleading and operationally incomplete.

---

### P0-3: Proposal Studio has syntax and symbol errors
**Area:** Revenue flow / quotes  
**File:** `flutter/lib/features/quotes/screens/proposal_studio_screen.dart`

**What is happening**
- Invalid map closure syntax inside `_submitProposal` causes parse errors.
- Invalid icon getter (`PhosphorIconsLight.package_`) causes unresolved symbol.

**Impact**
- Compile failure in quote/proposal flow.
- Blocks a key monetization pipeline in mobile UX.

---

### P0-4: Sync indicator dead-letter UI cannot compile
**Area:** Sync UX + DLQ visibility  
**File:** `flutter/lib/core/widgets/sync_indicator.dart`

**What is happening**
- Uses `SyncQueueData`, `appDatabaseProvider`, and `OrderingTerm` without required imports/type visibility.

**Impact**
- Compile failure in sync indicator path.
- Operationally removes visibility into failed queue items even after compile patching if wiring remains incomplete.

---

### P0-5: Safety screen icon symbol mismatch
**Area:** Safety workflow UI  
**File:** `flutter/lib/features/safety/screens/swms_assessment_screen.dart`

**What is happening**
- `PhosphorIconsBold.mapPinX` is unresolved with current icon package/version.

**Impact**
- Compile failure in SWMS assessment screen.
- Safety/compliance route is blocked at build time.

---

## P1 Findings (High Risk)

### P1-1: Team invite path appears schema-diverged from web stack and swallows all backend errors
**Area:** Workforce onboarding  
**File:** `flutter/lib/core/services/team_provider.dart`

**What is happening**
- Mobile writes to `workspace_invites` with `organization_id`.
- Web-side architecture in this repo centers on `organization_invites` + branch-aware invite handling.
- `catch (_) => false` discards actual error context.

**Impact**
- High probability of invite failures or data divergence.
- Debugging production failures is difficult due to swallowed exception details.

**Recommendation**
- Align table and payload contract with canonical backend invite model.
- Return structured failures (`error code`, `message`) to UI.

---

### P1-2: Listener lifecycle hygiene gaps in app bootstrap and router auth notifier
**Area:** Navigation/runtime stability  
**Files:** `flutter/lib/main.dart`, `flutter/lib/core/router/app_router.dart`

**What is happening**
- Auth and route stream listeners are attached without retaining/canceling subscriptions.
- Router refresh notifier listens to auth stream but does not expose teardown for subscription.

**Impact**
- Potential listener leaks and duplicate event handling across lifecycle/hot restarts.
- Hard-to-debug navigation jitter, repeated sync calls, or duplicate side effects.

**Recommendation**
- Store `StreamSubscription` handles and cancel in `dispose`.
- Use provider disposal hooks for notifier-bound listeners.

---

### P1-3: Integration test suite is currently red due to config contract drift
**Area:** QA automation confidence  
**Files:** `flutter/integration_test/config/test_config.dart`, `flutter/integration_test/tests/aegis_compliance_test.dart`, `flutter/integration_test/tests/aegis_offline_test.dart`

**What is happening**
- Tests reference `TestConfig.workerEmail` / `workerPassword`.
- Config only provides `testEmail` / `testPassword`.

**Impact**
- Integration test compile/runtime failures.
- CI confidence reduced for critical mobile flows.

---

## P2 Findings (Quality Debt / Incompletions)

### P2-1: Explicit incomplete TODO trails in production feature screens
**Files:** `flutter/lib/features/care/screens/sentinel_screen.dart`, `flutter/lib/features/care/screens/participants_screen.dart`, `flutter/lib/features/knowledge/screens/article_viewer_screen.dart`

**Examples**
- Sentinel settings action explicitly marked non-functional.
- Participant quick-call action not wired.
- Article HTML rendering marked for future replacement.

**Impact**
- User-visible dead actions and partial experiences.

---

### P2-2: Deprecated API surface and warning load is high
**Areas:** theming, color ops, background sync/testing APIs  
**Symptoms**
- Widespread `withOpacity` deprecations.
- Deprecated workmanager/debug and patrol APIs.

**Impact**
- Upgrade friction and hidden behavior changes in future SDK bumps.

---

### P2-3: Dependency lag is broad
**Observation**
- Analyzer run reports a large set of outdated packages (including major-version deltas in core ecosystem libs).

**Impact**
- Increased risk of abrupt breakage during future upgrades.
- Security patch intake may lag.

---

## Architecture Sweep Notes

### Strengths observed
- Clear feature modularization under `features/*`.
- Strong instrumentation intent (telemetry hooks, sync queue concept, offline primitives).
- Multi-domain capability breadth (care, jobs, routes, finance, safety) is substantial.

### Friction points
- Generated-code synchronization discipline (Drift) is currently broken.
- Security hardening modules are partially implemented with placeholder values.
- Error handling in some service layers is intentionally silent, reducing operability.

---

## Recommended Remediation Plan (Order of Operations)

1. **Build stabilization branch (P0-only)**
   - Resolve all compile blockers in:
     - `app_database` / `app_database.g.dart` / `sync_engine`
     - `rasp_service`
     - `proposal_studio_screen`
     - `sync_indicator`
     - `swms_assessment_screen`
   - Gate: `flutter analyze lib` returns zero **errors**.

2. **Security completion pass**
   - Replace all placeholder security identifiers/hashes.
   - Validate anti-tamper callbacks against pinned `freerasp` API.
   - Verify pinning strategy semantics and production behavior.

3. **Contract alignment pass**
   - Align mobile invite table/payload with canonical backend schema.
   - Add structured error propagation from team invite API path.

4. **Listener lifecycle pass**
   - Add deterministic subscription cancellation for app/router listeners.
   - Add regression test for duplicate auth event handling.

5. **Test harness repair**
   - Fix `TestConfig` naming mismatch.
   - Re-run integration smoke suite.

6. **Debt burn-down**
   - Resolve high-volume deprecations (`withOpacity`, deprecated APIs).
   - Close or track TODO incompletions with explicit issue IDs.

---

## Suggested Verification Gates

- `flutter analyze lib` (no errors, warning budget agreed).
- `flutter test` (unit/widget baseline).
- `flutter test integration_test` (or patrol subset) with fixed test config.
- Manual smoke:
  - auth login/logout
  - invite member flow
  - quote/proposal open + submit path
  - sync indicator + DLQ route
  - SWMS safety screen

---

## Bottom Line
- The Flutter app has strong product breadth, but **current branch quality is below release threshold** due to multiple P0 compile blockers and incomplete security hardening placeholders.
- Immediate focus should be **build integrity first**, then **security hardening completion**, then **schema/contract alignment** and **test reliability restoration**.

---

## Mobile-Vanguard Execution Update (same day)

### Implemented
- Fixed Proposal Studio compile breaks:
  - corrected malformed map construction in `_submitProposal`
  - replaced invalid `PhosphorIconsLight.package_` with `PhosphorIconsLight.package`
  - wired `p_options` payload into `win_proposal` RPC call
- Fixed RASP compile issues by aligning callback names with current `freerasp` API and moved signing values to build-time `--dart-define` (`SIGNING_CERT_HASH`, `IOS_TEAM_ID`).
- Regenerated Drift outputs with:
  - `flutter pub run build_runner build --delete-conflicting-outputs`
- Fixed database type mismatch (`LocalComplianceRuleData` -> `LocalComplianceRule`) across DB and Cerberus validator.
- Fixed listener lifecycle leaks:
  - auth stream subscription disposal in router notifier
  - auth + FCM pending-route subscription cancellation in app root state
- Fixed sync indicator compile path by importing required DB/provider/order types with non-ambiguous drift import.
- Fixed SWMS icon mismatch (`mapPinX` -> `warningCircle`).
- Aligned team invite API path toward canonical org invites:
  - moved insert target to `organization_invites`
  - added `branch_id` payload support
  - replaced swallowed bool failures with structured `TeamOperationResult`
- Repaired integration test config drift by adding `workerEmail`, `workerPassword`, `adminEmail`, `adminPassword`.
- Added branch-aware route query filtering in route optimizer provider (`jobs.branch_id`).
- Removed additional warning debt in touched files (unused imports/fields and TODO dead action in sentinel app bar).

### Verification outcomes
- `flutter analyze lib`:
  - before: compile-failing (hard errors)
  - after: **0 compile errors**, warnings/info debt remains (`71 issues`)
- `flutter test`: **passing** (unit/widget suite green)
- `flutter test integration_test/... -d macos`:
  - build now proceeds after macOS target updates
  - execution is blocked by Patrol binding mode mismatch when invoked via `flutter test` (requires Patrol runner flow)

### Remaining release blockers to close for strict “zero-state”
- Analyzer warning/info backlog (not compile errors), dominated by:
  - widespread `withOpacity` deprecation migrations
  - async-context lint fixes
  - minor unused symbols
- Patrol integration execution path should run through Patrol-native command flow in CI (not raw `flutter test`) to avoid binding conflict.
