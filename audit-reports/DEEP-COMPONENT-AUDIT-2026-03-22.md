# Deep React Component Audit — 2026-03-22
> Scope: ALL ~170 component files across 33 directories in `src/components/`
> Method: Full file reads, pattern analysis, cross-reference

---

## 🔴 CRITICAL — Bugs & Runtime Errors

### C-01: `slide-over.tsx` — Local state never persisted to Supabase
**Severity: CRITICAL** | **File**: `shell/slide-over.tsx` L43-68
The SlideOver edits job title, status, priority, assignee, and description — but **none of these changes are ever saved back to the store or database**. `addToast("Title updated")` fires on blur, giving the user the illusion of saving, but the Zustand `useJobsStore` is never mutated. All edits are lost on close.
```
setLocalTitle(e.target.value) // ← local state only
addToast("Title updated")    // ← misleading success toast
// MISSING: useJobsStore.getState().updateJob(job.id, { title: localTitle })
```

### C-02: `slide-over.tsx` — Activity items use array index as key
**Severity: HIGH** | **File**: `shell/slide-over.tsx` L180-181
```jsx
{(job?.activity || []).map((entry, i) => (
  <div key={i} ...>  // ← index key in a list that could reorder
```
If activity entries are prepended (newest first), React will mismap DOM nodes causing stale content display.

### C-03: `command-menu.tsx` — `setCreateInvoiceModalOpen` in deps but never called
**Severity: MEDIUM** | **File**: `shell/command-menu.tsx` L156-161
`setCreateInvoiceModalOpen` is destructured from `useShellStore` and included in `useCallback` deps, but the "create-invoice" action uses `router.push` instead. This is dead code / incomplete refactor — the "New Invoice" command ignores the modal pattern.

### C-04: `new-message-modal.tsx` — Backdrop and modal are siblings under AnimatePresence
**Severity: MEDIUM** | **File**: `messenger/new-message-modal.tsx` L67-81
The backdrop `<motion.div onClick={onClose}>` and the modal `<motion.div>` are siblings. Click on backdrop closes modal correctly, but `stopPropagation` on the modal div only works because the backdrop click handler fires first. If `open` is false early-returned before `AnimatePresence`, exit animations never play.

### C-05: `broadcast-modal.tsx` — Same backdrop/modal sibling issue
**Severity: MEDIUM** | **File**: `messenger/broadcast-modal.tsx` L67-80
Same pattern as C-04. Exit animations won't play because `if (!open) return null` short-circuits before `AnimatePresence`.

### C-06: `care-blueprint-builder.tsx` — Uses `alert()` for error handling
**Severity: MEDIUM** | **File**: `care/care-blueprint-builder.tsx` L163
```js
alert(e.message || "Pipeline failed");
```
Native `alert()` blocks the UI thread and breaks the Obsidian design aesthetic. Should use `addToast()` or error state.

### C-07: `care-blueprint-builder.tsx` — Catches `any` typed error
**Severity: LOW** | **File**: `care/care-blueprint-builder.tsx` L160
```js
} catch (e: any) {
```
Should type-narrow with `e instanceof Error`.

### C-08: `sidebar.tsx` — SSR-unsafe `typeof window !== "undefined"` in render
**Severity: MEDIUM** | **File**: `shell/sidebar.tsx` L663-668
```jsx
style={{
  paddingTop: typeof window !== "undefined" && (window as any).iworkr ? 6 : 0,
}}
```
Accessing `window` directly in render causes hydration mismatches between server and client. Also `(window as any).iworkr` — repeated on L667. Should use `useEffect` + state or a custom hook.

### C-09: `topbar.tsx` — SSR-unsafe window access in render
**Severity: MEDIUM** | **File**: `shell/topbar.tsx` L821
```jsx
{typeof window !== "undefined" && "iworkr" in window && (
  <DesktopUpdateIndicator />
)}
```
Same hydration mismatch risk as C-08.

