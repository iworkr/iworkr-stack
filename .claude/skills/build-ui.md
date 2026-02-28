---
name: build-ui
description: Build premium UI in iWorkr's Obsidian/Stealth Mode style — dark-first, Signal Green accent, bento grids, subtle motion, strict STYLE_GUIDE adherence, verification loop.
---

# Build UI Skill — iWorkr (Obsidian / Stealth Mode)

## Inputs required
- Feature description and which screens are affected
- Reference designs (if any) and what to emulate
- Whether this is landing page (public) or dashboard (authenticated) work
- `docs/STYLE_GUIDE.md` and `.claude/rules/design-system.md` loaded

## Step 1 — Load style truth
1. Read `docs/STYLE_GUIDE.md`. If a rule isn't covered, add it.
2. Read `.claude/rules/design-system.md` and enforce every rule.
3. Read `src/app/globals.css` for the exact token values and available animation classes.
4. Check `src/components/ui/` for existing base components before creating new ones.

## Step 2 — Plan the UI structure
- Identify which route(s) this touches in `src/app/`.
- Map to existing component directories in `src/components/<domain>/`.
- Define layout structure:
  - **Dashboard screens**: Use the shell layout (sidebar + header + content area). Widgets use `widget-glass` class.
  - **Landing sections**: Full-width sections with CSS variable backgrounds. Bento grids for features.
  - **Settings pages**: Follow existing settings page pattern (title + description + form card).
  - **Modals**: Framer Motion `AnimatePresence`, dark overlay, centered.

## Step 3 — Build in layers (do not overbuild)
1. **Layout skeleton** — Grid structure, spacing, containers. Use Tailwind utility classes.
2. **Typography** — Apply `.font-display` for headings, Inter for body, JetBrains Mono for data.
3. **Components** — Use existing UI components (`src/components/ui/`). Create new ones only if truly needed.
4. **States** — Loading (skeleton shimmer), empty (Lottie animation), error, success.
5. **Motion** — Framer Motion for entrance (`initial` → `animate`), CSS classes for persistent effects.
6. **Lottie** — Only for dashboard widgets and empty states. Use `LottieIcon` component. Place last after layout is stable.

## Step 4 — iWorkr-specific UI patterns
### Dashboard widgets
- Use `widget-glass` background class
- React Grid Layout for draggable arrangement
- Each widget: header with icon + title + action, body content, subtle border
- Lottie icons for widget headers (schedule, inbox, map, insights)

### Data tables / lists
- Use jobs-list-focus pattern: dim siblings on hover (`[data-job-row]`)
- Status badges with color-coded borders (not filled backgrounds)
- Keyboard navigation support

### Forms
- Zod validation with inline error messages
- Clean input styling with strong focus ring (`.focus-ring`)
- Group related fields with subtle section dividers

### Command palette (⌘K)
- Follows existing pattern in `src/components/shell/`
- Fast, keyboard-first, minimal

## Step 5 — Verification loop
1. Run `pnpm dev` and visually inspect affected screens.
2. Check against `docs/STYLE_GUIDE.md`:
   - Spacing rhythm consistent?
   - Typography hierarchy clear?
   - Signal Green used only for focus/CTAs?
   - Dark surfaces correct (`#050505` / `#0A0A0A` / `#141414`)?
   - Borders subtle (`rgba(255,255,255,0.05)`)?
3. Check mobile responsiveness at `375px` and `1440px`.
4. Fix top 3–5 visual issues.
5. Repeat max 3 rounds.

## Step 6 — Final pass checklist
- [ ] Mobile responsive (375px → 1440px)
- [ ] Accessible focus states (`.focus-ring`)
- [ ] No visual clutter — whitespace preserved
- [ ] Animations subtle and consistent (150–240ms, correct easing)
- [ ] Copy is tight and confident (benefit-first)
- [ ] Dark + light theme both work (test with theme toggle)
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] INCOMPLETE trails added for any partial work
