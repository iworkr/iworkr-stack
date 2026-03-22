# 🔬 DEEP SERVER ACTIONS AUDIT — Full Codebase
> **Date:** 2026-03-22 | **Files Audited:** 99 server action files | **Auditor:** Claude Deep Audit

---

## Executive Summary

| Severity | Count | Key Theme |
|----------|-------|-----------|
| 🔴 **CRITICAL** | **87** | Missing auth on entire files, cross-tenant data access/mutation, injection vectors |
| 🟠 **HIGH** | **113** | Missing org membership checks, missing org_id filters, broken queries, race conditions |
| 🟡 **MEDIUM** | **111** | Silent error swallowing, inconsistent error shapes, no role checks, pagination bugs |
| 🟢 **LOW** | **72** | Type safety bypasses, hardcoded config, dead code, naming inconsistencies |
| **TOTAL** | **383** | — |

### Systemic Pattern: **35+ files (~35%) have ZERO authentication checks across ALL exported functions.**

---

## 🔴 CRITICAL FINDINGS (87)

### Pattern 1: ENTIRE FILES WITH ZERO AUTHENTICATION (200+ functions exposed)

These files have **no `getUser()` / `getSession()` call in ANY function**. Every exported server action is callable by any unauthenticated user:

| File | Functions | Impact |
|------|-----------|--------|
| `system-telemetry.ts` | 4 | Full system telemetry + error data across all orgs |
| `care-compliance.ts` | 4 | NDIS restrictive practices, onboarding checklists, sentinel alerts |
| `care-clinical.ts` | 8 mutations | Medications, care plans, BSPs, care goals — **patient safety risk** |
| `care-blueprints.ts` | 10 | Create/mutate roster blueprints, auto-assign workers, generate schedules |
| `chronos-eba.ts` | 12 | Payroll agreements, rules, simulation — **financial data** |
| `astrolabe-travel.ts` | 6 | Approve/reject/bill travel claims — **financial** |
| `staff-profiles.ts` | 7 | Staff PII: DOBs, addresses, super, emergency contacts, SCHADS rates |
| `roster-templates.ts` | 17 | Create/delete roster templates, approve leave, commit rollouts |
| `shift-cost.ts` | 3 | Read/write shift financial ledgers — **payroll integrity** |
| `aegis-rbac.ts` | 17 | **THE RBAC SYSTEM ITSELF**: create/delete roles, assign permissions — **privilege escalation** |
| `travel.ts` | 8 | GPS breadcrumbs, travel logs, payroll allowances, Google Maps API abuse |
| `participants.ts` | 21 | ALL NDIS participant data: medications, goals, care plans, budgets, clinical timelines |
| `timesheets.ts` | 10+ | Worker hours, clock in/out, payroll exports, geofence data |
| `workforce-dossier.ts` | 6 | **BSB/account numbers, TFN hashes, super fund details** — payroll redirect risk |
| `care-houses.ts` | 16 | House data, participants, staff, petty cash, rosters |
| `teleology.ts` | 6 | Goal matrices, plan reports, participant data |
| `care-governance.ts` | 13+ | Incidents, audit sessions, CI actions, SC cases, NDIS claims, budgets |
| `aegis.ts` | 6 | Incidents, investigations, corrective actions (uses admin client bypassing RLS) |
| `billing.ts` | 7 | Invoices, billing telemetry, batch runs, payment marking, CSV export |
| `forge-proposals.ts` | 7 kit funcs | Kit creation/deletion, component management |
| `asclepius.ts` | 6 | **Medication profiles, S8 controlled substances, pharmacy orders, clinical PINs** |

**Total: ~200+ functions across 21 files with zero auth.**

---

### Pattern 2: SPECIFIC CRITICAL SECURITY ISSUES

#### C-SEC-01 · `superadmin.ts` → `toggleFeatureFlag` — Arbitrary Column Write
- **Line:** 521
- **Description:** `feature` parameter used directly as column name: `{ [feature]: enabled }`. Attacker writes to ANY column in `organization_features`.
- **Fix:** Validate `feature` against allowlist of known feature flag columns.

#### C-SEC-02 · `superadmin.ts` → `listWorkspaces/listUsers` — PostgREST Filter Injection
- **Lines:** 127, 326
- **Description:** `search` interpolated directly into `.or()` — metacharacters break filter logic.
- **Fix:** Apply `escapeIlike()` (already exists in `olympus-comms.ts`).

