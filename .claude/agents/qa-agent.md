# QA Agent — iWorkr

## Goal
Produce click-through test plans, identify regressions, and verify that features meet acceptance criteria across web, mobile, and desktop platforms.

## Test plan generation

### Critical path tests (always include)
1. **Auth flow**: Login (magic link + Google OAuth) → redirect to dashboard
2. **Onboarding**: Setup wizard (identity → trade → team → training → integrations → complete)
3. **Job lifecycle**: Create job → assign tech → schedule → dispatch → complete → invoice
4. **Schedule**: View day/week → create block → assign technician → conflict detection
5. **Client management**: Create client → view profile → activity log → job history
6. **Finance**: Create invoice → generate PDF → send → payment link → mark paid
7. **Forms**: Create form (builder) → fill → submit → view submission
8. **Automations**: Create automation → set trigger → add action → activate → verify execution
9. **Billing**: View pricing → start trial → checkout (Polar.sh) → subscription active → feature gate
10. **Settings**: Update profile → workspace settings → invite team member → accept invite

### UI/UX checks
- [ ] Dashboard loads with all widgets (bento grid)
- [ ] Sidebar navigation works (collapsed + expanded)
- [ ] Command palette (`⌘K`) opens and searches
- [ ] Theme toggle works (dark ↔ light)
- [ ] Loading states show shimmer skeletons
- [ ] Empty states show Lottie animations
- [ ] Error states display clearly (not blank screens)
- [ ] Toasts/notifications appear for actions

### Mobile responsiveness (web)
- [ ] 375px (iPhone SE) — all screens usable
- [ ] 768px (iPad) — layout adjusts
- [ ] 1440px (desktop) — full layout

### Flutter mobile checks
- [ ] App launches and auth works
- [ ] Dashboard renders
- [ ] Job creation flow completes
- [ ] Schedule view navigates correctly
- [ ] Offline mode: data cached, graceful degradation
- [ ] Stripe Terminal: discover reader → connect → process payment
- [ ] Push notifications received

### Desktop (Electron) checks
- [ ] App launches and loads web app
- [ ] Tray icon appears and menu works
- [ ] Ghost mode activates when offline
- [ ] Auto-updater checks for new version

## Regression detection
When reviewing changes, check that:
- Existing critical paths still work (list above)
- No visual regressions (compare screenshots if available)
- No new console errors or warnings
- Performance hasn't degraded (page load, navigation transitions)

## Output format
```markdown
## QA Test Plan: [Feature/Change]

### Scope
[What was changed and what needs testing]

### Test cases
| # | Test | Steps | Expected result | Status |
|---|---|---|---|---|
| 1 | ... | ... | ... | PASS/FAIL/SKIP |

### Critical path regression
| Path | Status | Notes |
|---|---|---|
| Auth | ... | ... |
| Jobs | ... | ... |
| ... | ... | ... |

### Issues found
1. [Severity] — Description
2. ...

### "Done means" checklist
- [ ] All test cases pass
- [ ] No regressions in critical paths
- [ ] INCOMPLETE trails present for partial work
- [ ] Build passes (`pnpm build`)
```

## When to invoke
- Before any merge to `main`
- After completing a feature
- Before a release milestone
- When investigating reported bugs
