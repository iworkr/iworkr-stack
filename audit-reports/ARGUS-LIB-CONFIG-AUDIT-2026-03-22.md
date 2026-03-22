# 🔍 ARGUS AUDIT — Utility Libraries, Stores, Hooks & Configuration
> **Date**: 2026-03-22  
> **Scope**: `src/lib/` (stores, hooks, utilities, supabase), project configuration files  
> **Files Audited**: 73 source files + 8 configuration files  
> **Total Findings**: 92

---

## Executive Summary

| Severity | Stores/Hooks | Utilities | Config | TOTAL |
|----------|-------------|-----------|--------|-------|
| 🔴 CRITICAL | 5 | 4 | 3 | **12** |
| 🟠 HIGH | 7 | 6 | 8 | **21** |
| 🟡 MEDIUM | 10 | 11 | 12 | **33** |
| 🟢 LOW | 8 | 9 | 9 | **26** |
| **TOTAL** | **30** | **30** | **32** | **92** |

**Top systemic risks**:
1. **Cross-org data leaks** — messenger & care-comms stores have no `reset()`, leaking messages between workspace switches
2. **Silent security bypasses** — in-memory rate limiter is useless on serverless, decrypt() returns ciphertext on failure
3. **Billing integrity** — Care plan Stripe webhooks downgrade customers to free, `formatCurrency()` produces incorrect output
4. **Stale closures** — realtime hooks capture initial callbacks permanently, missing events silently

---

## 🔴 CRITICAL FINDINGS (12)

### STORES & HOOKS

#### C-01: No `reset()` on `messenger-store` — cross-org message leak
- **File**: `src/lib/stores/messenger-store.ts` | Lines 93–271
- **Category**: incomplete
- **Description**: The messenger store has **no `reset()` function**. When a user switches workspaces via `auth-store.switchOrg()`, channels, messages, and members from Org A persist while in Org B. This is a **data privacy violation** — users see another organization's messages. Compare with `voice-store` (has `reset()` at line 170).

#### C-02: No `reset()` on `care-comms-store` — NDIS participant data leak
- **File**: `src/lib/stores/care-comms-store.ts` | Lines 103–264
- **Category**: incomplete
- **Description**: Same issue. Participant medical data, care channels, and clinical messages from one organization persist in-memory after workspace switch. Holds **NDIS participant data** — a regulatory compliance issue.

#### C-03: `loadChannels` guard prevents reload forever
- **File**: `src/lib/stores/messenger-store.ts` | Lines 103–111
- **Category**: error
- **Description**: `if (get().channelsLoaded) return;` blocks reloading permanently. No `forceRefresh`, no invalidation. On error, catches and sets `channelsLoaded: true` with empty data — permanently hiding the failure. Same pattern in `care-comms-store.ts` lines 115–125.

#### C-04: `loadMessages` caching prevents new message visibility
- **File**: `src/lib/stores/messenger-store.ts` | Lines 113–127
- **Category**: error
- **Description**: Returns early if `existing?.length` is truthy. Once a channel has messages, it **never re-fetches**. Messages arriving while components are unmounted (and realtime subscription is down) are permanently invisible. Same in `care-comms-store.ts` lines 127–141.

#### C-05: `settings-store` persists PII to localStorage
- **File**: `src/lib/stores/settings-store.ts` | Lines 258–275
- **Category**: error
- **Description**: `partialize` persists `email`, `phone`, `orgSettings` (including `tax_id`), `orgName`, `orgSlug` to localStorage. Survives browser sessions. If user closes browser without logging out, PII persists indefinitely. Any same-origin XSS exposes this data.

### UTILITIES

#### C-06: In-memory rate limiter is useless on Vercel serverless
- **File**: `src/lib/rate-limit.ts` | Lines 13, 42–68
- **Category**: error
- **Description**: Uses in-memory `Map` for rate tracking. On Vercel, each cold-start container has its own empty Map. **Auth brute-force protection (10 req/min) is effectively disabled.** Comment on line 5–6 acknowledges this but hasn't been fixed.

#### C-07: `decrypt()` returns ciphertext as plaintext on failure
- **File**: `src/lib/encryption.ts` | Lines 23–41
- **Category**: error
- **Description**: Three paths return raw encrypted string as-is: no colons (line 24), failed split (line 27), caught exception (line 38–40). Designed for "legacy tokens" but creates a **security bypass** — malformed ciphertext is silently treated as a valid decrypted value.

