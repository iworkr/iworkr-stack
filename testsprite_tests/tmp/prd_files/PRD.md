# iWorkr Product Requirements Document (PRD)

**Version:** 1.0  
**Last Updated:** February 15, 2026  
**Status:** Living Document

---

## 1. Executive Summary

**iWorkr** is a modern, keyboard-first field service management (FSM) platform designed for trades and service businesses (plumbing, HVAC, electrical, etc.). It combines job management, scheduling, client CRM, finance, assets, forms, automations, and integrations into a single, Linear-inspired interface optimized for speed and clarity.

### Product Vision

Deliver a fast, beautiful, and intuitive FSM experience that feels like a premium productivity tool—not enterprise software. iWorkr targets small to mid-sized service companies who want professional-grade capabilities without complexity.

### Key Differentiators

- **Linear-Focus Design** — Dark, monochrome, motion-heavy UI with minimal visual noise
- **Keyboard-First** — Power users can navigate and act without touching the mouse
- **Unified Inbox** — Central place for job assignments, approvals, mentions, and system alerts
- **Live Dispatch** — Real-time schedule view with technician status and radar sweep
- **AI Insights** — Embedded analytics and recommendations on the dashboard

---

## 2. User Personas & Use Cases

### Primary Personas

| Persona           | Role                                | Primary Needs                                  |
| ----------------- | ----------------------------------- | ---------------------------------------------- |
| **Owner/Manager** | Business owner, operations manager  | Overview, finance, team, automations, settings |
| **Dispatcher**    | Schedules jobs, assigns technicians | Inbox, schedule, jobs, clients                 |
| **Technician**    | Field worker                        | Inbox, jobs (assigned), schedule, forms        |
| **Office Admin**  | Invoicing, clients, forms           | Finance, clients, forms, inbox                 |

### Core Use Cases

1. **Onboard a new business** — Auth → Setup (identity, trade, team, training, integrations) → Dashboard
2. **Create and manage jobs** — Create job, assign, track status, add subtasks, log activity
3. **Schedule technicians** — Day/week/month view, drag blocks, see live status
4. **Manage clients** — Client list, profiles, contacts, activity, spend
5. **Handle finance** — Invoices, payouts, revenue overview
6. **Track assets** — Fleet, inventory, audits
7. **Collect forms** — Custom forms, library templates, submissions
8. **Automate workflows** — Flows, triggers, actions, activity logs
9. **Connect integrations** — Xero, Stripe, Slack, Google, etc.

---

## 3. Feature Inventory by Module

### 3.1 Landing & Marketing (`/`)

| Component    | Description                                                |
| ------------ | ---------------------------------------------------------- |
| Navbar       | Top navigation, auth CTA                                   |
| Hero         | Headline, subheadline, CTA                                 |
| SocialProof  | "Trusted by 2,000+ service businesses" + logo placeholders |
| BentoGrid    | Feature highlights in bento layout                         |
| Workflow     | Visual workflow explanation                                |
| Testimonials | Customer quotes                                            |
| Download     | App download buttons (Windows, macOS, iOS, Android)        |
| Pricing      | Pricing tiers                                              |
| FAQ          | Accordion FAQ                                              |
| FinalCTA     | Bottom call-to-action                                      |

### 3.2 Authentication (`/auth`)

| Feature      | Description                 |
| ------------ | --------------------------- |
| Auth modes   | Choice → Email or Google    |
| Email auth   | Magic link flow (simulated) |
| Google OAuth | OAuth flow (simulated)      |
| Validation   | Zod schema for email        |
| Redirect     | → `/setup` after auth       |

### 3.3 Onboarding / Setup (`/setup`)

| Step             | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| **identity**     | Company name, workspace slug                    |
| **trade**        | Select trade (plumbing, HVAC, electrical, etc.) |
| **team**         | Invite team members by email                    |
| **training**     | Command menu tutorial (⌘K)                      |
| **integrations** | Toggle integrations to connect                  |
| **complete**     | Success screen, redirect to dashboard           |

**State:** `useOnboardingStore` (persisted) — companyName, workspaceSlug, selectedTrade, teamInvites, commandMenuCompleted, connectedIntegrations.

### 3.4 Dashboard (`/dashboard`)

| Section       | Description                                                     |
| ------------- | --------------------------------------------------------------- |
| Bento grid    | Inbox, Live Dispatch, Jobs, Revenue, AI Insight, Team, Schedule |
| Inbox         | Unread count, recent items                                      |
| Live Dispatch | Schedule radar, technician blocks, sweep animation              |
| Jobs          | Status breakdown, recent jobs                                   |
| Revenue       | Revenue graph, daily data                                       |
| AI Insight    | AI-generated recommendation card                                |
| Team          | Active members, recent activity                                 |
| Schedule      | Today’s blocks summary                                          |

