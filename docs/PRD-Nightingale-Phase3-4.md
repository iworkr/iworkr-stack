# iWorkr Care Integration — Phase 3 & 4 Product Requirements Document (PRD)

> **Document Version:** 2026-03-12
> **Codename:** Project Nightingale (Expansion)
> **Target Release:** Q3 2026
> **Platforms:** Web (Next.js 16), Mobile (Flutter 3.11+), Backend (Supabase)
> **Design Language:** Obsidian / Linear.app Aesthetic (Dark Mode, Glassmorphism, Bento Grids, High-Performance UI)

---

## 1. Executive Summary

Following the successful rollout of Project Nightingale Phases 1 and 2 (Clinical Safety, EVV, and core credentials), iWorkr has established a foundational footprint in the Care & Support sector. However, to achieve parity with legacy monoliths like BrevityCare—and ultimately surpass them with our high-performance, Linear-inspired architecture—iWorkr must evolve from a clinical data repository into a **fully automated financial and compliance engine**.

Phase 3 (Financial & Regulatory) and Phase 4 (Quality Automation) will introduce end-to-end NDIS budget management, PRODA API bulk claiming, OCR-driven Plan Management, and SCHADS Award interpretation. The goal is to take the deeply complex, heavily regulated Australian care mechanics and wrap them in iWorkr's signature "sexy," ultra-fast, zero-clutter interface.

This PRD outlines the exact technical requirements, database schemas, and user experience flows required to bridge the remaining gaps and finalize iWorkr as the premier Care Operating System.

---

## 2. UI/UX & Design Principles (The "Obsidian Care" Aesthetic)

Before detailing the functional specs, all engineering and design execution must adhere to the **Obsidian Care** design system. We are dealing with highly dense financial and clinical data; the UI must remain breathless, fast, and aggressively clean.

* **Color Palette:** strict adherence to `#050505` backgrounds. The `careBlue` (`#3B82F6`) is used exclusively for primary CTAs, active states, and positive financial trajectories. Alerts (compliance breaches, budget overruns) utilize a neon, high-contrast crimson.
* **Bento Grid Architecture:** Complex financial dashboards (like the NDIS Budget Tracker) will be segmented into modular, smooth-scrolling bento boxes. No infinite scrolling lists of raw data; use pagination and command-menu (`Cmd+K`) deep links.
* **Micro-Interactions & Lottie:** When bulk PRODA claims are submitted, utilize subtle Lottie animations (e.g., a glowing blue laser line completing a circuit) to indicate background processing. Transitions between states (e.g., Draft Claim -> Submitted) must fade smoothly using Framer Motion.
* **Whitespace & Typography:** Maintain Inter/JetBrains Mono. Financial figures must be perfectly tabular. Dense SCHADS award rules must be hidden behind clean, collapsible accordion menus with generous padding.

---

## 3. Phase 3: Financial & Regulatory Engine

This phase transforms iWorkr into a financial clearinghouse capable of handling NDIS funding constraints natively.

### 3.1 NDIS Price Guide Synchronization Engine

Legacy systems require manual CSV uploads of the NDIS price guide. iWorkr will automate this.

**Functional Requirements:**

* **Dynamic Cataloging:** The backend must maintain a complete, historically versioned catalog of all NDIS Support Item numbers (e.g., `01_011_0107_1_1`).
* **Temporal Querying:** NDIS rates change annually (typically July 1). The pricing engine must calculate shift costs based strictly on the `actual_start` timestamp of the shift, *not* the date the invoice is generated.
* **Region Modifiers:** The system must automatically apply regional loading (MMM 1-7 geographic classification) based on the participant's registered address, applying the correct multiplier to the base rate.

**Database Schema (Migration 068):**

```sql
-- NDIS Support Catalogue — versioned price guide
CREATE TABLE ndis_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_item_number text NOT NULL,          -- e.g. '01_011_0107_1_1'
  support_item_name text NOT NULL,
  registration_group text,
  support_category text NOT NULL,             -- 'core', 'capacity_building', 'capital'
  unit text NOT NULL,                         -- 'hour', 'each', 'day', 'week'
  base_rate_national numeric(10,2) NOT NULL,
  base_rate_remote numeric(10,2),
  base_rate_very_remote numeric(10,2),
  effective_from date NOT NULL,               -- typically July 1
  effective_to date,                          -- NULL = currently active
  is_group_based boolean DEFAULT false,
  provider_travel_eligible boolean DEFAULT false,
  cancellation_eligible boolean DEFAULT false,
  non_face_to_face_eligible boolean DEFAULT false,
  irregularity_indicator text,                -- 'TTP' (temporary transformation), etc.
  created_at timestamptz DEFAULT now()
);

-- Composite index: item number + temporal range for fast lookups
CREATE INDEX idx_ndis_catalogue_item_temporal 
  ON ndis_catalogue(support_item_number, effective_from DESC);
CREATE INDEX idx_ndis_catalogue_category 
  ON ndis_catalogue(support_category);

-- MMM Region Modifiers
CREATE TABLE ndis_region_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mmm_classification int NOT NULL CHECK (mmm_classification BETWEEN 1 AND 7),
  modifier_percentage numeric(5,2) NOT NULL,  -- e.g., 40.00 for 40% loading
  effective_from date NOT NULL,
  effective_to date,
  label text NOT NULL                         -- 'Metropolitan', 'Regional', 'Remote', etc.
);
```

**Edge Function: `sync-ndis-catalogue`**

A new Supabase Edge Function that:
1. Accepts a raw NDIS Price Guide CSV (uploaded by admin or fetched from a scheduled URL)
2. Parses all support item rows, validating against the known schema
3. Inserts new rows with `effective_from` = the guide's publication date
4. Sets `effective_to` on the previous version's rows to one day before the new guide
5. Returns a reconciliation summary: items added, items updated, items deprecated