#### C-08: Encryption fallback to service role key
- **File**: `src/lib/encryption.ts` | Line 6
- **Category**: error
- **Description**: `getEncryptionKey()` falls back to `SUPABASE_SERVICE_ROLE_KEY` when `OAUTH_ENCRYPTION_KEY` unset. If the service role key rotates, **all encrypted OAuth tokens become permanently undecryptable**. Static salt `"iworkr-oauth-salt"` is hardcoded and shared across all deployments.

#### C-09: Super admin email hardcoded in source code
- **File**: `src/lib/supabase/middleware.ts` | Line 29
- **Category**: error
- **Description**: `SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"]` grants full super admin access. If this email account is compromised, the attacker gets super admin. Should be an env var or database lookup.

### CONFIGURATION

#### C-10: Missing Mapbox env var from `.env.local.example`
- **File**: `.env.local.example` | Missing
- **Category**: incomplete
- **Description**: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is used in 4+ source files but absent from `.env.local.example`. Additionally, `travel-ledger/page.tsx` uses a different name: `NEXT_PUBLIC_MAPBOX_TOKEN`. New devs get a broken dispatch map.

#### C-11: `@types/file-saver` in `dependencies` not `devDependencies`
- **File**: `package.json` | Line 69
- **Category**: config
- **Description**: Type definition packages belong in `devDependencies`. Signals potential misplacement of other `@types/*` packages, bloating production installs.

#### C-12: CSP `interest-cohort=()` is deprecated/invalid
- **File**: `next.config.ts` | Line 30
- **Category**: config
- **Description**: FLoC was replaced by Topics API in 2022. Unknown directives can cause strict parsers to reject the entire `Permissions-Policy` header. Replace with `browsing-topics=()` or remove.

---

## 🟠 HIGH FINDINGS (21)

### STORES & HOOKS

#### H-01: No error state in messenger-store async actions
- **File**: `src/lib/stores/messenger-store.ts` | Lines 103–254
- **Category**: error
- **Description**: `loadChannels`, `loadMembers`, `toggleReaction`, `votePoll`, `createGroupChannel`, `openDM` — none set error state. Store has no `error` field. On `loadChannels` failure, UI shows "no channels" with no way to know or retry.

#### H-02: No error state in care-comms-store async actions
- **File**: `src/lib/stores/care-comms-store.ts` | Lines 115–258
- **Category**: error
- **Description**: Same pattern. `acknowledgeAlert` failure is dangerous — worker thinks they acknowledged a clinical alert but it didn't persist.

#### H-03: Settings store optimistic update doesn't rollback on error
- **File**: `src/lib/stores/settings-store.ts` | Lines 152–167
- **Category**: error
- **Description**: `updateOrgField` applies optimistic update (line 157) before server call. On error, sets `error` but **doesn't rollback state**. UI shows updated value that server rejected. Compare with `updateOrgSettingsField` (line 179) which correctly rolls back.

#### H-04: `useRealtime` captures stale callbacks
- **File**: `src/lib/hooks/use-realtime.ts` | Lines 25–63
- **Category**: error
- **Description**: `useEffect` deps are `[table, options.filter, options.enabled]` — excludes `onInsert`, `onUpdate`, `onDelete`, `onChange`. Callbacks from first render are captured permanently. Re-created callbacks with new closure state are silently ignored.

#### H-05: `useWorkspaceChannel` captures stale options
- **File**: `src/lib/hooks/use-realtime.ts` | Lines 91–143
- **Category**: error
- **Description**: `useEffect` deps are `[orgId, userId]` but body references `options?.onPresenceSync`, `options?.onBroadcast`, `options?.presenceState`. Stale `presenceState` means `track()` sends outdated presence data.

#### H-06: `useData` hook can cause infinite fetch loops
- **File**: `src/lib/hooks/use-data.ts` | Lines 25–60
- **Category**: performance
- **Description**: `useCallback(async () => { ... }, deps)` passes caller's `deps` directly as dependency array. If caller passes object/array references that change every render, this triggers infinite fetch loop.

#### H-07: `auth-store.initialize()` has no concurrent invocation guard
- **File**: `src/lib/auth-store.ts` | Lines 43–141
- **Category**: error
- **Description**: Two components mounting simultaneously both execute full Supabase query chain in parallel, causing state thrashing. `loading` flag isn't checked before starting.

