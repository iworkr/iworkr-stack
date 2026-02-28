# PROJECT BRIEF TEMPLATE — iWorkr

> Use this template when starting a new feature, module, or sub-project within iWorkr.
> Copy this file, fill it in, and reference it in `src/CONTEXT.md`.

## A) What are we building?
- **Feature/module name**:
- **Type**: (New dashboard module / Settings page / Landing section / API endpoint / Migration / Flutter feature / Edge function)
- **One-liner**:
- **Target user persona**: (Owner/Manager / Dispatcher / Technician / Office Admin)
- **Success metric**:

## B) References
- **Visual reference**: (screenshot URL or description)
- **UX reference**: (similar feature in another product)
- **Must match**: (specific design patterns to follow)
- **Must avoid**: (anti-patterns or styles to avoid)

## C) Features (MVP)
- Feature 1:
- Feature 2:
- Feature 3:
- Feature 4:

## D) Technical scope
- **Routes affected**: (e.g., `/dashboard/fleet`, `/settings/fleet`)
- **Server actions**: (new file or additions to existing)
- **Database tables**: (new migrations needed?)
- **Edge functions**: (new or modified?)
- **Flutter screens**: (if mobile parity needed)
- **Components**: (which domain directory?)
- **Store**: (new Zustand store or extend existing?)

## E) Data model
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK, auto-generated |
| organization_id | uuid | FK → organizations, required for RLS |
| ... | ... | ... |

## F) Constraints
- **Timeline**:
- **Dependencies**: (what must exist first?)
- **Plan gating**: (which subscription tier enables this?)
- **Known blockers**:

## G) Verification plan
- **Web UI**: screenshot loop, responsive check
- **Backend**: migration test, RLS verification, smoke test
- **Mobile**: click-through checklist
- **E2E**: Playwright test for critical path?

## H) Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] `pnpm build` passes
- [ ] No INCOMPLETE:BLOCKED items remain