This function is idempotent — re-uploading the same CSV produces zero changes.

**UI Implementation:**

* A dedicated **"NDIS Pricing Matrix"** settings page at `/dashboard/settings/ndis-pricing`. A sleek, searchable data table (stealth-table pattern) where admins can view current active rates filtered by support category. A subtle, pulsing careBlue status indicator at the top right: `SYNC STATUS: NDIS July 2026 • Up to date`.
* A command-palette action: `Cmd+K` → "Search NDIS Support Items" → instant fuzzy search across all active catalogue items.

### 3.2 Participant Budget Tracking & Live Quarantining

Participants often have split funding (e.g., Core Supports via NDIS + Out-of-pocket top-up). The budget system must prevent over-allocation while maintaining real-time visibility.

**Functional Requirements:**

* **Budget Categories:** Each participant's `service_agreements` record stores NDIS budget allocations broken into three mandatory categories: Core Supports, Capacity Building, and Capital. Each category has its own ceiling.
* **Real-time Quarantining:** When a Coordinator schedules a shift 3 weeks in the future, the system must immediately "quarantine" the projected cost from the participant's available budget. This prevents accidental over-booking. The quarantine is released if the shift is cancelled, and converted to a "consumed" charge when the shift is completed and claimed.
* **Budget Burn Rate Engine:** A live dashboard widget showing the current spend velocity. If the participant is on track to exhaust their Core Supports budget 6 weeks before the agreement end date, the widget displays an Amber warning. If the budget would be exceeded by scheduled (quarantined) shifts, a Rose/crimson hard block appears.
* **Split Billing Logic:** A single completed shift must be capable of generating *multiple* invoice/claim line items across different funders automatically. Example: a 4-hour community access shift generates an NDIS Core claim for 3 hours of support + an NDIS Transport claim for 1 hour of travel + an out-of-pocket excess invoice for participant co-payment.
* **Travel Apportionment:** Travel time and kilometers must be automatically stripped from the base care rate and billed against the specific NDIS travel line item (e.g., `01_799_0107_1_1`). The system must calculate travel based on the distance between consecutive shifts or from the worker's registered home base.

**Database Schema (Migration 069):**

```sql
-- Budget allocations per category per service agreement
CREATE TABLE budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  service_agreement_id uuid REFERENCES service_agreements(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participant_profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('core', 'capacity_building', 'capital')),
  total_budget numeric(12,2) NOT NULL DEFAULT 0,
  consumed_budget numeric(12,2) NOT NULL DEFAULT 0,
  quarantined_budget numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(service_agreement_id, category)
);

-- Budget quarantine ledger — tracks every reservation and release
CREATE TABLE budget_quarantine_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  allocation_id uuid REFERENCES budget_allocations(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('quarantined', 'consumed', 'released')),
  ndis_item_number text,
  description text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_budget_alloc_agreement ON budget_allocations(service_agreement_id);
CREATE INDEX idx_quarantine_shift ON budget_quarantine_ledger(shift_id);
CREATE INDEX idx_quarantine_status ON budget_quarantine_ledger(status) WHERE status = 'quarantined';

-- Funders table — supports multi-funder splitting
CREATE TABLE funders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participant_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,                          -- 'NDIA', 'Plan Manager - XYZ', 'Self-Managed', 'Out of Pocket'
  type text NOT NULL CHECK (type IN ('ndia_managed', 'plan_managed', 'self_managed', 'private', 'other')),
  contact_email text,
  billing_reference text,                      -- ABN, NDIS reference, etc.
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Claim line items — one shift can produce multiple claim lines across funders
CREATE TABLE claim_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  claim_batch_id uuid,                         -- FK to proda_claim_batches (added in 3.3)
  shift_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES participant_profiles(id) ON DELETE CASCADE,
  funder_id uuid REFERENCES funders(id) ON DELETE SET NULL,
  ndis_item_number text,
  description text NOT NULL,
  quantity numeric(8,2) NOT NULL,              -- hours, units, etc.
  unit_rate numeric(10,2) NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  region_modifier numeric(5,2) DEFAULT 0,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'submitted', 'paid', 'rejected', 'written_off')),
  rejection_code text,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_claim_lines_batch ON claim_line_items(claim_batch_id);
CREATE INDEX idx_claim_lines_status ON claim_line_items(status);
CREATE INDEX idx_claim_lines_participant ON claim_line_items(participant_id);
```

**UI Implementation:**

* **Budget Dashboard Widget** (web + mobile): A bento-box card on the participant profile showing three horizontal progress bars (Core / Capacity Building / Capital). Each bar has three segments — consumed (solid blue), quarantined (striped blue), and available (dark). Hovering a bar shows the exact dollar breakdown.
* **Over-budget Hard Block:** When scheduling a shift that would push quarantined + consumed past the total allocation, the schedule canvas shows a shimmering rose border on the shift block. The Coordinator sees: `⚠️ Budget Exceeded: Core Supports ($234 over limit). Adjust hours or reassign funder.`
* **Split Billing Sheet:** After a shift is completed, the finance module presents a pre-calculated split-billing breakdown. The Coordinator reviews and approves with `Cmd+Enter`. Each line item populates `claim_line_items` independently.

### 3.3 PRODA & PACE API Bulk Claiming Integration

This is the most critical feature for cash flow. Organizations cannot manually enter hundreds of invoices into the government portal.

**Functional Requirements:**

* **Payload Generation:** An Edge Function that compiles approved `claim_line_items` into the exact XML/CSV payload required by the NDIS PRODA/PACE APIs.
* **Batch Tracking:** Each submission is tracked as a `proda_claim_batch` with status lifecycle: `draft` → `validating` → `submitted` → `processing` → `reconciled`.
* **Asynchronous Reconciliation:** When a batch of 500 claims is submitted, the API may return 490 successes and 10 failures (e.g., "Insufficient Funds in Plan"). The system must parse this response, automatically mark the 490 as "Paid" (syncing to Xero/QuickBooks via existing webhooks), and isolate the 10 failures with NDIS-specific error codes.
* **Remittance File Ingestion:** The system must accept PRODA remittance advice files (CSV), match them to submitted batches by claim reference, and automatically reconcile payment amounts.