### UTILITIES

#### H-08: Missing Care plans in `stripePriceToPlanKey()` mapping
- **File**: `src/lib/stripe.ts` | Lines 22–41
- **Category**: incomplete
- **Description**: Maps only `starter`, `pro`, `business` plans. Omits `care_standard`, `care_premium`, `care_plan_manager`. When a Care plan Stripe webhook fires, returns `"free"`, **downgrading paying Care customers**.

#### H-09: Plan key naming inconsistency
- **File**: `src/lib/plans.ts` | Lines 140–228, 397
- **Category**: inconsistency
- **Description**: Key `"pro"` → display name "Standard". Key `"business"` → "Enterprise". CLAUDE.md says "Starter / Standard / Enterprise" but code uses "free / starter / pro / business". `isHigherTier()` can't compare trades vs. care plans. `care_plan_manager` missing from `PLAN_ORDER`.

#### H-10: `formatCurrency()` produces incorrect output
- **File**: `src/lib/format.ts` | Lines 5–7
- **Category**: error
- **Description**: `formatCurrency(123.456)` → `"$123.456"`. No enforcement of 2 decimal places. `formatCurrency(NaN)` → `"$NaN"`. `formatCurrency(-500)` → `"$-500"`. For a billing platform, this is a liability.

#### H-11: NDIS rate engine hardcoded to Brisbane UTC+10
- **File**: `src/lib/ndis-codes.ts` | Lines 87–93
- **Category**: error
- **Description**: Hardcodes `BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000`. NDIS is a national system — providers in Sydney, Melbourne, Adelaide, Hobart (who observe DST) get **incorrect rate codes**. Needs configurable timezone per provider.

#### H-12: Auth store persists PII to localStorage
- **File**: `src/lib/auth-store.ts` | Lines 276–284
- **Category**: error
- **Description**: Persists `profile`, `organizations`, `currentOrg`, `currentMembership` including email, phone, org names, membership roles, branch assignments. Any XSS exposes this data.

#### H-13: Edge middleware makes up to 5 sequential DB queries
- **File**: `src/lib/supabase/middleware.ts` | Lines 133–265
- **Category**: performance
- **Description**: Profile check, membership check, portal link check, another membership check, onboarding check — up to ~500ms of added latency at the edge. Should be a single RPC or reliable JWT claims.

### CONFIGURATION

#### H-14: Two competing drag-and-drop libraries
- **File**: `package.json` | Lines 53–55, 58
- **Category**: inconsistency
- **Description**: Ships both `@dnd-kit/*` AND `@hello-pangea/dnd`. ~80KB+ of duplicate DnD functionality. `@dnd-kit` used in 2 files, `@hello-pangea/dnd` in 1 file.

#### H-15: `web-vitals` installed but never imported
- **File**: `package.json` | Line 91
- **Category**: incomplete
- **Description**: Listed in dependencies but never imported anywhere in `src/`. Dead weight.