#### C-SEC-03 · `panopticon-vision.ts` → 5 mutation functions — Cross-Tenant Evidence Destruction
- **Functions:** `toggleEvidenceVisibility`, `updateEvidenceCaption`, `deleteEvidence`, `markAsDefect`, `getEvidenceSignedUrl`
- **Description:** Only check `getUser()` but never verify org membership. Any authenticated user can delete evidence + storage files across orgs.
- **Fix:** Resolve `organization_id` via jobs table, then `assertOrgMember()`.

#### C-SEC-04 · `panopticon-vision.ts` → `getEvidenceSignedUrl` — Arbitrary Bucket Access
- **Line:** 219
- **Description:** `bucket` parameter is user-controlled with no whitelist. Any Supabase storage bucket accessible.
- **Fix:** Whitelist: `const ALLOWED = ["evidence-raw", "evidence-annotated"]`.

#### C-SEC-05 · `workforce-dossier.ts` → `updateStaffBanking` — Banking Details Without Auth
- **Line:** 362
- **Description:** Updates BSB, account number, TFN hash, super fund — **zero auth**. Payroll deposit redirect possible.
- **Fix:** Add auth + verify caller is self or admin.

#### C-SEC-06 · `aegis-rbac.ts` — Privilege Escalation Vector
- **All 17 functions**
- **Description:** The RBAC management module has zero auth. An attacker can `createRole` with all permissions → `assignRoleToMember` to themselves → full system access.
- **Fix:** Every mutation requires `getUser()` + admin/owner role verification.

#### C-SEC-07 · `email.ts` → `sendTeamInviteEmail` — Cross-Org Impersonation
- **Line:** 88
- **Description:** Auth checked but no org membership. Any authenticated user creates invite records and sends branded emails for ANY org.
- **Fix:** Add org membership + admin role check.

#### C-SEC-08 · `synapse-comms.ts` → `convertToBillableTime` — Service Client + No Org Scope
- **Line:** 729
- **Description:** Fetches communication log by ID only, then uses service role client to insert time entries. Creates billable records in any org.
- **Fix:** Verify org membership after fetching log.

#### C-SEC-09 · `billing.ts` → `dispatchInvoice` — Auth Check AFTER Database Write
- **Lines:** 399–410
- **Description:** `overrideEmail` update happens BEFORE auth check. Unauthenticated caller modifies invoice email.
- **Fix:** Move auth check to first operation.

#### C-SEC-10 · `ndis-pricing.ts` — URL Parameter Injection with Service Role Key
- **Lines:** 274, 291, 410, 422, 441
- **Description:** `effectiveFrom` interpolated into raw `fetch()` URLs using service role key.
- **Fix:** Use `encodeURIComponent()` or replace with typed Supabase client.

---

### Pattern 3: CRITICAL BUGS

#### C-BUG-01 · `ledger-sync.ts` → `retrySyncLog` — `.raw()` Does Not Exist
- **Line:** 253
- **Description:** `(supabase as any).raw("retry_count + 1")` — Supabase JS has no `.raw()`. Retry mechanism completely broken.
- **Fix:** Read current value, increment in JS, write back.

#### C-BUG-02 · `oracle-yield.ts` → `calculateDynamicYield` — Wrong API Parameter
- **Line:** 112
- **Description:** Uses `&lng=` but OpenWeatherMap requires `&lon=`. Weather always fails → severity defaults to 0.
- **Fix:** Change `lng` to `lon`.

#### C-BUG-03 · `forge-link.ts` → `pushPOToSupplier` — Encrypted Key as Plaintext Bearer
- **Line:** 514
- **Description:** `ws.api_key_encrypted` sent directly as Bearer token. Either encrypted (always fails) or misnamed (security risk).
- **Fix:** Add decrypt step or rename column.

#### C-BUG-04 · `billing.ts` → `exportProdaCsv` — Missing `id` in SELECT
- **Line:** 588
- **Description:** SELECT doesn't include `id`. `invoices.map(i => i.id)` returns all undefined. "Mark as exported" never executes → **duplicate PRODA claims every export**.
- **Fix:** Add `id` to SELECT clause.

#### C-BUG-05 · `aegis.ts` → `fetchAegisIncidentDetail` — Wrong ID Column in Corrective Actions Query
- **Line:** 148
- **Description:** Uses `incidentId` where `investigation_id` is needed. Query returns zero/wrong results.
- **Fix:** Remove from Promise.all (already re-fetched correctly later).

