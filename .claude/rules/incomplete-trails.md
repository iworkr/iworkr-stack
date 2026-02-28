# INCOMPLETE Trails — iWorkr (required)

## Why
We must be able to grep the codebase and instantly see what is unfinished, blocked, or deferred. This prevents "silent stubs" that look done but aren't.

## Format (exact)
Use one of these severity-tagged comment styles:

### TypeScript / JavaScript (web, desktop)
```typescript
// INCOMPLETE:BLOCKED(STRIPE_WEBHOOK_SECRET) — Stripe Connect onboarding requires webhook secret; add to .env.local
// INCOMPLETE:PARTIAL — Invoice PDF download implemented; email attachment pending
// INCOMPLETE:TODO — Add keyboard shortcut hint tooltip to schedule navigation buttons
```

### Dart (Flutter)
```dart
// INCOMPLETE:BLOCKED(SUPABASE_URL) — Offline sync requires Supabase URL configured in env
// INCOMPLETE:PARTIAL — Job detail screen renders; subtask list not yet implemented
// INCOMPLETE:TODO — Add pull-to-refresh animation on jobs list
```

### SQL (Supabase migrations)
```sql
-- INCOMPLETE:PARTIAL — RLS SELECT policy added; UPDATE and DELETE policies still needed for this table
-- INCOMPLETE:TODO — Add index on (organization_id, created_at) for faster dashboard queries
```

## Severity definitions
| Tag | Meaning | Action |
|---|---|---|
| `INCOMPLETE:BLOCKED(<dependency>)` | Cannot proceed without an external dependency, API key, or decision | Unblock the dependency first |
| `INCOMPLETE:PARTIAL(<what remains>)` | Feature is partially implemented; specific work remains | Complete the remaining work |
| `INCOMPLETE:TODO(<description>)` | Optional improvement, not blocking functionality | Address in future iteration |

## Required metadata
Every INCOMPLETE comment must include:
1. **What is missing** — the specific functionality or data
2. **Where to fix it** — file path, function name, or module name (if not obvious from location)
3. **Acceptance criteria** — one line describing "done" state

## Examples in iWorkr context
```typescript
// INCOMPLETE:BLOCKED(OPENAI_API_KEY) — AI agent voice config requires OpenAI key; set in .env.local and Supabase function secrets
// INCOMPLETE:PARTIAL — Automation trigger executes; delay step queuing not yet connected to the cron endpoint at /api/automation/cron
// INCOMPLETE:TODO — Add confetti animation when job status transitions to "done" (use animate-confetti-burst from globals.css)
```

```dart
// INCOMPLETE:PARTIAL — Route optimization screen renders map; turn-by-turn directions_service.dart integration pending
// INCOMPLETE:BLOCKED(REVENUE_CAT_API_KEY) — Paywall screen requires RevenueCat API key in flutter env config
```

```sql
-- INCOMPLETE:PARTIAL — branches table has RLS for SELECT/INSERT; missing UPDATE/DELETE policies
-- INCOMPLETE:TODO — Consider adding a composite index on (organization_id, status, scheduled_at) for schedule performance
```

## Cleanup ritual
- Run `grep -rn "INCOMPLETE:" src/ flutter/lib/ supabase/ electron/src/` periodically.
- Produce a checklist sorted by severity: BLOCKED → PARTIAL → TODO.
- Close them in priority order. Remove the comment when the work is complete.
- Track recurring BLOCKED items in `docs/DECISIONS_LOG.md`.