#### H-16: Inconsistent Mapbox env var naming
- **Files**: Multiple | `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` vs `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Category**: inconsistency
- **Description**: Three files use one name, `travel-ledger/page.tsx` uses another. Even with one set, travel ledger map breaks.

#### H-17: `lottie-react` not imported — dead dependency
- **File**: `package.json` | Line 78
- **Category**: config
- **Description**: Listed in deps, never imported. Project uses `lottie-web` instead. ~50KB dead weight.

#### H-18: Playwright `webServer.command` uses `npm` instead of `pnpm`
- **File**: `playwright.config.ts` | Line 295
- **Category**: inconsistency
- **Description**: Project enforces `pnpm` via `packageManager` field, but Playwright's web server command uses `npm run dev`.

#### H-19: No Vitest coverage configuration
- **File**: `vitest.config.ts` | Lines 7–11
- **Category**: incomplete
- **Description**: No coverage provider, thresholds, or exclude patterns. `vitest run --coverage` will either fail or produce unconfigured output.

#### H-20: No Vitest setupFiles configured
- **File**: `vitest.config.ts` | Lines 7–11
- **Category**: incomplete
- **Description**: Uses `jsdom` environment but no setup for `@testing-library/jest-dom`, `next/navigation` mocks, or Supabase client mocks.

#### H-21: CSP missing `media-src` directive
- **File**: `next.config.ts` | Lines 38–54
- **Category**: incomplete
- **Description**: No `media-src` directive. Media from Supabase Storage blocked by `default-src 'self'`. Silent failures for video/audio content.

---

## 🟡 MEDIUM FINDINGS (33)

### STORES & HOOKS

| # | File | Lines | Category | Description |
|---|------|-------|----------|-------------|
| M-01 | `messenger-store.ts` | 212–244 | performance | `toggleReaction` and `votePoll` rebuild ALL channel messages O(n×m) per call |
| M-02 | `care-comms-store.ts` | 229–241 | performance | `removeRealtimeMessage` iterates all channels to find target — no channelId param |
| M-03 | `branding-store.ts` | 189–194 | inconsistency | Persists `branding` but not `_lastFetchedAt` — always refetches on reload, defeating SWR |
| M-04 | `branding-store.ts` | 61–89 | error | `loadFromServer` race with concurrent calls — both pass freshness check before either sets `_lastFetchedAt` |
| M-05 | `settings-store.ts` | 96–277 | incomplete | No `reset()` function — old user's settings persist in-memory after sign-out until tab refresh |
| M-06 | `use-org.ts` | 13 | error | Module-level `cachedOrg` singleton persists across HMR, leaks between test cases |
| M-07 | `use-org.ts` | 85 | inconsistency | `(supabase as any)` bypasses type checking — schema changes fail silently at runtime |
| M-08 | `use-org-query.ts` | 20 | error | `orgId!` non-null assertion when orgId could theoretically be null between enabled check and execution |
| M-09 | `use-participants-query.ts` | 138–139 | error | `invalidateAll` ignores passed `workspaceId`, invalidating ALL workspace queries aggressively |
| M-10 | `participant-intake-store.ts` | 80–81 | error | Default dates use `today()` evaluated at import time — stale across midnight |

### UTILITIES

| # | File | Lines | Category | Description |
|---|------|-------|----------|-------------|
| M-11 | `validation.ts` | 156–163 | inconsistency | `sanitize()` escapes `/` to `&#x2F;` — breaks URLs, file paths, dates |
| M-12 | `validation.ts` | 50, 69, 108 | error | `due_date` accepts any string, no date validation (compare `start_time` which uses `.datetime()`) |
| M-13 | `ndis-codes.ts` | 11, 20–51 | config | NDIS rate table uses 2024–25 rates — likely stale by 1–2 pricing cycles |
| M-14 | `format.ts` | 9–28 | error | `formatDate("garbage")` → `"Invalid Date"` string, `formatRelativeTime("garbage")` → negative values |
| M-15 | `cache-utils.ts` | 18–26 | incomplete | `clearAllCaches()` only clears `iworkr-*` keys, misses `chronos-v1` (timer PII persists after sign-out) |
| M-16 | `plans.ts` | 400–404 | error | `isHigherTier()` asymmetric for unknown plans — unknown plans treated as lower than free |
| M-17 | `app-url.ts` | 9 | config | Hardcoded `"https://iworkrapp.com"` production fallback |
| M-18 | `session-geometry.ts` | 87–89, 121–123 | performance | Creates new Supabase admin client per request instead of singleton |
| M-19 | `ndis-codes.ts` | 95–151 | error | `resolveNdisCode()` doesn't handle cross-day shifts (Saturday 11PM → Sunday 3AM all billed at Saturday rate) |
| M-20 | `chronos-store.ts` | 100–114 | error | `pauseTimer()` calculates delta from `startedAtIso` — timezone changes can lose time silently |
| M-21 | `credentials-store.ts` | 258–263 | error | `uploadDocument()` generates **public** URLs for worker credentials (NDIS screening, police checks). Should use signed URLs with expiry. |

### CONFIGURATION