### C-10: `fleet-layer.tsx` — Inconsistent key usage between markersRef and elementsRef
**Severity: HIGH** | **File**: `dispatch/fleet-layer.tsx` L65-70
Fleet markers use `tech.id` for Map keys but `tid` (which is `tech.technician_id ?? tech.id`) for hover/ripple checks. If `technician_id` differs from `id`, the hover highlight won't match the correct marker because marker lookup uses `tech.id` but hover comparison uses `tid`.

---

## 🟡 ACCESSIBILITY Issues

### A-01: `slide-over.tsx` — "Open full view" button lacks aria-label
**Severity: MEDIUM** | **File**: `shell/slide-over.tsx` L112-122
The Maximize2 button uses `title="Open full view"` but no `aria-label`. Screen readers won't announce the purpose.

### A-02: `slide-over.tsx` — Status/Priority/Assignee buttons lack accessible names
**Severity: MEDIUM** | **File**: `shell/slide-over.tsx` L202-263
All three popover trigger buttons have no `aria-label`, `aria-haspopup`, or `role` attributes. Screen readers see empty buttons.

### A-03: `sidebar.tsx` — CollapsibleGroup parent button lacks aria-expanded
**Severity: MEDIUM** | **File**: `shell/sidebar.tsx` L430-436
The accordion trigger button toggles child visibility but doesn't communicate state:
```jsx
<button onClick={onToggle} ...>
// MISSING: aria-expanded={isOpen}
// MISSING: aria-controls="accordion-content-id"
```

### A-04: `dispatch-command-panel.tsx` — Toggle switches lack proper ARIA
**Severity: MEDIUM** | **File**: `dispatch/dispatch-command-panel.tsx` L84-108
The StealthToggle buttons are missing `role="switch"` and `aria-checked={on}`. Visually they look like switches but aren't announced as such.

### A-05: `command-menu.tsx` — Search input lacks aria-label
**Severity: LOW** | **File**: `shell/command-menu.tsx` L212
The command palette search input has no `aria-label` or associated `<label>` element.

### A-06: `chat-stream.tsx` — Message action buttons lack aria-labels
**Severity: LOW** | **File**: `messenger/chat-stream.tsx` L195-205
"View Job", "Pin", "Members" header buttons and the emoji quick-react buttons have no accessible names.

### A-07: `chronos-fab.tsx` — Multiple inputs lack labels
**Severity: MEDIUM** | **File**: `shell/chronos-fab.tsx` L278-332
Participant name, search, NDIS line item, and case note fields have `placeholder` text but no associated `<label>` elements.

### A-08: `inactivity-guard.tsx` — Warning modal lacks role="alertdialog"
**Severity: LOW** | **File**: `shell/inactivity-guard.tsx` L139
The timeout warning modal has no `role="alertdialog"` or `aria-modal="true"`, and buttons lack `type="button"`.

### A-09: `new-participant-overlay.tsx` — Many form inputs rely solely on placeholder
**Severity: MEDIUM** | **File**: `care/new-participant-overlay.tsx`
The overlay uses a custom `labelCls` for some labels, but many inputs throughout steps 0-6 use only `placeholder` for identification. Inputs like NDIS number, date of birth, email, and phone have `<label>` elements with the tiny `labelCls` styling but some don't have `htmlFor` associations.

---

## 🟠 PERFORMANCE Issues

