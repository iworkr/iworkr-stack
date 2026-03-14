# iWorkr — Full Platform Audit Report
> **Date:** 2026-03-14  
> **Auditor:** Claude Code  
> **Scope:** Complete codebase — Web (Next.js), Mobile (Flutter), Desktop (Electron), Backend (Supabase), E2E Tests  
> **Purpose:** Identify all incomplete modules, functions, CRUD gaps, mock data, stubs, and remaining work

---

## Executive Summary

The iWorkr platform is a massive, feature-rich ecosystem spanning **5 platforms** with **~340 server action functions**, **31 Edge Functions**, **85 database migrations**, **61 mobile screens**, **11 Electron modules**, and **32 E2E test files**. The overall codebase health is strong (Grade: **B+**), but several critical gaps remain that must be addressed before the platform can be considered production-hardened.

### Top-Level Health Scorecard

| Domain | Grade | Critical Issues |
|--------|-------|-----------------|
| **Server Actions** | B+ | 1 placeholder stub, 8 functions missing try/catch, 200+ `as any` casts |
| **Edge Functions** | A- | All 31 fully implemented; 1 has no auth, 3 have wildcard CORS |
| **Database Migrations** | A | All tables present; 12 unused tables, 1 missing table reference |
| **Frontend Pages** | B- | **6 pages using hardcoded mock data**, 6 fake save buttons |
| **Flutter Mobile** | A- | 34 features, 61 screens, all substantive; 4 orphan screens, near-zero tests |
| **Electron Desktop** | A | Fully functional; minor branding inconsistency |
| **E2E Tests** | A- | 32 test files covering all core modules; missing care/NDIS flows |
| **Unit Tests** | B | 493 passing tests across 8 files; large coverage gaps remain |

---

## 🔴 CRITICAL — Must Fix (8 items)

### 1. Pages Displaying Hardcoded Mock Data (NOT from Database)

These pages show **fabricated data to real users** in production:

| # | Page | File | Mock Data | Lines |
|---|------|------|-----------|-------|
| 1 | **Timesheets** | `src/app/dashboard/timesheets/page.tsx` | `MOCK_ENTRIES`, `MOCK_GRID`, `MOCK_EXPORTS` — entire page is mock | 13, 66–94 |
| 2 | **Care Comms** | `src/app/dashboard/care/comms/page.tsx` | `MockChannel`, `MockMessage`, `MOCK_PARTICIPANTS`, `MOCK_DMS`, `MOCK_TEAM_CHANNELS` — ~200 lines of mock | 43–248 |
| 3 | **Behaviour & BSP** | `src/app/dashboard/care/behaviour/page.tsx` | `MOCK_BSPS` (5), `MOCK_EVENTS` (8), `MOCK_RESTRICTIVE` (5) | 95–128 |
| 4 | **Quality & Governance** | `src/app/dashboard/care/quality/page.tsx` | `MOCK_CI_ACTIONS` (6), `MOCK_POLICIES` (5), `MOCK_GOVERNANCE` (5) | 102–127 |
| 5 | **Clients (Care Mode)** | `src/app/dashboard/clients/page.tsx` | `getMockNdisNumber()` — fake NDIS numbers shown alongside real data | 63–95 |
| 6 | **CRM (Care Mode)** | `src/app/dashboard/crm/page.tsx` | `getMockNdisNumber()`, `getMockFundingType()` — fake NDIS/funding data | 204–224 |

### 2. Fake Save Buttons (No Backend Persistence)

These pages have "Save Changes" buttons that do nothing but `setTimeout()`:

| # | Page | File | What's Not Saved |
|---|------|------|-----------------|
| 1 | AI Agent: Ads | `src/app/dashboard/ai-agent/ads/page.tsx` | All Meta Ads settings (spend monitoring, creative gen, account ID) |
| 2 | AI Agent: Dispatch | `src/app/dashboard/ai-agent/dispatch/page.tsx` | All Dispatch Copilot settings |
| 3 | AI Agent: Reputation | `src/app/dashboard/ai-agent/reputation/page.tsx` | All Reputation Manager settings |
| 4 | AI Agent: Social | `src/app/dashboard/ai-agent/social/page.tsx` | All Social Sales Agent settings |
| 5 | Behaviour BSP | `src/app/dashboard/care/behaviour/page.tsx` | BSP create form (line 187–193) |
| 6 | Funding Engine | `src/app/dashboard/care/funding-engine/page.tsx` | Sync button (line 931–937) |