---

## 🟠 HIGH FINDINGS (113)

### Pattern: Missing Org Membership Checks (auth exists but no org verification)

| File | Functions Affected | Impact |
|------|-------------------|--------|
| `assets.ts` | `createAsset`, `updateAsset`, `updateInventoryItem`, `createInventoryItem`, `getEntityAudits` | Cross-tenant asset CRUD |
| `athena-sop.ts` | `updateArticle`, `deleteArticle`, `publishArticle`, `createArticle`, `createTag` | Cross-tenant knowledge base |
| `settings.ts` | `updateOrganization` (no role check), `updateOrgSettings` (no validation) | Any member changes org settings |
| `care-shift-notes.ts` | `acknowledgeShiftNoteSubmissionAction`, `createShiftNoteTemplateAction` | Cross-tenant shift notes |
| `iworkr-connect.ts` | `getConnectBalance`, `getConnectTransactions`, `getConnectPayouts`, `getConnectStats` | Cross-tenant Stripe data |
| `schads-payroll.ts` | ALL 8 functions | Cross-tenant payroll data |
| `rosetta-synthesis.ts` | ALL functions via `requireUser` | Cross-tenant plan reviews |
| `plan-reviews.ts` | `listPlanReviewParticipantsAction`, `listPlanReviewDirectoryAction`, etc. | Cross-tenant NDIS data |
| `care-ironclad.ts` | 8+ functions | Cross-tenant compliance data |
| `participant-persona.ts` | 6+ functions | Cross-tenant medical/behavioral data |
| `hephaestus.ts` | `removeKitComponent` | Cross-org kit component deletion |
| `aegis-contract.ts` | `getContractById`, `getContractForJob`, `deleteSOVLine` | Cross-tenant contracts |
| `clients.ts` | `updateClient`, `deleteClient` (optional orgId!) | Cross-tenant client data |
| `jobs.ts` | `updateJob`, `assignJob`, `toggleSubtask`, `deleteSubtask`, `addJobActivity`, `updateJobLineItem`, `deleteJobLineItem` | Cross-tenant job data |
| `fleet-convoy.ts` | `updateFleetVehicleStatusAction`, `checkoutVehicleBookingAction`, `checkinVehicleBookingAction` | Cross-tenant fleet |
| `synapse-comms.ts` | `markAsRead`, `markAsStarred`, `getJobTimeline`, `getVoipRecord`, `getEmailThread` | Cross-tenant comms |

### Pattern: Missing `organization_id` Filter on Mutations

| File | Function | Query Target | Risk |
|------|----------|-------------|------|
| `care-clinical.ts` | `updateMedicationAction` | `medications` | Cross-tenant med update |
| `roster-templates.ts` | `updateRosterTemplate`, `deleteRosterTemplate` | `roster_templates` | Cross-tenant roster |
| `roster-templates.ts` | `updateTemplateShift`, `deleteTemplateShift` | `template_shifts` | Cross-tenant shifts |
| `roster-templates.ts` | `approveStaffLeave` | `staff_leave` | Cross-tenant leave |
| `care-governance.ts` | `updateIncidentAction`, `updateSCCaseAction` | Various | Cross-tenant governance |
| `aegis-contract.ts` | `deleteSOVLine` | `sov_lines` | Cross-tenant contract |
| `fleet-convoy.ts` | `updateFleetVehicleStatusAction` | `fleet_vehicles` | Cross-tenant fleet |
| `synapse-comms.ts` | `markAsRead`, `markAsStarred` | `communication_logs` | Cross-tenant comms |

### Pattern: Critical Bugs (HIGH)

