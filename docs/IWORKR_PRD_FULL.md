# iWorkr — Full PRD (Landing Page + FSM Platform)
> Design target: Linear's dark premium calm + Loveable's "try instantly" excitement loop.
> This PRD defines: (1) marketing landing page, (2) authenticated FSM platform, (3) Supabase backend, (4) billing/subscriptions, (5) mobile app, (6) desktop app, (7) QA + verification.

---

## 1) Product overview

**iWorkr** is a modern, keyboard-first field service management platform that helps trades and service businesses manage their entire operation — jobs, scheduling, clients, finance, assets, forms, automations, and live dispatch — in one premium interface.

iWorkr provides:
- A **premium landing page** that communicates credibility, speed, and outcomes with an Obsidian dark aesthetic.
- A **"try it instantly" flow** (Loveable-style) where visitors feel the product from the homepage.
- A **full authenticated web app** with dashboard, modules for every business function, and team collaboration.
- A **Flutter mobile app** with 40+ feature modules, offline-first architecture, and Stripe Terminal tap-to-pay.
- An **Electron desktop app** ("The Obsidian Monolith") for persistent desktop access.
- A **Supabase backend** with PostgreSQL, RLS multi-tenancy, 20+ Edge Functions, and Realtime.
- A **subscription billing system** via Polar.sh (web) and RevenueCat (mobile).

The experience should feel:
- **Minimal and high-end** like Linear (whitespace, calm, dark monochrome).
- **Magical and immediate** like Loveable (start using → instant value → signup → momentum).
- **Trustworthy and professional** (not gimmicky "vibe coding" — this is a business tool).

---

## 2) Goals and success metrics

### 2.1 Primary goals
1. **Adoption**: Service businesses understand iWorkr's value within 10 seconds and want to try it.
2. **Activation**: First meaningful action (create a job, schedule a tech) within 5 minutes of signup.
3. **Reliability**: Core flows (jobs, schedule, invoice, dispatch) work flawlessly.
4. **Retention**: Businesses return daily to manage operations.

### 2.2 Success metrics
| Metric | Target |
|---|---|
| Landing page → signup conversion | >5% |
| Signup → first job created | >60% in first session |
| D1 retention | >40% |
| D7 retention | >25% |
| Invoice generation → payment received rate | >70% |
| Stripe Terminal tap-to-pay adoption (mobile) | >30% of mobile users |

---

## 3) Target users and personas

### 3.1 Owner/Manager
- Runs the business. Needs overview of operations, revenue, team performance.
- Uses: Dashboard, Finance, Team, Automations, Settings, AI Agent.

### 3.2 Dispatcher
- Schedules jobs and assigns technicians. Lives in the schedule view.
- Uses: Schedule, Jobs, Clients, Inbox, Dispatch.

