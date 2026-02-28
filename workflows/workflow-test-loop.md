# Workflow — Test Loop (Backend / Logic Verification)

> Use this workflow to verify backend changes, server actions, and business logic.

## Steps

### 1) Identify test scope
- Which server actions were changed? (`src/app/actions/`)
- Which API routes were changed? (`src/app/api/`)
- Which migrations were added? (`supabase/migrations/`)
- Which Edge Functions were changed? (`supabase/functions/`)
- Which stores were changed? (`src/lib/`)

### 2) Run existing tests
```bash
# Unit tests (Vitest)
pnpm test

# Watch mode for iterative fixes
pnpm test:watch

# E2E tests (Playwright) — for critical path changes
pnpm test:e2e

# Flutter analysis
cd flutter && flutter analyze && flutter test
```

### 3) Add missing tests
For new server actions, add unit tests:
```typescript
// src/app/actions/__tests__/my-action.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('myAction', () => {
  it('should validate input', async () => {
    // ...
  })

  it('should check authorization', async () => {
    // ...
  })

  it('should handle errors gracefully', async () => {
    // ...
  })
})
```

### 4) Smoke test (when formal tests aren't practical)
For complex integrations or edge functions:
```bash
# Test edge function locally
supabase functions serve my-function

# Send test payload
curl -X POST http://localhost:54321/functions/v1/my-function \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": "payload"}'
```

Document the smoke test results.

### 5) RLS verification (for database changes)
```sql
-- Test as authenticated user in their org
set request.jwt.claims = '{"sub":"user-uuid-1"}';
select * from my_table; -- should return only org's data

-- Test as authenticated user in DIFFERENT org
set request.jwt.claims = '{"sub":"user-uuid-2"}';
select * from my_table; -- should return empty or different org's data

-- Test as anon (should fail)
set role anon;
select * from my_table; -- should be denied
```

### 6) Fix and repeat
- Fix any failures.
- Re-run tests.
- Repeat until clean.

### 7) Document
```markdown
## Test loop: [Feature/Change]

### Tests run
- [x] `pnpm test` — X/Y passing
- [x] `pnpm test:e2e` — X/Y passing (or N/A)
- [x] `flutter analyze` — clean (or N/A)
- [x] Migration: `supabase db reset` — success (or N/A)
- [x] RLS: verified org-scoping (or N/A)
- [x] Smoke test: [endpoint] — [result]

### New tests added
- `src/app/actions/__tests__/xxx.test.ts`

### Issues found and fixed
1. [Issue] → [Fix]

### Remaining items
- INCOMPLETE:PARTIAL — [description] (if any)
```
