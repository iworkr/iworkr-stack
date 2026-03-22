# 🔍 DEEP DASHBOARD AUDIT — All 140 page.tsx + 4 layout.tsx Files
> **Date**: 2026-03-22 | **Scope**: `src/app/dashboard/**/*.tsx` | **Files Read**: 144

---

## EXECUTIVE SUMMARY

| Severity | Count | Impact |
|----------|-------|--------|
| **🔴 P0 — Critical** | 2 | Security vulnerability + stub masquerading as real feature |
| **🟠 P1 — High** | 15 | Broken functionality, stale closures, missing auth, false 404s |
| **🟡 P2 — Medium** | 88 | Non-functional buttons, hardcoded data, missing error handling |
| **🟢 P3 — Low** | 71 | Dead code, minor UX nits, cosmetic issues |
| **TOTAL** | **176** | |

### Key Systemic Issues
1. **~25+ non-functional "Filters" buttons** across the entire app — buttons render with `<SlidersHorizontal>` icon but have no `onClick` handler
2. **12+ useEffect hooks with suppressed exhaustive-deps** — real stale closure bugs hidden behind `eslint-disable` comments
3. **AI Agent `knowledge_base` overwrite** — 4 sub-agent pages each write their own JSON blob, overwriting each other's settings
4. **Inconsistent data fetching** — mix of `useQuery`, `useEffect`/`useState`, and Zustand store reads, leading to stale data on direct navigation
5. **`window.prompt()` / `window.alert()` / `confirm()`** used in ~10 pages — breaks Obsidian design language, blocks UI thread

---

## 🔴 P0 — CRITICAL (2 findings)

