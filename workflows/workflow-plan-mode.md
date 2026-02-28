# Workflow — Plan Mode First (iWorkr)

> Use this workflow before starting any complex feature or change.

## Steps

### 1) Read context
- Read `src/CONTEXT.md` for current product state and architecture.
- Read `docs/PRD.md` and/or `docs/PRD-Backend.md` for feature specs.
- Read `docs/DECISIONS_LOG.md` for prior decisions that may affect this work.

### 2) Identify existing patterns
- Scan the relevant domain in `src/app/actions/`, `src/components/`, `src/lib/`.
- Find the closest existing feature to what you're building (e.g., "this new module is most like the jobs module").
- Note the patterns: server action shape, store shape, component structure, route layout.

### 3) Write the plan
```markdown
## Plan: [Feature name]

### Scope
[1-2 sentences on what this accomplishes]

### Files to touch
- `src/app/actions/xxx.ts` — [what changes]
- `src/components/xxx/` — [new or modified]
- `src/lib/xxx-store.ts` — [new store]
- `supabase/migrations/NNN_xxx.sql` — [new table/policy]

### New files to create
- ...

### Data model changes
| Table | Columns | Notes |
|---|---|---|

### Routes / navigation
- New route: `/dashboard/xxx`
- Sidebar entry needed: yes/no

### Verification steps
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] Visual check: matches STYLE_GUIDE
- [ ] RLS verified (if backend)
- [ ] Mobile responsive (375px, 1440px)

### Risks & assumptions
- Risk 1:
- Assumption 1:

### Estimated complexity
[Low / Medium / High]
```

### 4) Execute in small chunks
- Implement one logical piece at a time.
- Verify after each chunk (build, lint, visual check).
- Don't try to build everything at once.

### 5) Verify the complete feature
- Run full verification loop (see `workflows/workflow-screenshot-loop.md` or `workflows/workflow-test-loop.md`).
- Check for INCOMPLETE trails — add any that are needed.

### 6) Update documentation
- If new conventions were introduced, add to `.claude/rules/code-style.md`.
- If architectural decisions were made, add to `docs/DECISIONS_LOG.md`.
- If the product brief changed, update `src/CONTEXT.md`.