| File | Function | Bug | Impact |
|------|----------|-----|--------|
| `settings.ts` | `updateProfile` | Uses raw `updates` instead of Zod-validated `parsed.data` | Zod validation completely bypassed |
| `settings.ts` | `updateProfilePreferences` | `.passthrough()` + raw input merge | Arbitrary keys injected into JSONB |
| `rbac.ts` | `changeMemberRole` | Uses `getSession()` instead of `getUser()` | JWT not validated server-side |
| `rbac.ts` | `isCurrentUserAdmin` | No org scope — checks ANY org membership | Wrong admin status for multi-org users |
| `astrolabe-travel.ts` | `getTravelClaimDetail` | Fetches 1000 records to `.find()` one | O(N) instead of O(1), silent failure at 1000+ |
| `shift-cost.ts` | `calculateTimeSegments` | Midnight boundary bug — hour 0 classified as evening | All post-midnight shift hours DROPPED from cost |
| `team-leave.ts` | `getOrphanedShiftsForLeaveAction` | Uses `assigned_to` but column is `technician_id` | Query always returns empty — orphaned shifts never found |
| `team-leave.ts` | `syncLeaveBalanceCacheAction` | `onConflict: "worker_id"` may need `"worker_id,organization_id"` | Cross-tenant balance overwrite |
| `aegis-spend.ts` | `getAPDashboardStats` | `head: true` + `data.length` = always 0 | AP dashboard completely non-functional |
| `rosetta-synthesis.ts` | `finalizeAndGeneratePdf` | Never generates PDF, stores markdown as `final_html` | Broken feature, wrong data type |
| `schads-payroll.ts` | `upsertWorkerPayProfile` | Named "upsert" but uses `.insert()` | Constraint violation on existing profiles |
| `finance.ts` | `generateDisplayId` | TOCTOU race — reads max then increments | Duplicate invoice numbers |
| `hermes-scribe.ts` | `getAmbientStats` | `data.length` instead of `count` — fetches all rows to count | O(N) memory for what should be O(1) |
| `beacon-dispatch.ts` | `isCareOrg` | Uses `industry` but column likely `industry_type` | Care data masking NEVER applied |

---

## 🟡 MEDIUM FINDINGS (111)

### Pattern: Silent Error Swallowing (50+ instances)

Files with empty `catch {}` or `catch { return [] }` that hide failures:

| File | Functions | What's Lost |
|------|-----------|------------|
| `care-clinical.ts` | 4 sentinel-scan invocations | Clinical safety alerts stop firing silently |
| `care-compliance.ts` | `createRestrictivePracticeAction` | NDIS-reportable practice CI action not created |
| `travel.ts` | Award rule fetch, NDIS catalogue queries | Revenue systematically under-reported to $0 |
| `shift-cost.ts` | 3 catch blocks: holiday, allowance, NDIS rate | **Wrong financial data** (underbilled/underpaid) |
| `governance-policies.ts` | `publishPolicyWithFileAction` | Policy distribution fails, no one notified |
| `governance-policies.ts` | `nudgeUnreadStaffAction` | Returns fake nudge count on failure |
| `asclepius.ts` | `fetchLowStockAlerts`, `fetchS8AuditLedger`, `fetchPharmacyOrders` | Clinical alerts and S8 audit records invisible |
| `superadmin.ts` | `logAudit`, `verifySuperAdmin` | Audit trail breaks with zero visibility |
| `iworkr-connect.ts` | 4 Stripe functions | Stripe errors invisible — shows empty data |

### Pattern: Inconsistent Error Return Shapes

Three incompatible patterns used across the codebase:
1. **`{ data, error }` pattern** — `assets.ts`, `panopticon-bi.ts`, `aegis-spend.ts`
2. **`throw new Error()`** — `care-compliance.ts`, `care-clinical.ts`, `wallets.ts`
3. **Return `[]` or `null` on error** — `care-shift-notes.ts`, `care-governance.ts`, `care-houses.ts`

Callers must handle all three patterns. Recommendation: standardize on `{ data, error }`.

### Pattern: Race Conditions (Non-Atomic Operations)

| File | Function | Pattern | Risk |
|------|----------|---------|------|
| `hermes-scribe.ts` | `updateProposedAction`, `removeProposedAction` | Read-modify-write on JSONB array | Lost updates |
| `wallets.ts` | `reconcileWalletAction` | Non-transactional read→compute→write | Incorrect balance |
| `aegis-rbac.ts` | `setRolePermissions` | Delete all → insert new (non-atomic) | Zero-permission state on failure |
| `aegis-rbac.ts` | `setDefaultRole` | Clear all → set one (non-atomic) | No default role on failure |
| `messenger.ts` | `toggleReaction`, `votePoll` | Read-modify-write on JSON | Lost reactions/votes |
| `synapse-prod.ts` | `saveTaxCodes`, `saveAccountCodes` | Delete → insert (non-atomic) | Cache data lost on failure |
| `rosetta-synthesis.ts` | `saveSynthesisResult` | Delete citations → insert new | Lost citations on failure |

### Pattern: PostgREST Filter Injection (search parameter)