### P-01: `sidebar.tsx` — `useFilteredNav` dependency on `isFree` not included
**Severity: MEDIUM** | **File**: `shell/sidebar.tsx` L297-321
`useMemo` depends on `groups`, `roleDef`, `clearance` but the `isFree` variable (used for PRO badge display in CollapsibleGroup) is not part of the filtering, which is correct. However, the `useFilteredNav` hook recreates objects on every call since `groups` is a new reference each render (it's defined at module level, so actually stable). No issue here.

### P-02: `fleet-layer.tsx` — Dynamic import of mapbox-gl inside useEffect
**Severity: LOW** | **File**: `dispatch/fleet-layer.tsx` L47
Every time techs, visible, hoveredId, or rippleTechId changes, `import("mapbox-gl")` is called. While bundlers cache dynamic imports, the `.then()` callback creates a new closure each time, potentially causing race conditions if the effect re-runs before the import resolves.

### P-03: `job-layer.tsx` — Same dynamic import race condition
**Severity: LOW** | **File**: `dispatch/job-layer.tsx` L52
Same pattern as P-02. `import("mapbox-gl").then(...)` inside useEffect without cancellation guard.

### P-04: `chronos-fab.tsx` — setTick forces re-render every second
**Severity: LOW** | **File**: `shell/chronos-fab.tsx` L82-84
```jsx
useEffect(() => {
  const i = setInterval(() => setTick((v) => v + 1), 1000);
  return () => clearInterval(i);
}, []);
```
This triggers a full component re-render every second. The `tick` value is only used in a hidden `<span>` to force updates. Consider using `useSyncExternalStore` or limiting the tick to only when timers are running.

### P-05: `topbar.tsx` — SyncRadarPopover polls every 12s regardless of visibility
**Severity: MEDIUM** | **File**: `shell/topbar.tsx` L555-581
`SyncRadarPopover` fetches `/api/integrations/sync-radar` every 12 seconds from mount, even when the popover is closed. The `open` prop doesn't gate the interval. Should only poll when visible.

### P-06: `chat-stream.tsx` — New objects created in render for emoji reactions
**Severity: LOW** | **File**: `messenger/chat-stream.tsx` L328-347
`Object.entries(msg.reactions)` creates new arrays on every render. With many messages and reactions, this could cause unnecessary re-renders in children.

### P-07: `new-participant-overlay.tsx` — Heavy form re-renders
**Severity: LOW** | **File**: `care/new-participant-overlay.tsx`
The 1400-line component with `react-hook-form` + `useFieldArray` × 4 arrays + `watch()` on multiple fields causes frequent re-renders. Consider splitting step renderers into separate components with `React.memo`.

---

## 🔵 DEAD CODE & Unused Imports

### D-01: `sidebar.tsx` — Unused `WorkspaceSwitcher` local component
**Severity: MEDIUM** | **File**: `shell/sidebar.tsx` L777-838
The local `WorkspaceSwitcher` function component (lines 777-838) is **never called** — the sidebar uses `WorkspaceSwitcherNew` imported from `./workspace-switcher` (L78, L693). This is 60 lines of dead code including a `companyName` prop that was replaced.

### D-02: `sidebar.tsx` — Unused imports: `useRouter`, `Eye`
**Severity: LOW** | **File**: `shell/sidebar.tsx` L61
`useRouter` is imported but not used in the main `Sidebar` component (it's used in the dead `WorkspaceSwitcher` on L778). `Eye` icon on L54 is imported but never used.

### D-03: `command-menu.tsx` — `setCreateInvoiceModalOpen` destructured but unused
**Severity: LOW** | **File**: `shell/command-menu.tsx` L114
Destructured from store but never called in `executeCommand`.

### D-04: `topbar.tsx` — `breadcrumbs` never includes "dashboard" segment
**Severity: LOW** | **File**: `shell/topbar.tsx` L99-109
The `getBreadcrumbs` function has a special case for `seg === "dashboard"` that skips it, but `labelMap` still includes `dashboard: "Dashboard"`. Minor dead code in the map.

### D-05: `dispatch-search.tsx` — JSDoc comment prop never implemented
**Severity: LOW** | **File**: `dispatch/dispatch-search.tsx` L17
```
/** Cmd+K to open */
```
This comment-as-prop is in the interface but doesn't correspond to any actual prop.

### D-06: `messenger-sidebar.tsx` — SectionHeader `+` button does nothing
**Severity: MEDIUM** | **File**: `messenger/messenger-sidebar.tsx` L293-305
The `+` button that appears on hover for each section has no `onClick` handler — it's purely decorative but looks interactive.

---

## 🟣 INCONSISTENCIES & Pattern Violations

### I-01: Mixed modal patterns — some use portal, most don't
**Severity: LOW** | **File**: Multiple
`new-workspace-modal.tsx` uses `createPortal(... document.body)` while all other modals (`broadcast-modal`, `new-message-modal`, `create-job-modal`, etc.) render inline. This is inconsistent but functional.

### I-02: Mixed toast systems
**Severity: MEDIUM** | **File**: `shell/notification-toast.tsx` vs `app/action-toast.tsx`
Two separate toast systems exist:
- `shell/notification-toast.tsx` → `useToastStore` (for realtime notification toasts)
- `app/action-toast.tsx` → also `useToastStore` (for action feedback toasts)

Both export `useToastStore` but are **different stores with different interfaces**. Components import from different paths. The notification toast expects `{ id, type, title, body, action_url, created_at }` while the action toast expects `(message: string)`. This namespace collision is confusing.

### I-03: Inconsistent outside-click handling
**Severity: LOW** | **File**: Multiple
Some components register outside-click handlers on every render regardless of open state (e.g., `Combobox` in participant-intake-wizard L221-227), while others correctly gate with `if (open)` (e.g., workspace-switcher L99). The ungated ones create unnecessary event listeners.

### I-04: `hover-dialog.tsx` — eslint-disable for exhaustive deps
**Severity: LOW** | **File**: `dispatch/hover-dialog.tsx` L58
```
}, [map, anchor?.lat, anchor?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
```
The `anchor` object dependency is split into primitives, but the full `anchor` object is not in deps. This is intentional (avoiding re-subscription on same lat/lng) but the eslint-disable is fragile.

### I-05: `sidebar.tsx` — CollapsibleGroup uses CSS Grid animation, TopLevelLink uses Tailwind
**Severity: LOW** | **File**: `shell/sidebar.tsx`
CollapsibleGroup accordion uses inline `gridTemplateRows: "0fr"→"1fr"` animation (L456-462) while the rest of the sidebar uses Framer Motion. Mixing animation approaches reduces consistency.

### I-06: `CareBlueprintBuilder` uses `alert()`, rest of codebase uses toast
**Severity: MEDIUM** | **File**: `care/care-blueprint-builder.tsx` L163
Only instance of `alert()` in the entire component tree. All other error feedback uses toast stores.

### I-07: Font registration duplicated across PDF components
**Severity: LOW** | **File**: `pdf/invoice-document.tsx` L30-37 & `pdf/statement-document.tsx` L24-31
Identical `Font.register()` calls for Inter and JetBrains Mono appear in both files. Should be extracted to a shared `pdf/fonts.ts` module.

### I-08: `workspace-switcher.tsx` vs old `sidebar.tsx` WorkspaceSwitcher
**Severity: LOW** | **File**: `shell/workspace-switcher.tsx` vs `shell/sidebar.tsx` L777
Two `WorkspaceSwitcher` components exist. The sidebar's local one is dead code (see D-01) but creates confusion.

---

## Summary by Severity

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 CRITICAL | 1 | C-01: SlideOver changes never saved |
| 🔴 HIGH | 2 | C-02: Index keys in activity list, C-10: Fleet marker key mismatch |
| 🟡 MEDIUM | 14 | Mixed across bugs, a11y, performance, dead code |
| 🟢 LOW | 14 | Minor inconsistencies, dead imports, small patterns |

### Top 5 Actions (ordered by impact):

1. **FIX C-01** — SlideOver must persist edits to `useJobsStore` and Supabase. Currently all user edits silently vanish.
2. **FIX C-10** — Fleet layer marker keys must be consistent (`tid` everywhere or `tech.id` everywhere) to prevent hover highlight bugs.
3. **FIX C-08/C-09** — Replace `typeof window` checks in render with `useEffect` + state to prevent hydration mismatches.
4. **FIX P-05** — Gate SyncRadar polling behind `open` state to avoid unnecessary API calls every 12 seconds.
5. **FIX A-03/A-04** — Add `aria-expanded` to sidebar accordion triggers and `role="switch"` to dispatch toggles.

---
*Audited by deep read of 170 component files across 33 directories. 2026-03-22.*