### 3.5 Inbox (`/dashboard/inbox`)

| Feature     | Description                                                             |
| ----------- | ----------------------------------------------------------------------- |
| Tabs        | All, Unread, Snoozed                                                    |
| List        | InboxItem cards (job_assigned, quote_approved, mention, system, review) |
| Actions     | Mark read, snooze, archive                                              |
| Empty state | When no items                                                           |

**Data:** `InboxItem` — id, type, title, body, read, snoozedUntil, createdAt, relatedJobId, relatedClientId.

### 3.6 Jobs (`/dashboard/jobs`, `/dashboard/jobs/[id]`)

| Feature      | Description                                         |
| ------------ | --------------------------------------------------- |
| List/filters | Status, priority, search                            |
| Job detail   | Title, client, status, priority, subtasks, activity |
| Create       | CreateJobModal (⌘C)                                 |
| Subtasks     | Add, complete                                       |
| Activity     | Log entries                                         |

**Data:** `Job` — id, title, clientId, status, priority, dueDate, subtasks, activity, createdAt.

**Statuses:** backlog, todo, in_progress, done, cancelled.  
**Priorities:** urgent, high, medium, low, none.

### 3.7 Schedule (`/dashboard/schedule`)

| Feature     | Description                                |
| ----------- | ------------------------------------------ |
| View scale  | Day, week, month                           |
| Blocks      | ScheduleBlock per technician               |
| Technicians | Technician list with status                |
| Live status | scheduled, en_route, in_progress, complete |

**Data:** `ScheduleBlock`, `Technician` — blocks linked to jobs and technicians.

### 3.8 Clients (`/dashboard/clients`, `/dashboard/clients/[id]`)

| Feature | Description                        |
| ------- | ---------------------------------- |
| List    | Client cards, status filter        |
| Detail  | Profile, contacts, activity, spend |
| Create  | CreateClientModal (⌘⇧C)            |

**Data:** `Client` — id, name, status, contacts, activity, spendData.  
**Statuses:** active, lead, churned, inactive.

### 3.9 Finance (`/dashboard/finance`)

| Feature  | Description                                       |
| -------- | ------------------------------------------------- |
| Tabs     | Overview, Invoices, Payouts                       |
| Overview | Revenue, outstanding, payouts summary             |
| Invoices | List, status (draft, sent, paid, overdue, voided) |
| Payouts  | Payout history                                    |
| Create   | CreateInvoiceModal                                |

**Data:** `Invoice`, `Payout`, `DailyRevenue`, `LineItem`.

### 3.10 Assets (`/dashboard/assets`, `/dashboard/assets/[id]`)

| Feature   | Description                                   |
| --------- | --------------------------------------------- |
| Tabs      | Fleet, Inventory, Audits                      |
| View mode | Grid, list                                    |
| Fleet     | Vehicles, equipment                           |
| Inventory | Stock items, alert levels (ok, low, critical) |
| Audits    | Audit log entries                             |

**Data:** `Asset`, `StockItem`, `AssetAuditEntry`.  
**Statuses:** available, assigned, maintenance.

### 3.11 Forms (`/dashboard/forms`, `/dashboard/forms/submission/[id]`)

| Feature           | Description                    |
| ----------------- | ------------------------------ |
| Tabs              | My Forms, Library, Submissions |
| Forms             | Custom + library templates     |
| Submissions       | Signed, pending, expired       |
| Submission detail | View submission by ID          |

**Data:** `FormTemplate`, `FormSubmission` — status (draft, published, archived), blocks, telemetry.

### 3.12 Team (`/dashboard/team`, `/dashboard/team/roles`)

| Feature | Description                    |
| ------- | ------------------------------ |
| Members | List with role, status, skills |
| Roles   | Role definitions, permissions  |
| Invite  | Invite modal (email + role)    |

**Data:** `TeamMember`, `RoleDefinition`, `Skill` — roles: owner, manager, senior_tech, technician, apprentice, subcontractor, office_admin.

### 3.13 Automations (`/dashboard/automations`, `/dashboard/automations/[id]`)

| Feature     | Description                                          |
| ----------- | ---------------------------------------------------- |
| Tabs        | Flows, Activity                                      |
| Flows       | Automation flows (trigger, delay, action, condition) |
| Flow detail | Edit flow, blocks                                    |
| Activity    | Execution logs                                       |

**Data:** `AutomationFlow`, `FlowBlock`, `ExecutionLog`, `FlowTemplate`.  
**Categories:** marketing, billing, operations.

### 3.14 Integrations (`/dashboard/integrations`)

| Feature | Description                                            |
| ------- | ------------------------------------------------------ |
| Tabs    | All, Financial, Communication, Storage, Calendar, Maps |
| List    | Integration cards, connect/disconnect                  |
| Status  | connected, disconnected, error, syncing                |

