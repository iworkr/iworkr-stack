# Code Style Rules — iWorkr

## General
- TypeScript strict mode for all web/desktop code.
- Dart strict analysis for Flutter.
- Prefer `const` over `let`. Never use `var` in TypeScript.
- Use descriptive names — no single-letter variables outside loop indices.
- Files: kebab-case for filenames (`create-job-modal.tsx`, `jobs-store.ts`).
- Components: PascalCase for React components, PascalCase for Flutter widgets.
- No unused imports or dead code — lint must pass.

## Next.js / React patterns
- **App Router**: All routes in `src/app/`. Use Server Components by default; add `"use client"` only when needed.
- **Server Actions**: Business logic in `src/app/actions/<domain>.ts`. Validate with Zod. Always check auth + org membership.
- **API Routes**: Only for webhooks, public endpoints, and external integrations. Everything else uses server actions.
- **Components**: Organized by domain in `src/components/<domain>/`. Shared primitives in `src/components/ui/`.
- **State management**: Zustand stores in `src/lib/` or `src/lib/stores/`. One store per domain.
- **Hooks**: Custom hooks in `src/lib/hooks/`. Prefix with `use`.
- **Styling**: Tailwind v4 utility classes. Use CSS variables from `globals.css` for theme tokens. No inline style objects unless necessary for dynamic values.
- **Animation**: Framer Motion for component animation. CSS classes for persistent effects (`.animate-*`).
- **Imports**: Group — React/Next → external libraries → internal paths. Use `@/` alias for `src/`.

## Supabase patterns
- **Client**: Use `createClient()` from `src/lib/supabase/server.ts` (server) or `src/lib/supabase/client.ts` (browser).
- **Auth**: Always verify auth in server actions: `const { data: { user } } = await supabase.auth.getUser()`.
- **Org scoping**: All queries must filter by `organization_id`. Use the user's active org from their profile.
- **RLS**: Every table must have RLS enabled with policies. Use helper functions from `007_core_rls_helpers.sql`.
- **Migrations**: Sequential numbering (`001_`, `002_`, ...). Descriptive names. Idempotent where possible.
- **Edge Functions**: Deno runtime. Validate inputs. Use `Deno.env.get()` for secrets. Return proper HTTP status codes.

## Flutter patterns
- **Architecture**: Feature-first in `lib/features/<name>/`. Each feature has `screens/`, `widgets/`, and optional `providers/`.
- **State**: Riverpod + code generation (`riverpod_annotation`).
- **Navigation**: GoRouter in `lib/core/router/`.
- **Theme**: Centralized in `lib/core/theme/`. Use the Obsidian theme tokens.
- **Services**: Core services in `lib/core/services/` (auth, supabase, revenuecat, etc.).
- **Offline**: Drift (SQLite) for local persistence. Sync queue for deferred operations.

## Electron patterns
- **Main process**: `electron/src/main/`. IPC handlers in `ipc.ts`, menu in `menu.ts`, tray in `tray.ts`.
- **Preload**: Expose safe APIs via `contextBridge` in `electron/src/preload/`.
- **Never** use `nodeIntegration: true`.

## Error handling
- Wrap server actions in try/catch. Return `{ error: string }` shape on failure.
- Use `logger.ts` for server-side logging.
- Never expose internal error details to the client.
- Supabase errors: check `.error` on every query result.

## Testing
- **Unit tests**: Vitest — colocate with source (`*.test.ts`) or in `__tests__/`.
- **E2E tests**: Playwright in `e2e/`. Follow page object pattern.
- **Flutter tests**: `flutter test` in `flutter/test/`.
- **Naming**: `describe` blocks by feature, `it` blocks by behavior.

## Comments
- Don't narrate obvious code. Comments explain **why**, not **what**.
- Use `INCOMPLETE:` trails for unfinished work (see `incomplete-trails.md`).
- Use `TODO:` for minor improvements that aren't blocking.
- Never leave commented-out code in PRs.