| # | File | Lines | Category | Description |
|---|------|-------|----------|-------------|
| M-22 | `tailwind.config.ts` | missing | config | No TS config file — relies on CSS `@theme` in Tailwind v4. No `safelist` for dynamic classes |
| M-23 | `tsconfig.json` | 3 | performance | Target `ES2017` is outdated for Node 18+. `ES2022` produces cleaner emit |
| M-24 | `tsconfig.json` | 14 | config | `jsx: "react-jsx"` should be `"preserve"` for Next.js (SWC handles JSX) |
| M-25 | `package.json` | 76 | config | `html2canvas` v1.4.1 unmaintained since 2023, known issues with modern CSS |
| M-26 | `playwright.config.ts` | 30 | config | `retries: 1` in CI — low for complex E2E with auth, maps, Stripe |
| M-27 | `playwright.config.ts` | 31 | performance | `workers: 1` locally — serial test execution is extremely slow |
| M-28 | `playwright.config.ts` | 59–61 | performance | `trace: "on"` + `video: "on"` + `screenshot: "on"` locally — hundreds of MB per run |
| M-29 | `playwright.config.ts` | 68 | config | `setup` project matches `/$^/` regex (nothing) — wasteful empty dependency |
| M-30 | `eslint.config.mjs` | 22–30 | config | `e2e/` and `tests/` directories not explicitly linted or ignored |
| M-31 | `next.config.ts` | 42 | config | CSP `script-src` allows `'unsafe-inline'` in production — weakens XSS protection |
| M-32 | `package.json` | 74 | config | `file-saver` used in only 1 file — native `<a download>` or `showSaveFilePicker()` would eliminate dependency |
| M-33 | `package.json` | 61, 77 | config | Both `jspdf` AND `@react-pdf/renderer` installed — `jspdf` used in only 2 files |

---

## 🟢 LOW FINDINGS (26)

### STORES & HOOKS

| # | File | Lines | Description |
|---|------|-------|-------------|
| L-01 | `messenger-store.ts` | 138–144 | `setActiveChannel` fires `loadMessages`/`markRead` as fire-and-forget — no error handling |
| L-02 | `voice-store.ts` | 130–138 | `endCall` sets status "ended" but doesn't null `activeCall` — inconsistent with `reset()` |
| L-03 | `voice-store.ts` | 52–90 | `deviceStatus` has "error" variant but no `error` field for the actual message |
| L-04 | `care-comms-store.test.ts` | 495–508 | Doesn't test `sendingMessage` reset on error, no concurrent send tests |
| L-05 | `use-fleet-tracking.ts` | 21–46 | Between effect cleanup and restart, old `sendPosition` can fire for wrong org |
| L-06 | `use-dashboard-path.ts` | 18–19 | `(currentOrg as Record<string, unknown>)` — `industry_type` missing from type definition |
| L-07 | `use-active-branch.ts` | 21–23 | Redundant `typeof window === "undefined"` guard in client-only hook |
| L-08 | `use-data.ts` | 92–116 | `useMutation` callback has stale `options` reference (eslint-disable acknowledges it) |

### UTILITIES

| # | File | Lines | Description |
|---|------|-------|-------------|
| L-09 | `format.ts` | 30–39 | `formatPhoneNumber()` only handles AU numbers — no international support |
| L-10 | `ndis-utils.ts` | 4–8 | NDIS number validation just checks 9 digits — no Luhn/check digit |
| L-11 | `validation.ts` | 24–27 | `companyNameSchema` regex `^[a-zA-Z0-9\s&'.,-]+$` blocks non-ASCII (e.g. "Müller Plumbing") |
| L-12 | `data.ts` / `team-data.ts` | entire | 793 + 567 lines of mock data shipped in production bundle |
| L-13 | `supabase/client.ts` | 30–46 | `resolveWorkspaceId()` silently swallows JSON parse errors |
| L-14 | `logger.ts` | 73–85 | Production logger logs empty string when no data provided |
| L-15 | `onboarding-store.ts` | 67–74 | `slugify("!!!###")` → empty string. Edge case with punctuation-only names. |
| L-16 | `automations-data.ts` | 6 | `BlockType` exported from both `automations-data.ts` and `forms-data.ts` with different types |
| L-17 | `billing-store.ts` | 97–103 | Persists `_lastFetchedAt` — stale plan data after mid-session upgrade if browser reopened quickly |

### CONFIGURATION

| # | File | Lines | Description |
|---|------|-------|-------------|
| L-18 | `postcss.config.mjs` | 1–7 | No explicit `autoprefixer` — ok because Tailwind v4 includes it |
| L-19 | `package.json` | 102 | `@types/node` pinned to `^20` — should match minimum supported Node version |
| L-20 | `eslint.config.mjs` | 2–3 | Both `core-web-vitals` and `typescript` configs used — intentional, no issue |
| L-21 | `eslint.config.mjs` | 26 | `@typescript-eslint/no-explicit-any` is `"warn"` — should be `"error"` for new code |
| L-22 | `eslint.config.mjs` | 28 | `react-hooks/exhaustive-deps` is `"warn"` not `"error"` |
| L-23 | `package.json` | missing | No `engines` field or `.nvmrc` to enforce Node version |
| L-24 | `next.config.ts` | 29–30 | `Permissions-Policy` doesn't restrict `payment`, `usb`, `bluetooth` APIs |
| L-25 | `.gitignore` | — | `testsprite_tests/` with 80+ untracked Python files clutters `git status` |
| L-26 | `next.config.ts` | 60 | Static asset cache regex misses `.webp`, `.avif`, `.ttf`, Lottie `.json` |

