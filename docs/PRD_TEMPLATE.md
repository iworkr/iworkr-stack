# PRD Template — iWorkr

> Use this template for detailed product requirements. For quick features, use `PROJECT_BRIEF_TEMPLATE.md` instead.

## 1) Product overview
- Feature name:
- Owner:
- Status: Draft / In Review / Approved
- Last updated:

## 2) Goals + success metrics
| Goal | Metric | Target |
|---|---|---|
| ... | ... | ... |

## 3) Personas
Which iWorkr personas does this serve?
- [ ] Owner/Manager — overview, finance, team, automations, settings
- [ ] Dispatcher — inbox, schedule, jobs, clients
- [ ] Technician — inbox, assigned jobs, schedule, forms
- [ ] Office Admin — finance, clients, forms, inbox

## 4) Core user journeys
### Journey 1: [Name]
1. User does X...
2. System responds with Y...
3. User sees Z...

### Journey 2: [Name]
1. ...

## 5) Information architecture
- Where does this live in navigation? (Dashboard module / Settings page / etc.)
- Related modules:
- URL structure:

## 6) Design system requirements
- Follow `docs/STYLE_GUIDE.md` — Obsidian/Stealth Mode aesthetic.
- Specific component patterns needed:
- Animation requirements:
- Mobile responsive breakpoints: 375px, 768px, 1440px

## 7) Feature specs (module by module)

### 7.1 [Sub-feature name]
- **Purpose**:
- **UI states**: (loading / empty / populated / error)
- **Data model**: (table/columns or reference existing)
- **Server actions**: (function signatures)
- **API contracts**: (if API route needed)
- **Edge cases**:
- **Analytics events**: (if tracked)
- **Error handling**:
- **Acceptance criteria**:
- **INCOMPLETE markers**: (if staged delivery)

### 7.2 [Sub-feature name]
...

## 8) Security + privacy
- Auth requirements:
- RLS policies needed:
- Data sensitivity:
- GDPR/privacy considerations:

## 9) Performance + reliability
- Expected data volume:
- Query performance requirements:
- Caching strategy:
- Error recovery:

## 10) Rollout plan
- Phase 1: ...
- Phase 2: ...
- Feature flag: (if gated)
- Plan tier: (which subscription tier enables this?)

## 11) QA plan
- Unit tests:
- E2E tests:
- Manual test cases:
- Mobile testing:

## 12) Open questions
- [ ] Question 1
- [ ] Question 2