### 3. `integrations.ts:syncIntegration` is a Placeholder Stub

**File:** `src/app/actions/integrations.ts` (line 315)  
**Comment:** `"In a real implementation, this would trigger an Edge Function"`  
The function marks status as "syncing" then immediately marks as "connected" without actually syncing anything.

### 4. Integration Sync Functions Don't Persist Data

**File:** `src/app/actions/integration-sync.ts`  
Functions `syncXero`, `syncQuickBooks`, `syncGmail`, `syncGoogleCalendar`, `syncGoHighLevel` fetch API data and count items but **never store the synced data** into local tables. They're health-check pings, not real syncs.

### 5. `generate-pdf` Edge Function Has No Auth

**File:** `supabase/functions/generate-pdf/index.ts`  
Any request with the anon key can trigger PDF generation for **any invoice ID**. No caller authentication.

### 6. `shifts` Table Referenced But Doesn't Exist

**File:** `supabase/functions/sync-chat-memberships/index.ts`  
Queries a `shifts` table that has no `CREATE TABLE` in any migration. Should likely be `schedule_blocks`.

### 7. Supabase TypeScript Types Not Regenerated

**~200+ `as any` casts** across 15 server action files because TypeScript types have not been regenerated since migrations 063–085 were applied. All care, timesheet, roster, staff profile, branding, and NDIS tables are untyped.

### 8. `SUPABASE_SERVICE_ROLE_KEY` Still Mismatched (Pending User Action)

The Vercel production environment uses the service role key from the wrong Supabase project. This prevents all Olympus/Super Admin functionality. **Requires manual update in Vercel dashboard.**

---

## 🟡 HIGH PRIORITY — Should Fix (15 items)

### Server Action Error Handling Gaps

| # | File | Function(s) Missing try/catch |
|---|------|-------------------------------|
| 1 | `sms.ts` | `sendAppDownloadLink` — Twilio API fetch could throw |
| 2 | `onboarding.ts` | All 4 functions — `createOrganization`, `updateOrganizationTrade`, `sendTeamInvites`, `completeOnboarding` |
| 3 | `ndis-pricing.ts` | `fetchNDISCatalogue`, `fetchNDISSyncStatus`, `fetchNDISSyncHistory` |
| 4 | `integration-sync.ts` | `pushInvoiceToProvider` — Xero API fetch |

### Mock Data Augmenting Real Data

| # | File | What's Faked |
|---|------|-------------|
| 5 | `team/page.tsx` (lines 57–83) | `getMemberCredentialStatus()`, `getMemberCareSkills()` — fake credential/skills per team member |
| 6 | `jobs/page.tsx` (lines 297–302) | `getCareType(id)` — fake care support types |
| 7 | `schedule/page.tsx` (lines 198–203) | SCHADS compliance checks are mocked |

### CRUD Gaps (Missing Delete Operations)

Many care modules only have Create + Read operations:

| # | Module | Missing Operations |
|---|--------|--------------------|
| 8 | Observations | No update, no delete |
| 9 | Care Plans / Goals | No delete |
| 10 | BSPs | No delete |
| 11 | Progress Notes / Behaviour Events | No update, no delete |
| 12 | Incidents | No delete |
| 13 | Policies / Governance Meetings | No update, no delete |
| 14 | Service Agreements / External Agencies | No update, no delete |
| 15 | Timesheets / Time Entries | No delete, no updateTimeEntry |

### Edge Function Issues

| # | Issue |
|---|-------|
| 16 | Wildcard CORS on `care-dashboard-snapshot` — returns sensitive clinical data |
| 17 | Hardcoded SCHADS award rates in `process-timesheet-math` ($18.41, $19.50) should come from DB |
| 18 | Stripe webhook `PLAN_MAP` uses placeholder price IDs |
| 19 | Dead code in `automation-worker` (line 678–679) — both branches do the same thing |

---

## 🟠 MEDIUM PRIORITY — Nice to Fix (12 items)

### Flutter Mobile

