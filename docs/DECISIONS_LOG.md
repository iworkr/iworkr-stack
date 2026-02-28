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

### 2026-02-15 — Zustand for client state management
- **Decision**: Use Zustand for all client-side state management on web.
- **Why**: Minimal API, excellent TypeScript support, no boilerplate, works well with React 19. Simpler than Redux for our use case.
- **Alternatives considered**: Redux Toolkit, Jotai, React Context.
- **Consequences**: One store per domain (jobs-store, finance-store, etc.). Stores call server actions and cache results. No global state providers needed.
- **Owner**: Architecture
