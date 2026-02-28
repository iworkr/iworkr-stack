# STYLE_GUIDE — iWorkr "Obsidian / Stealth Mode" (Living Document)
> This is the canonical source of iWorkr's visual identity. Claude must constantly refer to it.
> Token source of truth: `src/app/globals.css`

## 1) Brand personality
- **Premium, calm, confident** — the UI should feel like a high-end productivity tool
- **Minimal, whitespace-heavy** — every element earns its place
- **"Engineer tasteful"** (Linear energy) + **"instant magic"** (Loveable energy)
- **Dark by default** — Obsidian dark theme is the primary experience
- **Keyboard-first** — power users navigate without touching the mouse (⌘K command palette)

## 2) Color system

### Dark theme (default)
| Token | Value | Usage |
|---|---|---|
| `--background` | `#050505` | Page background |
| `--surface-0` | `#050505` | Base surface |
| `--surface-1` | `#0A0A0A` | Card/panel background |
| `--surface-2` | `#141414` | Hover / elevated surface |
| `--border-base` | `rgba(255,255,255,0.05)` | Subtle borders |
| `--border-active` | `rgba(255,255,255,0.12)` | Active/focus borders |
| `--text-primary` | `#ededed` | Primary text |
| `--text-muted` | `#71717a` | Secondary/muted text |
| `--text-heading` | `#ededed` | Section headings |
| `--text-body` | `#a1a1aa` | Body copy |
| `--text-dim` | `#52525b` | Tertiary / disabled text |

### Brand accent — Signal Green
| Token | Value | Usage |
|---|---|---|
| `--brand` | `#10B981` | Primary accent (CTA, active, highlight) |
| `--brand-hover` | `#059669` | Hover state |
| `--brand-glow` | `0 0 20px rgba(16,185,129,0.3)` | Glow shadow |
| `--brand-glow-subtle` | `0 0 12px -5px rgba(16,185,129,0.2)` | Subtle glow |
| `--selection-bg` | `rgba(16,185,129,0.15)` | Text selection |

### Light theme
| Token | Value | Usage |
|---|---|---|
| `--background` | `#f9fafb` | Page background |
| `--surface-0` | `#ffffff` | Base surface |
| `--surface-1` | `#f4f4f5` | Card background |
| `--surface-2` | `#e4e4e7` | Hover surface |
| `--text-primary` | `#18181b` | Primary text |
| `--brand` | `#059669` | Darker green for contrast |

### Rules
- No rainbow UI. Dark monochrome with Signal Green accent only.
- Green accent ≤ **10% of visible UI area** per screen.
- Use semantic status colors sparingly: red for errors/overdue, amber for warnings, green for success.
- Never use pure white (`#ffffff`) for text in dark mode — use `#ededed`.

## 3) Typography
- **Sans**: Inter (variable weight, locally hosted)
- **Mono**: JetBrains Mono (variable weight, locally hosted)
- **Display**: `.font-display` — Inter with `letter-spacing: -0.05em`

### Hierarchy rules
| Level | Font | Weight | Tracking | Example |
|---|---|---|---|---|
| Page title | Inter | 600 (semibold) | -0.05em | "Jobs", "Schedule" |
| Section heading | Inter | 600 | -0.025em | Widget titles, form sections |
| Body | Inter | 400 (regular) | normal | Descriptions, paragraphs |
| Emphasis | Inter | 500 (medium) | normal | Labels, important values |
| Data/IDs | JetBrains Mono | 400 | normal | `#INV-2024-001`, `$4,500.00` |
| Caption | Inter | 400 | normal | Timestamps, helper text |

### Rules
- Strong hierarchy without shouting — use size and weight, not color variety.
- Avoid heavy bold everywhere. Medium (500) for emphasis, semibold (600) for headings.
- Large, comfortable line heights (1.5–1.7 for body text).

