# Design System Rules — iWorkr "Obsidian / Stealth Mode"

## Identity
iWorkr's visual identity is codename **"Stealth Mode"** (internal) / **"Obsidian"** (design tokens). It draws from Linear's premium calm aesthetic with a Signal Green accent for focus and energy.

## Non-negotiables
- **Dark by default.** Background `#050505`, surfaces `#0A0A0A` / `#141414`. Light mode is supported but dark is primary.
- **Whitespace > clutter.** Prefer fewer elements with better spacing. Let the UI breathe.
- **Signal Green `#10B981` only.** No other accent colors in standard UI. Use it for CTAs, focus rings, active states, and highlights only. ≤10% of visible area.
- **Inter typography** with restrained weights and tight tracking for display text.
- **JetBrains Mono** for data, IDs, money values, and code snippets.
- **Subtle textures**: fractal noise grain (0.02 opacity), dot grids, line grids, inset bevel shadows.
- **Bento grid layouts** for dashboard widgets and landing page feature sections.
- **"Premium calm"**: no neon overload, no heavy drop shadows, no cartoon illustrations.

## Color tokens (from `globals.css`)
### Dark theme (default)
| Token | Value | Usage |
|---|---|---|
| `--background` | `#050505` | Page background |
| `--surface-0` | `#050505` | Base surface |
| `--surface-1` | `#0A0A0A` | Card background |
| `--surface-2` | `#141414` | Hover / elevated surface |
| `--border-base` | `rgba(255,255,255,0.05)` | Subtle borders |
| `--border-active` | `rgba(255,255,255,0.12)` | Active/hover borders |
| `--text-primary` | `#ededed` | Primary text |
| `--text-muted` | `#71717a` | Secondary text |
| `--brand` | `#10B981` | Signal Green accent |
| `--brand-hover` | `#059669` | Green hover state |

### Light theme
| Token | Value | Usage |
|---|---|---|
| `--background` | `#f9fafb` | Page background |
| `--surface-0` | `#ffffff` | Base surface |
| `--surface-1` | `#f4f4f5` | Card background |
| `--surface-2` | `#e4e4e7` | Hover / elevated |
| `--text-primary` | `#18181b` | Primary text |
| `--brand` | `#059669` | Green accent (darker for contrast) |

## Typography
- **Font stack**: `Inter` (sans) + `JetBrains Mono` (mono)
- **Display**: `.font-display` class — Inter with `letter-spacing: -0.05em`
- **Body**: Default Inter, normal tracking
- **Mono**: JetBrains Mono for invoice numbers, IDs, money, timestamps
- **Hierarchy**: Strong — use size and weight, not color variety, to create hierarchy
- **Weights**: Avoid heavy bold everywhere. Prefer medium (500) for emphasis, semibold (600) for headings.

## Spacing & layout rhythm
- Use consistent spacing scale: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px`
- **Radius scale**: `xs: 4px`, `sm: 6px`, `md: 8px`, `lg: 12px`, `xl: 16px`
- **Bento grids**: Strong gutters (16–24px), clear alignment, visual "breathing room"
- **Dashboard**: React Grid Layout with draggable/resizable widgets
- **Max content width**: Respect existing layout containers — don't create new max-width patterns.

## Component style
- **Cards**: `widget-glass` class — gradient background, subtle border (`rgba(255,255,255,0.05)`), inset bevel shadow. Generous radius (12px).
- **Buttons**: Primary = high contrast Signal Green on dark. Secondary = subtle border, muted text. Use `.btn-micro` for snappy scale interaction.
- **Inputs**: Clean with strong focus ring (2px offset, Signal Green at 40% opacity).
- **Badges/chips**: Minimal, not chunky. Muted backgrounds with subtle borders.
- **Modals**: Dark overlay (`rgba(0,0,0,0.95)`), centered with Framer Motion `AnimatePresence`.
- **Sidebar**: Collapsible shell with icon-only mode. Command palette (`⌘K`) for navigation.

## Animation rules
- **Default duration**: 150–240ms for transitions, up to 500ms for entrance animations
- **Easing**: `--ease-snappy` (`cubic-bezier(0.2, 0.8, 0.2, 1)`) for UI. `--ease-spring` for playful micro-interactions. `--ease-out-expo` for page transitions.
- **Framer Motion**: Use for page transitions, modal enter/exit, staggered list animations, layout animations with `layoutId`.
- **CSS keyframes**: Use for persistent micro-interactions (pulse, glow, orbit, breathe).
- **Lottie**: Use for dashboard widget icons, empty states, success animations. Keep files small.
- **Rule**: Don't animate everything. Animate **hierarchy and attention** — entrance of primary content, hover states, status transitions.

## Copy rules
- Short headlines, punchy subheads
- Benefit-first bullets
- Avoid hype spam; use confident clarity
- Speak to outcomes: "ship", "dispatch", "track", "automate"
- Voice: professional, calm, direct — not playful/casual, not corporate/stiff

## Landing page specifics
- Sections use CSS variables: `--card-bg`, `--card-border`, `--hero-grad-from`, `--hero-grad-to`, `--section-fade`
- Background textures: `.bg-dot-grid`, `.bg-line-grid`, `.bg-noise`
- Social proof strip + bento feature grid + workflow steps + testimonials + pricing + FAQ + final CTA
- "Try it" / "Start free" CTA pattern (Loveable-style instant engagement)

## Iconography
- Use `lucide-react` for web (consistent stroke width, minimal line icons)
- Use `phosphor_flutter` for mobile (same style)
- Don't mix icon libraries within the same platform
