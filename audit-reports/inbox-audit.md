# Inbox Module — Comprehensive Audit Report (Post-PRD)

> **Generated**: 2026-02-16T14:29:22.385Z
> **Module**: Inbox (`/dashboard/inbox`)
> **Test Framework**: Playwright (18 test suites)
> **Total Findings**: 39
> **PRD**: Inbox Module Live Activation & Fixes (P0)

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 Critical Failures | 0 |
| 🟡 Visual Defects | 0 |
| 🟣 Dummy Data Leaks | 0 |
| 🟠 Warnings | 7 |
| 🟢 Flow Passes | 32 |

---

## 🔴 Critical Failures

_No critical failures found._



---

## 🟡 Visual Defects

_No visual defects found._



---

## 🟣 Dummy Data Leaks

_No dummy data leaks found._



---

## 🟠 Warnings


### No items to select
- **Area**: Preview
- **Detail**: Cannot test preview — inbox is empty.

### No items to archive
- **Area**: Archive
- **Detail**: Skipping archive test — inbox empty.

### No items to snooze
- **Area**: Snooze
- **Detail**: Skipping snooze test.

### Not enough items for keyboard nav
- **Area**: Keyboard
- **Detail**: Only 0 items — need at least 2 for J/K testing.

### No items for reply test
- **Area**: Reply
- **Detail**: Skipping reply test.

### No items for avatar check
- **Area**: Avatar
- **Detail**: Skipping — inbox empty.

### No items for job ref test
- **Area**: JobRef
- **Detail**: Skipping.


---

## 🟢 Flow Verification (Passes)

- ✅ **[Layout]** Inbox heading renders: h1 'Inbox' is visible.
- ✅ **[Layout]** Left pane (feed) renders: 350px feed column is visible.
- ✅ **[Layout]** Right pane (preview) renders: Empty state shown.
- ✅ **[Layout]** Two-pane layout verified: Inbox uses split-pane design consistent with Linear.
- ✅ **[Tabs]** "All" tab renders: Tab button "All" is visible.
- ✅ **[Tabs]** "All" tab has active indicator: Animated underline indicator is present under active tab.
- ✅ **[Tabs]** "Unread" tab renders: Tab button "Unread" is visible.
- ✅ **[Tabs]** "Unread" tab has active indicator: Animated underline indicator is present under active tab.
- ✅ **[Tabs]** Unread empty state renders: 'All caught up' when no unread items.
- ✅ **[Tabs]** "Snoozed" tab renders: Tab button "Snoozed" is visible.
- ✅ **[Tabs]** "Snoozed" tab has active indicator: Animated underline indicator is present under active tab.
- ✅ **[Tabs]** Snoozed empty state renders: 'No snoozed items' empty state is correct.
- ✅ **[Items]** Empty state or zen state shown: Inbox is empty — expected for test user.
- ✅ **[UI]** Keyboard hints render: Found 21 kbd elements for J, K, E, H hints.
- ✅ **[UI]** "done" hint visible: Keyboard action label "done" rendered.
- ✅ **[UI]** "snooze" hint visible: Keyboard action label "snooze" rendered.
- ✅ **[UI]** "open" hint visible: Keyboard action label "open" rendered.
- ✅ **[Style]** All buttons have pointer cursor: Checked 15 buttons.
- ✅ **[Style]** Dark theme correct: Body bg is #000.
- ✅ **[Style]** Inter font applied: Font: Inter, "Inter Fallback"
- ✅ **[Style]** Custom border colors used: 26 elements use rgba border styling — consistent with theme.
- ✅ **[Console]** No console errors: Inbox page loaded without console errors.
- ✅ **[Network]** No network failures: All requests returned 2xx/3xx.
- ✅ **[Responsive]** Desktop (1440px) renders: Inbox heading visible at desktop width.
- ✅ **[Responsive]** Mobile (375px) renders: Inbox heading visible on mobile.
- ✅ **[Responsive]** Preview pane hidden on mobile: Right pane correctly hidden with hidden md:flex classes.
- ✅ **[Filter]** Filter button renders: Filter button is visible in the inbox header.
- ✅ **[Filter]** Filter button shows active state: Filter button displays violet active style when Mentions mode is on.
- ✅ **[Filter]** Filter tooltip updated: Button title: "Showing mentions only — click for all"
- ✅ **[Filter]** Filter toggles back to All: Second click restores 'All' filter mode.
- ✅ **[Snooze]** Snooze visible in empty state: Snooze button is rendered in the preview.
- ✅ **[EmptyState]** Empty state renders: 'No notifications' or 'You're all clear' is displayed.

---

## Architecture Notes (Post-PRD)

### Data Flow
```
InboxPage → useInboxStore
               ├── loadFromServer(orgId) → getNotifications() [server action]
               │       └── Supabase: notifications table (user_id, archived, snoozed_until)
               ├── Initial state: empty [] (no mock data fallback)
               ├── Realtime: DataProvider subscribes to notifications INSERT/UPDATE
               ├── Filter: toggleFilter() cycles "all" ↔ "mentions"
               └── Triage actions (optimistic + server sync):
                   ├── markAsRead → markRead() server action
                   ├── archive → archiveNotification()
                   ├── snooze → snoozeNotification()
                   └── reply → sendReplyAction() → notification_replies table
```

### PRD Fixes Applied
1. ✅ **Data Pipeline (3.1)**: `use-org.ts` uses `.maybeSingle()` — 406 error resolved.
2. ✅ **Mock Removal (3.2)**: `inbox-store.ts` no longer imports `inboxItems`; initial state is `[]`.
3. ✅ **Reply Persistence (3.3a)**: `sendReplyAction` inserts into `notification_replies` table.
4. ✅ **Filter Button (3.3b)**: Filter icon toggles `mentions` / `all` mode in store.
5. ✅ **Snooze Visibility (3.3c)**: Snooze button always rendered, disabled when no selection.
6. ✅ **Job Navigation (3.4a)**: `jobRef` maps to UUID `related_job_id` from notifications table.
7. ✅ **Reply Avatar (3.4b)**: Uses `useAuthStore` profile `full_name` for dynamic initials.
8. ✅ **Cursor Fix (4.1)**: `globals.css` rule: `button, [role="button"], a, .clickable { cursor: pointer }`.

---

_Report generated by iWorkr QA Audit System_
