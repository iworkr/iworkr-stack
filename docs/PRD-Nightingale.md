# Product Requirements Document: NDIS & Aged Care Operational Platform

**Project**: iWorkr Care Sector Expansion (Project Nightingale)
**Version**: 1.0
**Theme**: "Compassion through Compliance"
**Status**: Approved for Core Engineering — Phase 2 Complete, Phase 3 Pending
**Risk Level**: VERY HIGH (Healthcare data compliance, Privacy Act, Government Billing)
**Dependencies**: Global Scheduling Engine, Offline Sync, Roles/RBAC
**Scope**: Next.js (Web), Flutter (Mobile), Supabase (DB, RLS, Cron), Government APIs (PRODA)

---

## 1. Executive Summary

### 1.1 The Operational Reality of the Care Sector

The field service architecture of iWorkr (dispatching a worker to a location to perform a task and bill for it) is functionally identical to the mechanics of community care. However, the stakes are exponentially higher. A plumber forgetting to upload a photo results in a delayed invoice. A disability support worker forgetting to log a PRN medication administration or an incident report results in severe clinical risk, NDIS Quality and Safeguards Commission audits, and potential harm to a vulnerable participant.

Currently, care providers use fragmented systems: one app for rostering, a paper binder in the client's home for medication, and Excel for tracking NDIS budgets. This creates massive compliance gaps and operational bleeding.

### 1.2 The Objective

"Project Nightingale" is not a separate application. It is a deeply integrated, highly secure configuration state of the core iWorkr platform. By introducing an "Industry Toggle", we morph the platform from a Trades OS into an enterprise-grade Care OS.

This PRD establishes a phased delivery architecture:

- **Phase 1 (Foundational Governance)**: Participant Files, Service Agreements, Workforce Compliance (Hard Gates), and Progress Notes.
- **Phase 2 (Clinical Safety)**: eMAR (Electronic Medication Administration Record), Health Observations, and Restrictive Practice logging.
- **Phase 3 (NDIS Finance)**: Participant Budgets, NDIS Support Catalogue integration, and PRODA Bulk Claim exports.
- **Phase 4 (Quality & Automation)**: Internal Audits, Continuous Improvement (CI) loops, and predictive risk signals.

---

## 2. The Chameleon Architecture (The Industry Toggle)

We must ensure that plumbing workspaces do not see "Medication Charts," and care providers do not see "Asset Maintenance."

### 2.1 The Workspace Configuration

- **Database**: `ALTER TABLE organizations ADD COLUMN industry_type text DEFAULT 'trades' CHECK (industry_type IN ('trades', 'care'));`
- **The Global Provider (React/Flutter)**: Upon login, the app fetches `organization.industry_type` and stores it in global state.

### 2.2 Nomenclature Mapping Dictionary

The UI must never hardcode core entity nouns. They must pass through a translation dictionary.

| Trades Term | Care Term |
|---|---|
| Job | Shift |
| Client | Participant |
| Quote | Service Agreement |
| Technician | Support Worker |
| Dispatcher | Roster Coordinator |
| Invoice | Claim / Invoice |
| My Jobs | My Shifts |
| Dispatch | Roster |
| Team | Support Team |

---

## 3. Phase 1: Operational Safety & Governance (MVP)

### 3.1 Workforce Compliance & The Scheduling "Hard Gate"

A care organization cannot legally dispatch a worker whose screening has expired.

**Schema (`public.worker_credentials`)**:
- `id` (UUID), `workspace_id` (FK), `user_id` (FK to profiles)
- `type` (Enum: NDIS_SCREENING, WWCC, FIRST_AID, MANUAL_HANDLING, MEDICATION_COMPETENCY, CPR, DRIVERS_LICENSE, OTHER)
- `document_url` (Supabase Storage path)
- `issued_date`, `expiry_date` (DATE)
- `verification_status` (Enum: pending, verified, rejected, expired)

**The Expiry Cron Engine**: A pg_cron job runs daily. If `expiry_date` is < 30 days away, it inserts a payload into `mail_queue` to email the worker and HR.

