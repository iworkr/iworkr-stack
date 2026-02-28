# 00 — Priority Rules (must obey)

## A) Quality bar
- We ship **premium-feeling** UI/UX — "Obsidian / Stealth Mode" aesthetic.
- Every UI change must respect `docs/STYLE_GUIDE.md` and the design tokens in `src/app/globals.css`.
- iWorkr looks and feels like Linear — dark, minimal, keyboard-first, fast.
- Signal Green `#10B981` is the only accent. Use it sparingly (≤10% of visible UI area per screen).

## B) Verification is mandatory
- **Web UI**: Run screenshot loop (or manual visual checks documented). `pnpm build` must pass.
- **Backend**: Run tests or smoke scripts and log outputs. Validate RLS assumptions explicitly.
- **Mobile**: `flutter analyze` must pass. Click-through checklist for key flows.
- **E2E**: Run `pnpm test:e2e` for any changes touching critical paths (auth, jobs, finance).

## C) No silent stubs
- If any feature/module is not complete, leave `INCOMPLETE:` comments.
- Use severity tags:
  - `INCOMPLETE:BLOCKED(<what>)` — can't proceed without external dependency
  - `INCOMPLETE:PARTIAL(<what remains>)` — partially implemented, needs more work
  - `INCOMPLETE:TODO(<nice-to-have>)` — optional improvement, non-blocking
- See `.claude/rules/incomplete-trails.md` for exact format.

## D) Don't create new patterns casually
- Prefer existing folder structure and component patterns.
- Server actions go in `src/app/actions/`. API routes go in `src/app/api/`.
- Components go in `src/components/<domain>/`. Shared UI goes in `src/components/ui/`.
- Zustand stores go in `src/lib/` or `src/lib/stores/`.
- Flutter features go in `flutter/lib/features/<name>/`.
- Supabase migrations go in `supabase/migrations/` with sequential numbering.
- If a new pattern is necessary, document it in `.claude/rules/code-style.md`.

## E) Secrets and safety
- Never commit secrets (API keys, tokens, passwords).
- Use `.env.local.example` and document required keys.
- All Supabase tables must have RLS policies — no exceptions.
- Service role key is server-only — never expose to client.

## F) Multi-tenancy enforcement
- Every functional table is scoped by `organization_id`.
- RLS enforces data isolation at the database level, not the application level.
- Always verify org-scoping when adding new tables or queries.

## G) Existing PRD compliance
- All features must align with `docs/PRD.md` (product) and `docs/PRD-Backend.md` (architecture).
- If deviating from the PRD, document the decision in `docs/DECISIONS_LOG.md`.
