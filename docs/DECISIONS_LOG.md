# Decisions Log — iWorkr

> Record architectural, design, and product decisions here.
> Newest entries at the top.

## Format
```
### [Date] — [Decision title]
- **Decision**: What was decided
- **Why**: Rationale
- **Alternatives considered**: What else was evaluated
- **Consequences**: Impact and tradeoffs
- **Owner**: Who made the decision
```

---

## Decisions

### 2026-03-14 — Project Synapse v1 delivered as compatibility-first extension
- **Decision**: Implemented `Project Synapse` by extending the existing `integrations` architecture (instead of replacing it with a brand-new parallel model) with new primitives: `external_mappings`, `integration_webhooks`, `integration_sync_queue`, and hardened `integration_sync_log`.
- **Why**: The product already had production integrations and UI flows wired to `integrations`; replacing that layer would risk regressions across billing, scheduling, and onboarding. Compatibility-first unlocks immediate webhook ingestion + sync radar while preserving current behavior.
- **Alternatives considered**: Introduce a new `connected_integrations` table and migrate all app code in one release; build per-provider webhook handlers only.
- **Consequences**: Faster rollout with lower migration risk, but provider-specific enrichment still requires credentials and tenant-level mappings (`INCOMPLETE:BLOCKED` trails added in queue/ingest functions).
- **Owner**: Architecture

