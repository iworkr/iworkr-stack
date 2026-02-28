# CLAUDE.md — iWorkr Project Brain
> Injected at the top of every Claude Code session. High-signal, enforceable.

## 0) Prime Directives (non-negotiable)
- **Follow `.claude/rules/00-priority-rules.md` first.**
- Always start complex work in **Plan Mode**: read codebase, propose a plan, then execute.
- Always use a **verification loop**: build, lint, test, screenshot, or manual checklist.
- **Never "finish" a feature silently** — if anything is missing or stubbed, leave `INCOMPLETE:` trails (see `.claude/rules/incomplete-trails.md`).
- Maintain and constantly refer to `docs/STYLE_GUIDE.md`. If a design decision isn't covered, add it there.
- Read `src/CONTEXT.md` for the living product brief and architecture snapshot before any work.

## 1) What iWorkr is
**iWorkr — The Field Operating System.**
A modern, keyboard-first field service management (FSM) platform for trades and service businesses (plumbing, HVAC, electrical, cleaning, landscaping). Combines job management, scheduling, CRM, finance, assets, forms, automations, integrations, AI phone agent, and live dispatch into a Linear-inspired interface.

### Platforms
| Platform | Stack | Entry point |
|---|---|---|
| **Web app** | Next.js 16, React 19, Tailwind v4, Zustand, Framer Motion, Lottie | `src/app/` |
| **Mobile app** | Flutter 3.11+, Riverpod, GoRouter, Supabase, Drift (SQLite) | `flutter/lib/` |
| **Desktop app** | Electron ("The Obsidian Monolith") | `electron/src/` |
| **Backend** | Supabase (PostgreSQL 17, RLS, Edge Functions, Realtime, Storage) | `supabase/` |
| **Hosting** | Vercel (web), App Store / Play Store (mobile), direct download (desktop) | — |

### Key integrations
Stripe (Connect + Terminal tap-to-pay), Polar.sh (billing MoR), RevenueCat (mobile subscriptions), Resend (email), Google Maps, OpenAI, Xero, Slack.

## 2) How to work (always)

### Step A — Understand
1. Read `src/CONTEXT.md` for the product brief, PRD anchors, and current status.
2. Read `docs/PRD.md` (feature-level) and `docs/PRD-Backend.md` (architecture-level).
3. Scan existing patterns — **ask "where is the pattern for this?" before creating new patterns.**
4. Check `docs/DECISIONS_LOG.md` for prior architectural decisions.

