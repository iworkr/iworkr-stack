# Dashboard Module — Audit Report

> **Generated**: 2026-02-19T00:56:25.527Z
> **Module**: Dashboard (`/dashboard`)
> **Test Framework**: Playwright
> **Total Findings**: 48

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 Critical Failures | 6 |
| 🟡 Visual Defects | 3 |
| 🟣 Dummy Data Leaks | 0 |
| 🟠 Warnings | 4 |
| 🟢 Flow Passes | 35 |

---

## 🔴 Critical Failures


### Missing widgets in bento grid
- **Widget**: Page
- **Detail**: Expected 6 widgets but found 4. Some widgets may have failed to render.


### Revenue MTD label missing
- **Widget**: Revenue
- **Detail**: The Revenue widget may not have loaded — 'Revenue MTD' text not found.


### Live Dispatch header missing
- **Widget**: Map
- **Detail**: The map widget may not have loaded.


### 'Open Dispatch' button missing
- **Widget**: Map
- **Detail**: The 'Open Dispatch' action link is not rendered.


### AI Insight header missing
- **Widget**: Insights
- **Detail**: Insights widget may not have loaded.


### "Inbox" nav link missing
- **Widget**: Sidebar
- **Detail**: Sidebar link "Inbox" not found or not visible.



---

## 🟡 Visual Defects


### Growth indicator missing
- **Widget**: Revenue
- **Detail**: The 'vs last month' text is not visible — may indicate the growth% section failed to render.


### Map legend incomplete
- **Widget**: Map
- **Detail**: One or more legend items missing from the map widget.


### Background color unexpected
- **Widget**: Style
- **Detail**: Body background is rgb(5, 5, 5) — expected pure black (#000).



---

## 🟣 Dummy Data Leaks

_No dummy data leaks found._



---

## 🟠 Warnings


### No pin dots visible
- **Widget**: Map
- **Detail**: No technician pins found — map may be showing empty state or pins have different selectors.

### No inbox items or empty state
- **Widget**: Inbox
- **Detail**: Neither items nor 'All caught up' found — widget may have render issues.

### ⌘K shortcut may not work in test
- **Widget**: Topbar
- **Detail**: Could not detect command menu after ⌘K — may be a Playwright focus issue.

### 'C' shortcut unclear
- **Widget**: Shortcuts
- **Detail**: Could not detect create job modal after pressing 'C'.


---

## 🟢 Flow Verification (Passes)

- ✅ **[Page]** Dashboard heading renders: The h1 'Dashboard' heading is visible on page load.
- ✅ **[Page]** Dynamic date renders correctly: Subheading contains current day "Thursday" — not hardcoded.
- ✅ **[Page]** Live indicator present: The green pulsing 'Live' indicator is rendered.
- ✅ **[Revenue]** SVG area chart renders: Found 34 SVG elements with paths (chart area + line).
- ✅ **[Inbox]** Triage header renders: 'Triage' label is visible in the inbox widget.
- ✅ **[Inbox]** 'View all' navigates to Inbox: Navigated to http://localhost:3000/dashboard/inbox
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
- ✅ **[Sidebar]** "My Jobs" → /dashboard/jobs: Navigation successful.
- ✅ **[Sidebar]** "Schedule" → /dashboard/schedule: Navigation successful.
- ✅ **[Sidebar]** "Clients" → /dashboard/clients: Navigation successful.
- ✅ **[Sidebar]** "Finance" → /dashboard/finance: Navigation successful.
- ✅ **[Sidebar]** "Assets" → /dashboard/assets: Navigation successful.
- ✅ **[Sidebar]** "Forms" → /dashboard/forms: Navigation successful.
- ✅ **[Sidebar]** "Team" → /dashboard/team: Navigation successful.
- ✅ **[Sidebar]** "Automations" → /dashboard/automations: Navigation successful.
- ✅ **[Style]** All buttons have pointer cursor: Checked 19 buttons — all have cursor: pointer.
- ✅ **[Style]** Inter font applied: Font family: Inter, "Inter Fallback"
- ✅ **[Style]** No default blue links: All 15 checked links have custom themed colors.
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
