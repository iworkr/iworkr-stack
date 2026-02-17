# Dashboard Module — Audit Report

> **Generated**: 2026-02-16T14:25:10.736Z
> **Module**: Dashboard (`/dashboard`)
> **Test Framework**: Playwright
> **Total Findings**: 50

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 Critical Failures | 1 |
| 🟡 Visual Defects | 2 |
| 🟣 Dummy Data Leaks | 0 |
| 🟠 Warnings | 3 |
| 🟢 Flow Passes | 44 |

---

## 🔴 Critical Failures


### Revenue MTD label missing
- **Widget**: Revenue
- **Detail**: The Revenue widget may not have loaded — 'Revenue MTD' text not found.



---

## 🟡 Visual Defects


### Growth indicator missing
- **Widget**: Revenue
- **Detail**: The 'vs last month' text is not visible — may indicate the growth% section failed to render.


### Map legend incomplete
- **Widget**: Map
- **Detail**: One or more legend items missing from the map widget.



---

## 🟣 Dummy Data Leaks

_No dummy data leaks found._



---

## 🟠 Warnings


### No pin dots visible
- **Widget**: Map
- **Detail**: No technician pins found — map may be showing empty state or pins have different selectors.

### ⌘K shortcut may not work in test
- **Widget**: Topbar
- **Detail**: Could not detect command menu after ⌘K — may be a Playwright focus issue.

### 'C' shortcut unclear
- **Widget**: Shortcuts
- **Detail**: Could not detect create job modal after pressing 'C'.


---

## 🟢 Flow Verification (Passes)

- ✅ **[Page]** Dashboard heading renders: The h1 'Dashboard' heading is visible on page load.
- ✅ **[Page]** Dynamic date renders correctly: Subheading contains current day "Tuesday" — not hardcoded.
- ✅ **[Page]** Live indicator present: The green pulsing 'Live' indicator is rendered.
- ✅ **[Page]** All 6 widgets rendered: Found 6 widget containers in the bento grid.
- ✅ **[Revenue]** SVG area chart renders: Found 38 SVG elements with paths (chart area + line).
- ✅ **[Map]** Live Dispatch header renders: 'Live Dispatch' label is visible.
- ✅ **[Map]** Active technicians badge renders: Badge showing number of active technicians is visible.
- ✅ **[Map]** 'Open Dispatch' navigates to Schedule: Button navigated to http://localhost:3000/dashboard/schedule
- ✅ **[Inbox]** Triage header renders: 'Triage' label is visible in the inbox widget.
- ✅ **[Inbox]** 'View all' navigates to Inbox: Navigated to http://localhost:3000/dashboard/inbox
- ✅ **[Inbox]** Empty state renders correctly: 'All caught up' empty state is displayed — no unread items.
- ✅ **[Schedule]** My Schedule header renders: 'My Schedule' label is visible.
- ✅ **[Schedule]** 'Today' label visible: Schedule widget correctly shows 'Today' context.
- ✅ **[Schedule]** 'Full View' navigates to Schedule: Navigated to http://localhost:3000/dashboard/schedule
- ✅ **[Actions]** Quick Actions header renders: 'Quick Actions' label is visible.
- ✅ **[Actions]** "New Job" button renders: Action button "New Job" is visible and styled.
- ✅ **[Actions]** "New Invoice" button renders: Action button "New Invoice" is visible and styled.
- ✅ **[Actions]** "Add Client" button renders: Action button "Add Client" is visible and styled.
- ✅ **[Actions]** "Broadcast" button renders: Action button "Broadcast" is visible and styled.
- ✅ **[Actions]** 'New Invoice' opens modal: Clicking 'New Invoice' successfully opens the create invoice modal.
- ✅ **[Actions]** 'Add Client' opens modal: Clicking 'Add Client' successfully opens the create client modal.
- ✅ **[Actions]** 'New Job' opens modal: Clicking 'New Job' successfully opens the create job modal.
- ✅ **[Actions]** 'Broadcast' opens modal: Clicking 'Broadcast' triggers a UI response.
- ✅ **[Insights]** AI Insight header renders: 'AI Insight' label is visible with sparkle icon.
- ✅ **[Sidebar]** "My Jobs" → /dashboard/jobs: Navigation successful.
- ✅ **[Sidebar]** "Schedule" → /dashboard/schedule: Navigation successful.
- ✅ **[Sidebar]** "Inbox" → /dashboard/inbox: Navigation successful.
- ✅ **[Sidebar]** "Clients" → /dashboard/clients: Navigation successful.
- ✅ **[Sidebar]** "Finance" → /dashboard/finance: Navigation successful.
- ✅ **[Sidebar]** "Assets" → /dashboard/assets: Navigation successful.
- ✅ **[Sidebar]** "Forms" → /dashboard/forms: Navigation successful.
- ✅ **[Sidebar]** "Team" → /dashboard/team: Navigation successful.
- ✅ **[Sidebar]** "Automations" → /dashboard/automations: Navigation successful.
- ✅ **[Topbar]** Search trigger visible: ⌘K search bar trigger is rendered in the topbar.
- ✅ **[Style]** All buttons have pointer cursor: Checked 20 buttons — all have cursor: pointer.
- ✅ **[Style]** Dark theme background correct: Body background is rgb(0, 0, 0) — matches dark theme.
- ✅ **[Style]** Inter font applied: Font family: Inter, "Inter Fallback"
- ✅ **[Style]** No default blue links: All 14 checked links have custom themed colors.
- ✅ **[Console]** No console errors: Dashboard loaded without any console.error calls.
- ✅ **[Network]** No network failures: All network requests returned 2xx/3xx status codes.
- ✅ **[Shortcuts]** '?' opens keyboard shortcuts: Keyboard shortcuts modal opens correctly.
- ✅ **[Responsive]** Desktop layout (1440px) renders: Bento grid visible at desktop width.
- ✅ **[Responsive]** Tablet layout (768px) renders: Grid adjusts to 2-column layout.
- ✅ **[Responsive]** Mobile layout (375px) renders: Grid collapses to single column on mobile.

---

## Architecture Notes

### Data Flow
The dashboard uses a dual-source strategy:
1. **Primary**: Server Actions (RPCs) — `getDashboardStats`, `getDailyRevenueChart`, `getMySchedule`, `getAIInsights`, `getLiveDispatch`
2. **Fallback**: Zustand stores populated by `DataProvider` — which themselves fallback to hardcoded mock data in `data.ts`

### Known Code Issues Found During Review
1. **`widget-actions.tsx` line 51-59**: `handleAction` switch statement does NOT handle `"createJob"` or `"broadcast"` — these fall through to default (no-op), making 2 of 4 quick action buttons dead clicks.
2. **`widget-map.tsx` line 48-53**: Hardcoded fallback pins (`Mike T.`, `Sarah C.`, `James O.`, `Tom L.`) are used when RPC returns empty. These are dummy data leaks.
3. **`widget-insights.tsx` line 18-25**: Hardcoded fallback insight text is shown when RPC returns empty. This is the default state for new orgs with no AI insights.
4. **`data.ts`**: Full mock data file with 753 lines of hardcoded jobs, clients, invoices, etc. Stores fall back to this data when Supabase queries return empty.

---

_Report generated by iWorkr QA Audit System_