### Step B — Plan
Write a brief plan with:
- Files you will touch and new files you will create
- Data model / routes / components affected
- Verification steps (what you'll check)
- Risks and assumptions

### Step C — Execute with quality gates
- **Code**: `pnpm build` + `pnpm lint` + `pnpm test` (Vitest)
- **UI**: Screenshot loop (see `workflows/workflow-screenshot-loop.md`)
- **E2E**: `pnpm test:e2e` (Playwright) for critical paths
- **Flutter**: `flutter analyze` + `flutter test`
- **Supabase**: Migration scripts tested in local Supabase, RLS verified

### Step D — Invoke subagents when needed
- **Research Agent** — API/docs exploration → `.claude/agents/research-agent.md`
- **Reviewer Agent** — Fresh-eyes code review → `.claude/agents/reviewer-agent.md`
- **QA Agent** — Click-through test plan and regression → `.claude/agents/qa-agent.md`
- **Design Agent** — Visual polish and Obsidian compliance → `.claude/agents/design-agent.md`

## 3) The iWorkr design target ("Obsidian / Stealth Mode")
- **Primary inspiration**: Linear — dark monochrome, whitespace, keyboard-first, bento grids
- **Brand color**: Signal Green `#10B981` (emerald, not neon) — used sparingly for focus + highlights
- **Dark by default**: background `#050505`, surfaces `#0A0A0A` / `#141414`
- **Typography**: Inter (sans), JetBrains Mono (mono). Tight tracking for display text.
- **Motion**: Subtle, purposeful — Framer Motion for page transitions, CSS keyframes for micro-interactions, Lottie for rich empty states and dashboard widgets.
- **Must feel**: premium, calm, fast, minimal, confident. Never cluttered, never neon-overloaded.
- Full token reference in `src/app/globals.css` and `docs/STYLE_GUIDE.md`.

## 4) Repo commands
### Next.js (web)
```bash
pnpm i                  # Install
pnpm dev                # Dev server (localhost:3000)
pnpm build              # Production build
pnpm lint               # ESLint
pnpm test               # Vitest unit tests
pnpm test:watch         # Vitest watch mode
pnpm test:e2e           # Playwright E2E
```

### Flutter (mobile)
```bash
cd flutter
flutter pub get          # Dependencies
flutter run              # Run on device/emulator
flutter analyze          # Static analysis
flutter test             # Unit tests
```

### Supabase (backend)
```bash
supabase start           # Start local Supabase (ports: API 54321, DB 54322, Studio 54323)
supabase db reset        # Reset + reseed local DB
supabase functions serve # Serve edge functions locally
supabase db push         # Push migrations to remote
```

### Electron (desktop)
```bash
cd electron
npm install
npm run dev              # Dev mode
npm run build            # Production build
```

## 5) Git rules
- Do **not** push to GitHub unless the user explicitly says "push".
- Use small, atomic commits with clear messages.
- Prefer feature branches — never commit to `main` directly during development.
- Never commit secrets. Use `.env.local.example` to document required keys.

## 6) Project structure (key paths)
```
src/
  app/              # Next.js App Router routes
    actions/        # Server actions (23 files — jobs, clients, finance, schedule, etc.)
    api/            # API route handlers (webhooks, Stripe, invoices, etc.)
    dashboard/      # Authenticated dashboard routes
    settings/       # Settings pages
  components/       # React components organized by domain
    ui/             # Base UI components
    shell/          # App shell (sidebar, header, command palette)
    sections/       # Landing page sections
  lib/              # Utilities, stores, hooks
    supabase/       # Supabase client helpers
    stores/         # Zustand stores
    hooks/          # Custom React hooks
    email/          # Email templates + send logic
  fonts/            # Local font files (Inter, JetBrains Mono)

flutter/
  lib/
    core/           # Theme, services, widgets, router, database
    features/       # 40+ feature modules (auth, jobs, schedule, payments, etc.)
    models/         # Data models

electron/
  src/main/         # Main process (IPC, menu, tray, analytics)
  src/preload/      # Preload scripts

supabase/
  migrations/       # 52+ SQL migration files (001–061)
  functions/        # 20 Edge Functions (Deno)
  config.toml       # Supabase project config

docs/               # PRD, Backend PRD, Live Setup, Style Guide, Decisions Log
e2e/                # Playwright E2E tests
scripts/            # Build/deployment utility scripts
```

## 7) Living documentation rule (self-improving)
If you discover missing conventions, add them to:
- `docs/STYLE_GUIDE.md` — design rules, tokens, component patterns
- `.claude/rules/code-style.md` — code standards
- `src/CONTEXT.md` — product knowledge
- `docs/DECISIONS_LOG.md` — architectural decisions

Keep docs **tight** — summarize, don't paste entire libraries.

## 8) Skills to invoke
| Task | Skill file |
|---|---|
| UI work (web) | `.claude/skills/build-ui.md` |
| Next.js scaffolding | `.claude/skills/build-nextjs-app.md` |
| Supabase backend | `.claude/skills/build-backend-supabase.md` |
| Flutter mobile | `.claude/skills/build-mobile-flutter.md` |
| QA & audit | `.claude/skills/qa-audit.md` |

## 9) Plans & billing reference
| Plan | Price | Max users | Polar Product ID |
|---|---|---|---|
| Free | $0 | 1 | — |
| Starter | $47/mo | 5 | `95b33e16-0141-4359-8d6c-464b5f08a254` |
| Standard | $97/mo | 25 | `7673fa11-335c-4e37-a5cf-106f17202e58` |
| Enterprise | $247/mo | ∞ | `e5ac6ca6-8dfa-4be8-85aa-87c2eac2633e` |

All paid plans include 14-day free trial. See `src/lib/plans.ts` for full feature matrix.

## 10) Environment variables
See `.env.local.example` for all required keys. Critical ones:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `POLAR_ACCESS_TOKEN` / `POLAR_WEBHOOK_SECRET` / `POLAR_ORGANIZATION_ID`
- `RESEND_API_KEY` / `ADMIN_EMAIL`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY` (for Connect/Terminal)