### 3.3 Technician
- Field worker. Uses mobile app primarily.
- Uses: Inbox (assignments), Jobs (execution), Schedule (today's agenda), Forms (completion), Payments (tap-to-pay).

### 3.4 Office Admin
- Handles invoicing, client communication, form management.
- Uses: Finance, Clients, Forms, Inbox, Quotes.

---

## 4) Brand and design principles

### 4.1 Visual identity — "Obsidian / Stealth Mode"
- Dark by default: `#050505` background, `#0A0A0A` / `#141414` surfaces.
- Signal Green `#10B981` — the only accent, used sparingly (≤10% of visible UI).
- Subtle background textures: fractal noise grain, dot grids, line grids.
- Bento grid layouts for dashboard and landing page feature sections.
- `widget-glass` cards with gradient background and inset bevel shadow.

### 4.2 Typography
- Inter (sans) for all text. JetBrains Mono for data, IDs, money.
- Tight tracking for display headings (`-0.05em`).
- Strong hierarchy without shouting — size and weight, not color variety.

### 4.3 Motion
- Framer Motion for page transitions, modal enter/exit, staggered lists.
- CSS keyframes for persistent micro-interactions (pulse, glow, breathe, orbit).
- Lottie for dashboard widget icons and empty states.
- Easing: `--ease-snappy`, `--ease-spring`, `--ease-out-expo`.
- Rule: Animate hierarchy and attention, not everything.

### 4.4 Copy voice
- Confident, clear, direct. Benefits first.
- Speak to outcomes: "dispatch", "track", "automate", "invoice".
- No hype spam. Professional but not corporate.

---

## 5) Landing page PRD

### 5.1 Page structure

#### Top nav
- Left: iWorkr logo
- Center: Product, Features, Pricing, Download
- Right: Sign in + "Start free trial" CTA
- Sticky with subtle blur and border

#### Hero
- Gradient text headline: "The Field Operating System"
- Subheadline: "Job management, scheduling, dispatch, invoicing, and automations — built for trades, designed like Linear."
- Primary CTA: "Start free trial"
- Secondary CTA: "Watch demo"
- Hero visual: Product screenshot / animated dashboard preview
- Background: Dot grid texture with Signal Green glow accents

#### Social proof
- "Trusted by 2,000+ service businesses" + industry logos
- Metric counters: jobs managed, invoices sent, revenue processed

#### Feature bento grid
Tiles:
1. **Jobs & dispatch** — assign, track, and complete jobs in real-time
2. **Smart scheduling** — drag-and-drop timeline with conflict detection
3. **Instant invoicing** — generate PDFs, send payment links, get paid
4. **Custom forms** — build inspection checklists and compliance forms
5. **Automations** — trigger workflows on job status, schedule, and more
6. **AI phone agent** — never miss a call, book jobs automatically

#### Workflow steps ("How it works")
1. Set up your workspace (60 seconds)
2. Create jobs and schedule your team
3. Track, invoice, and get paid

#### Testimonials
- Verified carousel with avatar + name + role + company + quote

#### Download section
- Desktop apps (macOS, Windows) + mobile apps (iOS, Android)
- App store badges

#### Pricing
| | Free | Starter | Standard | Enterprise |
|---|---|---|---|---|
| Price | $0 | $47/mo | $97/mo | $247/mo |
| Users | 1 | 5 | 25 | Unlimited |
| Jobs | 10/mo | Unlimited | Unlimited | Unlimited |
| Automations | — | 5 | Unlimited | Unlimited |
| AI Agent | — | — | Yes | Yes |
| Support | Community | Email | Priority | Dedicated |

All paid plans include 14-day free trial.

#### FAQ
- What is iWorkr?
- How does the free trial work?
- Can I cancel anytime?
- What trades does iWorkr support?
- Do you offer a mobile app?
- How does invoicing work?

#### Footer
- Product links, legal (privacy, terms, cookies), social links, status page

---

## 6) Web app PRD (authenticated platform)

### 6.1 Information architecture
```
/dashboard          → Bento grid widgets (inbox, dispatch, jobs, revenue, AI, schedule)
/dashboard/jobs     → Job list + detail + creation
/dashboard/schedule → Timeline view (day/week/month)
/dashboard/clients  → Client list + profiles
/dashboard/finance  → Revenue overview + invoices + quotes
/dashboard/assets   → Vehicle/tool/equipment tracking
/dashboard/forms    → Form builder + submissions
/dashboard/automations → Workflow builder + activity log
/dashboard/integrations → Connected services
/dashboard/messages → Internal messenger (channels)
/dashboard/team     → Team members + invites
/dashboard/inbox    → Unified notification center
/dashboard/ai-agent → AI phone agent configuration
/dashboard/dispatch → Live technician tracking
/dashboard/help     → Help articles + support

/settings/profile   → User profile
/settings/workspace → Organization settings
/settings/billing   → Subscription + invoices
/settings/members   → Team management
/settings/branches  → Multi-branch management
/settings/integrations → Integration settings
/settings/security  → Password, 2FA
/settings/notifications → Notification preferences
/settings/import    → Data import tools
```

### 6.2 Core objects
| Object | Table | Key fields |
|---|---|---|
| User | `profiles` | id, email, full_name, avatar_url, active_organization_id |
| Organization | `organizations` | id, name, slug, trade, logo_url, brand_color |
| Member | `members` | user_id, organization_id, role, status |
| Subscription | `subscriptions` | organization_id, plan_key, status, polar_subscription_id |
| Job | `jobs` | organization_id, title, status, priority, client_id, assigned_to |
| Client | `clients` | organization_id, name, type, status, email, phone, address |
| Schedule Block | `schedule_blocks` | organization_id, job_id, technician_id, start_at, end_at |
| Invoice | `invoices` | organization_id, client_id, job_id, status, total, due_date |
| Quote | `quotes` | organization_id, client_id, status, total, valid_until |
| Asset | `assets` | organization_id, name, type, status, serial_number |
| Form | `forms` | organization_id, title, blocks, status |
| Automation | `automations` | organization_id, name, trigger, actions, is_active |
| Channel | `channels` | organization_id, name, type, context_id |
| Message | `messages` | channel_id, sender_id, content, type |
| Notification | `notifications` | user_id, organization_id, type, read |
| Branch | `branches` | organization_id, name, is_headquarters, timezone |

### 6.3 Dashboard
- Bento grid with draggable/resizable widgets (React Grid Layout)
- Widgets: Inbox (unread), Live Dispatch (radar), Jobs (status breakdown), Revenue (chart), AI Insights, Schedule (today), Team (online), Quick Actions
- Edit mode for layout customization
- Snapshot caching (5-minute stale threshold)

### 6.4 Key flows

#### Job lifecycle
Create → Assign team → Schedule → En route → In progress → Complete → Invoice → Paid

#### Client lifecycle
Lead → Active → Jobs → Invoicing → Retention (or Churned)

#### Automation flow
Trigger (event) → Condition (filter) → Action (notification, email, status change, etc.) → Log

#### Invoice flow
Create → Add line items → Generate PDF → Send (email + payment link) → Client views portal → Pays (Stripe) → Marked paid

---

## 7) Mobile app PRD (Flutter)

### 7.1 Architecture
- 40+ feature modules in `flutter/lib/features/`
- Riverpod for state management
- GoRouter for navigation
- Supabase Flutter for backend
- Drift (SQLite) for offline persistence
- Stripe Terminal for tap-to-pay
- RevenueCat for subscription management

### 7.2 Key mobile features
| Feature | Module | Notes |
|---|---|---|
| Auth | `auth/` | Magic link, Google OAuth, biometric unlock |
| Dashboard | `dashboard/` | Mobile-optimized widget grid |
| Jobs | `jobs/` | Create, view, update status, log time |
| Schedule | `schedule/` | Today's agenda, weekly view |
| Dispatch | `dispatch/` | Live GPS tracking, route optimization |
| Finance | `finance/` | Invoice list, payment status |
| Payments | `payments/` | Stripe Terminal tap-to-pay |
| Forms | `forms/` | Fill and submit forms on-site |
| Scan | `scan/` | QR/barcode scanning for assets |
| Chat | `chat/` | Team messaging |
| Route planning | `routes/` | Optimized job routes on map |

### 7.3 Offline-first
- Critical data cached locally via Drift (SQLite)
- Mutations queued when offline, replayed on reconnect
- Background sync via `workmanager`
- Clear visual indicator for offline state

---

## 8) Desktop app PRD (Electron)

### 8.1 Features
- Loads iWorkr web app in native window
- System tray with quick access
- "Ghost mode" — desaturated UI when offline
- Auto-updater for seamless updates
- Sentry error tracking
- Platform: macOS and Windows

---

## 9) Backend PRD summary

See `docs/PRD-Backend.md` for full details.

### Key principles
1. Multi-tenancy via `organization_id` + RLS on every table
2. Polar.sh as billing source of truth (webhook sync to local cache)
3. Modular schema — add modules without touching core
4. Edge Functions for server-side compute (Deno runtime)
5. Realtime for live features (schedule, inbox, dispatch)
6. Audit log for all state-changing operations
7. Soft deletes for critical business entities

### Database
- PostgreSQL 17 via Supabase
- 52+ migrations covering core + modules
- RLS policies on all functional tables

### Edge Functions (20)
- Webhook handlers: Stripe, Polar, Resend, RevenueCat
- Workers: automation, sync queue, email processing
- Generators: PDF, push notifications
- Auth helpers: invite, terminal token

---

## 10) Billing + payments

### Web (Polar.sh)
- Merchant of record — handles tax, compliance, invoicing
- Checkout via Polar hosted page
- Webhook sync to `subscriptions` table
- Customer portal for billing management
- Plans: Free, Starter ($47), Standard ($97), Enterprise ($247)

### Mobile (RevenueCat)
- In-app purchase management
- Paywall screen with entitlement checks
- `purchases_flutter` SDK

### In-person (Stripe Terminal)
- Tap-to-pay via `mek_stripe_terminal` Flutter package
- Connection token from Edge Function
- Payment intent creation with Stripe Connect (direct charges)

### Stripe Connect
- Connected accounts for businesses accepting payments
- Onboarding flow via Stripe Connect account links
- Dashboard access for connected account management

---

## 11) QA + verification loops

### UI verification
- Screenshot loop for landing page and key app screens
- Compare to `docs/STYLE_GUIDE.md`
- Visual regression via Playwright screenshots

### Backend verification
- Migration testing with `supabase db reset`
- RLS audit queries
- Edge Function smoke tests

### Mobile verification
- `flutter analyze` + `flutter test`
- Click-through checklists for critical flows
- Multi-screen-size testing

### INCOMPLETE detection
- `grep -rn "INCOMPLETE:" src/ flutter/lib/ supabase/ electron/src/`
- Categorize by BLOCKED / PARTIAL / TODO
- Address BLOCKED items first

---

## 12) Milestones

### Milestone 1: Core platform (COMPLETE)
- Auth + onboarding + dashboard
- Jobs, schedule, clients, finance modules
- Landing page with Obsidian design
- Supabase backend with RLS
- Polar.sh billing integration

### Milestone 2: Extended platform (COMPLETE)
- Assets, forms, automations, integrations
- Messenger, team management, branches
- AI phone agent, dispatch
- Help center, notifications, inbox

### Milestone 3: Polish + parity (CURRENT)
- UI polish and design system consistency
- Mobile feature parity
- Performance optimization
- Advanced automations
- Integration marketplace

### Milestone 4: Scale + enterprise
- SSO/SAML
- Advanced analytics
- Custom integrations
- SLA guarantees
- White-label considerations

---

## 13) Acceptance criteria (high level)
- [ ] Landing page matches Obsidian style: dark, Signal Green accents, bento grids, subtle motion
- [ ] Auth flow works (magic link + Google OAuth)
- [ ] Dashboard loads with all widgets, responsive
- [ ] All 15+ modules functional with proper data flow
- [ ] Supabase RLS enforces multi-tenancy on every table
- [ ] Billing works end-to-end (checkout → subscription → feature gating)
- [ ] Mobile app covers core flows (jobs, schedule, payments)
- [ ] Desktop app loads and auto-updates
- [ ] INCOMPLETE trails exist for any staged or blocked work
- [ ] `pnpm build` + `pnpm lint` + `pnpm test` all pass