**Database Schema (Migration 070):**

```sql
CREATE TYPE proda_batch_status AS ENUM (
  'draft', 'validating', 'submitted', 'processing', 'partially_reconciled', 'reconciled', 'failed'
);

CREATE TABLE proda_claim_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  batch_number text NOT NULL,                  -- auto-generated: 'BATCH-2026-07-001'
  status proda_batch_status NOT NULL DEFAULT 'draft',
  total_claims int NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  successful_claims int DEFAULT 0,
  failed_claims int DEFAULT 0,
  paid_amount numeric(14,2) DEFAULT 0,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES profiles(id),
  reconciled_at timestamptz,
  proda_reference text,                        -- reference returned by PRODA API
  payload_url text,                            -- Supabase Storage path to submitted CSV/XML
  remittance_url text,                         -- Supabase Storage path to reconciled remittance
  error_log jsonb DEFAULT '[]',                -- Array of {claim_id, error_code, error_message}
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add FK from claim_line_items to batches
ALTER TABLE claim_line_items 
  ADD CONSTRAINT fk_claim_batch 
  FOREIGN KEY (claim_batch_id) REFERENCES proda_claim_batches(id) ON DELETE SET NULL;

CREATE INDEX idx_proda_batches_org ON proda_claim_batches(organization_id);
CREATE INDEX idx_proda_batches_status ON proda_claim_batches(status);
```

**Edge Function: `generate-proda-payload`**

1. Accepts a list of approved `claim_line_items` IDs
2. Validates each item against the `ndis_catalogue` (correct support item number, rate within tolerance, participant NDIS number present)
3. Generates the PRODA-compliant CSV/XML payload
4. Uploads the payload to Supabase Storage
5. Creates a `proda_claim_batches` record with status `validating`
6. Returns the batch ID and validation summary

**Edge Function: `reconcile-proda-remittance`**

1. Accepts a remittance CSV file upload
2. Parses claim references, matching to existing `claim_line_items`
3. Updates statuses: matched paid claims → `'paid'`, unmatched → flagged for review
4. Triggers Xero/QuickBooks sync webhook for paid items
5. Updates the batch record with final reconciliation stats

**UI Implementation — The Reconciliation Dashboard:**

A specialized page at `/dashboard/finance/ndis-claims` with a Bento Box layout:

* **Top Row:** Three metric cards — Total Submitted ($), Awaiting Payment ($), Failed Claims (count). Each card uses the stealth-metric pattern with JetBrains Mono tabular numerals.
* **Center:** Batch list table showing all `proda_claim_batches` with status pills (blue=submitted, green=reconciled, rose=failed). Click to expand.
* **Expanded Batch View — Split Pane:**
  * *Left Pane:* List of failed claims with the exact NDIS error code translated into human-readable text (e.g., `E-403: "Insufficient funds in participant's Core Supports budget"`).
  * *Right Pane:* One-click resolution actions per failed claim: "Shift to Out-of-Pocket Funder", "Adjust Hours & Resubmit", "Write Off", "Escalate to Participant". Each action updates the `claim_line_items` status and optionally creates a new draft claim.

### 3.4 Plan Management & OCR Invoice Parsing Module

For organizations acting as Plan Managers (financial intermediaries), iWorkr must process inbound invoices from external third parties (cleaners, therapists, allied health providers).

**Functional Requirements:**

* **Inbound Email Parsing:** Generate a unique inbound email address for the organization (e.g., `invoices@brightpath.iworkr.com`) via integration with Resend's inbound webhook feature or a dedicated Supabase Edge Function HTTP endpoint.
* **OCR Extraction:** Utilize OpenAI's vision model (already integrated via `OPENAI_API_KEY`) to scan attached invoice PDFs. Extract: ABN, Invoice Number, Total Amount, NDIS Line Item Code(s), Participant Name, and Date of Service.
* **Draft Claim Auto-Creation:** Map the extracted data to the `participant_profiles` (fuzzy matching on name + NDIS number) and draft a `claim_line_items` entry against their budget, flagging it for human approval.
* **Confidence Scoring:** Each extracted field receives a confidence score (0-100). Fields below 80% are highlighted in amber for manual review. Fields above 95% are auto-confirmed.

**Database Schema (Migration 071):**

```sql
CREATE TABLE plan_manager_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  source_email text,
  source_abn text,
  provider_name text,
  invoice_number text,
  invoice_date date,
  total_amount numeric(12,2),
  participant_id uuid REFERENCES participant_profiles(id),
  matched_participant_confidence numeric(5,2),  -- 0-100
  extracted_line_items jsonb DEFAULT '[]',       -- [{ndis_item, description, amount, confidence}]
  pdf_url text,                                 -- Supabase Storage path
  ocr_raw_output jsonb,                         -- Full vision model response for audit trail
  status text NOT NULL CHECK (status IN ('received', 'processing', 'review_required', 'approved', 'rejected', 'claimed')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_pm_invoices_org ON plan_manager_invoices(organization_id);
CREATE INDEX idx_pm_invoices_status ON plan_manager_invoices(status);
CREATE INDEX idx_pm_invoices_participant ON plan_manager_invoices(participant_id);
```

**Edge Function: `process-inbound-invoice`**

