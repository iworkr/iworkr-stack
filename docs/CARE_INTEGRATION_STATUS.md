# iWorkr Care Integration — Comprehensive Status Brief

> **Document version:** 2026-03-12  
> **Codename:** Project Nightingale  
> **Status:** Phase 2 Complete — Clinical Safety & Health Intelligence  
> **Platforms:** Web (Next.js 16), Mobile (Flutter 3.11+), Backend (Supabase)

---

## 1. Executive Summary

iWorkr has been expanded from a trades-only field service management platform into a dual-sector system serving both **Trades & Field Service** and **Care & Support (NDIS / Aged Care)** organizations. This expansion — internally codenamed **Project Nightingale** — is driven by a single architectural toggle: the `industry_type` column on the `organizations` table. When set to `"care"`, the entire platform morphs its UI labels, navigation structure, brand accent color, feature visibility, and compliance workflows to serve care workers, coordinators, and participants.

The integration spans **three platforms** (web app, Flutter mobile app, Supabase backend), **six database migrations** creating ten care-specific tables, **one scheduling compliance Edge Function**, and a translation/lexicon layer that maps 225+ trades terms to their care equivalents. As of this writing, Phase 1 (core infrastructure, credentials, participant profiles) and Phase 2 (eMAR, incidents, health observations) are fully implemented and deployed to production.

---

## 2. Architecture Overview

### 2.1 The Single Toggle Pattern

The entire care/trades dichotomy is governed by one column:

```sql
ALTER TABLE organizations
ADD COLUMN industry_type text NOT NULL DEFAULT 'trades'
CHECK (industry_type IN ('trades', 'care'));
```

This value is set during onboarding when the user selects their sector ("Trades & Field Service" or "Care & Support") and persists as the organization's permanent operating mode. All downstream decisions — from navigation labels to compliance enforcement — flow from this single source of truth.

### 2.2 Platform-Specific Translation Layers

| Platform | Mechanism | File | Entries |
|---|---|---|---|
| **Web (Next.js)** | `useIndustryLexicon()` React hook | `src/lib/industry-lexicon.ts` | 225 lexicon entries |
| **Mobile (Flutter)** | `isCareProvider` + `labelTranslatorProvider` (Riverpod) | `flutter/lib/core/services/industry_provider.dart` | 44 lexicon entries |
| **Backend** | Direct column read; `validate-schedule` Edge Function | `supabase/functions/validate-schedule/` | N/A |

Both frontend layers expose a translator function (`t()` on web, `t()` via `labelTranslatorProvider` on mobile) that accepts a trades-default string and returns the care-equivalent when the user's organization is a care org. Key translations include:

| Trades Term | Care Term |
|---|---|
| Job | Shift |
| Client | Participant |
| Invoice | Claim |
| Quote | Service Agreement |
| Technician | Support Worker |
| Dispatch | Roster / Coordination |
| Revenue | Funding |
| Pipeline | Referral Pipeline |
| Equipment | Aids & Equipment |
| Fleet | Transport |

### 2.3 Visual Theming

The care mode applies a distinct visual identity while remaining within the Obsidian design system:

| Token | Trades | Care |
|---|---|---|
| **Primary accent** | `#10B981` (Signal Green / Emerald) | `#3B82F6` (Blue-500 / "Care Blue") |
| **Accent dim** | `rgba(16, 185, 129, 0.12)` | `rgba(59, 130, 246, 0.12)` |
| **Background** | `#050505` (unchanged) | `#050505` (unchanged) |
| **Surfaces** | `#0A0A0A` / `#141414` (unchanged) | `#0A0A0A` / `#141414` (unchanged) |
| **Typography** | Inter / JetBrains Mono (unchanged) | Inter / JetBrains Mono (unchanged) |

The accent swap is applied to: navigation indicators, buttons, charts, progress bars, status dots, pulse animations, chronometer rings, laser lines, role badges, refresh indicators, and interactive element focus states. The change is purely chromatic — layout, typography, spacing, and component structure remain consistent across both sectors, preserving the unified Obsidian design language.