| # | Issue |
|---|-------|
| 1 | **4 orphan screens** — `ai_cortex`, `form_runner`, `compliance_packet`, `safety_shield` have no navigation path |
| 2 | **Near-zero test coverage** — 6 test files covering <1% of codebase |
| 3 | **GoRouter bypass** — payments, quotes, scan use `Navigator.push` instead of GoRouter (breaks deep linking) |
| 4 | **1 INCOMPLETE trail** — PDF preview in invoice creation needs Edge Function integration |

### Unused Database Tables (Created but Never Referenced)

| # | Table | Migration |
|---|-------|-----------|
| 5 | `budget_quarantine_ledger` | 069 |
| 6 | `goal_progress_links` | 073 |
| 7 | `fatigue_overrides` | 072 |
| 8 | `ndis_region_modifiers` | 068 |
| 9 | `care_typing_indicators` | 083 |
| 10 | `client_activity_logs` | 047 |
| 11 | `schads_award_rates` | 077 |
| 12 | `pipeline_events` | 042 |

### Other

| # | Issue |
|---|-------|
| 13 | `sms.ts` has placeholder App Store/Play Store URLs |
| 14 | `help.ts:aiSearch` is a basic keyword matcher, not AI-powered |
| 15 | `data.ts` — 790-line mock data file used by ~15 files for type definitions |
| 16 | Duplicate E2E page objects (PascalCase + kebab-case) |
| 17 | E2E `constants.ts` has hardcoded golden user credentials |
| 18 | `brand_kits` table referenced in `process-mail` Edge Function but being replaced by `workspace_branding` |

---

## 🟢 LOW PRIORITY — Known & Documented (5 items)