1. Receives the email payload (sender, subject, attachments)
2. Stores the PDF attachment in Supabase Storage
3. Sends the first page of the PDF to OpenAI Vision API with a structured extraction prompt
4. Parses the response into typed fields (ABN, amount, NDIS items, etc.)
5. Performs fuzzy matching against `participant_profiles` (name + NDIS number)
6. Creates a `plan_manager_invoices` record with confidence scores
7. If all fields ≥ 95% confidence AND the budget has sufficient funds → auto-approves and creates `claim_line_items`
8. Otherwise → sets status to `review_required` and sends a push notification to the Plan Manager

**UI Implementation:**

* **The "Plan Manager Inbox"** at `/dashboard/finance/plan-manager`. A hyper-minimalist split screen:
  * *Left Pane (40%):* Rendered PDF viewer using an embedded `<iframe>` or a React PDF library. The PDF displays with the Obsidian dark treatment (inverted colors for readability on dark backgrounds).
  * *Right Pane (60%):* Extracted data fields displayed as a vertical form. Each field has a colored confidence indicator (careBlue = high confidence, amber = needs review, rose = low confidence/missing). Glowing blue borders around auto-detected text. A prominent `Cmd+Enter` "Approve & Queue for PRODA" action at the bottom.
* **Inbox List:** Above the split pane, a horizontal filter bar: "All | Review Required | Auto-Approved | Rejected". A count badge pulses on "Review Required" when new items arrive.

---

## 4. Phase 3.5: Advanced Rostering & SCHADS Compliance

The Australian Social, Community, Home Care and Disability Services (SCHADS) Award is notoriously complex. Our scheduling engine must act as an automated compliance guardrail.

### 4.1 Award Interpretation Engine (Logic Layer)

We must expand the `validate-schedule` Edge Function into a comprehensive award rules engine.

**Functional Requirements:**

* **Split-Shift Mechanics:** If a worker is rostered from 7:00 AM – 9:00 AM, and again from 3:00 PM – 5:00 PM on the same day, the system must automatically apply the SCHADS "broken shift" allowance to their payroll export. The allowance is a fixed dollar amount per broken shift occurrence, currently defined in the SCHADS award schedule.
* **Fatigue Management (10-Hour Rule):** The system must calculate the exact gap between the `actual_end` of a worker's last shift and the `scheduled_start` of their next shift. If the gap is less than 10 hours, the system triggers a hard UI block (preventing the dispatch) or requires a Manager Override with a mandatory justification note stored as an audit record.
* **Overtime Triggers:** Live calculation of weekly hours. If dragging a shift onto a worker's timeline pushes them over 38 hours, the shift block turns amber (warning of time-and-a-half) or rose (if over 45.6 hours, warning of double-time). The cost preview in the scheduling tooltip adjusts in real-time.
* **Minimum Engagement:** For casual workers, the SCHADS award mandates a minimum 2-hour engagement per shift. If a Coordinator creates a 1-hour shift for a casual worker, the system displays a warning: `⚠️ SCHADS: Casual minimum engagement is 2 hours. Billing will reflect 2 hours.`
* **Saturday/Sunday/Public Holiday Loading:** The rate engine must automatically detect the day-of-week and apply the correct penalty rate multiplier (Saturday = 150%, Sunday = 200%, Public Holiday = 250%). Public holidays are sourced from a configurable `public_holidays` table per state.
* **Sleepover & Active Night Shifts:** The award differentiates between "sleepover" (flat rate) and "active night" (hourly rate) shifts. The shift creation form must include a toggle, and the billing engine must apply the correct rate structure.

**Database Schema (Migration 072):**

```sql
-- SCHADS Award rules engine configuration
CREATE TABLE award_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN (
    'minimum_engagement', 'broken_shift_allowance', 'fatigue_gap_hours',
    'overtime_threshold_weekly', 'double_time_threshold_weekly',
    'saturday_loading', 'sunday_loading', 'public_holiday_loading',
    'sleepover_rate', 'active_night_multiplier'
  )),
  value_numeric numeric(10,2),                 -- e.g., 38.00 for overtime threshold
  value_text text,                             -- for complex rules
  effective_from date NOT NULL,
  effective_to date,
  source text DEFAULT 'SCHADS 2025',           -- award reference
  created_at timestamptz DEFAULT now()
);

-- Public holidays per state (for penalty rate calculation)
CREATE TABLE public_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  state text NOT NULL CHECK (state IN ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'National')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, date, state)
);

-- Fatigue management overrides (audit trail)
CREATE TABLE fatigue_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  gap_hours numeric(4,1) NOT NULL,             -- actual gap in hours
  justification text NOT NULL,
  approved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_public_holidays_date ON public_holidays(date, state);
CREATE INDEX idx_fatigue_overrides_worker ON fatigue_overrides(worker_id);
```

**Edge Function Enhancement: `validate-schedule` v2**

The existing credential compliance function is extended with a second validation pass:

1. **Credential Check** (existing): NDIS_SCREENING, WWCC, FIRST_AID
2. **Fatigue Check** (new): Query the worker's last completed shift end time. If gap < `fatigue_gap_hours` rule → return `409` with `FATIGUE_VIOLATION`
3. **Overtime Check** (new): Sum the worker's scheduled + completed hours for the current week. If exceeds `overtime_threshold_weekly` → return `200` with `WARNING: OVERTIME` (soft warning, not a block). If exceeds `double_time_threshold_weekly` → return `200` with `WARNING: DOUBLE_TIME`.
4. **Minimum Engagement Check** (new): If shift duration < `minimum_engagement` rule AND worker is casual → return `200` with `WARNING: MIN_ENGAGEMENT_APPLIED` (auto-adjust billing to minimum).
5. **Penalty Rate Calculation** (new): Check shift date against `public_holidays`. Calculate the applicable rate multiplier and return it in the response payload for the frontend cost preview.

**UI Implementation:**