---

## 3. Database Schema — Care-Specific Tables

Six migrations (`062`–`067`) establish the care data model. All tables follow iWorkr's standard patterns: UUID primary keys, `organization_id` foreign keys with CASCADE delete, `created_at`/`updated_at` timestamps with auto-update triggers, and Row Level Security (RLS) policies scoped to organization membership.

### 3.1 Migration 062 — Industry Toggle

Adds `industry_type` to `organizations`. Two valid values: `'trades'` (default) and `'care'`. Indexed for query performance.

### 3.2 Migration 063 — Worker Credentials (`worker_credentials`)

Workforce compliance and credentialing system. Tracks certifications with expiry dates, verification status, and document attachments.

- **Credential types** (enum): `NDIS_SCREENING`, `WWCC`, `FIRST_AID`, `MANUAL_HANDLING`, `MEDICATION_COMPETENCY`, `CPR`, `DRIVERS_LICENSE`, `POLICE_CHECK`, `OTHER`
- **Verification workflow**: `pending` → `verified` (with `verified_by` user + timestamp) or `rejected` or `expired`
- **Automated expiry management**: Database function `check_credential_expiries()` designed for daily cron execution — auto-expires past-date credentials and enqueues email warnings for credentials expiring within 30 days via the `mail_queue` table
- **RLS**: Workers can manage their own credentials; admin/manager roles can manage all credentials within the organization

### 3.3 Migration 064 — Care Sector Core Tables

Three foundational tables for participant management and shift documentation:

**`participant_profiles`**: Extended profile for care participants, linked 1:1 to the existing `clients` table. Stores NDIS number, date of birth, primary diagnosis, mobility requirements, communication preferences, triggers and risks, support categories (array), and emergency contacts (JSONB array). This is the bridge between iWorkr's generic client entity and the care-specific clinical data model.

**`service_agreements`**: NDIS service agreements with budget tracking. Stores NDIS line items (JSONB), total budget, consumed budget, signature data, date ranges, and agreement status (`draft` → `pending_signature` → `active` → `expired` → `cancelled`). Supports PDF attachment for signed agreements.

**`progress_notes`**: Shift completion notes with **Electronic Visit Verification (EVV)** data. Each note records: context of support, outcomes achieved, risks identified, linked goals (JSONB), and four EVV fields — start lat/lng/time and end lat/lng/time — providing GPS-verified timestamps of when the worker arrived at and departed from the participant's location.

### 3.4 Migration 065 — eMAR Tables

Electronic Medication Administration Record system comprising two tables:

**`participant_medications`**: Active medication register per participant. Captures medication name, generic name, dosage, route (12 routes from `oral` to `transdermal`), frequency (11 frequencies from `once_daily` to `prn`), scheduled time slots, prescribing doctor, pharmacy, PRN status and reason, special instructions, and active/inactive flag.

**`medication_administration_records`**: Individual administration events. Each record links a medication to a worker, participant, and optional shift, with an `outcome` enum (`given`, `refused`, `absent`, `withheld`, `self_administered`, `prn_given`, `not_available`, `other`), timestamp, notes, and optional witness (for controlled substances). PRN records include effectiveness tracking and follow-up scheduling.

### 3.5 Migration 066 — Incidents & Restrictive Practices

**`incidents`**: Full incident reporting lifecycle. Categories include `fall`, `medication_error`, `behavioral`, `environmental`, `injury`, `near_miss`, `property_damage`, `abuse_allegation`, `restrictive_practice`, and `other`. Severity levels: `low`, `medium`, `high`, `critical`. Status workflow: `reported` → `under_review` → `investigation` → `resolved` → `closed`. Stores witnesses (JSONB), immediate actions taken, photo evidence (text array of URLs), reviewer details, and resolution notes.

**`restrictive_practices`**: Governance table for restrictive practice documentation, linked to incidents. Records practice type (`seclusion`, `chemical_restraint`, `mechanical_restraint`, `physical_restraint`, `environmental_restraint`), authorization details, duration, behavioral observations (before/during/after), and mandatory debrief tracking.