---

## 🎯 Priority Action Matrix

### Immediate (Week 1) — Security & Data Integrity
| # | Action | Findings | Effort |
|---|--------|----------|--------|
| 1 | **Add `reset()` to `messenger-store` and `care-comms-store`** — call from `switchOrg()` and `signOut()` | C-01, C-02 | 2h |
| 2 | **Replace in-memory rate limiter** with Upstash Redis | C-06 | 4h |
| 3 | **Fix `decrypt()` to throw or return `null` on failure** instead of returning ciphertext | C-07 | 1h |
| 4 | **Add Care plans to `stripePriceToPlanKey()`** mapping | H-08 | 1h |
| 5 | **Move super admin emails to env var** | C-09 | 30m |
| 6 | **Use signed URLs for credential documents** | M-21 | 2h |
| 7 | **Fix `formatCurrency()` to enforce 2 decimal places** | H-10 | 30m |

### Short-term (Week 2–3) — Reliability
| # | Action | Findings | Effort |
|---|--------|----------|--------|
| 8 | **Add SWR invalidation to messenger/care-comms channels** — replace permanent `channelsLoaded` flag | C-03, C-04 | 4h |
| 9 | **Fix stale closures in `useRealtime` hooks** — use `useRef` for callbacks | H-04, H-05 | 3h |
| 10 | **Add error states to messenger & care-comms stores** | H-01, H-02 | 3h |
| 11 | **Add optimistic rollback in settings-store** | H-03 | 1h |
| 12 | **Fix NDIS timezone to be configurable per-provider** | H-11 | 4h |
| 13 | **Clear `chronos-v1` on sign-out** — add to `clearAllCaches()` | M-15 | 30m |
| 14 | **Unify Mapbox env var naming** + add to `.env.local.example` | C-10, H-16 | 1h |

### Medium-term (Week 4+) — Performance & Cleanup
| # | Action | Findings | Effort |
|---|--------|----------|--------|
| 15 | **Remove dead dependencies** (`lottie-react`, `web-vitals`, consolidate DnD) | H-14, H-15, H-17 | 2h |
| 16 | **Reduce edge middleware DB queries** to single RPC | H-13 | 8h |
| 17 | **Fix Playwright config** (`pnpm`, workers, trace settings) | H-18, M-26–M-29 | 2h |
| 18 | **Add Vitest coverage config** | H-19, H-20 | 2h |
| 19 | **Update NDIS rate tables** to current pricing cycle | M-13 | 2h |
| 20 | **Implement nonce-based CSP** — remove `'unsafe-inline'` | M-31 | 8h |

---

## Cross-Cutting Patterns Observed

### 1. Inconsistent Store Patterns
Some stores have `reset()` (voice, branding) while others don't (messenger, care-comms, settings). No standard pattern enforced. **Recommendation**: Create a `createResettableStore` wrapper.

### 2. `(supabase as any)` Anti-Pattern
Found in `use-org.ts`, `branding-store.ts`, `auth-store.ts`. Bypasses type safety for table queries. **Recommendation**: Generate proper Supabase types and use typed clients.

### 3. Stale Closure Pattern in Hooks
Both `useRealtime` and `useWorkspaceChannel` suffer from the same stale-closure bug. **Recommendation**: Create a `useLatestRef` utility hook and apply to all callback-accepting subscription hooks.

### 4. PII in localStorage
`auth-store`, `settings-store`, and `chronos-store` all persist PII to localStorage. **Recommendation**: Limit persisted data to IDs only, hydrate sensitive data from server on mount.

### 5. Missing Error States
`messenger-store`, `care-comms-store`, and `voice-store` have incomplete error handling. **Recommendation**: Standardize on `{ error: string | null; isError: boolean }` across all stores.

---

*Audit performed by Argus Engine — v4.0*  
*Next audit due: 2026-03-29*