* **Schedule Canvas Warnings:** When a Coordinator drags a shift that triggers a SCHADS warning, the shift capsule on the timeline gets a colored glow:
  * *Amber glow + ⚠️ icon:* Overtime (time-and-a-half zone)
  * *Rose glow + 🚫 icon:* Fatigue violation (hard block, requires override)
  * *Purple glow + 🌙 icon:* Public holiday (penalty rate active)
* **Override Modal:** If a fatigue hard block fires, a glassmorphic modal appears: "This shift starts 8.5 hours after [Worker]'s last shift ended. SCHADS requires a minimum 10-hour break. To proceed, a Manager must provide a justification." A text input + "Override & Schedule" button (rose-bordered for high-risk action). The override is logged to `fatigue_overrides`.
* **Cost Preview Tooltip:** Hovering over any shift capsule shows a real-time tooltip with: Base rate, Penalty loading (if applicable), Projected cost, and NDIS line item number.

---

## 5. Phase 4: Quality Automation & Clinical Governance

The transition from Phase 2 (tracking incidents) to Phase 4 (preventing them and surviving audits).

### 5.1 Structured Care Plans (`care_plans` Schema)

Addressing the identified gap in the Phase 2 status brief: we need a structured way to document and track participant goals over time, creating an auditable thread from NDIS funding to daily shift notes.

**Database Schema (Migration 073):**

```sql
CREATE TYPE care_plan_status AS ENUM ('draft', 'active', 'under_review', 'archived');
CREATE TYPE goal_status AS ENUM ('not_started', 'in_progress', 'achieved', 'on_hold', 'abandoned');

CREATE TABLE care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participant_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  status care_plan_status NOT NULL DEFAULT 'draft',
  start_date date,
  review_date date,                            -- mandatory review cycle (typically 12 months)
  next_review_date date,
  domains jsonb NOT NULL DEFAULT '{}',         -- {"daily_living": "Requires 1-person assist", "social": "Needs prompting for community access"}
  assessor_name text,
  assessor_role text,
  notes text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE care_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_plan_id uuid REFERENCES care_plans(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES participant_profiles(id) ON DELETE CASCADE,
  ndis_goal_reference text,                    -- direct link to official NDIS plan goal text
  support_category text,                       -- 'core', 'capacity_building', 'capital'
  title text NOT NULL,
  description text,
  target_outcome text,
  status goal_status NOT NULL DEFAULT 'not_started',
  priority int DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  milestones jsonb DEFAULT '[]',               -- [{"title": "...", "target_date": "...", "achieved": false}]
  evidence_notes text,                         -- what evidence demonstrates progress
  started_at timestamptz,
  achieved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Goal-to-shift linkage table (many-to-many via progress_notes)
CREATE TABLE goal_progress_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid REFERENCES care_goals(id) ON DELETE CASCADE,
  progress_note_id uuid REFERENCES progress_notes(id) ON DELETE CASCADE,
  contribution_summary text,                   -- what the worker did toward this goal during the shift
  created_at timestamptz DEFAULT now(),
  UNIQUE(goal_id, progress_note_id)
);

CREATE INDEX idx_care_plans_participant ON care_plans(participant_id);
CREATE INDEX idx_care_plans_review ON care_plans(next_review_date) WHERE status = 'active';
CREATE INDEX idx_care_goals_plan ON care_goals(care_plan_id);
CREATE INDEX idx_care_goals_status ON care_goals(status) WHERE status = 'in_progress';
CREATE INDEX idx_goal_progress_note ON goal_progress_links(progress_note_id);
```

**Workflow Integration — The Auditable Thread:**

This creates the critical chain the NDIS auditors look for:

```
NDIS Plan Goal  →  care_goals.ndis_goal_reference
      ↓
Care Plan Goal  →  care_goals (with milestones & evidence criteria)
      ↓
Shift Execution →  progress_notes (with EVV GPS, context, outcomes)
      ↓
Goal Linkage    →  goal_progress_links (worker selects which goal they worked on)
      ↓
Financial Claim →  claim_line_items (NDIS item number, rate, amount)
```

**Flutter Mobile Integration:**

When a worker fills out the mandatory Shift Report Sheet (`shift_report_sheet.dart`) on the mobile app:
1. The app queries `care_goals` WHERE `participant_id = current_participant` AND `status = 'in_progress'`
2. A multi-select chip row displays the active goals (e.g., "🎯 Increased community access", "🎯 Independent meal preparation")
3. The worker must tap at least one goal and provide a brief contribution summary
4. On submission, `goal_progress_links` records are created alongside the `progress_notes` entry

This ensures every completed shift has a verifiable link between the NDIS funding justification and the actual support delivered.

**Web UI — Care Plan Management:**

A new sidebar item (care-only): "Care Plans" at `/dashboard/care/plans`.

* **Plan List View:** Filterable by participant, status, and review date. An amber badge pulses on plans approaching their review date.
* **Plan Detail View:** A bento-grid layout with:
  * *Left column:* Participant info card + plan metadata (assessor, dates, status)
  * *Center:* Goals list as expandable cards. Each goal shows status pill, milestone progress bar, and a timeline of linked progress notes
  * *Right column:* Quick-add goal form, review scheduling, and the care domains panel

### 5.2 NDIS Audit & Compliance Export Tooling

During an NDIS Quality and Safeguards Commission audit, providers have 48 hours to produce comprehensive data. iWorkr will make this a one-click process.

**Functional Requirements:**

* **The "Audit Mode" Interface:** A secure, read-only portal view that an Admin can generate via a time-limited magic link (expires after 72 hours). The auditor sees a branded, watermarked read-only dashboard scoped to a specific participant or time range.
* **Dossier Generation:** Ability to select a participant and compile their complete history into a single, beautifully formatted, watermarked PDF:
  * Participant profile & support needs
  * Active Care Plan with all goals and milestone status
  * Service Agreement with budget utilization summary
  * All EVV-verified Progress Notes (chronological, with GPS coordinates)
  * All Incident Reports linked to this participant
  * All Restrictive Practice records (with debrief completion status)
  * Health Observation trends (with abnormal flags highlighted)
  * Medication chart and full MAR history
  * Worker credential verification status for all workers who delivered shifts