### 3.6 Migration 067 — Health Observations

**`health_observations`**: Clinical observation tracking with 15 observation types: `blood_pressure`, `blood_glucose`, `heart_rate`, `temperature`, `weight`, `oxygen_saturation`, `respiration_rate`, `seizure`, `pain_level`, `bowel_movement`, `fluid_intake`, `food_intake`, `sleep_quality`, `mood`, and `other`. Supports numeric values, text values, and dedicated systolic/diastolic fields for blood pressure. Abnormal readings are flagged with `is_abnormal` boolean. Indexed for efficient type-based and abnormal-only queries.

---

## 4. Backend Compliance Logic — Edge Functions

### 4.1 `validate-schedule` — Credential Compliance Hard Gate

The `validate-schedule` Edge Function enforces care-sector credential compliance at the scheduling layer. When a coordinator attempts to assign a worker to a shift in a care organization, the function:

1. **Trades bypass**: If `industry_type === 'trades'`, returns `200` immediately (no checks)
2. **Mandatory credentials check**: Verifies the worker holds three non-expired, verified credentials: `NDIS_SCREENING`, `WWCC`, and `FIRST_AID`
3. **Shift-specific credentials**: Accepts an optional `required_credentials[]` parameter for additional shift-specific requirements (e.g., `MEDICATION_COMPETENCY` for medication-round shifts)
4. **Validation response**: Returns `200` (compliant), `409` (non-compliant, with detailed issue list), `400` (bad request), or `401` (unauthorized)

This function serves as the hard compliance gate — a worker cannot be rostered if their credentials are missing, expired, or unverified.

### 4.2 `process-mail` — Credential Expiry Warnings

The email pipeline includes a `credential_expiry_warning` template that sends advance warnings when worker credentials are approaching expiration, triggered by the daily `check_credential_expiries()` database function.

---

## 5. Web Application — Care Integration (Next.js)

### 5.1 Scope of Integration

**43 files** across the web app consume the industry lexicon hook or contain care-conditional logic. This includes:

- **14 dashboard pages** with translated labels and conditional UI (jobs, schedule, clients, finance, CRM, team, assets, forms, automations, dispatch, plus 3 care-only pages)
- **7 dashboard widgets** with translated labels and blue chart colors for care
- **3 shell components** (sidebar with `careOnly` nav items, topbar breadcrumbs, command menu translations)
- **7 onboarding components** with care-specific flow, copy, and visual theming
- **3 auth/public pages** including the dedicated `/ndis` landing page (1,492 lines)
- **2 store files** with care-specific business logic (schedule credential validation)
- **1 settings component** with translated notification triggers

### 5.2 Navigation — Sidebar Morphing

For care organizations, the web sidebar reorganizes its navigation into a dedicated **"Clinical & Governance"** section containing three care-only items:

| Item | Route | Description |
|---|---|---|
| Medications | `/dashboard/care/medications` | eMAR dashboard |
| Incidents | `/dashboard/care/incidents` | Incident register |
| Observations | `/dashboard/care/observations` | Health observations |

These items are flagged with `careOnly: true` and are hidden for trades organizations. All other sidebar items remain visible but have their labels translated (e.g., "Jobs" → "Shifts", "Dispatch" → "Roster").

### 5.3 Care-Specific Pages (Web)

| Route | Lines | Functionality |
|---|---|---|
| `/dashboard/care/observations` | 251 | Health telemetry dashboard — blood pressure, glucose, heart rate, temperature, weight, SpO2, pain, seizures, mood. Filterable by type, searchable, abnormal flagging. |
| `/dashboard/care/medications` | 251 | eMAR — medication chart with administration history. Tracks PRN, routes, frequencies, time slots, outcomes. |
| `/dashboard/care/incidents` | 360 | Incident register — fall, medication error, behavioral, injury, near miss, abuse allegation, restrictive practice. Create modal, severity/status/category filters. |

### 5.4 Zustand Stores (Web — Care-Specific)

