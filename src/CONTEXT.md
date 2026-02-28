# CONTEXT.md — iWorkr Project Brief + PRD Anchor
> The single source of truth for what we are building. Keep updated.

## 1) Project identity
- **Name**: iWorkr
- **Tagline**: The Field Operating System
- **One-liner**: A modern, keyboard-first field service management platform for trades and service businesses — job management, scheduling, CRM, finance, assets, forms, automations, and live dispatch in one Linear-inspired interface.
- **Target users**: Small to mid-sized service companies (plumbing, HVAC, electrical, cleaning, landscaping, pest control, locksmith, etc.)
- **Primary goal**: Replace fragmented FSM tools with a single premium platform that feels like a productivity tool, not enterprise software.

## 2) References & design north stars
- **Primary inspiration**: [Linear](https://linear.app) — dark monochrome, keyboard-first, minimal, fast
- **Secondary inspiration**: [Raycast](https://raycast.com) — command palette UX, keyboard shortcuts
- **Landing page inspiration**: Linear + [Loveable](https://loveable.dev) — premium calm + "try it instantly" excitement loop
- **What to copy**: structure, spacing, motion restraint, dark-first palette, bento grids, command palette
- **What NOT to copy**: neon colors, heavy gradients, playful cartoon illustration, dense enterprise UI

## 3) Brand constraints
- **Design system codename**: "Stealth Mode" / "Obsidian"
- **Primary palette**: Dark — `#050505` background, `#0A0A0A` / `#141414` surfaces, white text `#ededed`
- **Light mode**: Supported — `#f9fafb` background, white surfaces
- **Brand accent**: Signal Green `#10B981` (emerald, not neon). Used sparingly — ≤10% of visible UI per screen.
- **Typography**: Inter (variable, sans-serif), JetBrains Mono (variable, monospace for data/IDs/money)
- **Tracking**: `-0.025em` tight, `-0.05em` tighter (display text)
- **Motion**: Framer Motion for page transitions, CSS keyframes for micro-interactions, Lottie for dashboard widgets and empty states. Subtle, never gimmicky.
- **Textures**: Fractal noise grain overlay (0.02 opacity), dot/line grids, inset bevel shadows.

## 4) Product mechanics

### Inputs
- Business onboarding: company name, trade, team invites, integrations
- Jobs: title, description, client, priority, location, schedule, status, subtasks, revenue/cost
- Clients: name, type (residential/commercial), address, contacts, tags
- Schedule: technician + time block + job reference
- Finance: invoices, payments (Stripe Connect), quotes
- Forms: custom form builder with blocks and field types

### Outputs
- Dashboard: bento grid with live widgets (inbox, dispatch, jobs, revenue, AI insights, schedule)
- Dispatch: real-time technician tracking with radar sweep animation
- Finance: invoices with PDF generation, payment links, portal
- Reports: revenue, growth %, daily breakdowns
- Automations: trigger → condition → action workflows
- Notifications: unified inbox (mentions, assignments, approvals, system alerts)

### Core flows
1. **Onboard** → Auth → Setup (identity, trade, team, training, integrations) → Dashboard
2. **Create job** → Assign team → Schedule → Dispatch → Execute → Invoice → Collect payment
3. **Client lifecycle** → Lead → Active → Jobs → Invoicing → Retention
4. **Automation** → Trigger (job created, status changed, etc.) → Condition → Action (email, notification, status update)

### Non-goals (current)
- White-label / reseller architecture
- Multi-region deployment
- Self-hosted / on-premise
- Real-time voice/video in-app

## 5) PRD references
- **Product PRD**: `docs/PRD.md` (476 lines — full feature inventory by module)
- **Backend PRD**: `docs/PRD-Backend.md` (2000+ lines — schema, RLS, edge functions, architecture)
- **Live Setup**: `docs/LIVE-SETUP.md` (deployment, env vars, Polar.sh, Stripe)

## 6) Work-in-progress status
- **Current milestone**: Core platform live — jobs, schedule, clients, finance, assets, forms, automations, integrations, AI agent, dispatch, messenger, team management
- **Next milestone**: Polish, performance, mobile parity, advanced automations, marketplace
- **Known blockers**: External API integrations (Xero, QuickBooks, Gmail, Google Calendar, GoHighLevel) require credentials. See `INCOMPLETE:BLOCKED` comments in `src/app/actions/integration-sync.ts`.

## 7) Architecture snapshot
| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind v4, Zustand, Framer Motion, Lottie | App Router, server actions + API routes |
| Mobile | Flutter 3.11+, Riverpod, GoRouter, Drift (SQLite), Supabase Flutter | 40+ feature modules, offline-first |
| Desktop | Electron, Sentry, electron-store, auto-updater | "The Obsidian Monolith" |
| Backend | Supabase (PostgreSQL 17, RLS, Edge Functions, Realtime, Storage) | 52+ migrations, 20 edge functions |
| Auth | Supabase Auth (Google OAuth, Magic Link) | JWT + RLS enforcement |
| Payments | Stripe (Connect + Terminal), Polar.sh (MoR), RevenueCat (mobile) | Multi-provider |
| Email | Resend + react-email templates | Transactional + marketing |
| Maps | Google Maps (web + mobile) | Dark "Obsidian" map style |
| AI | OpenAI (AI agent, insights) | Voice agent + dashboard AI |
| PDF | @react-pdf/renderer + jsPDF | Invoice generation |
| Testing | Vitest (unit), Playwright (E2E), Qase (reporting) | `pnpm test`, `pnpm test:e2e` |
| Hosting | Vercel (web), Supabase (backend) | Production: iworkrapp.com |

## 8) Decisions log pointer
See: `docs/DECISIONS_LOG.md`

## 9) Key database entities
- `profiles` — user profiles linked to Supabase Auth
- `organizations` — multi-tenant workspace (every business table scoped by `organization_id`)
- `members` — org membership with roles (owner, admin, manager, technician)
- `subscriptions` — billing state (Polar.sh as source of truth)
- `jobs`, `clients`, `schedule_blocks`, `invoices`, `assets`, `forms`, `automations`, `notifications`, `messages`, `channels`, `integrations`, `branches`, `audit_log`

## 10) Module inventory
| Module | Web route | Server actions | Flutter feature |
|---|---|---|---|
| Dashboard | `/dashboard` | `dashboard.ts` | `dashboard/` |
| Jobs | `/dashboard/jobs` | `jobs.ts` | `jobs/` |
| Schedule | `/dashboard/schedule` | `schedule.ts` | `schedule/` |
| Clients | `/dashboard/clients` | `clients.ts` | — |
| Finance | `/dashboard/finance` | `finance.ts`, `quotes.ts` | `finance/`, `quotes/` |
| Assets | `/dashboard/assets` | `assets.ts` | `assets/` |
| Forms | `/dashboard/forms` | `forms.ts` | `forms/` |
| Automations | `/dashboard/automations` | `automations.ts` | — |
| Integrations | `/dashboard/integrations` | `integrations.ts`, `integration-oauth.ts`, `integration-sync.ts` | — |
| Messenger | `/dashboard/messages` | `messenger.ts` | `chat/` |
| Team | `/dashboard/team` | `team.ts`, `branches.ts` | `team/` |
| AI Agent | `/dashboard/ai-agent` | `ai-agent.ts` | `ai/` |
| Dispatch | `/dashboard/dispatch` | — | `dispatch/` |
| Inbox | `/dashboard/inbox` | `notifications.ts` | `inbox/` |
| Settings | `/settings/*` | `settings.ts` | `profile/`, `organization/` |
| Help | `/dashboard/help` | `help.ts` | `knowledge/` |
| Onboarding | `/setup` | `onboarding.ts` | `onboarding/` |