* **Bulk Export:** For organization-wide audits, generate a ZIP archive containing individual participant dossiers for all active participants within a date range.
* **Performance Target:** A single participant dossier (12 months of data) must generate within 15 seconds. An organization-wide export (50 participants) must complete within 5 minutes.

**Database Schema (Migration 074):**

```sql
-- Audit sessions — tracks who generated what
CREATE TABLE audit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  generated_by uuid REFERENCES profiles(id),
  magic_link_token text UNIQUE,
  expires_at timestamptz NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('participant', 'organization', 'date_range')),
  scope_participant_id uuid REFERENCES participant_profiles(id),
  scope_date_from date,
  scope_date_to date,
  dossier_urls text[] DEFAULT '{}',            -- Storage paths to generated PDFs
  accessed_count int DEFAULT 0,
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_sessions_token ON audit_sessions(magic_link_token) WHERE magic_link_token IS NOT NULL;
CREATE INDEX idx_audit_sessions_org ON audit_sessions(organization_id);
```

**Edge Function: `generate-audit-dossier`**

1. Accepts: participant_id, date range, and organization_id
2. Executes parallel queries across all care tables (progress_notes, incidents, health_observations, medication_administration_records, care_goals, worker_credentials)
3. Compiles data into a structured JSON payload
4. Renders a PDF using a templating engine (html-to-pdf via Puppeteer or a lightweight Deno PDF library)
5. Applies a diagonal watermark: `CONFIDENTIAL — [Org Name] — Generated [Date]`
6. Uploads to Supabase Storage with a 30-day TTL
7. Returns the download URL

**UI Implementation:**

* **Audit Command Center** at `/dashboard/admin/audit`:
  * A stealth-settings-style page with three action cards:
    1. "Generate Participant Dossier" → participant picker + date range → progress animation → PDF download
    2. "Generate Organization Audit Pack" → date range picker → background job with email notification on completion
    3. "Create Auditor Access Link" → scope picker → generates a 72-hour magic link URL
  * A history table showing all previous audit sessions with download links and access counts

### 5.3 Automated Sentinel Alerts

Moving from passive data collection to active risk management.

**Functional Requirements:**

* **NLP on Progress Notes:** Implement a lightweight text-scanning Edge Function. When a worker submits a progress note containing high-risk keywords ("bruise," "hit," "refused medication," "aggressive," "police," "ambulance," "hospital," "fall," "absconded") but *did not* file an accompanying Incident Report for that shift, the system automatically:
  1. Creates a `sentinel_alert` record
  2. Pushes a critical notification to the Coordinator / Quality Lead
  3. Flags the shift on the Dashboard with a pulsing rose indicator
  4. The Coordinator can dismiss (with reason) or escalate to a formal incident
* **Health Baseline Deviations:** Using the `health_observations` table from Phase 2. If a participant's blood pressure, blood glucose, or weight is logged as `is_abnormal = true` three or more times in a rolling 7-day period, trigger an automated alert to the designated clinical lead with a trend summary.
* **Medication Non-Compliance Patterns:** If a participant has `refused` or `absent` MAR outcomes for 3+ consecutive scheduled doses of the same medication, alert the clinical lead and auto-generate a "Medication Review Required" task.
* **Credential Expiry Escalation:** Extend the existing 30-day expiry warning. At 14 days, escalate to the HR Manager. At 7 days, the worker's name turns amber on the roster. At 0 days, auto-block (existing behavior) + notify the organization owner.

**Database Schema (Migration 075):**

```sql
CREATE TYPE sentinel_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE sentinel_status AS ENUM ('active', 'acknowledged', 'escalated', 'dismissed', 'resolved');

CREATE TABLE sentinel_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN (
    'progress_note_keywords', 'health_baseline_deviation', 'medication_non_compliance',
    'credential_expiry_escalation', 'budget_overrun', 'care_plan_review_due',
    'restrictive_practice_debrief_overdue'
  )),
  severity sentinel_severity NOT NULL DEFAULT 'warning',
  status sentinel_status NOT NULL DEFAULT 'active',
  title text NOT NULL,
  description text NOT NULL,
  participant_id uuid REFERENCES participant_profiles(id),
  worker_id uuid REFERENCES profiles(id),
  shift_id uuid REFERENCES jobs(id),
  source_table text,                           -- 'progress_notes', 'health_observations', 'medication_administration_records', etc.
  source_id uuid,                              -- ID of the triggering record
  triggered_keywords text[],                   -- for NLP alerts, the matched keywords
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  resolution_action text,                      -- 'incident_created', 'dismissed_false_positive', 'escalated_to_clinical', etc.
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sentinel_org_status ON sentinel_alerts(organization_id, status) WHERE status = 'active';
CREATE INDEX idx_sentinel_participant ON sentinel_alerts(participant_id);
CREATE INDEX idx_sentinel_severity ON sentinel_alerts(severity) WHERE severity = 'critical';
```

**Edge Function: `sentinel-scan`**

A scheduled function (runs every 15 minutes or triggered on `progress_notes` INSERT):

1. **Keyword Scan:** For each new progress note, tokenize the text and check against a configurable keyword list. If keywords found AND no `incidents` record exists for the same `shift_id`, create a `sentinel_alert` with severity `critical`.
2. **Health Trend Scan:** For each new health observation, query the last 7 days for the same participant + observation type. If `is_abnormal` count ≥ 3, create a `sentinel_alert` with severity `warning`.
3. **MAR Compliance Scan:** For each medication with a scheduled dose, check if the last 3 consecutive scheduled doses have `outcome` in (`refused`, `absent`). If so, create a `sentinel_alert` with severity `warning`.
4. **Care Plan Review Scan:** Query `care_plans` where `next_review_date` is within 30 days and no review has been initiated. Create `info`-level alerts.