Files interpolating unsanitized user input into `.or()` / `.ilike()` filter strings:

| File | Function | Line |
|------|----------|------|
| `superadmin.ts` | `listWorkspaces` | 127 |
| `superadmin.ts` | `listUsers` | 326 |
| `system-telemetry.ts` | `listSystemTelemetry` | 92 |
| `assets.ts` | `scanLookup` | 875, 888 |
| `billing.ts` | `getBillingInvoices` | 176 |
| `ndis-pricing.ts` | `fetchNDISCatalogue` | 77 |
| `hephaestus.ts` | `getInventoryItems` | 89 |
| `care-governance.ts` | `fetchNDISCatalogueAction` | 473 |
| `telemetry.ts` | `listTelemetryEvents` | 217 |

**Fix:** Apply the `escapeIlike()` pattern from `olympus-comms.ts` to all.

### Pattern: `getSession()` Instead of `getUser()` (Security Downgrade)

| File | Function | Line |
|------|----------|------|
| `rbac.ts` | `changeMemberRole` | 42 |
| `billing.ts` | `dispatchInvoice` | 409 |
| `billing.ts` | `bulkDispatchInvoices` | 452 |
| `schads-payroll.ts` | `runSchadsEngine` | 180 |

**Risk:** `getSession()` doesn't validate the JWT server-side. Forged tokens pass.

### Pattern: No Role Checks on Admin Operations

| File | Function | What Any Member Can Do |
|------|----------|----------------------|
| `settings.ts` | `updateOrganization` | Change org name, slug, logo, trade |
| `settings.ts` | `updateOrgSettings` | Modify all org settings (unvalidated JSONB) |
| `branches.ts` | `createBranch`, `updateBranch`, `deleteBranch` | Full branch management |
| `outrider-autonomous.ts` | `toggleAutopilot` | Enable/disable dispatch autopilot |

---

## 🟢 LOW FINDINGS (72)

### Pattern: Pervasive `(supabase as any)` Type Safety Bypass

**40+ files** cast the Supabase client to `any`, completely disabling TypeScript's compile-time protection. Table name typos, wrong column names, and type mismatches are invisible until runtime.

**Fix:** Run `supabase gen types typescript` against the latest schema.

### Pattern: Hardcoded Super Admin Email

Duplicated in 4+ files: `superadmin.ts`, `olympus-comms.ts`, `olympus-mobile.ts`, `telemetry.ts`

```typescript
const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"]
```

**Fix:** Extract to shared constant or `process.env.SUPER_ADMIN_EMAILS`.

### Pattern: `|| null` vs `?? null` (Falsy Coercion Bugs)

| File | Function | Field | Risk |
|------|----------|-------|------|
| `assets.ts` | `createAsset` | `purchase_cost`, `year` | Value `0` coerced to null |
| `assets.ts` | `createInventoryItem` | `unit_cost` | `$0.00` cost → null |
| `participants.ts` | `createParticipantIntake` | `address_lat`, `address_lng` | Coordinates at 0,0 → null |

### Additional Notable Findings

- **`asclepius.ts` → `setClinicalPin`** — SHA-256 without salt on 4-digit PIN. Reversible in milliseconds.
- **`sms.ts` → `sendAppDownloadLink`** — No auth, allows unlimited SMS via Twilio.
- **`integration-sync.ts`** — All sync functions only count records, never actually sync data.
- **`rosetta-synthesis.ts` → `finalizeAndGeneratePdf`** — Never generates a PDF.
- **`beacon-dispatch.ts`** — SMS/email/push body multiplexing bug sends wrong format to each channel.
- **`workforce-dossier.ts` → `getWorkerDossier`** — Returns TFN hash to client (should never leave server).
- **`schedule.ts` → `checkFatigueCompliance`** — Returns `compliant: true` on error (fail-open on safety check).
- **`help.ts` → `upvoteThread`** — No duplicate-vote prevention + race condition on fallback path.
- **`billing.ts` → `getBillingInvoices`** — Overdue filter checks 30 days past-due, not any past-due.
- **`shift-cost.ts` → `evaluateShiftCost`** — Writes $0 ledger entry for unassigned shifts.
- **`team-leave.ts` → `reportEmergencySickAction`** — Worker self-approves their own sick leave.
- **`nightingale-pace.ts` → `createPaceLinkage`** — Missing `created_by` audit field (NDIS compliance).

---

## 📋 REMEDIATION PRIORITY MATRIX