## 4) Spacing & layout rhythm
- **Scale**: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px`
- **Consistent padding**: Cards use 16–24px internal padding. Sections use 48–96px vertical spacing.
- **Grid system**: Bento grids with 16–24px gutters and strong alignment.

### Radius scale
| Token | Value | Usage |
|---|---|---|
| `--radius-xs` | `4px` | Badges, chips, small elements |
| `--radius-sm` | `6px` | Inputs, small buttons |
| `--radius-md` | `8px` | Cards, panels |
| `--radius-lg` | `12px` | Dashboard widgets, modals |
| `--radius-xl` | `16px` | Large containers, hero elements |

### Dashboard layout
- **React Grid Layout** for draggable/resizable widget arrangement
- Widgets use `widget-glass` class (gradient background + subtle border + inset bevel)
- "Live" indicator with animated ping on dashboard header

## 5) Components

### Buttons
- **Primary**: Signal Green background, white text, high contrast. Use `.btn-micro` for snappy hover/active scale.
- **Secondary**: Subtle border (`--border-active`), muted text. Transparent background.
- **Ghost**: No border, muted text. Hover reveals subtle background.
- **Destructive**: Red accent, used sparingly for delete/dangerous actions.

### Cards
- `widget-glass` class: gradient background (`rgba(255,255,255,0.03)` → `0.01`), subtle border, inset bevel shadow.
- Generous padding (16–24px).
- Radius: `--radius-lg` (12px).
- Hover: border brightens to `--card-border-hover`.

### Inputs
- Clean with transparent background on dark theme.
- Strong focus ring: 2px offset, Signal Green at 40% opacity (`.focus-ring`).
- Placeholder text uses `--text-dim`.

### Badges / chips
- Minimal, not chunky. Small radius (`--radius-xs`).
- Muted backgrounds with subtle borders.
- Status colors: muted tones, not vivid.

### Modals
- Dark overlay: `rgba(0,0,0,0.95)`.
- Centered with Framer Motion `AnimatePresence` (scale + fade enter/exit).
- Escape to close, focus trap.

### Sidebar / shell
- Collapsible: expanded (icon + label) and collapsed (icon only).
- Command palette (`⌘K`) for quick navigation.
- Active item: Signal Green indicator or subtle background highlight.

## 6) Motion

### Timing
| Duration | Usage |
|---|---|
| 150ms | Micro-interactions (hover, active states) |
| 200ms | Transitions (color, border, shadow changes) |
| 240ms | Small movements (slide, fade) |
| 300–500ms | Page entrance, modal open/close |

### Easing functions
| Token | Curve | Usage |
|---|---|---|
| `--ease-snappy` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Standard UI transitions |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Playful micro-interactions (slight overshoot) |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions, content entrance |

### Effects
- **Page entrance**: Fade in + slight y-translate (8–16px) with stagger for lists.
- **Modal**: Scale from 0.95 → 1 + fade in.
- **Hover**: Subtle scale (1.01–1.02) or border/shadow change.
- **Active/click**: Scale down slightly (0.97–0.98).
- **Status transitions**: `animate-status-fill` (scale pop), `animate-confetti-burst` for completion.

### Lottie animations
- Dashboard widget icons (schedule, inbox, map, insights)
- Empty states (no jobs, no clients, no messages)
- Success feedback (checkmark draw)
- Typing indicator (messenger)
- Keep files small. Load lazily.

### Rule
**Don't animate everything. Animate hierarchy and attention.** Entrance of primary content, hover feedback, status transitions, and celebratory moments.

## 7) Background textures
- **Noise grain**: SVG fractal noise at 0.02 opacity, applied as fixed overlay on `<body>`.
- **Dot grid**: `.bg-dot-grid` — radial gradient dots at 20px spacing.
- **Line grid**: `.bg-line-grid` — linear grid at 48px spacing.
- Use sparingly — usually on landing page sections, not on dense data screens.

## 8) Iconography
- **Web**: `lucide-react` — consistent stroke width, minimal line icons.
- **Mobile**: `phosphor_flutter` — matching style.
- Don't mix icon libraries on the same platform.
- Icon size: 16px for inline, 20px for standard, 24px for prominent.

## 9) Copy voice
- Clear, confident, not hypey.
- Benefits first, features second.
- Speak to outcomes: "dispatch", "track", "automate", "invoice", "schedule".
- Short headlines, punchy subheads.
- Professional but not corporate. Direct but not cold.

### Examples
- Good: "Track every job from assignment to completion."
- Good: "Get paid faster with instant invoice links."
- Bad: "Our revolutionary AI-powered synergistic platform..."
- Bad: "lol just click the button and watch the magic happen!"

## 10) Landing page sections
The marketing landing page follows this structure:
1. **Top nav**: Logo + links + auth CTA. Sticky with blur.
2. **Hero**: Gradient text headline + subheadline + dual CTAs + product visual.
3. **Social proof**: "Trusted by X+ businesses" strip.
4. **Feature bento grid**: 2–3 row grid with benefit tiles + micro-widgets.
5. **Workflow steps**: "How it works" in 3–4 steps with timeline visual.
6. **Testimonials**: Verified carousel with avatar + name + role + quote.
7. **Download section**: Desktop + mobile app CTAs.
8. **Pricing**: 4-tier table (Free / Starter / Standard / Enterprise).
9. **FAQ**: Accordion-style.
10. **Final CTA**: Bottom call-to-action section.
11. **Footer**: Links, legal, social.

## 11) Status color palette (semantic)
| Status | Color | Usage |
|---|---|---|
| Active / success | `#10B981` (brand green) | Completed jobs, active clients, paid invoices |
| Warning / attention | `#F59E0B` (amber) | Overdue reminders, low stock alerts |
| Error / danger | `#F43F5E` (rose) | Failed operations, overdue invoices, urgent priority |
| Info / neutral | `#71717A` (zinc) | Informational states, disabled |
| In progress | `#3B82F6` (blue) | Active schedules, en route, processing |

Use these sparingly and muted — never as large background fills.