**UI Implementation — Sentinel Dashboard:**

* **Dashboard Widget (web + mobile):** A "Risk Radar" bento card on the main care dashboard. Shows active sentinel alerts grouped by severity. Critical alerts have a breathing rose glow. Tapping an alert navigates to the source record with a slide-up resolution sheet.
* **Resolution Flow:** When a Coordinator taps a keyword-flagged progress note alert, they see: the full progress note text with the triggering keywords highlighted in rose, and three action buttons:
  1. "Create Incident Report" → pre-fills an incident from the progress note data
  2. "Dismiss — False Positive" → requires a one-line reason
  3. "Escalate to Clinical Lead" → sends a push notification + email

---

## 6. Technical Refactoring & Architecture Updates

To support these advanced features, several technical debts and architectural gaps identified in the Phase 2 status brief must be addressed.

### 6.1 Web: Migration to Server Actions

* **The Problem:** Current care pages (Observations, Medications, Incidents) use direct Supabase client queries. This leaks logic to the frontend and bypasses server-side validation.
* **The Fix:** Refactor all 3 pages to use Next.js `src/actions/`. Create `src/actions/care-observations.ts`, `src/actions/care-medications.ts`, `src/actions/care-incidents.ts`. This ensures strict schema validation (using Zod) before touching the database, crucial for health data with legal implications.
* **Scope:** ~6 server action files, ~1,200 lines of code. All existing Zustand stores updated to call server actions instead of direct Supabase queries.

### 6.2 Mobile: Lexicon Parity

* **The Problem:** Flutter app has 44 translation entries vs Web's 225. Trades terminology leaks into care users on edge-case screens.
* **The Fix:** Create a centralized JSON lexicon file (`care_lexicon.json`) stored in `shared/` at the monorepo root. Both Next.js and Flutter read from this master list at build time. The web `industry-lexicon.ts` and Flutter `industry_provider.dart` are generated from this single source.
* **Scope:** 1 shared JSON file, 2 generator scripts, updates to both translation modules.

### 6.3 Desktop App (Electron) Parity

* **The Problem:** The Electron desktop app has zero care integration. Back-office staff (Schedulers, Plan Managers, Quality Leads) are heavy desktop users.
* **The Fix:** Since the Electron app wraps the Next.js web build, inject the `useIndustryLexicon()` hook and ensure all care routes are accessible. The desktop app must support the exact same visual morphing, sidebar routing, and care-only nav items as the web build. Desktop-specific additions: keyboard shortcuts for common care actions (e.g., `Cmd+Shift+I` for quick incident report).
* **Scope:** Electron main process menu updates, preload script additions for care shortcuts, IPC handlers for audit dossier download.

### 6.4 Offline-First Care (Flutter)

* **The Problem:** Care workers operate in homes with unreliable connectivity. eMAR entries, progress notes, and incident reports must work offline.
* **The Fix:** Extend the existing Drift (SQLite) sync engine to cover care-specific tables. When offline, mutations are queued in the local Drift database and synced when connectivity resumes via the existing `sync_queue` mechanism. Conflict resolution: last-write-wins with server timestamp authority, except for MAR records which use append-only semantics (never overwrite, only add).
* **Scope:** 5 new Drift table definitions, sync engine extensions, offline indicator on care screens.

---

## 7. Go-To-Market & Pricing Strategy

With the introduction of PRODA billing and SCHADS compliance, iWorkr's value proposition for care providers increases exponentially compared to the trades offering.

**Recommendation:** Introduce Care-Specific Billing Tiers.

While Phase 1 & 2 remained industry-neutral regarding pricing, Phase 3's infrastructure (OCR processing, PRODA API integration, complex award math, PDF generation) incurs significant server costs and provides massive ROI for care businesses (a single organization may process $500K+ in NDIS claims annually).

| Plan | Monthly | Annual | Max Users | Key Features |
|---|---|---|---|---|
| **iWorkr Care** | $149/mo | $119/mo | 25 | Rostering, EVV progress notes, CRM, eMAR, incidents, health observations, care plans, budget tracking |
| **iWorkr Care Premium** | $299/mo | $239/mo | 100 | + SCHADS award engine, PRODA bulk claiming API, multi-funder splitting, audit dossier generation, sentinel alerts |
| **Plan Manager Add-on** | +$99/mo | +$79/mo | — | OCR invoice parsing inbox, third-party provider management, inbound email processing |
| **Enterprise Care** | Custom | Custom | ∞ | + SSO, dedicated success manager, custom PRODA integrations, SLA, on-premise deployment option |

**Implementation:** Extend `src/lib/plans.ts` with care-specific plan definitions. The `PlanLimits` interface gains new boolean flags: `prodaClaiming`, `schadsEngine`, `auditDossier`, `sentinelAlerts`, `planManagerInbox`, `ocrProcessing`. Feature gates check these flags before rendering Phase 3/4 UI elements.

**Free Tier Strategy:** All care organizations retain free access to Phase 1 & 2 features (credentials, eMAR, incidents, observations, progress notes). This ensures a generous free tier that drives adoption, with monetization at the financial automation layer where ROI is highest.

---

## 8. Acceptance Criteria (Definition of Done)

### Phase 3 (Financials)

