# Dashboard Module — Audit Report

> **Generated**: 2026-03-14T14:54:10.342Z
> **Module**: Dashboard (`/dashboard`)
> **Test Framework**: Playwright
> **Total Findings**: 29

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 Critical Failures | 8 |
| 🟡 Visual Defects | 1 |
| 🟣 Dummy Data Leaks | 0 |
| 🟠 Warnings | 4 |
| 🟢 Flow Passes | 16 |

---

## 🔴 Critical Failures


### "Automations" navigation failed
- **Widget**: Sidebar
- **Detail**: Expected URL to contain "/dashboard/automations" but got "http://localhost:3000/dashboard"


### Console error detected
- **Widget**: Console
- **Detail**: Failed to load resource: the server responded with a status of 500 (Internal Server Error)


### Console error detected
- **Widget**: Console
- **Detail**: Failed to load resource: the server responded with a status of 404 (Not Found)


### Console error detected
- **Widget**: Console
- **Detail**: Failed to load resource: the server responded with a status of 404 (Not Found)


### Console error detected
- **Widget**: Console
- **Detail**: Error: Failed to initialize WebGL
    at Map._setupPainter (http://localhost:3000/_next/static/chunks/7e9b8_mapbox-gl_dist_mapbox-gl_a3300777.js:48404:65)
    at new Map (http://localhost:3000/_next/static/chunks/7e9b8_mapbox-gl_dist_mapbox-gl_a3300777.js:47686:60)
    at DispatchMapbox.useEffect (http://localhost:3000/_next/static/chunks/Development_STACK_iWorkr-Linear_src_cd925679._.js:1642:33)


### Console error detected
- **Widget**: Console
- **Detail**: Failed to load resource: the server responded with a status of 500 (Internal Server Error)


### HTTP 500 response
- **Widget**: Network
- **Detail**: URL: http://127.0.0.1:54321/functions/v1/ingest-telemetry


### HTTP 500 response
- **Widget**: Network
- **Detail**: URL: http://127.0.0.1:54321/functions/v1/ingest-telemetry



---

## 🟡 Visual Defects


### Background color unexpected
- **Widget**: Style
- **Detail**: Body background is rgb(5, 5, 5) — expected pure black (#000).



---

## 🟣 Dummy Data Leaks

_No dummy data leaks found._



---

## 🟠 Warnings


### ⌘K shortcut may not work in test
- **Widget**: Topbar
- **Detail**: Could not detect command menu after ⌘K — may be a Playwright focus issue.

### HTTP 404 response
- **Widget**: Network
- **Detail**: URL: http://127.0.0.1:54321/rest/v1/org_members?select=profile_id%2Cprofiles%28id%2Cfull_name%2Cavatar_url%29&organization_id=eq.721629d5-0459-4d4a-b323-ad76d3ba58c2

### HTTP 404 response
- **Widget**: Network
- **Detail**: URL: http://127.0.0.1:54321/rest/v1/org_members?select=profile_id%2Cprofiles%28id%2Cfull_name%2Cavatar_url%29&organization_id=eq.721629d5-0459-4d4a-b323-ad76d3ba58c2

### 'C' shortcut unclear
- **Widget**: Shortcuts
- **Detail**: Could not detect create job modal after pressing 'C'.


---

## 🟢 Flow Verification (Passes)

- ✅ **[Sidebar]** "My Jobs" → /dashboard/jobs: Navigation successful.
- ✅ **[Sidebar]** "Schedule" → /dashboard/schedule: Navigation successful.
- ✅ **[Sidebar]** "Messages" → /dashboard/inbox: Navigation successful.
- ✅ **[Sidebar]** "Clients" → /dashboard/clients: Navigation successful.
- ✅ **[Sidebar]** "Finance" → /dashboard/finance: Navigation successful.
- ✅ **[Sidebar]** "Assets" → /dashboard/assets: Navigation successful.
- ✅ **[Sidebar]** "Forms" → /dashboard/forms: Navigation successful.
- ✅ **[Sidebar]** "Team" → /dashboard/team: Navigation successful.
- ✅ **[Topbar]** Search trigger visible: ⌘K search bar trigger is rendered in the topbar.
- ✅ **[Style]** All buttons have pointer cursor: Checked 20 buttons — all have cursor: pointer.
- ✅ **[Style]** Inter font applied: Font family: inter, "inter Fallback"
- ✅ **[Style]** No default blue links: All 15 checked links have custom themed colors.
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