**Data:** `Integration`, `IntegrationEvent`, `SyncSetting`, `AccountMapping`.

### 3.15 Settings (`/settings/*`)

| Section            | Pages                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| **Account**        | Preferences, Profile, Notifications, Security & access, Connected accounts |
| **Jobs**           | Labels, Templates, Statuses, Workflow                                      |
| **Administration** | Workspace, Members, Billing, Integrations, Import / Export                 |
| **Your teams**     | Team switcher, Create team                                                 |

---

## 4. Routes & Navigation

### Public Routes

| Route      | Purpose          |
| ---------- | ---------------- |
| `/`        | Landing page     |
| `/auth`    | Authentication   |
| `/privacy` | Privacy policy   |
| `/terms`   | Terms of service |

### App Routes (Post-Auth)

| Route                              | Purpose                   |
| ---------------------------------- | ------------------------- |
| `/setup`                           | Onboarding wizard         |
| `/dashboard`                       | Main app, bento dashboard |
| `/dashboard/inbox`                 | Inbox                     |
| `/dashboard/jobs`                  | Jobs list                 |
| `/dashboard/jobs/[id]`             | Job detail                |
| `/dashboard/schedule`              | Schedule                  |
| `/dashboard/clients`               | Clients list              |
| `/dashboard/clients/[id]`          | Client detail             |
| `/dashboard/finance`               | Finance                   |
| `/dashboard/assets`                | Assets                    |
| `/dashboard/assets/[id]`           | Asset detail              |
| `/dashboard/forms`                 | Forms                     |
| `/dashboard/forms/submission/[id]` | Form submission detail    |
| `/dashboard/team`                  | Team                      |
| `/dashboard/team/roles`            | Roles & permissions       |
| `/dashboard/automations`           | Automations               |
| `/dashboard/automations/[id]`      | Automation flow detail    |
| `/dashboard/integrations`          | Integrations              |
| `/settings`                        | Settings layout           |
| `/settings/preferences`            | Preferences               |
| `/settings/profile`                | Profile                   |
| `/settings/notifications`          | Notifications             |
| `/settings/security`               | Security & access         |
| `/settings/connected`              | Connected accounts        |
| `/settings/labels`                 | Labels                    |
| `/settings/templates`              | Templates                 |
| `/settings/statuses`               | Statuses                  |
| `/settings/workflow`               | Workflow                  |
| `/settings/workspace`              | Workspace                 |
| `/settings/members`                | Members                   |
| `/settings/billing`                | Billing                   |
| `/settings/integrations`           | Integrations              |
| `/settings/import`                 | Import / Export           |

### Shell Navigation (Sidebar)

- Inbox, Jobs, Schedule, Clients, Finance, Assets, Forms, Team, Automations, Integrations
- Settings, Help, Invite Team

---

## 5. Data Models & State

### Core Types (`data.ts`)

| Type             | Key Fields                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| `Job`            | id, title, clientId, status, priority, dueDate, subtasks, activity       |
| `InboxItem`      | id, type, title, body, read, snoozedUntil, relatedJobId, relatedClientId |
| `Client`         | id, name, status, contacts, activity, spendData                          |
| `TeamMember`     | id, name, role, status, skills                                           |
| `ScheduleBlock`  | id, technicianId, jobId, start, end, status                              |
| `Invoice`        | id, clientId, status, lineItems, events                                  |
| `Asset`          | id, name, category, status, metadata                                     |
| `SubTask`        | id, title, done                                                          |
| `ActivityEntry`  | id, type, text, createdAt                                                |
| `ClientContact`  | id, name, role, email, phone                                             |
| `ClientActivity` | id, type, text, createdAt                                                |
| `SpendDataPoint` | month, amount                                                            |

### Enums & Statuses

- **JobStatus:** backlog, todo, in_progress, done, cancelled
- **Priority:** urgent, high, medium, low, none
- **InboxItemType:** job_assigned, quote_approved, mention, system, review
- **ClientStatus:** active, lead, churned, inactive
- **InvoiceStatus:** draft, sent, paid, overdue, voided
- **ScheduleBlockStatus:** scheduled, en_route, in_progress, complete
- **AssetStatus:** available, assigned, maintenance
- **FormStatus:** draft, published, archived
- **MemberStatus:** active, pending, suspended, archived
- **FlowStatus:** active, paused, draft, archived
- **IntegrationStatus:** connected, disconnected, error, syncing

### Zustand Stores

| Store                | Purpose                               |
| -------------------- | ------------------------------------- |
| `shell-store`        | Modals, command menu, sidebar, toasts |
| `onboarding-store`   | Setup wizard state (persisted)        |
| `inbox-store`        | Inbox tab, filters                    |
| `jobs-store`         | Jobs filters, selection               |
| `clients-store`      | Clients filters                       |
| `finance-store`      | Finance tab                           |
| `schedule-store`     | Schedule view scale                   |
| `team-store`         | Team filters                          |
| `forms-store`        | Forms tab                             |
| `integrations-store` | Integrations tab                      |
| `assets-store`       | Assets tab, view mode                 |
| `automations-store`  | Automations tab                       |