- [ ] System can successfully parse an NDIS Price Guide CSV and apply temporal rates. A shift on June 30 uses the old rate; a shift on July 1 uses the new rate.
- [ ] Budget quarantining prevents over-allocation. Scheduling a shift that would exceed the Core Supports budget displays a hard block with the exact overage amount.
- [ ] A single completed shift can be split-billed between NDIS Core, NDIS Transport, and an Out-of-pocket Funder, producing 3 separate `claim_line_items`.
- [ ] `validate-schedule` Edge Function correctly prevents a shift dispatch if it violates the 10-hour SCHADS fatigue rule. A Manager Override with justification note successfully bypasses the block.
- [ ] Overtime cost preview updates in real-time as a shift is dragged on the schedule canvas. The tooltip shows the correct penalty rate multiplier for Saturday/Sunday/public holiday shifts.
- [ ] Plan Manager inbox can ingest a PDF via email and accurately extract ABN, Amount, and NDIS line item with ≥90% accuracy on standard Australian invoices.
- [ ] PRODA payload generator produces a valid CSV that passes validation in the NDIS sandbox environment.
- [ ] Reconciliation of a remittance file correctly marks paid claims and isolates failures with human-readable error descriptions.

### Phase 4 (Quality & Automation)

- [ ] `care_plans`, `care_goals`, and `goal_progress_links` tables are deployed with RLS policies. Only org members can read; only admin/manager roles can create/update plans.
- [ ] Flutter mobile app shift completion sheet forces the user to select at least one active `care_goal` and provide a contribution summary before submission.
- [ ] Sentinel keyword scan correctly detects "bruise" in a progress note and creates a critical alert when no incident report exists for that shift.
- [ ] Health baseline deviation alert triggers after 3 abnormal blood pressure readings within 7 days.
- [ ] Audit Dossier compiler successfully merges a participant's EVV notes, incidents, health observations, MAR history, care plans, and service agreements into a single watermarked PDF within 15 seconds for 12 months of data.
- [ ] Auditor magic link provides read-only scoped access that automatically expires after 72 hours.
- [ ] Web application care pages (Observations, Medications, Incidents) successfully refactored from client-side Supabase queries to Next.js Server Actions with Zod validation.
- [ ] Mobile lexicon parity achieved: Flutter and Next.js both consume the same `care_lexicon.json` master file with 225+ entries.

---

## 9. Rollout Timeline

| Milestone | Target Date | Scope |
|---|---|---|
| **M1: Schema & Foundation** | April 2026 | Migrations 068–075 deployed to staging. `ndis_catalogue`, `budget_allocations`, `claim_line_items`, `care_plans`, `care_goals`, `sentinel_alerts` tables live. RLS policies verified. |
| **M2: Budget & Billing Engine** | May 2026 | Budget quarantining, split billing, travel apportionment. Budget dashboard widget on web + mobile. `validate-schedule` v2 with SCHADS fatigue + overtime. |
| **M3: PRODA Integration** | June 2026 | `generate-proda-payload` Edge Function. Reconciliation dashboard. Remittance file processing. NDIS sandbox certification. |
| **M4: Care Plans & Goals** | June 2026 | Care plans CRUD (web + mobile). Goal-to-shift linkage in Shift Report Sheet. Care plan review scheduling. |
| **M5: Sentinel & Audit** | July 2026 | `sentinel-scan` Edge Function. Sentinel dashboard widget. Audit dossier generator. Magic link portal. |
| **M6: Plan Manager & OCR** | August 2026 | Inbound email processing. OCR extraction via OpenAI Vision. Plan Manager inbox UI. |
| **M7: Polish & Launch** | September 2026 | Technical refactoring (server actions, lexicon parity, Electron, offline). Care pricing tiers live. Marketing launch. |

---

## 10. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| **PRODA API changes without notice** | High | Medium | Maintain a versioned adapter layer. Subscribe to NDIS developer newsletter. Automated payload validation tests run daily against sandbox. |
| **SCHADS award interpretation disputes** | High | High | All award rules are admin-configurable (not hardcoded). Default values match current SCHADS but can be overridden per organization. Legal review of rule implementation before launch. |
| **OCR accuracy on poor-quality PDFs** | Medium | High | Confidence scoring with mandatory human review below 80%. Fallback to manual entry form. Track accuracy metrics per provider for continuous improvement. |
| **Health data breach / Privacy Act violation** | Critical | Low | RLS policies on all care tables. Audit logging on all data access. Participant data scoped to assigned workers only. Time-limited audit links. Encryption at rest (Supabase default). |
| **Offline sync conflicts for MAR records** | High | Medium | Append-only semantics for MAR entries (no overwrites). Server-side deduplication on `(medication_id, worker_id, administered_at)`. Conflict resolution favoring the earliest timestamp. |
| **Budget calculation precision errors** | High | Medium | All monetary calculations use `numeric(12,2)` (not floating point). Quarantine ledger provides full audit trail. Reconciliation reports flag discrepancies > $0.01. |

---

## 11. Dependencies & Prerequisites

| Dependency | Status | Owner | Notes |
|---|---|---|---|
| Phase 1 & 2 (complete) | ✅ Production | Architecture | 10 tables, 6 migrations, 13 enums, 15+ RLS policies |
| Supabase Edge Functions runtime | ✅ Available | Infrastructure | Deno 1.x runtime for all new Edge Functions |
| OpenAI API access | ✅ Configured | Infrastructure | `OPENAI_API_KEY` env var in place for OCR features |
| Resend email integration | ✅ Live | Infrastructure | Inbound webhook capability needed for Plan Manager inbox |
| Stripe billing | ✅ Live | Finance | Existing `src/lib/plans.ts` extended with care tiers |
| NDIS PRODA sandbox access | 🔲 Required | Compliance | Organization must register as a software vendor with NDIA |
| SCHADS award legal review | 🔲 Required | Legal | External employment law review of rule implementation |
| Supabase Storage (PDF generation) | ✅ Available | Infrastructure | Used for audit dossiers, PRODA payloads, remittance files |

---

*This document is a living artifact. As implementation progresses, specific sections will be updated with final migration numbers, exact API endpoint specifications, and verified PRODA payload formats. All changes will be logged in `docs/DECISIONS_LOG.md`.*