| # | Issue | Status |
|---|-------|--------|
| 1 | Linux desktop build not available | `INCOMPLETE:TODO` in download page |
| 2 | Additional AI agent types not configurable | `INCOMPLETE:TODO` in [agentId] page |
| 3 | Electron shell uses neon green (#00E676) instead of Signal Green (#10B981) | Documented deliberate choice |
| 4 | `CARE_INTEGRATION_STATUS.md` is stale (doesn't reflect Phase 3-4 completion) | Documentation update needed |
| 5 | No care-specific E2E tests | Care modules are newer; tests needed |

---

## Full Inventory

### Server Actions: 340+ Functions Across 35 Files

| File | Functions | Error Handling | CRUD Status |
|------|-----------|----------------|-------------|
| `ai-agent.ts` | 4 | ✅ | ✅ Complete |
| `api-keys.ts` | 3 | ✅ | ✅ Complete |
| `assets.ts` | 13 | ✅ | ⚠️ No delete |
| `automations.ts` | 18 | ✅ | ✅ Uses archive |
| `branding.ts` | 6 | ✅ | ✅ Complete |
| `branches.ts` | 4 | ✅ | ✅ Full CRUD |
| `care-clinical.ts` | 18 | ✅ | ⚠️ Missing deletes |
| `care-comms.ts` | 21 | ✅ | ⚠️ No delete channel |
| `care-compliance.ts` | 8 | ✅ | ⚠️ Missing updates/deletes |
| `care-governance.ts` | 23 | ✅ | ⚠️ Many deletes missing |
| `care.ts` | Barrel re-export | N/A | N/A |
| `clients.ts` | 14 | ✅ | ✅ Full CRUD |
| `contact.ts` | 1 | ✅ | N/A |
| `dashboard.ts` | 12 | ✅ | N/A |
| `email.ts` | 2 | ✅ | N/A |
| `finance.ts` | 16 | ✅ | ✅ Full CRUD |
| `forms.ts` | 13 | ✅ | ✅ Full CRUD |
| `help.ts` | 9 | ✅ | ⚠️ No admin CRUD |
| `import-export.ts` | 2 | ✅ | N/A |
| `integration-oauth.ts` | 8 | ✅ | ✅ |
| `integration-sync.ts` | 2 | ⚠️ | 🔴 Sync is fake |
| `integrations.ts` | 7 | ✅ | 🔴 syncIntegration is stub |
| `jobs.ts` | 16 | ✅ | ✅ Full CRUD |
| `messenger.ts` | 15 | ✅ | ⚠️ No channel update/delete |
| `ndis-pricing.ts` | 6 | ⚠️ | ✅ |
| `notifications.ts` | 11 | ✅ | ✅ |
| `onboarding.ts` | 4 | ⚠️ | N/A |
| `participants.ts` | 10 | ✅ | ⚠️ Missing deletes |
| `quotes.ts` | 11 | ✅ | ⚠️ No delete |
| `roster-templates.ts` | 17 | ✅ | ⚠️ No leave delete |
| `schedule.ts` | 19 | ✅ | ⚠️ No event update |
| `settings.ts` | 8 | ✅ | ✅ |
| `shift-cost.ts` | 3 | ✅ | N/A |
| `sms.ts` | 1 | ⚠️ | N/A |
| `staff-profiles.ts` | 7 | ✅ | ⚠️ No delete |
| `superadmin.ts` | 20 | ✅ | ✅ Full CRUD |
| `team.ts` | 19 | ✅ | ✅ Full CRUD |
| `telemetry.ts` | 6 | ✅ | ✅ |
| `timesheets.ts` | 14 | ✅ | ⚠️ Missing deletes |
| `travel.ts` | 2 | ✅ | N/A |

### Edge Functions: 31 Fully Implemented

All 31 Edge Functions have complete implementations with try/catch error handling and CORS support. No stubs. See individual function notes in the Critical Issues section for auth and security concerns.

### Database: 85 Migration Files, ~120+ Tables

All tables referenced in server actions exist in migrations. The only missing table reference is `shifts` in `sync-chat-memberships` (should be `schedule_blocks`). 12 tables are created but never referenced in application code.

### Flutter Mobile: 34 Features, 61 Screens, 207 Dart Files

All features have substantive implementations (no stubs). 4 screens are orphaned (no navigation path). Test coverage is critically thin (6 test files).

### Electron Desktop: 11 Source Files, Fully Functional

Complete production-grade desktop wrapper with window management, auth, tray, menu, auto-update, crash reporting, and offline mode. No stubs or placeholders.

### E2E Tests: 32 Test Files, ~250+ Test Cases

Comprehensive coverage of all core Trades modules. Missing coverage for Care/NDIS flows, messenger, and onboarding.

### Unit Tests: 8 Test Files, 493 Passing Tests

Good coverage for validation, formatting, plans, status-pill, superadmin, care-comms-store, finance, and schedule. Large gaps in care, roster, timesheet, and other action files.

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Immediate)
1. ⬜ Replace mock data in 4 full-mock pages (timesheets, comms, behaviour, quality) with real DB queries
2. ⬜ Fix mock NDIS numbers in clients + CRM pages — query from `participant_profiles`
3. ⬜ Wire AI Agent save buttons to `upsertAgentConfig` server action
4. ⬜ Fix `syncIntegration` stub — delegate to `integration-sync.ts:triggerSync`
5. ⬜ Add auth check to `generate-pdf` Edge Function
6. ⬜ Fix `sync-chat-memberships` to query `schedule_blocks` instead of `shifts`
7. ⬜ Regenerate Supabase TypeScript types to eliminate `as any` epidemic
8. ⬜ Update `SUPABASE_SERVICE_ROLE_KEY` on Vercel (user action)

### Phase 2: Error Handling & CRUD (High Priority)
9. ⬜ Add try/catch to remaining 8 functions across 4 files
10. ⬜ Add delete operations for care modules (soft-delete with archival)
11. ⬜ Fix wildcard CORS on `care-dashboard-snapshot`
12. ⬜ Replace hardcoded SCHADS rates with DB lookups
13. ⬜ Update Stripe webhook `PLAN_MAP` with real price IDs

### Phase 3: Mobile & Testing (Medium Priority)
14. ⬜ Wire 4 orphan Flutter screens to GoRouter
15. ⬜ Implement Flutter unit tests for core providers
16. ⬜ Add E2E tests for care/NDIS flows
17. ⬜ Clean up duplicate E2E page objects

### Phase 4: Polish & Documentation
18. ⬜ Update `CARE_INTEGRATION_STATUS.md` to reflect Phase 3-4 completion
19. ⬜ Add care branding documentation to `STYLE_GUIDE.md`
20. ⬜ Fix Electron shell neon green to match Signal Green
21. ⬜ Implement real `aiSearch` with OpenAI embeddings

---

*Generated by Claude Code full platform audit — 2026-03-14*