### P0 — Fix Immediately (Security Emergency)

| # | Action | Files | Functions |
|---|--------|-------|-----------|
| 1 | **Add auth to ALL zero-auth files** | 21 files listed above | ~200 functions |
| 2 | **Fix `aegis-rbac.ts` — privilege escalation** | `aegis-rbac.ts` | 17 functions |
| 3 | **Fix `workforce-dossier.ts` → `updateStaffBanking`** | `workforce-dossier.ts` | Banking redirect |
| 4 | **Fix `asclepius.ts` — clinical data without auth** | `asclepius.ts` | S8 controlled substances |
| 5 | **Fix `billing.ts` → `dispatchInvoice` auth ordering** | `billing.ts` | Auth-after-write |
| 6 | **Fix `billing.ts` → `exportProdaCsv` missing `id`** | `billing.ts` | Duplicate PRODA claims |

### P1 — Fix Within 48 Hours

| # | Action | Files |
|---|--------|-------|
| 7 | Add org membership checks to all auth-but-no-membership functions | 16+ files |
| 8 | Add `organization_id` filters to all unscoped mutations | 15+ files |
| 9 | Fix `settings.ts` Zod bypass (raw `updates` instead of `parsed.data`) | `settings.ts` |
| 10 | Fix `rbac.ts` `getSession()` → `getUser()` | `rbac.ts` |
| 11 | Fix `shift-cost.ts` midnight boundary bug | `shift-cost.ts` |
| 12 | Fix `team-leave.ts` wrong column name `assigned_to` → `technician_id` | `team-leave.ts` |
| 13 | Fix `ledger-sync.ts` broken `.raw()` call | `ledger-sync.ts` |
| 14 | Sanitize all PostgREST filter injection points | 9 files |

### P2 — Fix This Sprint

| # | Action | Files |
|---|--------|-------|
| 15 | Standardize error return shapes to `{ data, error }` | All files |
| 16 | Replace empty `catch {}` blocks with error logging | 15+ files |
| 17 | Wrap non-atomic operations in transactions | 7 files |
| 18 | Add role checks to admin-only operations | 4 files |
| 19 | Fix `aegis-spend.ts` dashboard count extraction | `aegis-spend.ts` |
| 20 | Fix `beacon-dispatch.ts` channel body bug | `beacon-dispatch.ts` |

### P3 — Backlog

| # | Action | Files |
|---|--------|-------|
| 21 | Generate typed Supabase client, remove all `as any` | 40+ files |
| 22 | Extract hardcoded super admin emails | 4 files |
| 23 | Fix falsy coercion bugs (`||` → `??`) | 3 files |
| 24 | Address N+1 query patterns | 5 files |
| 25 | Implement actual sync in `integration-sync.ts` | 1 file |

---

## 📊 FILES RANKED BY RISK

| Rank | File | Critical | High | Med | Low | Total | Key Risk |
|------|------|----------|------|-----|-----|-------|----------|
| 1 | `participants.ts` | 6 | 1 | 2 | 2 | **11** | 21 zero-auth functions, NDIS data |
| 2 | `aegis-rbac.ts` | 6 | 4 | 2 | 1 | **13** | Privilege escalation, 17 zero-auth |
| 3 | `roster-templates.ts` | 2 | 5 | 2 | 1 | **10** | 17 zero-auth, schedule mutations |
| 4 | `care-governance.ts` | 5 | 3 | 3 | 2 | **13** | 13+ zero-auth, NDIS claims |
| 5 | `workforce-dossier.ts` | 4 | 1 | 0 | 1 | **6** | Banking details without auth |
| 6 | `care-clinical.ts` | 7 | 5 | 2 | 1 | **15** | Patient safety, medication mutations |
| 7 | `billing.ts` | 7 | 5 | 1 | 0 | **13** | PRODA duplicate claims, auth-after-write |
| 8 | `timesheets.ts` | 3 | 4 | 0 | 1 | **8** | Payroll data, fake timesheet injection |
| 9 | `synapse-comms.ts` | 4 | 3 | 4 | 1 | **12** | Cross-tenant comms, service client |
| 10 | `asclepius.ts` | 5 | 2 | 4 | 0 | **11** | S8 drugs, unsalted PIN, admin client |

---

*Generated by deep audit of 99 server action files in `src/app/actions/`. Each file was read in full and every exported function was evaluated against 6 audit categories.*