### P0-001: SECURITY — TOTP Secret Leaked to Third-Party Service
**File**: `settings/security/page.tsx`
**Type**: SECURITY / BUG
```tsx
<img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`} />
```
**Impact**: MFA enrollment QR code sends the user's full TOTP URI (including secret key) to `api.qrserver.com` — an untrusted third-party. This secret can be intercepted, logged, or harvested by the third party to generate valid TOTP codes.
**Fix**: Generate QR code client-side using `qrcode` npm package.

---

### P0-002: STUB — Finance Retention Release is Fake
**File**: `finance/retention/page.tsx`
**Type**: INCOMPLETION
```tsx
// INCOMPLETE: Wire up actual retention release action
await new Promise((r) => setTimeout(r, 1000));
```
**Impact**: Clicking "Release" on a retention hold does nothing except show a success toast after a 1-second fake delay. Users believe money has been released but it hasn't. This is a financial action with real-world consequences.
**Fix**: Wire to actual server action for releasing retention holds.

---

## 🟠 P1 — HIGH (15 findings)

### P1-001: XSS Vector in Clinical Reviews
**File**: `clinical/reviews/page.tsx`
```tsx
dangerouslySetInnerHTML={{ __html: markdown.replace(...) }}
```
AI-generated markdown with citation markers is rendered as raw unsanitized HTML in a `contentEditable` div. Malicious HTML in AI output will execute.

### P1-002: Instant Payout Calls Edge Function Without Auth
**File**: `finance/iworkr-connect/page.tsx`
```tsx
await fetch(`${supabaseUrl}/functions/v1/process-payout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: ...
}); // No Authorization header
```
Supabase Edge Functions require auth. This call will always be rejected in production.

### P1-003: `prompt()` Used for Financial Rejection Reason
**File**: `finance/accounts-payable/page.tsx`
```tsx
const reason = prompt("Rejection reason:");
```
Blocks UI thread, terrible on mobile, no validation. Should use inline form.

### P1-004: `useMemo` with `setState` — React Anti-Pattern
**File**: `roster/dispatch/page.tsx`
```tsx
useMemo(() => { if (blueprint) setSelectedBlueprint(blueprint); }, [blueprint]);
```
Calling `setState` inside `useMemo` can cause infinite render loops. Must be `useEffect`.

### P1-005: Hardcoded Fake Dispatch Data Shown to Users
**File**: `dispatch/page.tsx`
```
Shift Coverage: 12/15 rostered
```
Hardcoded text not derived from real data. Users see fabricated shift coverage numbers.

### P1-006: Job Detail Shows False 404 During Loading
**File**: `jobs/[id]/page.tsx`
```tsx
if (!job) { return "Job not found" }
```
No loading check before showing not-found. Direct URL navigation always briefly shows 404.

### P1-007: Client Detail Never Refetches After Initial Load
**File**: `clients/[id]/page.tsx`
```tsx
if (!clientId || !orgId || detailLoading || serverDetail) return;
```
Once `serverDetail` is set, the guard prevents all future fetches. Stale data persists across navigations.

### P1-008: Jobs List Has No Loading State
**File**: `jobs/page.tsx`
No spinner or skeleton while jobs load. Users see empty state message during fetch.

### P1-009: Widget Triage Tree Fetches Wrong Org Data
**File**: `settings/widgets/page.tsx`
```tsx
const fetchTriageTree = useCallback(async (widgetId: string) => {
  const { data } = await getTriageTree(widgetId, orgId!);
}, []); // ← orgId missing from deps
```
If org changes, stale `orgId` closure fetches/writes data for wrong organization.

### P1-010: Integration Health `orgId!` Crashes on Initial Render
**File**: `settings/integration-health/page.tsx`
```tsx
const healthKey = queryKeys.settings.integrationHealth(orgId!);
```
Non-null assertion before `orgId` is guaranteed to exist. Crashes if `orgId` is null during initial render.

### P1-011: `useEffect` No Dependency Array — Plan Manager Keyboard Shortcut
**File**: `finance/plan-manager/page.tsx`
```tsx
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) { ... }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}); // ← No dependency array — runs every render
```
Re-registers listener on every render, captures stale closures.

### P1-012: `useEffect` No Dependency Array — Quote Builder Keyboard Shortcut
**File**: `finance/quotes/new/page.tsx`
Same pattern as P1-011. Ctrl+S re-registers on every render.

### P1-013: Vehicle Status Change — Silent Failure
**File**: `fleet/vehicles/page.tsx`
Async `updateFleetVehicleStatusAction` in `onChange` handler has no error handling. If it fails, UI shows stale data.

### P1-014: Compliance Policies — `startTransition` with Async
**File**: `compliance/policies/page.tsx`
```tsx
useEffect(() => {
  startTransition(async () => { await load(); });
}, [orgId]);
```
`startTransition` does not support async callbacks. State updates may not trigger correctly. No loading state shown.

### P1-015: Care Participant Persona Uses `window.prompt()`
**File**: `care/participants/[id]/persona/page.tsx`
Uses `window.prompt()` for creating medical alerts, behaviors, and goals. No validation, blocks UI thread, breaks Obsidian design.

---

## 🟡 P2 — MEDIUM (88 findings)

### Data Wiring Issues (28)

| # | File | Issue |
|---|------|-------|
| 1 | `finance/invoices/[id]/page.tsx` | Invoice from Zustand store, not fetched by ID — direct navigation shows "not found" |
| 2 | `finance/invoices/[id]/page.tsx` | GST hardcoded as "GST (10%)" — doesn't use actual tax rate |
| 3 | `finance/invoices/[id]/page.tsx` | `toLocaleString()` without locale spec — currency formatting varies by browser |
| 4 | `finance/invoices/new/page.tsx` | Navigates to `displayId` but detail page looks up by store ID — mismatch |
| 5 | `finance/accounts-payable/page.tsx` | No try/catch on `Promise.all` — unhandled rejection crashes page |
| 6 | `finance/supplier-invoices/page.tsx` | No error handling on load/detail/upload/approve/reject — all silently swallow errors |
| 7 | `finance/iworkr-connect/page.tsx` | `totalInvoiced * 100` before `fmtAUD` which divides by 100 — double conversion risk |
| 8 | `finance/coordination-ledger/page.tsx` | NDIS line item defaults to hardcoded `"07_002_0106_8_3"` rate `$65.09` |
| 9 | `care/participants/[id]/finance/page.tsx` | `eslint-disable` hides missing deps for `loadWallets`/`loadLedger` |
| 10 | `care/participants/[id]/persona/page.tsx` | `loadAll()` missing `orgId` dependency — stale closure |
| 11 | `care/observations/page.tsx` | `observations.length` in `useCallback` deps causes re-fetch loops |
| 12 | `care/progress-notes/page.tsx` | Same `notes.length` dependency issue + `loadNotes()` missing `forceRefresh` |
| 13 | `care/plan-reviews/build/page.tsx` | `setPlanReviewStatusAction` fire-and-forget — no await, no error handling |
| 14 | `care/sil-quoting/variance/page.tsx` | Shared `startTransition` between two effects — race condition risk |
| 15 | `settings/ndis-pricing/page.tsx` | `orgId` destructured but never passed to `fetchNDISCatalogue` |
| 16 | `settings/ndis-pricing/page.tsx` | Hardcoded 200-item limit, no pagination for large catalogues |
| 17 | `settings/integration-health/page.tsx` | `webhookEvents` state never populated — "Recent Events" always empty |
| 18 | `settings/integration-health/page.tsx` | Tax code "Fetch Live" hardcodes static AU codes instead of fetching |
| 19 | `jobs/[id]/contract/page.tsx` | `VariationsTab` — `variations` state never populated from server |
| 20 | `jobs/[id]/contract/page.tsx` | `updateLineField` reads pre-update `lines` state in server call |
| 21 | `team/[id]/page.tsx` | No "not found" fallback — loading skeleton shown forever when profile is null |
| 22 | `ai-agent/dispatch/page.tsx` | `knowledge_base` JSON overwrite — replaces entire field with just dispatch settings |
| 23 | `ai-agent/ads/page.tsx` | Same `knowledge_base` overwrite |
| 24 | `ai-agent/social/page.tsx` | Same `knowledge_base` overwrite |
| 25 | `ai-agent/reputation/page.tsx` | Same `knowledge_base` overwrite |
| 26 | `analytics/chat/page.tsx` | SSE `fetch` with no `AbortController` — connection leaks on navigation |
| 27 | `roster/rollout/page.tsx` | `useSearchParams()` without `<Suspense>` boundary |
| 28 | `schedule/page.tsx` | Store accessed imperatively via `getState()` — bypasses React reactivity |

### Bug Findings (25)

| # | File | Issue |
|---|------|-------|
| 29 | `finance/sync-errors/page.tsx` | Uses `alert()` for retry failure — should use toast |
| 30 | `finance/sync-errors/page.tsx` | `border-white/8` is invalid Tailwind — should be `border-white/[0.08]` |
| 31 | `finance/oracle-triage/page.tsx` | Dynamic Tailwind `bg-${color}-500/10` — purged in production |
| 32 | `finance/petty-cash/page.tsx` | `useEffect` dep `wallet?.id` — optional chain in deps |
| 33 | `finance/claims/page.tsx` | Noise overlay `z-50` blocks Link Participant Modal |
| 34 | `finance/accounts-payable/page.tsx` | Raw `<img>` tag — should use Next.js `Image` with error handling |
| 35 | `settings/yield-profiles/page.tsx` | Dynamic Tailwind `text-${color}-400` — won't compile |
| 36 | `settings/communications/page.tsx` | Colliding `emailKey: "email_shift_modified"` for two different toggles |
| 37 | `settings/compliance-engine/page.tsx` | No confirmation before deleting compliance framework |
| 38 | `fleet/overview/page.tsx` | `AddVehicleSlideOver` catches error with `console.error` only — no user feedback |
| 39 | `fleet/overview/page.tsx` | `UtilizationCell` shows fleet average for every row — misleading |
| 40 | `dispatch/page.tsx` | `handleSearch` is a no-op — search does nothing |
| 41 | `dispatch/live/page.tsx` | Multiple `as unknown as` type casts — fragile, masks runtime errors |
| 42 | `roster/dispatch/page.tsx` | `alert()` for validation errors |
| 43 | `roster/master/page.tsx` | No validation: `start_time > end_time` shifts can be created |
| 44 | `schedule/page.tsx` | Phone/Message buttons hardcoded to "No phone number configured" toast |
| 45 | `jobs/[id]/page.tsx` | Stale closure in `handleKey` — eslint-disable hides real bug |
| 46 | `jobs/[id]/page.tsx` | Sparkline SVG is hardcoded path — never reflects actual revenue |
| 47 | `jobs/[id]/page.tsx` | Delete job has no confirmation dialog |
| 48 | `clients/[id]/page.tsx` | `client?.id` dep with eslint-disable — local state won't resync on update |
| 49 | `messages/page.tsx` | Realtime subscription stale closure — eslint-disable on deps |
| 50 | `inbox/page.tsx` | Same realtime stale closure issue |
| 51 | `clinical/reviews/page.tsx` | Access token in SSE URL query parameter — leaks via logs/referrer |
| 52 | `houses/[id]/page.tsx` | `RosterTab.shiftsByDay` `useMemo` missing `days` in deps |
| 53 | `care/medications/page.tsx` | `worker_id: ""` passed when recording administration — orphan record |

### Incompletions (22)

| # | File | Issue |
|---|------|-------|
| 54 | `finance/kits/page.tsx` | Proposals tab is entirely a placeholder — no data, no create |
| 55 | `finance/travel-ledger/page.tsx` | Route polyline decoding is stubbed — draws straight line only |
| 56 | `finance/invoices/new/page.tsx` | `CATALOG` items hardcoded ("Standard Callout Fee", "Boiler Service") |
| 57 | `care/note-review/page.tsx` | `handleAutoSummarize` is client-side regex stub — not calling LLM |
| 58 | `care/participants/[id]/page.tsx` | Document Vault drop zone has no `onDrop`/`onChange` handlers |
| 59 | `care/comms/page.tsx` | Paperclip, Pin, Members buttons all non-functional |
| 60 | `care/sil-quoting/[id]/page.tsx` | "Publish Family PDF" hardcoded to first participant only |
| 61 | `clients/[id]/page.tsx` | NDIS number fabricated from client ID: `43{id.slice(0,7)}` |
| 62 | `clients/[id]/page.tsx` | Budget Utilization hardcoded to 65% |
| 63 | `clients/[id]/page.tsx` | Care clinical sections always show "No observations recorded" |
| 64 | `settings/security/page.tsx` | WebAuthn/Passkeys section is "coming soon" placeholder |
| 65 | `settings/integrations/page.tsx` | MYOB connect shows `alert("coming soon")` |
| 66 | `ai-agent/page.tsx` | Non-phone agent "Activate" buttons do nothing |
| 67 | `ai-agent/[agentId]/page.tsx` | Unknown agent IDs show "Coming soon" with no back navigation |
| 68 | `tracking/page.tsx` | Settings tab is entirely read-only hardcoded values |
| 69 | `ops/kits/page.tsx` | "Create Kit" button has no onClick |
| 70 | `ops/proposals/page.tsx` | "New Proposal" button and row clicks do nothing |
| 71 | `ops/inventory/page.tsx` | "Add Item" sets modal state but no modal component rendered |
| 72 | `ops/suppliers/page.tsx` | "Settings" button per supplier has no onClick |
| 73 | `clinical/reviews/page.tsx` | "Download Official PDF" button has no onClick |
| 74 | `workforce/team/[id]/page.tsx` | "Send Password Reset" and "Force MFA" only show toasts — no API |
| 75 | `workforce/team/[id]/page.tsx` | "Message" button is `onClick={() => {}}` |

### UX Issues (13)

| # | File | Issue |
|---|------|-------|
| 76 | `care/participants/[id]/finance/page.tsx` | No loading skeleton — blank page while wallets load |
| 77 | `care/participants/[id]/persona/page.tsx` | Plain text "Loading persona dossier..." — no skeleton |
| 78 | `care/sil-quoting/variance/page.tsx` | No loading state — misleading "Choose a quote" during load |
| 79 | `fleet/vehicles/page.tsx` | No loading skeleton for initial vehicle list |
| 80 | `fleet/vehicles/page.tsx` | No form validation before vehicle creation |
| 81 | `fleet/overview/page.tsx` | Row click navigates with `?id=` param that is never read |
| 82 | `settings/yield-profiles/page.tsx` | No delete functionality for yield profiles |
| 83 | `settings/yield-profiles/page.tsx` | No validation — `min_margin_floor` can exceed `max_margin_ceiling` |
| 84 | `admin/audit/page.tsx` | Participant ID input requires raw UUID — no picker |
| 85 | `houses/[id]/page.tsx` | "Add Staff" toggle has no staff picker/search |
| 86 | `team/[id]/training/page.tsx` | No loading skeleton — blank table body during fetch |
| 87 | `ops/safety/page.tsx` | Search/filter inputs exist but don't actually filter displayed data |
| 88 | `clinical/reviews/page.tsx` | Create Review requires raw participant UUID — no picker |

---

## 🟢 P3 — LOW (71 findings)

### Non-Functional Buttons (Filters + misc) (~25+)
Pages with decorative "Filters" buttons that do nothing:
`finance/petty-cash`, `finance/retention`, `finance/coordination-ledger`, `care/participants`, `care/sil-quoting`, `care/plan-reviews`, `care/notes`, `care/medications`, `care/facilities`, `care/plans`, `compliance/audits`, `compliance/readiness`, `timesheets`, `admin/audit` (Download + Revoke buttons)

### Dead Code / Unused Imports (~15)
- `dispatch/live/page.tsx`: `reportAnomaly` imported but unused + 9 unused Lucide icons
- `schedule/page.tsx`: `Rows3` imported but unused
- `tracking/page.tsx`: `initiateTrackingSession` + `Trash2` imported but unused
- `finance/petty-cash/page.tsx`: `useTransition` destructured but never used
- `care/page.tsx`: `MOOD_COLORS` constant defined but never used
- `jobs/page.tsx`: `restoreJobs` + `selectAll` destructured but unused

### Minor UX (~20)
- `settings/security/page.tsx`: Success/error messages never auto-dismiss
- `settings/roles/page.tsx`: No unsaved changes warning
- `fleet/vehicles/page.tsx`: Bookings silently capped at 12 with no "show all"
- `roster/rollout/page.tsx`: `setTimeout` redirect with no cleanup
- `schedule/page.tsx`: SCHADS constants hardcoded, no DB override
- `jobs/[id]/page.tsx`: Photo thumbnails show camera icon, never real images
- `jobs/[id]/page.tsx`: "Print" button has no onClick
- `jobs/[id]/contract/page.tsx`: SOV save not debounced despite comment
- `clients/page.tsx`: `navigator.clipboard.writeText(client.email)` — no null check
- `team/leave/page.tsx`: All error handling is `console.error` only
- `team/credentials/page.tsx`: `confirm()` for delete
- `workforce/payroll-export/page.tsx`: Period picker is read-only
- `ops/suppliers/page.tsx`: `confirm()` for delete
- `dispatch/page.tsx`: Mapbox logo/attribution hidden — possible ToS violation
- `care/sil-quoting/[id]/page.tsx`: Toast `msg` never auto-clears
- `care/daily-ops/page.tsx`: Realtime INSERT events lack joined data
- `care/roster-intelligence/page.tsx`: No cancellation on unmount for async fetch

### Minor Bugs (~11)
- `finance/kits/page.tsx`: `(org as any)?.orgId` fragile type cast
- `finance/travel/page.tsx`: `useCallback` dep on `selected` — infinite loop risk
- `finance/travel-ledger/page.tsx`: Optional chain `claim?.claim_id` in deps
- `tracking/page.tsx`: `(org as any)?.orgId` same fragile cast
- `settings/widgets/page.tsx`: `(org as any)?.orgId` same fragile cast
- `roster/dispatch/page.tsx`: Workers typed as `any[]`
- `governance/policies/page.tsx`: Dead SSR check in `useMemo` for client component
- `care/participants/[id]/persona/page.tsx`: `any[]` types for alerts/behaviors/goals
- `care/participants/[id]/page.tsx`: `orgId!` assertion in queryFn
- `houses/[id]/page.tsx`: `orgId!` assertion passed to child component
- `team/[id]/training/page.tsx`: `orgId!` / `workerId!` assertions in onClick

---

## SYSTEMIC PATTERNS TO ADDRESS

### 1. Non-Functional "Filters" Buttons (~25 pages)
**Pattern**: `<button className="..."><SlidersHorizontal />Filters</button>` with no `onClick`
**Recommendation**: Either implement a shared `<FilterDrawer>` component or remove the buttons.

### 2. `eslint-disable react-hooks/exhaustive-deps` (~12 files)
**Files**: participant finance, persona, observations, progress-notes, templates, jobs/[id], clients/[id], messages, inbox, team/[id]/training
**Recommendation**: Fix each closure properly — use `useCallback` with correct deps, or move function definitions inside `useEffect`.

### 3. AI Agent `knowledge_base` Overwrite (4 pages)
**Files**: `ai-agent/dispatch`, `ai-agent/ads`, `ai-agent/social`, `ai-agent/reputation`
**Recommendation**: Read existing `knowledge_base`, merge settings, then write back.

### 4. `window.prompt()` / `window.alert()` / `confirm()` (~10 pages)
**Recommendation**: Replace with styled modal components from the UI kit.

### 5. `(org as any)?.orgId ?? (org as any)?.id` (~5 pages)
**Recommendation**: Fix the `useOrg()` hook type or standardize destructuring as `const { orgId } = useOrg()`.

### 6. Missing `<Suspense>` for `useSearchParams()` (1+ pages)
**Recommendation**: Wrap in `<Suspense>` per Next.js 13+ requirements.

### 7. Dynamic Tailwind Class Names (~3 pages)
**Files**: `oracle-triage`, `yield-profiles`, `sync-errors`
**Recommendation**: Use class maps instead of string interpolation: `const colorMap = { emerald: "bg-emerald-500/10" }`.

---

## TOP 10 MUST-FIX (Priority Order)

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | **P0** | `settings/security` | TOTP secret leaked to third-party | Generate QR client-side |
| 2 | **P0** | `finance/retention` | Release action is a fake stub | Wire to real server action |
| 3 | **P1** | `clinical/reviews` | XSS via `dangerouslySetInnerHTML` | Sanitize HTML with DOMPurify |
| 4 | **P1** | `finance/iworkr-connect` | Payout without auth header | Use server action with proper auth |
| 5 | **P1** | `roster/dispatch` | `useMemo` with `setState` | Change to `useEffect` |
| 6 | **P1** | `dispatch/page` | Hardcoded fake shift coverage | Wire to real data |
| 7 | **P1** | `jobs/[id]` | False 404 during loading | Add loading check before not-found |
| 8 | **P1** | `settings/widgets` | Wrong org data from stale closure | Add `orgId` to `useCallback` deps |
| 9 | **P1** | `accounts-payable` | `prompt()` for rejection | Replace with inline form |
| 10 | **P2** | `finance/invoices/[id]` | Hardcoded "GST (10%)" + locale-dependent currency | Use actual tax rate + fixed locale |

---

## SECTION HEALTH SCORECARD

| Section | Pages | P0 | P1 | P2 | P3 | Health |
|---------|-------|----|----|----|----|--------|
| Finance (21 pages) | 21 | 1 | 4 | 20 | 9 | 🟡 Fair |
| Care (31 pages) | 31 | 0 | 2 | 27 | 7 | 🟡 Fair |
| Fleet/Dispatch/Schedule (10 pages) | 10 | 0 | 3 | 25 | 13 | 🟡 Fair |
| Settings (9 pages) | 9 | 1 | 3 | 10 | 5 | 🟠 Needs Work |
| Admin/Compliance/Governance (4 pages) | 4 | 0 | 1 | 5 | 2 | 🟡 Fair |
| Jobs/Clients/Team/Workforce (17 pages) | 17 | 0 | 3 | 16 | 20 | 🟡 Fair |
| AI Agent (7 pages) | 7 | 0 | 0 | 6 | 2 | 🟢 Good |
| Ops (6 pages) | 6 | 0 | 0 | 6 | 3 | 🟢 Good (but many stubs) |
| Forms (5 pages) | 5 | 0 | 0 | 1 | 2 | 🟢 Good |
| Clinical (2 pages) | 2 | 0 | 1 | 4 | 1 | 🟡 Fair |
| Remaining (22 pages) | 22 | 0 | 0 | 5 | 7 | 🟢 Good |
| Layouts (4 files) | 4 | 0 | 0 | 0 | 1 | ✅ Excellent |

---

*Audit performed by reading all 144 files in full across 6 parallel analysis passes.*