**The Scheduling Hard Gate**: When a Roster Coordinator drags a Shift onto a Worker's calendar, the backend Edge Function executes a strict JOIN on `worker_credentials`. If mandatory credentials are missing or expired, return `409 Conflict`. The Shift card snaps back with a Rose-500 error modal.

### 3.2 Participant Intake & Digital Files

The Client Dossier transforms into the Participant File with sections:
- **Profile**: NDIS Number, Date of Birth, Primary Diagnosis, Emergency Contacts.
- **Support Profile**: Mobility requirements, Communication preferences, Triggers.
- **Service Agreements**: PDF generation outlining agreed NDIS line items and total budget allocation. Must be electronically signed.

### 3.3 Shift Execution & Progress Notes

**Structured Progress Notes**: At the end of a shift, the app forces the Support Worker to complete:
- Context of support (What was planned?)
- Outcomes achieved against Participant Goals
- Changes in condition or risks identified

**Electronic Visit Verification (EVV)**: The app records GPS coordinates and UTC timestamp at "Start Shift" and "Complete Shift" to prove service delivery.

---

## 4. Phase 2: Clinical Safety & Health Intelligence

### 4.1 Medication Management & Digital MAR (eMAR)

**Schema (`public.participant_medications`)**: medication_name, dosage, route, frequency, prescribing_doctor.

**Schema (`public.medication_administration_records`)**: shift_id, medication_id, worker_id, outcome (given, refused, absent, prn_used), exact_time_administered, notes.

**The PRN Loop**: If a PRN medication is given, the system schedules an automated task for 2 hours later for an "Effectiveness Check".

### 4.2 Incident & Restrictive Practice Governance

- Floating FAB on mobile: "Log Incident/Hazard"
- Categorization: Falls, Medication Error, Behavioral, Environmental
- Restrictive Practices trigger immediate High-Priority push notification to Quality/Governance Manager
- Incidents auto-linked to Participant file, Worker file, and Shift record

### 4.3 Health Observations (Telemetry)

Workers log Blood Glucose, Blood Pressure, Weight, Seizure activity. Web Dashboard renders these using charts for trend detection.

---

## 5. Phase 3: NDIS Financial Engine & Integrations

### 5.1 The NDIS Support Catalogue

Edge Function parses NDIA pricing CSV into `public.ndis_catalogue` table.

### 5.2 Participant Budget Tracking

Categories: Core Supports, Capacity Building, Capital. Burn Rate Engine calculates estimated vs consumed funds. Amber-500 warning when budget would be exceeded.

### 5.3 PRODA Bulk Claim Exports

Route: `/dashboard/finance/ndis-claims`. Generates CSV strictly adhering to PRODA data specification. Reconciliation flow for remittance files.

---

## 6. Phase 4: Quality System Automation & Intelligence

### 6.1 Continuous Improvement (CI) Hub

High-severity incidents auto-generate CI Tasks requiring Root Cause Analysis and Action Plans.

### 6.2 The Compliance Audit Pack Generator

Aggregates 12 months of Incident Reports, CI Register, Staff Credentials matrix, Service Agreement samples into a structured .zip file.

---

## 7. Security, Privacy & Edge Cases

### 7.1 Privacy Act Compliance (Data Isolation)

Workers can only view participants they are assigned to (within a 7-day past / 14-day future window). Enforced via RLS policies.

### 7.2 The "Split-Shift" Billing Complexity

The billing engine must run a temporal split against NDIS time-of-day brackets, auto-generating multiple claim lines for a single shift spanning rate boundaries.

---

## 8. Definition of Done (Clinical Readiness Gate)

1. **Compliance Wall Test**: Expired credential blocks scheduling with Rose-500 error.
2. **Offline eMAR Audit**: MAR entry survives airplane mode and syncs within 30 seconds.
3. **PRODA Formatting Test**: Generated CSV matches government specification exactly.
4. **Budget Burn Rate Test**: Overdraw warning fires correctly at budget boundary.
5. **Privacy Isolation Test**: Worker JWT returns only assigned participants via RLS.