---

## 6. Design System & UX Patterns

### Visual Design

- **Theme:** Dark, monochrome (Linear-Focus style)
- **Colors:** Zinc grays, white accents, subtle gradients
- **Typography:** System fonts, clear hierarchy
- **Borders:** `rgba(255,255,255,0.06)` to `0.08`
- **Backgrounds:** `#050505`, `#0a0a0a`, layered surfaces

### Motion

- **Framer Motion** for page transitions, list animations, modals
- **FadeIn** component for staggered reveals
- **Radar sweep** on Live Dispatch for live feel

### Components

- **Shell:** Sidebar, Topbar, CommandMenu, modals (CreateJob, CreateClient, CreateInvoice), KeyboardShortcuts, ActionToast
- **UI:** Buttons, inputs, cards, tabs, popovers, dropdowns
- **Dashboard:** Bento grid sections, charts, lists

### Accessibility

- Keyboard navigation throughout
- Focus management in modals
- ARIA where applicable

---

## 7. Keyboard Shortcuts

| Shortcut     | Action                  |
| ------------ | ----------------------- |
| `G` then `j` | Go to Jobs              |
| `G` then `s` | Go to Schedule          |
| `G` then `i` | Go to Inbox             |
| `G` then `c` | Go to Clients           |
| `G` then `f` | Go to Finance           |
| `G` then `a` | Go to Assets            |
| `G` then `o` | Go to Forms             |
| `G` then `t` | Go to Team              |
| `G` then `w` | Go to Automations       |
| `G` then `d` | Go to Dashboard         |
| `⌘[`         | Toggle sidebar          |
| `⌘,`         | Open settings           |
| `⌘K`         | Command menu            |
| `C`          | Create job              |
| `⌘⇧C`        | Create client           |
| `?`          | Keyboard shortcuts help |

---

## 8. Technical Architecture

### Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19
- **Styling:** Tailwind CSS 4
- **Animation:** Framer Motion
- **State:** Zustand (with persist for onboarding)
- **Validation:** Zod
- **Icons:** Lucide React

### Project Structure

```
src/
├── app/                    # Routes, layouts, pages
├── components/
│   ├── shell/              # Sidebar, Topbar, CommandMenu, modals
│   ├── sections/           # Landing page sections
│   ├── dashboard/          # Dashboard bento sections
│   ├── app/                # Shared app components
│   ├── onboarding/         # Setup wizard components
│   ├── settings/           # Settings layout, sidebar
│   ├── team/               # Team-specific components
│   ├── forms/              # Forms-specific components
│   ├── integrations/       # Integrations-specific components
│   ├── assets/             # Assets-specific components
│   ├── automations/        # Automations-specific components
│   └── ui/                 # Base UI primitives
└── lib/
    ├── *-store.ts          # Zustand stores
    ├── *-data.ts           # Mock/seed data
    ├── data.ts             # Core models & shared data
    └── validation.ts       # Zod schemas
```

### Data Strategy

- **Current:** Mock/seed data in `*-data.ts` and `data.ts`
- **Future:** API layer, database (e.g. Postgres), real auth (e.g. Clerk, Auth0)

---

## 9. Mobile & Responsive

- Layout adapts for smaller viewports
- Sidebar collapses or becomes overlay on mobile
- Touch-friendly targets where applicable
- Keyboard shortcuts remain available on devices with keyboards

---

## 10. Future / Backlog

- Real authentication (OAuth, magic links)
- Backend API and database
- Real-time sync (WebSockets)
- Offline support
- Mobile native apps (iOS, Android) — download buttons present on landing
- Advanced reporting and exports
- Multi-workspace / multi-tenant
- Custom fields and workflows
- Deeper integration implementations (Xero, Stripe, etc.)

---

## Appendix A: File Reference

| Area       | Key Files                                                    |
| ---------- | ------------------------------------------------------------ |
| Landing    | `src/app/page.tsx`, `src/components/sections/*`              |
| Auth       | `src/app/auth/page.tsx`                                      |
| Setup      | `src/app/setup/page.tsx`, `src/components/onboarding/*`      |
| Dashboard  | `src/app/dashboard/layout.tsx`, `src/app/dashboard/page.tsx` |
| Shell      | `src/components/shell/*`                                     |
| Stores     | `src/lib/*-store.ts`                                         |
| Data       | `src/lib/data.ts`, `src/lib/*-data.ts`                       |
| Validation | `src/lib/validation.ts`                                      |

---

_This PRD is derived from the iWorkr-Linear codebase and reflects the current implementation as of February 2026._