| Store | Tables | Key Features |
|---|---|---|
| `medications-store.ts` (226 lines) | `participant_medications`, `medication_administration_records` | Full CRUD, typed models with 12 medication routes, 11 frequencies, 8 MAR outcomes |
| `incidents-store.ts` (203 lines) | `incidents` | Full CRUD, 10 incident categories, 4 severity levels, 5 status states |

### 5.5 Onboarding — Care Flow

The onboarding wizard forks based on sector selection at Step 1:

| Step | Trades Experience | Care Experience |
|---|---|---|
| **Sector** | "Trades & Field Service" (emerald) | "Care & Support" (blue) |
| **Trade** | "What is your primary trade?" (plumbing, HVAC, electrical…) | "What type of care?" (NDIS, aged care, home care…) |
| **Identity** | Placeholder: "Smith's Plumbing" | Placeholder: "BrightPath Care Services" |
| **Team** | "Who is in the van?" | "Who is on your care team?" |
| **Training** | Command palette demo with "Create Job" | Command palette demo with "Create Shift" |
| **Integrations** | Xero, Stripe, Google, Slack | NDIS Portal, PRODA, eMAR integrations |
| **Complete** | "System Operational" (emerald) | "Care Platform Ready" (blue) |

### 5.6 Public Entry — NDIS Landing Page

A dedicated landing page at `/ndis` (1,492 lines) provides a care-sector-specific marketing page with care-tailored hero, features, pricing, and CTAs. All conversion actions link to `/auth?mode=signup&sector=care`, which auto-sets the industry type in the onboarding store and bypasses the sector selection step.

The main marketing site navbar includes a "For NDIS" link pointing to this page.

---

## 6. Mobile Application — Care Integration (Flutter)

### 6.1 Scope of Integration

**21 files** import the industry provider. The integration covers the complete mobile experience:

- **Dashboard**: Entirely different layout for care users (clock-in card, today's roster, care quick actions, compliance banner) vs trades users (revenue, dispatch, schedule, triage)
- **Navigation dock**: Care tabs (Home, Shifts, Roster, Care, Profile) vs Trades tabs (Home, Jobs, Timeline, Comms, Profile)
- **7 dedicated care screens** totaling 3,621 lines of code
- **5 care-specific Riverpod providers** with Supabase Realtime subscriptions
- **5+ typed data models** for care entities

### 6.2 Dashboard Morphing (Mobile)

| Component | Trades Dashboard | Care Dashboard |
|---|---|---|
| **Card 1** | Revenue MTD (sparkline chart, trend badge) | **Clock In/Out** (GPS capture, live elapsed timer, weekly hours) |
| **Card 2** | Live Dispatch (tactical map) | **Today's Roster** (shift list with status indicators) |
| **Card 3** | Schedule (today's blocks) | **Compliance Banner** (credentials + incidents summary) |
| **Card 4** | Triage (priority messages) | **Care Quick Actions** (Medications, Observations, Incidents, Credentials) |
| **Card 5** | Quick Actions (Scan, New Job, Search, Clock In) | Schedule Preview (shared) |

The care dashboard's clock-in card includes:
- **GPS location capture** via Geolocator with permission handling
- **Live elapsed timer** that ticks every second (StreamBuilder)
- **Weekly hours summary** from `weeklyHoursProvider`
- **START SHIFT / END SHIFT button** with loading state, calling `clockIn()`/`clockOut()` from `timeclock_provider.dart`

### 6.3 Navigation Dock (Mobile)

The "Obsidian Dock" floating glass navigation bar switches tab sets based on industry:

| Index | Trades | Care |
|---|---|---|
| 0 | 🏠 Home (`/`) | 🏠 Home (`/`) |
| 1 | 💼 Jobs (`/jobs`) | 💼 **Shifts** (`/jobs`) |
| 2 | 📅 Timeline (`/schedule`) | 📅 **Roster** (`/schedule`) |
| Center | 🔍 Search (overlay) | 🔍 Search (overlay) |
| 3 | 💬 Comms (`/chat`) | 💙 **Care** (`/care`) |
| 4 | 👤 Profile (`/profile`) | 👤 Profile (`/profile`) |

Key difference: Care mode replaces the Chat/Comms tab with the Care Hub (heartbeat icon). Active tab indicators and dots use `careBlue` instead of `emerald`.

### 6.4 Care Screens (Mobile — 7 screens, 3,621 LOC)

| Screen | Route | Lines | Functionality |
|---|---|---|---|
| **Care Hub** | `/care` | 258 | Central navigation hub with compliance stats, clinical nav tiles, documentation links |
| **Credentials** | `/care/credentials` | 711 | Worker credential management with FAB for adding, status filters, verification workflow |
| **Medications** | `/care/medications` | 634 | eMAR dashboard with medication cards, administration recording sheet, PRN support |
| **Observations** | `/care/observations` | 637 | Health observations with 13 observation types, recording bottom sheet, abnormal flagging |
| **Incidents** | `/care/incidents` | 576 | Incident list with severity/status indicators, reporting flow |
| **Incident Detail** | `/care/incidents/:id` | 577 | Full incident detail with status progression (Open → Review → Investigation → Resolved → Closed) |
| **Progress Notes** | `/care/progress-notes` | 228 | Shift completion reports with EVV GPS data |

### 6.5 Care Providers (Mobile — 5 providers with Realtime)

All care providers follow a consistent pattern: initial REST fetch + Supabase Realtime channel subscription via `onPostgresChanges` for live updates, scoped to `organization_id`.

| Provider | Table(s) | Key Exports |
|---|---|---|
| `credentials_provider.dart` (213 lines) | `worker_credentials` | Stream, stats (verified/expiring/expired counts), CRUD, `validateScheduleCompliance()` |
| `medications_provider.dart` (198 lines) | `participant_medications`, `medication_administration_records` | Stream, participant meds, MAR entries, today's pending, `recordAdministration()` |
| `observations_provider.dart` (130 lines) | `health_observations` | Stream, participant observations, today's observations, `recordObservation()` |
| `incidents_provider.dart` (175 lines) | `incidents` | Stream, open incidents, stats (open/critical counts), `createIncident()`, `updateIncidentStatus()` |
| `progress_notes_provider.dart` (143 lines) | `progress_notes` | Stream, job notes, my notes, `createProgressNote()` with EVV GPS fields |

### 6.6 Care-Aware Screen Updates (Mobile)

Beyond dedicated care screens, **12 existing screens** have been updated with care-conditional logic:

| Screen | Care Adaptations |
|---|---|
| **Time Clock** | Title "My Shifts", accent color swap, care-aware chronometer ring |
| **Schedule** | Title "Roster", care-blue laser line, care-blue capsule status colors |
| **Jobs List** | Translated labels ("Shifts"), care-blue refresh indicator |
| **Job Detail** | Translated labels, conditional shift report before completion |
| **Profile** | Role badges (SUPPORT WORKER / COORDINATOR), care-blue avatar fallback and status dots |
| **Settings** | Notification triggers ("New Shift Assigned", "Shift Status Change") |
| **Finance** | "Claims" vs "Invoices" labels |
| **Create Invoice** | "NEW CLAIM", "PARTICIPANT", "SEND CLAIM" |
| **Invoice Detail** | "Claim" fallback, "Participant" label |
| **Team Roster** | Role badges (SW, SR SW, COORD) |
| **Member Dossier** | Role labels, "Shifts MTD", care-specific role picker |
| **Invite Member** | "Invite Support Worker", care role names |

### 6.7 Shift Report Enforcement (Mobile)

The `mission_hud_screen.dart` includes a critical care workflow gate: when a care worker taps "Complete Shift", the app presents a mandatory **Shift Report Sheet** (`shift_report_sheet.dart`) that collects:

- Participant mood and presence assessment
- Shift summary narrative
- Goals linked to the shift
- Observations recorded
- Incidents flagged
- EVV GPS verification (start/end coordinates)

The shift cannot be marked as complete until this report is submitted. This ensures every care shift produces a compliant progress note with EVV data. Trades workers skip this sheet entirely and go directly to the standard job completion debrief.

---

## 7. Billing & Plan Structure

All four plan tiers (Free, Starter $47/mo, Standard $97/mo, Enterprise $247/mo) are **industry-neutral**. There are no care-specific plan tiers or feature gates. Care features (eMAR, incidents, observations, credentials, participant profiles) are available to any organization with `industry_type = 'care'`, regardless of their billing plan. This means a free-tier care organization has access to the same clinical features as an enterprise care organization, differentiated only by user limits and general platform features (automations, API access, SSO, etc.).

---

## 8. Known Gaps & Future Work

### 8.1 Planned Phases (from Decisions Log)

| Phase | Status | Scope |
|---|---|---|
| **Phase 1** — Core Infrastructure | ✅ Complete | Industry toggle, lexicon, credentials, participant profiles, service agreements, progress notes, EVV |
| **Phase 2** — Clinical Safety | ✅ Complete | eMAR, incidents, restrictive practices, health observations |
| **Phase 3** — Financial & Regulatory | 🔲 Planned | NDIS budget tracking, PRODA claims integration, bulk claiming, plan management |
| **Phase 4** — Quality Automation | 🔲 Planned | Automated compliance reporting, quality indicator dashboards, audit trails |

### 8.2 Identified Gaps

1. **`care_plans` table does not exist** — referenced conceptually but no migration or schema exists. This would be needed for structured goal-setting and support plan documentation.

2. **Web care pages use direct Supabase client queries** rather than server actions — an architectural inconsistency with the rest of the web app which uses the `src/actions/` pattern. This should be refactored for consistency and to enable server-side validation.

3. **Mobile lexicon has 44 entries vs web's 225** — the Flutter translation map is significantly smaller than the web equivalent. While the most critical translations are present, edge cases may still show trades terminology to care users on mobile.

4. **No care-specific billing/plan tiers** — care organizations have no differentiated pricing. Depending on business strategy, care-specific plan features (compliance reporting, NDIS claiming, multi-participant management) may warrant dedicated pricing.

5. **Style guide does not document care branding** — the `docs/STYLE_GUIDE.md` file contains no mention of the care blue accent, care-specific component patterns, or industry-conditional design rules. This should be documented for design consistency.

6. **Desktop app (Electron) has no care integration** — the `electron/` platform has received no care-specific modifications. If desktop is a delivery target for care organizations, it will need the same industry-aware treatment.

7. **No NDIS-specific reporting** — while data collection (incidents, observations, medications, progress notes) is comprehensive, there are no export/reporting features tailored to NDIS audit requirements, PRODA submission formats, or quality indicator frameworks.

---

## 9. File Inventory Summary

| Category | Web (Next.js) | Mobile (Flutter) | Backend (Supabase) |
|---|---|---|---|
| **Core translation** | 1 file (283 lines) | 1 file (96 lines) | — |
| **Files using care logic** | 43 files | 21+ files | 2 Edge Functions |
| **Dedicated care pages/screens** | 3 pages | 7 screens (3,621 LOC) | — |
| **Care-specific stores/providers** | 2 Zustand stores | 5 Riverpod providers | — |
| **Care data models** | Inline TypeScript types | 5+ typed Dart models | — |
| **Database migrations** | — | — | 6 migrations (062–067) |
| **Care-specific tables** | — | — | 10 tables |
| **RLS policies** | — | — | 15+ policies |
| **Enums** | — | — | 13 enums |

---

## 10. Conclusion

Project Nightingale transforms iWorkr from a single-sector trades platform into a polymorphic field operating system serving both trades and care industries. The integration is architecturally sound — driven by a single database column, expressed through consistent translation layers, and enforced by backend compliance gates. The care-specific clinical features (eMAR, health observations, incident management, credential compliance, EVV-enabled progress notes) address the core operational requirements of NDIS and aged care providers.

The implementation is production-ready for Phase 1 and Phase 2 scope. Phase 3 (NDIS financial integration) and Phase 4 (quality automation) represent the natural next steps to achieve full NDIS provider compliance and differentiate iWorkr as a complete care operating system.
