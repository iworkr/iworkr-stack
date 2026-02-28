# Verification Loops — iWorkr

## Web UI verification
1. **Build check**: `pnpm build` — must succeed with zero errors.
2. **Lint check**: `pnpm lint` — must pass.
3. **Screenshot loop** (for visual changes):
   - Run `pnpm dev` locally
   - Capture stable screenshots of affected screens (desktop + mobile breakpoint)
   - Compare to reference + `docs/STYLE_GUIDE.md`
   - Fix spacing, typography, contrast, alignment issues
   - Repeat 2–3 passes max (avoid infinite loops)
4. **Unit tests**: `pnpm test` — run affected test files.
5. **E2E tests**: `pnpm test:e2e` — for changes touching auth, jobs, finance, or schedule flows.

## Backend verification
1. **Migration testing**: Run `supabase db reset` locally to verify migrations apply cleanly.
2. **RLS testing**: Query as different roles (anon, authenticated user, different org member) to verify isolation.
3. **Edge function testing**: `supabase functions serve` + test with sample payloads.
4. **Smoke scripts**: For endpoints without formal tests, test with curl/fetch and log responses.
5. **Schema validation**: Verify foreign keys, indexes, and constraints are correct.

## Flutter mobile verification
1. **Static analysis**: `flutter analyze` — zero issues.
2. **Unit tests**: `flutter test` — where available.
3. **Click-through checklist**:
   - Auth flow (login → dashboard)
   - Job creation and status changes
   - Schedule view and navigation
   - Offline mode behavior
   - Stripe Terminal tap-to-pay flow (if relevant)
4. **Layout check**: Test on small (iPhone SE) and large (iPhone Pro Max / iPad) screen sizes.

## Electron desktop verification
1. **Build**: `cd electron && npm run build` — must succeed.
2. **Dev test**: `npm run dev` — app launches, connects to web app.
3. **Offline mode**: Verify ghost mode activates when disconnected.

## Verification checklist template
When completing work, document verification:
```
## Verification
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (affected tests)
- [ ] Visual check: UI matches STYLE_GUIDE
- [ ] Mobile responsive: checked at 375px and 1440px
- [ ] RLS: verified org-scoping (if backend change)
- [ ] No secrets committed
- [ ] INCOMPLETE trails added for any partial work
```

## When to escalate
- If build fails and fix isn't obvious → investigate don't guess.
- If RLS test shows data leaking between orgs → treat as P0.
- If E2E tests fail on a critical path → fix before declaring done.
