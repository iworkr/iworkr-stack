# iWorkr — Style & Brand Reference Guide
> **The Field Operating System** · Design DNA for Web, Mobile & Desktop
> Version 3.0 — March 2026 · Living document

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Design Philosophy](#2-design-philosophy)
3. [Color System](#3-color-system)
4. [Typography](#4-typography)
5. [Spacing & Layout](#5-spacing--layout)
6. [Border Radius](#6-border-radius)
7. [Shadows & Elevation](#7-shadows--elevation)
8. [Surface System](#8-surface-system)
9. [Button System](#9-button-system)
10. [Input & Form Elements](#10-input--form-elements)
11. [Status System (Pills, Icons, Colors)](#11-status-system)
12. [Badge & Tag System](#12-badge--tag-system)
13. [Card System](#13-card-system)
14. [Modal & Dialog System](#14-modal--dialog-system)
15. [Toast & Notification System](#15-toast--notification-system)
16. [Navigation: Sidebar, Topbar, Breadcrumbs](#16-navigation-sidebar-topbar-breadcrumbs)
17. [Command Palette](#17-command-palette)
18. [Dropdown, Popover, Context Menu](#18-dropdown-popover-context-menu)
19. [Slide-Over / Sheet / Drawer](#19-slide-over--sheet--drawer)
20. [Bulk Action Bar](#20-bulk-action-bar)
21. [Dashboard Widgets (Bento Grid)](#21-dashboard-widgets-bento-grid)
22. [Paywall & Monetization UI](#22-paywall--monetization-ui)
23. [Loading & Skeleton System](#23-loading--skeleton-system)
24. [Empty States & Illustrations](#24-empty-states--illustrations)
25. [Animation System](#25-animation-system)
26. [Texture & Effects](#26-texture--effects)
27. [Icon System](#27-icon-system)
28. [Logo & Brand Assets](#28-logo--brand-assets)
29. [Keyboard Shortcuts](#29-keyboard-shortcuts)
30. [Flutter Mobile Parity](#30-flutter-mobile-parity)
31. [Electron Desktop Parity](#31-electron-desktop-parity)
32. [Quick Reference: Copy-Paste Snippets](#32-quick-reference-copy-paste-snippets)

---

## 1. Brand Identity

| Attribute | Value |
|---|---|
| **Name** | iWorkr |
| **Tagline** | The Field Operating System |
| **Design System** | "Obsidian" / "Stealth Mode" |
| **Primary Inspiration** | Linear, Vercel, Raycast |
| **Mood** | Premium, calm, fast, minimal, confident |
| **Anti-patterns** | Never cluttered, never neon-overloaded, never playful/bubbly |

### Brand Personality
- **Professional** — Built for trades businesses, not consumer apps
- **Surgical** — Every pixel earns its place
- **Keyboard-first** — Power users rewarded, mouse is secondary
- **Dark by default** — Obsidian-black foundation, light mode available

---

## 2. Design Philosophy

### Core Principles
1. **Monochrome + one accent** — 95% zinc palette, Signal Green for focus
2. **Information density** — More data in less space, no gratuitous whitespace
3. **Consistent cadence** — Same easing, same timing, same spacing everywhere
4. **Progressive disclosure** — Show what matters, reveal on demand
5. **Ghost tint** — Colored elements use 5–15% opacity tints, never solid fills
6. **Bevel light** — Inset top highlight creates subtle 3D depth on elevated surfaces

### The Rules
- **Never use color for decoration** — color communicates status
- **Never use more than 2 font weights** on screen at once (medium + regular)
- **Never exceed 3 levels of nesting** in card/panel hierarchy
- **Always** include keyboard navigation for interactive elements
- **Always** provide hover, active, focus, and disabled states

---

## 3. Color System

### 3.1 Brand Colors

| Token | Hex | Usage |
|---|---|---|
| **Signal Green** | `#10B981` | Primary brand, CTA, success, focus rings |
| **Signal Green Dark** | `#059669` | Hover state, light-mode brand |
| **Signal Green Glow** | `rgba(16,185,129,0.4)` | Focus ring outer, glow effects |
| **Signal Green Dim** | `rgba(16,185,129,0.15)` | Selection, soft highlights |

```css
--color-brand: #10B981;
--color-brand-dark: #059669;
--color-brand-glow: rgba(16, 185, 129, 0.4);
```

### 3.2 Surface Colors (Dark Theme — Default)

| Token | Hex | CSS Var | Usage |
|---|---|---|---|
| **Void** | `#050505` | `--background`, `--surface-0` | Page background, deepest layer |
| **Surface 1** | `#0A0A0A` | `--surface-1` | Sidebar, panels, elevated cards |
| **Surface 2** | `#141414` | `--surface-2` | Hover highlights, secondary panels |

### 3.3 Surface Colors (Light Theme)

| Token | Hex | CSS Var | Usage |
|---|---|---|---|
| **Background** | `#F9FAFB` | `--background` | Page background |
| **Surface 1** | `#F4F4F5` | `--surface-1` | Panels |
| **Surface 2** | `#E4E4E7` | `--surface-2` | Hover |

### 3.4 Border Colors

| Token | Value (Dark) | Value (Light) | Usage |
|---|---|---|---|
| `--border-base` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.08)` | Default borders |
| `--border-active` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.15)` | Active/focused borders |
| `--card-border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Card borders |
| `--card-border-hover` | `rgba(255,255,255,0.15)` | `rgba(0,0,0,0.15)` | Card hover borders |

### 3.5 Text Colors

| Token | Value (Dark) | Value (Light) | Tailwind | Usage |
|---|---|---|---|---|
| `--text-primary` | `#EDEDED` | `#18181B` | `text-zinc-100` | Headings, primary |
| `--text-heading` | `#EDEDED` | `#18181B` | `text-zinc-100` | Display headings |
| `--text-body` | `#A1A1AA` | `#52525B` | `text-zinc-400` | Body copy |
| `--text-muted` | `#71717A` | `#71717A` | `text-zinc-500` | Secondary, labels |
| `--text-dim` | `#52525B` | `#A1A1AA` | `text-zinc-600` | Tertiary, disabled |

### 3.6 Semantic Status Colors

| Status | Color | Hex | Tailwind |
|---|---|---|---|
| **Success / Active** | Emerald | `#10B981` | `text-emerald-400` / `bg-emerald-500/10` |
| **Warning / En Route** | Amber | `#F59E0B` | `text-amber-400` / `bg-amber-500/10` |
| **Error / Danger** | Rose | `#F43F5E` | `text-rose-400` / `bg-rose-500/10` |
| **Info / Scheduled** | Sky | `#38BDF8` | `text-sky-400` / `bg-sky-500/10` |
| **In Progress / On-Site** | Violet | `#8B5CF6` | `text-violet-400` / `bg-violet-500/10` |
| **Invoiced** | Blue | `#3B82F6` | `text-blue-400` / `bg-blue-500/10` |
| **Neutral / Archived** | Zinc | `#71717A` | `text-zinc-500` / `bg-zinc-500/8` |
| **AI / Intelligence** | Indigo | `#6366F1` | `text-indigo-400` / `bg-indigo-500/10` |

### 3.7 Overlay & Effect Colors

| Token | Value (Dark) | Usage |
|---|---|---|
| `--overlay-bg` | `rgba(0,0,0,0.95)` | Full overlays |
| `--selection-bg` | `rgba(16,185,129,0.15)` | Text selection |
| `--glow-soft` | `rgba(255,255,255,0.03)` | Radial section glows |
| `--grid-line` | `rgba(255,255,255,0.04)` | Grid patterns |
| `--grid-line-strong` | `rgba(255,255,255,0.1)` | Strong grid lines |
| `--scrollbar-thumb` | `rgba(255,255,255,0.06)` | Custom scrollbar |
| `--scrollbar-thumb-hover` | `rgba(255,255,255,0.12)` | Scrollbar hover |

### 3.8 Confetti / Celebration Palette

```ts
const CONFETTI_COLORS = ["#10B981", "#FFFFFF", "#34D399", "#6EE7B7", "#A7F3D0"];
```

---

## 4. Typography

### 4.1 Font Stack

| Font | CSS Variable | Usage | Files |
|---|---|---|---|
| **Inter** (variable) | `--font-inter` | Body, UI, headings | `src/fonts/inter-latin-variable.woff2` |
| **JetBrains Mono** (variable) | `--font-mono` | Code, KBDs, IDs, timestamps | `src/fonts/jetbrains-mono-latin-variable.woff2` |

Both loaded via `next/font/local` with `display: "swap"`.

```css
@theme inline {
  --font-sans: var(--font-inter);
  --font-mono: var(--font-mono);
  --font-display: var(--font-inter);
}
```

### 4.2 Type Scale

| Element | Size | Weight | Tracking | Class Example |
|---|---|---|---|---|
| **Page title** | `24px` | 600 (semibold) | `-0.025em` (tight) | `text-2xl font-semibold tracking-tight` |
| **Section title** | `20px` | 600 | `-0.025em` | `text-xl font-semibold tracking-tight` |
| **Card heading** | `17px` | 600 | `-0.025em` | `text-[17px] font-semibold tracking-tight` |
| **Subheading** | `14–15px` | 500 (medium) | normal | `text-[14px] font-medium` |
| **Body** | `13–14px` | 400 (regular) | normal | `text-[13px] text-zinc-400` |
| **Small / Caption** | `12px` | 400–500 | normal | `text-[12px] text-zinc-500` |
| **Label / Overline** | `9–11px` | 600–700 | `0.05em+` (widest) | `text-[9px] font-bold tracking-widest uppercase` |
| **Mono / Code** | `12–13px` | 400 | `-0.025em` | `font-mono text-[12px]` |
| **Pill / Badge** | `10px` | 600 | `0.025em` (wide) | `text-[10px] font-semibold tracking-wide` |
| **Kbd** | `9px` | 400 | normal | `font-mono text-[9px]` |

### 4.3 Letter Spacing

| Token | Value | Usage |
|---|---|---|
| `--tracking-tight` | `-0.025em` | All headings and display text |
| `--tracking-tighter` | `-0.05em` | Hero display text |
| `tracking-widest` | `0.1em` | Section labels, overlines, uppercase tags |
| `tracking-wider` | `0.05em` | Badges, plan labels |
| `tracking-wide` | `0.025em` | Status pills |

### 4.4 Landing Page Type Scale

| Element | Size | Tracking | Class |
|---|---|---|---|
| **Hero headline** | `48–64px` | `-0.05em` | `text-5xl md:text-6xl lg:text-7xl tracking-tighter` |
| **Section title** | `30–48px` | `-0.025em` | `text-3xl md:text-4xl lg:text-5xl tracking-tight` |
| **Section label** | `12px` mono | `0.1em` | `font-mono text-xs tracking-widest uppercase text-zinc-500` |
| **Section body** | `18px` | normal | `text-lg leading-relaxed text-text-secondary` |
| **CTA text** | `14–16px` | normal | `text-sm` / `text-base` |

---

## 5. Spacing & Layout

### 5.1 Spacing Scale (px)

```
4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64 · 96
```

Tailwind utility equivalents: `1 · 1.5 · 2 · 3 · 4 · 5 · 6 · 8 · 12 · 16 · 24`

### 5.2 Layout Constants

| Element | Width / Value |
|---|---|
| **Sidebar (expanded)** | `240px` |
| **Sidebar (collapsed)** | `64px` |
| **Topbar height** | `48px` (`h-12`) |
| **Max content width (landing)** | `1200px` |
| **Max content width (dashboard)** | `100%` (fluid) |
| **Section vertical padding** | `py-24 md:py-32` (96–128px) |
| **Card internal padding** | `p-4` to `p-6` (16–24px) |
| **Modal max height** | `85vh` |
| **Slide-over width** | `400px` |
| **Command palette width** | `560px` |
| **Popover width** | `200px` default |
| **Context menu width** | `208px` (`w-52`) |
| **Dashboard gap** | Handled by `react-grid-layout` |

### 5.3 Section Layout Pattern

```tsx
<Section id="section-name">
  <SectionHeader
    label="OVERLINE"        // mono, uppercase, zinc-500
    title="Section Title"    // 3xl–5xl, tracking-tight
    description="..."        // lg, text-secondary
  />
  {/* Content */}
</Section>
```

Container: `mx-auto max-w-[1200px] px-6 md:px-12`

---

## 6. Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-xs` | `4px` | Badges, chips, small pills |
| `--radius-sm` | `6px` | Inputs, small buttons, tags |
| `--radius-md` | `8px` | Cards, panels, command palette |
| `--radius-lg` | `12px` | Dashboard widgets, modals, large cards |
| `--radius-xl` | `16px` | Large containers, widget shells |
| `rounded-full` | `9999px` | Avatars, status pills, toggle tracks |
| `rounded-2xl` | `16px` | Modal dialogs, widget shells |

---

## 7. Shadows & Elevation

| Token / Usage | Value |
|---|---|
| **Inset bevel** | `inset 0 1px 0 0 rgba(255,255,255,0.05)` — top light on elevated surfaces |
| **Card shadow** | `shadow-none` — cards use border only, not drop shadows |
| **Widget hover** | Border transitions from `white/5` → `white/10` |
| **Dropdown shadow** | `0 16px 48px -8px rgba(0,0,0,0.6)` — deep float shadow |
| **Context menu** | `0 16px 48px -8px rgba(0,0,0,0.8)` — extra deep |
| **Brand glow** | `0 0 20px rgba(16,185,129,0.3)` — emerald glow |
| **Brand glow subtle** | `0 0 12px -5px rgba(16,185,129,0.2)` — soft emerald |
| **Focus ring** | `0 0 0 2px var(--background), 0 0 0 4px rgba(16,185,129,0.4)` |
| **Schedule block hover** | `0 10px 40px -10px rgba(0,0,0,0.6)` with `scale(1.02)` |
| **Overdue pulse** | `0 0 15px rgba(244,63,94,0.15)` ↔ `0 0 4px rgba(244,63,94,0.05)` |
| **Low stock pulse** | `0 0 15px rgba(245,158,11,0.15)` ↔ `0 0 4px rgba(245,158,11,0.05)` |

---

## 8. Surface System

### 8.1 Card Backgrounds

| Context | Value | CSS Var |
|---|---|---|
| **Standard card** | `rgba(255,255,255,0.02)` | `--card-bg` |
| **Subtle bg** | `rgba(255,255,255,0.04)` | `--subtle-bg` |
| **Subtle bg hover** | `rgba(255,255,255,0.06)` | `--subtle-bg-hover` |
| **Widget glass** | Radial gradient + inset bevel | `.widget-glass` class |
| **Widget body** | `radial-gradient(120% 150% at 50% -20%, rgba(16,185,129,0.04) 0%, transparent 50%), #09090b` | Inline style |

### 8.2 Widget Glass Effect

```css
.widget-glass {
  background: linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
  box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.05);
}
```

Light mode:
```css
.light .widget-glass {
  background: linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,0.7));
  box-shadow: inset 0 1px 0 0 rgba(255,255,255,0.5);
}
```

---

## 9. Button System

### 9.1 SpotlightButton (Primary CTA)

| Variant | Classes |
|---|---|
| **Primary** | `bg-[var(--text-primary)] text-[var(--background)] hover:opacity-90` |
| **Secondary** | `bg-transparent border-[var(--card-border)] hover:bg-[var(--subtle-bg)]` |
| **Ghost** | `bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]` |

| Size | Padding | Font |
|---|---|---|
| `sm` | `px-3.5 py-1.5` | `text-sm` |
| `md` | `px-5 py-2.5` | `text-sm` |
| `lg` | `px-7 py-3` | `text-base` |

Base: `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200`
Motion: `whileTap={{ scale: 0.98 }}`

### 9.2 Obsidian Button System (Modals & Forms)

```ts
// Primary — white bg, black text
const obsidianButtonPrimary = "rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

// Ghost — transparent, zinc text
const obsidianButtonGhost = "rounded-xl bg-transparent px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white";

// Danger — rose outline
const obsidianButtonDanger = "rounded-xl border border-rose-500/20 bg-transparent px-4 py-2 text-[13px] font-medium text-rose-500 transition-colors hover:bg-rose-500/10";
```

### 9.3 Micro-Interaction Utilities

```css
.btn-micro {
  transition-timing-function: var(--ease-snappy);
}
.btn-micro:hover { transform: scale(1.01); }
.btn-micro:active { transform: scale(0.97); }
```

### 9.4 Shimmer CTA Button (Paywall)

```tsx
<button className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-zinc-900 py-3 text-[13px] font-medium text-white group">
  {/* Shimmer sweep on hover */}
  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700
    bg-gradient-to-r from-transparent via-white/5 to-transparent" />
  Get Started
</button>
```

---

## 10. Input & Form Elements

### 10.1 Text Input (Standard)

```tsx
<input className="w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2
  text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600
  focus:border-[rgba(255,255,255,0.15)] focus:bg-[rgba(255,255,255,0.02)]
  transition-all duration-150" />
```

### 10.2 Search Input (Command Palette / Popover)

```tsx
<input className="flex-1 bg-transparent text-[14px] text-zinc-100 outline-none
  placeholder:text-zinc-600" />
```

### 10.3 Textarea

```tsx
<textarea className="w-full resize-none rounded-lg border border-transparent bg-transparent
  text-[13px] text-zinc-400 focus:border-[rgba(255,255,255,0.08)]
  focus:bg-[rgba(255,255,255,0.02)] focus:p-3 transition-all" />
```

### 10.4 Toggle / Switch

```css
.toggle-track { transition: background-color 200ms ease-out; }
.toggle-thumb { transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1); }
```

Framer Motion variant: `animate={{ x: checked ? 18 : 2 }}` with `type: "spring", stiffness: 500, damping: 30`

### 10.5 Focus Ring

```css
.focus-ring:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--background), 0 0 0 4px rgba(16, 185, 129, 0.4);
}
```

---

## 11. Status System

### 11.1 Status Pill (`StatusPill` component)

Ghost-tint pattern: colored text + `10%` bg + `20%` border

| Status | Text | Background | Border |
|---|---|---|---|
| `urgent` | `text-rose-400` | `bg-rose-500/10` | `border-rose-500/20` |
| `backlog` | `text-zinc-500` | `bg-zinc-500/8` | `border-zinc-500/15` |
| `todo` | `text-zinc-400` | `bg-zinc-400/8` | `border-zinc-400/15` |
| `scheduled` | `text-sky-400` | `bg-sky-500/10` | `border-sky-500/20` |
| `en_route` | `text-amber-400` | `bg-amber-500/10` | `border-amber-500/20` |
| `on_site` | `text-violet-400` | `bg-violet-500/10` | `border-violet-500/20` |
| `in_progress` | `text-amber-400` | `bg-amber-500/10` | `border-amber-500/20` |
| `done` / `completed` | `text-emerald-400` | `bg-emerald-500/10` | `border-emerald-500/20` |
| `invoiced` | `text-blue-400` | `bg-blue-500/10` | `border-blue-500/20` |
| `on_hold` | `text-orange-400` | `bg-orange-500/10` | `border-orange-500/20` |
| `archived` / `cancelled` | `text-zinc-600` | `bg-zinc-500/8` | `border-zinc-500/10` |

Base: `rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide`

### 11.2 Status Icon (`StatusIcon` component)

Custom SVG circles with dynamic fill:
- Empty (backlog/todo): Outlined circle, dotted for backlog
- Partial fill (scheduled 15%, en_route 30%, on_site 45%, in_progress 50%)
- Full (done/completed): Checkmark
- Special: Invoiced (clock), cancelled (X), archived (dashed + check)

### 11.3 Priority Icon (`PriorityIcon` component)

| Priority | Color | Icon Shape |
|---|---|---|
| `urgent` | `text-red-400` | Warning triangle |
| `high` | `text-orange-400` | Arrow up |
| `medium` | `text-yellow-500/70` | Horizontal dash |
| `low` | `text-sky-400/70` | Arrow down |
| `none` | `text-zinc-600` | Horizontal dash |

---

## 12. Badge & Tag System

### 12.1 Badge (Landing page / Headers)

```tsx
<Badge glow>
  <Sparkles size={12} /> New feature
</Badge>
```

Classes: `inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-1.5 text-sm text-[var(--text-muted)] backdrop-blur-md`

Glow hover: `boxShadow: "0 0 20px -8px rgba(0, 230, 118, 0.15)"`

### 12.2 ProBadge (Upgrade indicator)

| Size | Classes |
|---|---|
| `xs` | `rounded-full bg-amber-400/10 px-1.5 py-px text-[8px] font-semibold text-amber-400` |
| `sm` | `rounded-full bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold text-amber-400` + Crown icon |

### 12.3 LockIndicator

```tsx
<div className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400/10">
  <Lock size={8} className="text-amber-400" />
</div>
```

### 12.4 Tags / Labels (Inline)

```tsx
<span className="rounded border border-[rgba(255,255,255,0.08)] px-1.5 py-0.5 text-[10px] text-zinc-500">
  Label Name
</span>
```

### 12.5 Plan Badge (Paywall)

```tsx
<span className="inline-flex items-center gap-1 rounded-md bg-white/[0.03] px-2.5 py-0.5
  font-mono text-[9px] uppercase tracking-wider text-zinc-500">
  STARTER
</span>
```

### 12.6 Unread Count Badge

```tsx
<span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full
  bg-rose-500/15 px-1 font-mono text-[9px] font-medium text-rose-400">
  3
</span>
```

### 12.7 Notification "New" Badge

```tsx
<span className="rounded-full bg-[rgba(0,230,118,0.12)] px-1.5 py-0.5
  text-[9px] font-medium text-[#00E676]">
  NEW
</span>
```

---

## 13. Card System

### 13.1 GlassCard (Standard)

Cursor-tracking spotlight with spring physics.

```tsx
<GlassCard spotlightSize={350}>
  {/* Content */}
</GlassCard>
```

Classes: `group relative overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-[border-color] duration-200 hover:border-white/10`

Spotlight: `radial-gradient(350px circle at ${x}px ${y}px, var(--subtle-bg-hover), transparent 80%)` using `useSpring({ stiffness: 300, damping: 30 })`

### 13.2 WidgetShell (Dashboard)

Green light cone from top + cursor spotlight + noise overlay.

```tsx
<WidgetShell header={<h3>Title</h3>} action={<button>+</button>} delay={0.1}>
  {/* Widget content */}
</WidgetShell>
```

Background: `radial-gradient(120% 150% at 50% -20%, rgba(16,185,129,0.04) 0%, transparent 50%), #09090b`
Entry: `opacity: 0, scale: 0.96, y: 12 → 1, 1, 0` over `0.6s`

### 13.3 Bento Card (Paywall)

```tsx
<div className="flex flex-col rounded-lg border border-white/[0.05] bg-zinc-900/40 p-4
  hover:border-emerald-500/10 hover:bg-zinc-900/60 transition-all duration-200">
```

---

## 14. Modal & Dialog System

### 14.1 ObsidianModal

The standard modal pattern across the app.

```tsx
<ObsidianModal open={open} onClose={onClose} maxWidth="xl" padding="p-8">
  <ObsidianModalHeader
    title="Modal Title"
    subtitle="Optional subtitle"
    onClose={onClose}
  />
  {/* Body */}
  <div className="flex items-center justify-end gap-2 pt-6">
    <button className={obsidianButtonGhost}>Cancel</button>
    <button className={obsidianButtonPrimary}>Confirm</button>
  </div>
</ObsidianModal>
```

| Prop | Options |
|---|---|
| `maxWidth` | `"md"` (28rem) · `"lg"` (32rem) · `"xl"` (36rem) · `"2xl"` (42rem) · `"full"` (100%) |
| `padding` | `"p-6"` · `"p-8"` · `"none"` |

**Animation:**
```tsx
// Backdrop
initial={{ opacity: 0 }} → animate={{ opacity: 1 }} → exit={{ opacity: 0 }}
transition={{ duration: 0.15, ease: "easeOut" }}

// Body
initial={{ opacity: 0, scale: 0.95 }} → animate={{ opacity: 1, scale: 1 }} → exit={{ opacity: 0, scale: 0.98 }}
transition={{ duration: 0.15, ease: "easeOut" }}
```

### 14.2 Upgrade Modal (Full-screen overlay)

Portal-mounted, z-100, with pricing tiles. See `src/components/app/upgrade-modal.tsx`.
- Backdrop: `bg-black/70 backdrop-blur-md`
- Body: `rounded-2xl border border-white/[0.06] bg-[#0A0A0A] max-w-[860px]`
- Spring entry: `stiffness: 400, damping: 32`

---

## 15. Toast & Notification System

### 15.1 ActionToast

Fixed bottom-center, z-60.

```tsx
useToastStore.addToast("Job created successfully");
useToastStore.addToast("Failed to save", undefined, "error");
```

| Type | Icon | Text Color | Border |
|---|---|---|---|
| `success` | `CheckCircle` | `text-emerald-400` | `border-emerald-500/15` |
| `error` | `AlertCircle` | `text-rose-400` | `border-rose-500/15` |
| `info` | `CheckCircle` | `text-zinc-400` | `border-white/[0.06]` |

Toast classes: `rounded-xl border bg-[#0A0A0A]/95 px-4 py-2.5 shadow-lg backdrop-blur-md`
Auto-dismiss: 5 seconds. Includes optional "Undo" button.

**Animation:**
```tsx
initial={{ opacity: 0, y: 12, scale: 0.98 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, y: 8, scale: 0.98 }}
```

### 15.2 Upgrade Celebration

40 confetti particles in emerald palette + success toast with checkmark.
Triggered by `?upgrade=success` URL param. Auto-dismisses in 5s.

---

## 16. Navigation: Sidebar, Topbar, Breadcrumbs

### 16.1 Sidebar

| State | Width | Content |
|---|---|---|
| Expanded | `240px` | Icons + labels + shortcuts |
| Collapsed | `64px` | Icons only |
| Mobile | Full overlay | `bg-black/60 backdrop-blur-sm` |

- **Active indicator**: `layoutId="sidebar-glass-pill"` — shared layout animation
- **Active bg**: `shadow-[inset_0_0_0_1px_var(--border-active)] bg-[var(--surface-2)]`
- **Hover**: `bg-[var(--surface-2)]` at `opacity-0 → group-hover:opacity-100`
- **Section labels**: `text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase`
- **Team avatars**: `h-5 w-5 rounded-full bg-[var(--surface-2)] text-[8px]`
- **Online dot**: `h-[7px] w-[7px] rounded-full bg-emerald-500`
- **Kbd hints**: `rounded border px-1 py-0.5 font-mono text-[9px]` — shown on hover

Collapse animation: `type: "spring", stiffness: 400, damping: 30`

### 16.2 Topbar

Height: `h-12`. Background: `color-mix(in srgb, var(--surface-0) 80%, transparent)` + `backdrop-blur-xl`

- **Breadcrumbs**: `text-[13px]`, active = `font-medium text-zinc-300`, inactive = `text-zinc-600`
- **Search trigger**: `text-[13px] text-zinc-600 hover:bg-white/[0.03]`
- **Profile avatar**: `h-6 w-6 rounded-full ring-1 ring-[rgba(255,255,255,0.08)]`

---

## 17. Command Palette

Triggered by `⌘K`. Top-18% positioning.

```
Panel: rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F]
       shadow-[0_24px_48px_rgba(0,0,0,0.4)] max-w-[560px]
Input: text-[14px] text-zinc-100 placeholder:text-zinc-600
Group: text-[9px] font-bold tracking-widest text-zinc-700 uppercase
Item:  rounded-xl px-3 py-2 text-zinc-400
Active: bg-white/[0.05] text-zinc-100
Kbd:   rounded border border-white/[0.06] bg-white/[0.03] font-mono text-[9px] text-zinc-600
```

Scale-in: `scale: 0.98, y: -8 → 1, 0` (0.12s)

---

## 18. Dropdown, Popover, Context Menu

### 18.1 PopoverMenu (Searchable Select)

```
Panel: rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F]
       shadow-[0_16px_48px_-8px_rgba(0,0,0,0.5)] p-1
Item:  rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400
Active: bg-white/[0.06] text-zinc-200
Check: text-emerald-500 (for selected)
```

Entry: `opacity: 0, scale: 0.95, y: -4 → 1, 1, 0` (0.12s)

### 18.2 ContextMenu (Right-click)

```
Panel: rounded-[8px] border border-[rgba(255,255,255,0.1)] bg-[#0F0F0F]
       shadow-[0_16px_48px_-8px_rgba(0,0,0,0.8)] w-52 p-1
Item:  rounded-md px-2.5 py-1.5 text-[12px] text-zinc-400
Danger: text-red-400 hover:bg-red-500/10
Divider: h-px bg-white/[0.08]
Shortcut: font-mono text-[10px] text-zinc-700
```

Entry: `opacity: 0, scale: 0.95 → 1, 1` (0.1s)

### 18.3 Workspace / Profile Dropdowns

```
Panel: rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#161616]
       shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6)] w-52 py-1
Item:  rounded-md px-2.5 py-1.5 text-[12px] hover:bg-[rgba(255,255,255,0.04)]
Divider: h-px bg-[rgba(255,255,255,0.06)]
```

---

## 19. Slide-Over / Sheet / Drawer

Right-side panel for detail views.

```
Panel: w-[400px] border-l border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]
       shadow-[0_24px_48px_rgba(0,0,0,0.4)]
Title: text-[20px] font-medium tracking-tight text-zinc-100
ID: font-mono text-[12px] text-zinc-500/60
Props: text-[11px] text-zinc-600 (label) + text-[12px] text-zinc-300 (value)
```

Animation: `x: "100%" → 0` with `type: "spring", stiffness: 400, damping: 36`

---

## 20. Bulk Action Bar

Fixed bottom-center floating toolbar for multi-select.

```tsx
<div className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.1)]
  bg-zinc-900/95 px-2 py-1.5 shadow-xl backdrop-blur-sm">
  <span className="text-[13px] font-medium text-zinc-200">{count} selected</span>
  {/* Action buttons */}
</div>
```

Animation: `y: 30 → 0` (0.2s, ease-out-expo)

---

## 21. Dashboard Widgets (Bento Grid)

Uses `react-grid-layout` for drag-and-drop widget arrangement.

### Widget Shell Pattern

Every dashboard card uses `WidgetShell`:
- Green light cone from top
- Cursor-tracking spotlight
- Noise overlay at 2% opacity
- Staggered entrance (0.06s intervals)
- `widget-glass` surface treatment

### Resize Handle

```css
.react-grid-placeholder { background: rgba(16,185,129,0.05); border: 2px dashed rgba(16,185,129,0.2); border-radius: 16px; }
```

### Widget Header Pattern

```tsx
<div className="flex items-center justify-between px-4 pt-4">
  <h3 className="text-[13px] font-medium text-zinc-300">{title}</h3>
  <button className="rounded-md p-1 text-zinc-600 hover:bg-white/5">{action}</button>
</div>
```

---

## 22. Paywall & Monetization UI

### 22.1 Three Paywall Variants

| Variant | Use Case | Key Visual |
|---|---|---|
| **FullPagePaywall** | Module-level gate | Circuit board SVG hero + bento value grid |
| **ModalPaywall** | Feature intercept | Centered modal with plan badge + benefits |
| **BannerPaywall** | Usage cap warning | Compact inline banner |

### 22.2 Feature Gate Pattern

```tsx
<FeatureGate requiredTier="pro" featureTitle="AI Phone Agent">
  {/* Protected content */}
</FeatureGate>
```

Gate overlay: `blur-[6px] opacity-30` on content + centered upgrade prompt.

### 22.3 Upgrade Modal Pricing Tiles

3-column grid with monthly/yearly toggle. Recommended plan has:
- Emerald top accent line
- `bg-emerald-500/[0.03]` background
- "Most popular" badge
- White CTA button (vs outline for others)

---

## 23. Loading & Skeleton System

### 23.1 Shimmer Components

```tsx
<Shimmer className="h-3 w-20" />       // Text line
<ShimmerCircle className="h-6 w-6" />   // Avatar
<ShimmerBlock className="h-20 w-full" /> // Card
<ShimmerTeamRow />                       // Composite row
```

Base: `bg-zinc-800/80` with animated gradient sweep (`animate-[shimmer_2s_infinite]`)
Gradient: `from-transparent via-zinc-700/30 to-transparent`

### 23.2 Widget Skeleton

```tsx
<WidgetSkeleton />  // Staggered blocks inside widget shell
```

### 23.3 CSS Skeleton Shimmer

```css
.skeleton-shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
```

### 23.4 Spinner

Framer Motion SVG arc: `animate={{ rotate: 360 }}` with `duration: 0.8, repeat: Infinity, ease: "linear"`

### 23.5 Hydration Gate (App Boot)

Full-screen splash with pulsing emerald ring + "iW" logo mark. Exits with fade + scale when app is ready.

---

## 24. Empty States & Illustrations

### 24.1 Web Empty States

| Context | Animation | Visual |
|---|---|---|
| Inbox Zero | Lottie `successCheckAnimation` | Emerald checkmark draws in |
| Empty Schedule | Lottie `emptyCalendarAnimation` | Calendar with floating elements |
| Dispatch Map | Lottie `radarScanAnimation` | Radar sweep with concentric rings |
| 404 Page | CSS `orbit` + `signal-pulse` | Orbiting rings + Compass icon |
| Error Pages | CSS `orbit` + `signal-pulse` | Orbiting rings + AlertTriangle |

Pattern: Pulsing rings + zen-breathe icon + descriptive text cascade

### 24.2 Flutter Empty States (12 Types)

Each uses custom `CustomPainter` for hand-crafted animations:
`radar` · `inbox` · `calendar` · `briefcase` · `crate` · `clipboard` · `team` · `shield` · `contactless` · `cortex` · `archive` · `generic`

### 24.3 Zen Empty State Pattern

```css
.animate-zen-breathe { animation: zen-breathe 3s ease-in-out infinite; }
/* scale 1 → 1.15 → 1, opacity 0.6 → 1 → 0.6 */

.animate-zen-ring { animation: zen-ring 2s ease-out infinite; }
/* scale 0.8 → 2, opacity 0.3 → 0 */
```

---

## 25. Animation System

### 25.1 Easing Curves (The Three Pillars)

| Name | Curve | CSS Var | Usage |
|---|---|---|---|
| **Ease Out Expo** | `cubic-bezier(0.16, 1, 0.3, 1)` | `--ease-out-expo` | Page transitions, modals, primary motion |
| **Snappy** | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `--ease-snappy` | Buttons, hover effects, grid layout |
| **Spring** | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | `--ease-spring` | Playful micro-interactions, overshoot |

**Rule:** `ease-out-expo` is the default. Use `snappy` for interactive elements. Use `spring` sparingly for celebration moments.

### 25.2 Framer Motion Standard Configs

```tsx
// Modal entry
{ duration: 0.15, ease: "easeOut" }

// Page/section reveal
{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }

// Stagger children
{ staggerChildren: 0.06–0.1 }

// List item
{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }

// Spring panels (sidebar, drawer)
{ type: "spring", stiffness: 400, damping: 30–36 }

// Spring toggle
{ type: "spring", stiffness: 500, damping: 30 }

// Dropdown popover
{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }

// Toast
{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }

// Cursor spotlight springs
{ stiffness: 300, damping: 30 }
```

### 25.3 Standard Motion Patterns

| Pattern | Initial → Animate | Duration |
|---|---|---|
| **FadeIn (scroll)** | `opacity: 0, y: 20 → 1, 0` | 0.5s |
| **Modal scale-in** | `opacity: 0, scale: 0.95 → 1, 1` | 0.15s |
| **Dropdown** | `opacity: 0, scale: 0.95, y: -4 → 1, 1, 0` | 0.12s |
| **Toast (bottom)** | `opacity: 0, y: 12, scale: 0.98 → 1, 0, 1` | 0.15s |
| **Slide-over** | `x: "100%" → 0` | spring (400/36) |
| **Widget enter** | `opacity: 0, scale: 0.96, y: 12 → 1, 1, 0` | 0.6s |
| **Bulk bar** | `opacity: 0, y: 30 → 1, 0` | 0.2s |
| **Onboarding step** | `x: 40, opacity: 0 → 0, 1` | 0.4s |
| **Confetti particle** | `y: -20 → 300+, opacity: 1 → 0` | 2–3s |
| **Pulse ring** | `scale: 1 → 3, opacity: 0.2 → 0` | 3s, infinite |
| **Hero word reveal** | `opacity: 0, y: 20 → 1, 0` (stagger 0.08s) | 0.6s |

### 25.4 CSS Animation Library (27 Animations)

| Animation | Duration | Usage |
|---|---|---|
| `marquee` | 30s | Logo carousel scroll |
| `shimmer` | 2s | Loading skeletons |
| `zen-breathe` | 3s | Empty state breathing |
| `zen-ring` | 2s | Empty state pulse ring |
| `orbit` / `orbit-reverse` | 8s / 6s | Error/404 page rings |
| `radar-sweep` | 4s | Dispatch radar |
| `signal-pulse` | 2s | Live indicators |
| `laser-pulse` | 2s | Schedule now-line |
| `capsule-glow` | 2.5s | Schedule block glow |
| `overdue-pulse` | 3s | Overdue invoice glow |
| `lowstock-pulse` | 3s | Low inventory glow |
| `backlog-idle` | 3s | Idle item float |
| `urgent-stripe` | 1s | Urgent diagonal stripe |
| `typing-bounce` | 1.4s | Chat typing dots |
| `confetti-burst` | 0.6s | Celebration burst |
| `status-fill` | 0.35s | Status change pop |
| `check-pop` | 0.3s | Checkbox bounce |
| `subtle-bounce` | 0.4s | Micro-bounce |
| `slide-up-fade` | 0.2s | Message entrance |
| `slide-date-left/right` | 0.2s | Calendar navigation |
| `float-up` | 0.5s | Element entrance |
| `checkmark-draw` | 0.6s | SVG path draw |
| `line-draw` | 2s | SVG stroke reveal |
| `pulse-dot` | 2s | Pulsing dot |
| `skeleton-shimmer` | 1.5s | CSS skeleton sweep |

---

## 26. Texture & Effects

### 26.1 Noise Grain

Applied globally and on elevated surfaces for analog warmth.

```tsx
// Global (layout.tsx)
<div className="pointer-events-none fixed inset-0 z-50 opacity-[0.02] mix-blend-overlay"
  style={{ backgroundImage: `url("data:image/svg+xml,...")` }} />

// Widget-level
<div className="pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay bg-noise" />
```

Noise source: `<feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/>`

### 26.2 Radial Glows

```css
/* Hero section */
background: radial-gradient(ellipse at center, var(--glow-soft) 0%, transparent 70%);

/* Widget light cone */
background: radial-gradient(120% 150% at 50% -20%, rgba(16,185,129,0.04) 0%, transparent 50%);

/* Hydration splash */
background: radial-gradient(ellipse at center, rgba(0,230,118,0.06) 0%, transparent 70%);
```

### 26.3 Grid Patterns

```css
.bg-dot-grid {
  background-image: radial-gradient(circle, rgba(255,255,255,0.25) 1px, transparent 1px);
  background-size: 20px 20px;
}

.bg-line-grid {
  background-image:
    linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px),
    linear-gradient(to right, var(--grid-line) 1px, transparent 1px);
  background-size: 48px 48px;
}
```

### 26.4 Backdrop Blur Levels

| Context | Blur | Classes |
|---|---|---|
| Modal backdrop | `sm` (4px) | `backdrop-blur-sm` |
| Upgrade modal | `md` (12px) | `backdrop-blur-md` |
| Topbar | `xl` (24px) | `backdrop-blur-xl` |
| Floating badges | `md` (12px) | `backdrop-blur-md` |
| Mobile sidebar | `sm` (4px) | `backdrop-blur-sm` |
| Celebration toast | `lg` (16px) | `backdrop-blur-lg` |

### 26.5 Diagonal Stripe (Urgent)

```css
.diagonal-stripe {
  background-image: repeating-linear-gradient(
    135deg, transparent, transparent 4px,
    rgba(244,63,94,0.06) 4px, rgba(244,63,94,0.06) 5px
  );
}
```

---

## 27. Icon System

### 27.1 Library

**Lucide React** — `lucide-react` is the sole icon library. ~120+ unique icons used.

### 27.2 Size Scale

| Size | px | Usage |
|---|---|---|
| `8` | 8px | Lock indicators, tiny decorations |
| `10` | 10px | Trust signals, footer icons |
| `11` | 11px | Feature list checks |
| `12` | 12px | Inline actions, badges, status indicators |
| `13` | 13px | Back links, breadcrumbs |
| `14` | 14px | Button icons, modal headers, card actions |
| `16` | 16px | Navigation icons, standard UI |
| `18` | 18px | Modal header icons |
| `20` | 20px | Feature gates, large actions |
| `24` | 24px | Loading spinners, empty states |
| `32` | 32px | Success checkmarks, celebrations |

### 27.3 Top 30 Icons

```
X · ArrowRight · Check · AlertTriangle · Loader2 · Plus · ArrowLeft · Search · Lock · FileText
MapPin · CheckCircle2 · Sparkles · AlertCircle · Users · Send · Camera · Crown · Download · Inbox
Calendar · Pencil · RotateCcw · MessageSquare · ChevronLeft · ChevronRight · Briefcase · Banknote
LayoutDashboard · Settings · Zap · Shield · CreditCard · Trash2 · MoreHorizontal · Bot
```

---

## 28. Logo & Brand Assets

### 28.1 Logo Variants

| File | Use |
|---|---|
| `logos/logo-dark-full.png` | Primary — dark backgrounds (navbar, sidebar) |
| `logos/logo-light-full.png` | Light backgrounds (footer on dark, email) |
| `logos/logo-dark-streamline.png` | Compact dark variant |
| `logos/logo-light-streamline.png` | Compact light variant |
| `logos/logo-mark.png` | App icon / symbol only |
| `logos/logo-black.png` | Print, high-contrast |
| `logo-email.png` | Email header (root public/) |

### 28.2 Programmatic Logo Mark

```tsx
<span className="text-[11px] font-bold text-black">iW</span>
```
Inside a white rounded-lg container — used in onboarding.

### 28.3 Favicon Suite

- `favicon-16x16.png` — Browser tab
- `favicon-32x32.png` — Browser tab (Retina)
- `apple-touch-icon.png` — iOS home screen
- `android-chrome-192x192.png` — Android / PWA
- `android-chrome-512x512.png` — Android splash

### 28.4 OG / Social

Configure in `layout.tsx` metadata. Theme color: `#000000` (dark) / `#f9fafb` (light).

---

## 29. Keyboard Shortcuts

Global shortcuts managed by `KeyboardShortcuts` component.

| Shortcut | Action |
|---|---|
| `⌘ K` | Open command palette |
| `G D` | Go to Dashboard |
| `G I` | Go to Inbox |
| `G J` | Go to Jobs |
| `G S` | Go to Schedule |
| `G C` | Go to Clients |
| `G F` | Go to Finance |
| `G A` | Go to Assets |
| `G T` | Go to Team |
| `G W` | Go to Automations |
| `G P` | Go to Dispatch |
| `G R` | Go to CRM |
| `Escape` | Close active modal/popover |
| `Arrow ↑/↓` | Navigate lists |
| `Enter` | Select/confirm |

KBD display: `rounded border border-white/[0.06] bg-white/[0.03] px-1 py-0.5 font-mono text-[9px] text-zinc-600`

---

## 30. Flutter Mobile Parity

### 30.1 Theme Tokens

```dart
class ObsidianTheme {
  static const Color void_ = Color(0xFF050505);
  static const Color surface1 = Color(0xFF0A0A0A);
  static const Color surface2 = Color(0xFF141414);
  static const Color surfaceGlass = Color(0xD90C0C0C); // 85% opacity
  static const Color emerald = Color(0xFF10B981);
  static const Color emeraldHover = Color(0xFF059669);
  static const Color textPrimary = Color(0xFFEDEDED);
  static const Color textMuted = Color(0xFF71717A);
  static const Color borderBase = Color(0x0DFFFFFF); // 5%
  static const Color borderActive = Color(0x1FFFFFFF); // 12%
}
```

### 30.2 Widget Equivalents

| Web Component | Flutter Widget |
|---|---|
| `GlassCard` | `GlassSheet` (with `BackdropFilter`) |
| `StatusPill` | Custom status chips matching ghost-tint pattern |
| `EmptyState` (web) | `AnimatedEmptyState` (12 types with `flutter_animate`) |
| `ObsidianModal` | Bottom sheets with `showModalBottomSheet` |
| `Shimmer` | `Shimmer` package with matching colors |

---

## 31. Electron Desktop Parity

### 31.1 Desktop-Specific Tokens

```css
:root {
  --vantablack: #050505;
  --surface: #0a0a0a;
  --border: rgba(255,255,255,0.06);
  --green-400: #00E676;  /* Note: brighter neon green for desktop */
  --green-600: #00C853;
  --sidebar-width: 240px;
}
```

### 31.2 Desktop Animations

| Animation | Duration | Usage |
|---|---|---|
| `glow-pulse` | 3s | Boot screen logo glow |
| `logo-appear` | 0.8s | Logo entrance (scale + fade) |
| `text-fade` | 1s | Loading text fade-in |
| `slide-up` | 0.3s | Update banner entrance |

### 31.3 Ghost Mode (Offline)

```css
body.desktop-ghost-mode {
  filter: saturate(0%) brightness(0.85);
  transition: filter 0.6s ease;
}
```

---

## 32. Quick Reference: Copy-Paste Snippets

### Standard Card

```tsx
<div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5
  transition-all duration-200 hover:border-white/[0.1]">
  {/* Content */}
</div>
```

### Standard Button (Primary)

```tsx
<button className="rounded-xl bg-white px-4 py-2 text-[13px] font-medium text-black
  transition-all hover:bg-zinc-200 active:scale-[0.98]">
  Save changes
</button>
```

### Standard Input

```tsx
<input className="w-full rounded-lg border border-white/[0.08] bg-transparent
  px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-600
  focus:border-[rgba(255,255,255,0.15)] transition-all" />
```

### Status Pill

```tsx
<span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide
  bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
  Completed
</span>
```

### Section Label

```tsx
<span className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
  SECTION LABEL
</span>
```

### Toast

```tsx
<div className="rounded-xl border border-emerald-500/15 bg-[#0A0A0A]/95
  px-4 py-2.5 shadow-lg backdrop-blur-md">
  <div className="flex items-center gap-2.5">
    <CheckCircle size={14} className="text-emerald-400" />
    <span className="text-[13px] text-zinc-200">Action completed</span>
  </div>
</div>
```

### Modal Pattern

```tsx
<ObsidianModal open={open} onClose={onClose} maxWidth="lg">
  <ObsidianModalHeader title="Title" onClose={onClose} />
  <div className="space-y-4">
    {/* Form fields */}
  </div>
  <div className="flex justify-end gap-2 pt-6">
    <button className={obsidianButtonGhost}>Cancel</button>
    <button className={obsidianButtonPrimary}>Confirm</button>
  </div>
</ObsidianModal>
```

### Empty State

```tsx
<div className="flex flex-col items-center py-16 text-center">
  <div className="relative mb-6">
    <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
    <div className="animate-zen-breathe flex h-12 w-12 items-center justify-center rounded-xl
      border border-white/5 bg-white/[0.02]">
      <Inbox size={20} className="text-zinc-600" />
    </div>
  </div>
  <h3 className="text-[14px] font-medium text-zinc-300">All clear</h3>
  <p className="mt-1 text-[12px] text-zinc-600">No items to display</p>
</div>
```

### Noise Overlay

```tsx
<div className="pointer-events-none absolute inset-0 opacity-[0.02] mix-blend-overlay"
  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }} />
```

### Radial Glow

```tsx
<div className="pointer-events-none absolute inset-0"
  style={{ background: "radial-gradient(ellipse at center, rgba(16,185,129,0.04) 0%, transparent 60%)" }} />
```

### Grid Pattern

```tsx
<div className="pointer-events-none absolute inset-0 bg-line-grid opacity-[0.02]" />
```

---

> **Last updated:** March 11, 2026
> **Maintained by:** Design System Team + Claude Code
> **Source of truth:** `src/app/globals.css` (tokens), this document (patterns)