### 2026-02-27 — Claude Code configuration with full rules, skills, agents, and workflows
- **Decision**: Established comprehensive Claude Code setup with `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `workflows/`, and `docs/STYLE_GUIDE.md` as canonical references.
- **Why**: Ensure consistent, high-quality output from Claude Code sessions. Enforce iWorkr's Obsidian design system, multi-tenancy security patterns, and INCOMPLETE trail conventions.
- **Alternatives considered**: Minimal CLAUDE.md only; external documentation wiki; per-session briefing.
- **Consequences**: Claude Code sessions start with full context. Rules are enforceable and auditable. Living documents evolve with the project.
- **Owner**: Project setup

### 2026-02-15 — Polar.sh as billing merchant-of-record
- **Decision**: Use Polar.sh for subscription billing instead of self-managed Stripe Billing.
- **Why**: Polar.sh handles merchant-of-record responsibilities (tax, compliance, invoicing). Faster to ship. Less billing infrastructure to maintain.
- **Alternatives considered**: Stripe Billing (direct), Paddle, LemonSqueezy.
- **Consequences**: Subscription state is Polar's source of truth. Local `subscriptions` table is a read-cache synced via webhooks. Checkout flow redirects to Polar's hosted page.
- **Owner**: Architecture

### 2026-02-15 — Supabase as backend platform
- **Decision**: Use Supabase (PostgreSQL + Auth + Edge Functions + Realtime + Storage) as the primary backend.
- **Why**: Full-featured BaaS that eliminates need for custom API server. PostgreSQL RLS provides row-level multi-tenancy. Edge Functions handle serverless compute. Realtime enables live features.
- **Alternatives considered**: Firebase, custom Node.js API, AWS Amplify.
- **Consequences**: All backend logic runs as server actions (Next.js) or Edge Functions (Deno). Database is the authority for business rules via RLS. Migrations are SQL-first.
- **Owner**: Architecture

### 2026-02-15 — Dark-first "Obsidian" design system
- **Decision**: Ship with dark theme as default, Signal Green (#10B981) as the only accent color.
- **Why**: Differentiates from typical FSM software. Aligns with Linear-inspired premium aesthetic. Reduces eye strain for field workers checking phones in bright sun (dark text on bright is harder than light text on dark with device brightness up).
- **Alternatives considered**: Light-first with dark mode option; blue/purple accent; multi-color theme.
- **Consequences**: All components must be designed dark-first. Light mode supported but secondary. Green usage must be disciplined (≤10% rule).
- **Owner**: Design

### 2026-03-11 — Design System Revamp: Full Obsidian Enforcement

- **Decision**: Execute comprehensive design system rework across all web pages, components, and Flutter mobile tokens. Eradicate all design drift.
- **Why**: Product had drifted from the Obsidian design system — neon green (#00E676) leaked into 46+ files, hardcoded hex colors (#050505, #080808, #0A0A0A) appeared instead of CSS variable tokens, button/tab/empty-state patterns were inconsistent across modules, and many pages lacked the atmospheric texture (noise, glow) that defines the brand.
- **What changed**:
  - Token enforcement across 60+ files, neon green eradication in 46 files
  - New CSS utilities: `stealth-btn-*`, `stealth-tab`, `stealth-table-*`, `stealth-settings-*`, `stealth-empty-state`, `stealth-paywall`, `stealth-noise`
  - Ghost-tint CSS variable tokens for all semantic status colors
  - Mono overline labels on every dashboard module and settings page
  - Atmospheric treatment (noise texture + emerald radial glow) on all pages
  - All 6 dashboard widgets upgraded with analytical density
  - Flutter Alabaster light theme corrected (6 token fixes), empty state animations aligned
  - Landing page darkened, paywall redesigned as aspirational surface
- **Consequences**: All new UI must use CSS variable tokens from globals.css. Hardcoded hex colors are a blocking review issue.
- **Owner**: Design System Team

### 2026-03-12 — Project Nightingale Phase 2: Clinical Safety & Health Intelligence

- **Decision**: Implement eMAR (Electronic Medication Administration Records), Incident Reporting & Restrictive Practice governance, and Health Observations telemetry.
- **Why**: Phase 1 delivered workforce compliance and participant intake. Phase 2 delivers the clinical safety layer required for NDIS Quality & Safeguards Commission compliance — medication tracking, incident management, and health monitoring.
- **What changed (Phase 2)**:
  - `participant_medications` table with prescription profiles, PRN flags, and time slots
  - `medication_administration_records` table (eMAR) with outcome tracking and PRN effectiveness follow-ups
  - `incidents` table with category/severity/status enums, witnesses, and photo evidence
  - `restrictive_practices` table linked to incidents with authorization and debrief tracking
  - `health_observations` table with 15 observation types (BP, glucose, heart rate, seizure, mood, etc.)
  - Zustand stores: `medications-store.ts`, `incidents-store.ts` with CRUD and filtering
  - Care-sector nav items (Medications, Incidents, Observations) gated by `industry_type === 'care'`
  - Full dashboard pages at `/dashboard/care/medications`, `/dashboard/care/incidents`, `/dashboard/care/observations`
- **All 6 migrations (065-067) applied to production Supabase with RLS policies**
- **Consequences**: Care orgs see 3 new nav items and can track medications, incidents, and health observations. Trades orgs see zero changes.
- **Owner**: Architecture

### 2026-03-12 — Project Nightingale: NDIS & Aged Care Sector Expansion

- **Decision**: Implement an "Industry Toggle" architecture that morphs iWorkr from a Trades OS into a Care OS via `organizations.industry_type` column and a nomenclature abstraction layer.
- **Why**: The field service dispatch model (worker → location → task → bill) maps directly to community care. Care providers use fragmented tools (rostering app + paper medication binders + Excel budgets). iWorkr can capture this market by adding a configuration state, not a separate app.
- **What changed (Phase 1)**:
  - `industry_type` column on `organizations` table ('trades' | 'care')
  - `useIndustryLexicon()` hook replaces all hardcoded labels (Jobs→Shifts, Clients→Participants, etc.)
  - `worker_credentials` table with scheduling "hard gate" — expired credentials block shift assignment
  - `participant_profiles`, `service_agreements`, `progress_notes` tables for care-specific data
  - `validate-schedule` Edge Function enforces credential compliance before scheduling
  - Credential expiry warnings via existing `mail_queue` pipeline
- **Phases planned**: Phase 2 (eMAR, Incidents), Phase 3 (NDIS Budgets, PRODA Claims), Phase 4 (Quality Automation)
- **Consequences**: All new UI labels must go through the lexicon system. Care-specific features gated behind `isCare` checks. Zero regression for existing trades workspaces — `industry_type` defaults to 'trades'.
- **Reference**: `docs/PRD-Nightingale.md`
- **Owner**: Architecture

### 2026-03-12 — Project Nightingale Phase 3 & 4: Financial Engine & Quality Automation

- **Decision**: Implement the NDIS Financial Engine (PRODA bulk claiming, budget quarantining, multi-funder split billing, SCHADS award compliance) and Quality Automation (structured care plans with goal-to-shift linkage, sentinel alerts for automated risk detection, audit dossier generation, OCR invoice parsing for plan managers).
- **Why**: Phase 1 & 2 delivered clinical safety (credentials, eMAR, incidents, health observations). To achieve parity with legacy systems like BrevityCare and become the definitive Care Operating System, iWorkr must handle the financial and compliance dimensions natively — NDIS budget tracking, PRODA claiming, SCHADS award interpretation, and audit readiness.
- **What changed (Phase 3)**:
  - `ndis_catalogue` + `ndis_region_modifiers` tables (migration 068) — versioned NDIS price guide with temporal querying and MMM region loading
  - `funders`, `budget_allocations`, `budget_quarantine_ledger`, `claim_line_items` tables (migration 069) — real-time budget quarantining, multi-funder split billing
  - `proda_claim_batches` table (migration 070) — PRODA/PACE API bulk claim lifecycle tracking
  - `plan_manager_invoices` table (migration 071) — OCR-driven invoice parsing for plan managers
  - `award_rules`, `public_holidays`, `fatigue_overrides` tables (migration 072) — SCHADS award interpretation engine
  - Edge Functions: `sync-ndis-catalogue`, `generate-proda-payload`, `process-inbound-invoice`
  - Web pages: NDIS Pricing Matrix (`/dashboard/settings/ndis-pricing`), NDIS Claims Dashboard (`/dashboard/finance/ndis-claims`), Plan Manager Inbox (`/dashboard/finance/plan-manager`)
  - Server actions: `src/app/actions/care.ts` — Zod-validated CRUD for all care entities
  - Care-specific billing tiers: iWorkr Care ($149/mo), iWorkr Care Premium ($299/mo), Plan Manager Add-on (+$99/mo)
- **What changed (Phase 4)**:
  - `care_plans`, `care_goals`, `goal_progress_links` tables (migration 073) — structured care planning with auditable NDIS goal-to-shift linkage
  - `audit_sessions` table (migration 074) — time-limited magic link audit portal for NDIS audits
  - `sentinel_alerts`, `sentinel_keywords` tables (migration 075) — automated risk detection (NLP keyword scanning, health baseline deviations, medication non-compliance, credential expiry escalation)
  - Edge Function: `sentinel-scan` — triggered on progress note/observation/MAR inserts
  - Web pages: Care Plans (`/dashboard/care/plans`), Sentinel Alerts (`/dashboard/care/sentinel`), Audit Command Center (`/dashboard/admin/audit`)
  - Zustand stores: `care-plans-store.ts`, `budget-store.ts`, `sentinel-store.ts`
  - Sidebar updated with "Clinical & Governance" and "NDIS Finance" nav sections for care orgs
- **All 8 migrations (068–075) applied to production Supabase** — 17 new tables, 5 enums, 8 helper functions, 34 seeded sentinel keywords
- **Consequences**: Care orgs gain NDIS financial management, PRODA claiming, SCHADS compliance, care plan goal tracking, automated sentinel risk alerts, and one-click audit dossier generation. Feature-gated behind care-specific billing tiers. Zero regression for trades orgs.
- **Reference**: `docs/PRD-Nightingale-Phase3-4.md`
- **Owner**: Architecture

### 2026-02-15 — Zustand for client state management
- **Decision**: Use Zustand for all client-side state management on web.
- **Why**: Minimal API, excellent TypeScript support, no boilerplate, works well with React 19. Simpler than Redux for our use case.
- **Alternatives considered**: Redux Toolkit, Jotai, React Context.
- **Consequences**: One store per domain (jobs-store, finance-store, etc.). Stores call server actions and cache results. No global state providers needed.
- **Owner**: Architecture
