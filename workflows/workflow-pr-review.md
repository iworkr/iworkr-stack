# Workflow — PR Review (iWorkr)

> Use this workflow before merging any feature branch to `main`.

## Steps

### 1) Reviewer Agent scan
Invoke `.claude/agents/reviewer-agent.md` to review the changes:
- Correctness and edge cases
- Security (auth, RLS, secrets)
- Consistency with iWorkr conventions
- Design system compliance
- Missing INCOMPLETE markings
- Test coverage

### 2) Fix blocking issues
Address all blocking issues identified by the reviewer:
- Security vulnerabilities → fix immediately
- Broken auth/RLS → fix immediately
- Build/lint failures → fix immediately

### 3) QA Agent checklist
Invoke `.claude/agents/qa-agent.md` to produce a test plan:
- Critical path regression checks
- Feature-specific test cases
- UI/UX visual checks

### 4) Run verification
```bash
pnpm build          # Must pass
pnpm lint           # Must pass
pnpm test           # Must pass
pnpm test:e2e       # Critical paths pass (if relevant)
```

### 5) INCOMPLETE trail check
```bash
# Scan for any INCOMPLETE markers in changed files
git diff main --name-only | xargs grep -n "INCOMPLETE:" 2>/dev/null
```

Ensure all partial work has appropriate `INCOMPLETE:` trails.

### 6) PR description
Include in the PR:
```markdown
## What changed
[Brief description]

## Why
[Rationale]

## Verification
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Visual check done (screenshot loop)
- [ ] RLS verified (if backend)
- [ ] No secrets committed
- [ ] INCOMPLETE trails present where needed

## Screenshots (if UI change)
[Attach screenshots]
```

### 7) Merge criteria
Before merging:
- [ ] All blocking review issues resolved
- [ ] Build + lint + tests pass
- [ ] QA checklist items addressed
- [ ] INCOMPLETE trails present for any staged work
- [ ] PR description is complete
- [ ] No secrets in the diff
