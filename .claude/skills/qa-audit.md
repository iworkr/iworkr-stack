---
name: qa-audit
description: Run a comprehensive QA audit of iWorkr — code quality, security, accessibility, performance, INCOMPLETE trail scan, design compliance, and regression checks.
---

# QA Audit Skill — iWorkr

## When to invoke
- Before a release or milestone
- After a large feature merge
- When the user requests a quality check
- Periodically as maintenance

## Step 1 — INCOMPLETE trail scan
```bash
# Find all INCOMPLETE markers across the codebase
grep -rn "INCOMPLETE:" src/ flutter/lib/ supabase/ electron/src/

# Categorize by severity
grep -rn "INCOMPLETE:BLOCKED" src/ flutter/lib/ supabase/ electron/src/
grep -rn "INCOMPLETE:PARTIAL" src/ flutter/lib/ supabase/ electron/src/
grep -rn "INCOMPLETE:TODO" src/ flutter/lib/ supabase/ electron/src/
```

Produce a checklist sorted by severity: BLOCKED → PARTIAL → TODO.
Flag any BLOCKED items that should be escalated.

## Step 2 — Build & lint verification
### Web
```bash
pnpm build           # Must succeed — zero errors
pnpm lint            # Must pass
pnpm test            # Unit tests pass
pnpm test:e2e        # E2E critical paths pass
```

### Flutter
```bash
cd flutter
flutter analyze       # Zero issues
flutter test          # Unit tests pass
```

### Electron
```bash
cd electron
npm run build         # Must succeed
```

## Step 3 — Security audit
- [ ] No secrets committed: scan for API keys, tokens, passwords in source
- [ ] `.env.local.example` is up to date with all required keys
- [ ] All Supabase tables have RLS enabled
- [ ] RLS policies cover SELECT, INSERT, UPDATE, DELETE for all functional tables
- [ ] Webhook endpoints validate signatures (Stripe, Polar, Resend, RevenueCat)
- [ ] Public endpoints use secure tokens, not user IDs
- [ ] Service role key never exposed to client
- [ ] No `nodeIntegration: true` in Electron

### RLS audit query
```sql
-- Find tables without RLS
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
AND NOT rowsecurity;

-- Find tables without policies
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
AND p.policyname IS NULL;
```

## Step 4 — Design compliance audit
Check against `docs/STYLE_GUIDE.md` and `.claude/rules/design-system.md`:

- [ ] Dark theme is primary — `#050505` background, correct surface tokens
- [ ] Signal Green `#10B981` used only for accents (≤10% of visible UI)
- [ ] Typography hierarchy: `.font-display` for headings, Inter body, JetBrains Mono for data
- [ ] Spacing rhythm consistent: 4/8/12/16/24/32/48/64 scale
- [ ] Border radius follows scale: xs(4), sm(6), md(8), lg(12), xl(16)
- [ ] Animations use correct easing: `--ease-snappy`, `--ease-spring`, `--ease-out-expo`
- [ ] No visual clutter — sufficient whitespace
- [ ] Light mode works correctly (not broken or unstyled)
- [ ] Mobile responsive: tested at 375px, 768px, 1440px

## Step 5 — Accessibility audit
- [ ] Focus states visible: `.focus-ring` applied to interactive elements
- [ ] Keyboard navigation works for core flows (jobs, schedule, inbox)
- [ ] Command palette (`⌘K`) accessible
- [ ] Color contrast: text on backgrounds meets WCAG AA
- [ ] Form inputs have labels (visible or `aria-label`)
- [ ] Modals trap focus and can be dismissed with Escape
- [ ] Images have alt text

## Step 6 — Performance audit
- [ ] `pnpm build` output: check bundle sizes for large imports
- [ ] `lucide-react`, `framer-motion`, `@supabase/supabase-js` are in `optimizePackageImports`
- [ ] Images optimized and using Next.js `<Image>` component
- [ ] No unnecessary re-renders (check Zustand store subscriptions)
- [ ] Supabase queries have appropriate indexes
- [ ] Edge Functions respond within 10s timeout
- [ ] Loading states shown during data fetches (shimmer skeletons)

## Step 7 — Regression checklist (critical paths)
- [ ] **Auth**: Login → Dashboard (magic link + Google OAuth)
- [ ] **Onboarding**: Setup flow completes → redirects to dashboard
- [ ] **Jobs**: Create → assign → schedule → status transitions
- [ ] **Schedule**: View day/week, create blocks, technician assignment
- [ ] **Clients**: Create → view profile → see activity
- [ ] **Finance**: Create invoice → generate PDF → send → payment
- [ ] **Forms**: Create form → fill → submit
- [ ] **Automations**: Create automation → trigger fires → action executes
- [ ] **Billing**: Pricing page → checkout → subscription active → feature gating
- [ ] **Settings**: Profile update, workspace settings, team invite

## Step 8 — Output format
Produce a structured report:

```markdown
# iWorkr QA Audit Report — [Date]

## Summary
- Build: PASS / FAIL
- Lint: PASS / FAIL
- Tests: X/Y passing
- INCOMPLETE items: X BLOCKED, Y PARTIAL, Z TODO
- Security issues: X critical, Y warnings
- Design violations: X items
- Accessibility: X items

## Critical issues (must fix)
1. ...

## Warnings (should fix)
1. ...

## Improvements (nice to have)
1. ...

## INCOMPLETE trail inventory
### BLOCKED
- ...
### PARTIAL
- ...
### TODO
- ...
```
