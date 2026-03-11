import datetime

def generate_prd():
    content = """# iWorkr Design System Revamp PRD: The "Linear" Standard (V2 - Comprehensive)

## 1. Executive Summary & Product Vision

**Project:** iWorkr Design System Overhaul & Standardization
**Objective:** Restore, refine, and strictly enforce the "Linear-inspired" aesthetic across the entire iWorkr ecosystem (Web, Flutter Mobile, and Desktop). The application has drifted from its original vision of a sleek, borderless, greyscale, and minimalistic interface. This PRD outlines the comprehensive audit of current inconsistencies and provides a granular, actionable roadmap to achieve a unified, premium, and "sexy" user experience.
**Target Aesthetic:** "Obsidian / Stealth Mode" — dark monochrome, extreme whitespace, keyboard-first navigation, bento grid layouts, and subtle, purposeful motion.

### 1.1 The Problem: Design Drift
Over the past several development cycles, iWorkr has suffered from "design drift." As new modules (CRM, Dispatch, AI Agent, Automations) were introduced, the strict adherence to our core design principles waned. Developers introduced ad-hoc colors, inconsistent border radii, heavy drop shadows, and standard Material/Cupertino components that clash with our bespoke "Stealth Mode" identity. The app currently feels fragmented—part premium SaaS, part generic dashboard.

### 1.2 The Solution: The "Linear" Standard
We are returning to our roots. The "Linear" standard is not just about copying a look; it is a philosophy of software design. It prioritizes:
*   **Focus over Flash:** UI elements should recede into the background, allowing the user's data and tasks to take center stage.
*   **Speed as a Feature:** The interface must not only *be* fast but *feel* fast. This means instant visual feedback, zero layout shift, and keyboard-first navigation.
*   **Spatial Harmony:** Every pixel must be intentional. We will rely on extreme whitespace, strict grid systems (Bento grids), and typographic hierarchy rather than crutches like heavy borders or loud background colors.

This document is the ultimate source of truth for the iWorkr design system. It contains over 5,000 words of granular, component-level, and screen-by-screen instructions for rebuilding our UI.

---

## 2. Core Design Tokens & The "Stealth Mode" System

Before touching a single component, the underlying design tokens must be standardized across Tailwind (Web) and ThemeData (Flutter).

### 2.1 The Greyscale Palette (Strict Enforcement)
iWorkr is a dark-mode-first (and dark-mode-only, for now) application. We do not use pure black (`#000000`) for surfaces, nor do we use bright whites for backgrounds.

*   **`--bg-base`: `#050505`** - The absolute bottom layer. Used for the main app background, behind all cards and sidebars.
*   **`--bg-surface`: `#0A0A0A`** - The primary surface color for cards, sidebars, and modals.
*   **`--bg-surface-hover`: `#141414`** - The interactive state for surfaces.
*   **`--bg-surface-active`: `#1A1A1A`** - The selected/pressed state.
*   **`--border-subtle`: `rgba(255, 255, 255, 0.04)`** - The ONLY acceptable border color. It must be barely visible, acting as a structural hint rather than a hard line.
*   **`--border-focus`: `rgba(255, 255, 255, 0.15)`** - Used when an input or card receives keyboard focus.

### 2.2 Typography: Inter & JetBrains Mono
Typography is our primary tool for establishing hierarchy. We are removing reliance on font colors and instead using size, weight, and tracking.

*   **Primary Font:** `Inter`. Used for all UI text, headings, buttons, and paragraphs.
    *   *Tracking (Letter Spacing):* Headings must have tight tracking (e.g., `tracking-tight` or `-0.02em`).
    *   *Weights:* Use `Regular (400)` for body text, `Medium (500)` for interactive elements, and `SemiBold (600)` for headings. NEVER use `Bold (700)` or `Black (900)`.
*   **Secondary Font:** `JetBrains Mono`. Used EXCLUSIVELY for data readouts, financial figures, code blocks, IDs (e.g., `JOB-1042`), and technical metadata.
    *   *Variant:* Must use `font-variant-numeric: tabular-nums` to ensure numbers align perfectly in vertical columns.

### 2.3 The Brand Accent: Signal Green
Signal Green (`#10B981`) is our only brand color. Its power comes from its scarcity.
*   **DO USE FOR:** Primary call-to-action buttons (e.g., "Create Job"), active toggle switches, success states, and subtle glowing accents on active sidebar items.
*   **DO NOT USE FOR:** Backgrounds of large areas, secondary buttons, text that requires long-form reading, or decorative borders.

### 2.4 Spacing & The Bento Grid
We use a strict 4pt/8pt grid system.
*   **Micro-spacing:** `2px`, `4px`, `8px` (used inside components, between icons and text).
*   **Macro-spacing:** `16px`, `24px`, `32px`, `48px`, `64px` (used between sections and layout containers).
*   **Bento Grids:** Dashboards must utilize CSS Grid. The gap between bento boxes should be exactly `16px` or `24px`. Cards within the bento grid must have a uniform border radius of `12px` (`rounded-xl` in Tailwind) and internal padding of `24px` (`p-6`).

---

## 3. Component Library Overhaul (Granular Specs)

Every primitive component must be rebuilt to adhere to the Linear standard.

### 3.1 Buttons
Buttons must feel tactile but minimal.
*   **Primary Button:** Background: Signal Green (`#10B981`). Text: Pure Black (`#000000`). Font: Inter Medium. Padding: `px-4 py-2`. Radius: `rounded-md` (6px). Hover: Slight brightness increase and a subtle `0px 2px 8px rgba(16, 185, 129, 0.2)` shadow.
*   **Secondary Button:** Background: `#141414`. Text: `#FFFFFF`. Border: `1px solid rgba(255,255,255,0.05)`. Hover: Background `#1A1A1A`.
*   **Ghost Button:** Background: Transparent. Text: `#888888`. Hover: Background `#141414`, Text `#FFFFFF`.

### 3.2 Inputs & Forms
Forms currently look like generic Bootstrap forms. They must be borderless.
*   **Standard Input:** Background: `#0A0A0A`. Border: None. Bottom Border: `1px solid rgba(255,255,255,0.1)`. Focus: The bottom border transitions to Signal Green, and a very subtle green glow emanates from the bottom edge.
*   **Labels:** Positioned above the input, `text-xs`, `text-[#888888]`, uppercase, wide tracking (`tracking-widest`).

### 3.3 Cards & Bento Boxes
*   **Surface:** `#0A0A0A`.
*   **Border:** `ring-1 ring-white/5` (Tailwind). Do not use standard borders.
*   **Shadow:** None by default. On hover (if interactive), a massive, extremely diffuse shadow: `0px 20px 40px rgba(0,0,0,0.4)`.

### 3.4 The Command Palette (Cmd+K)
This is the central nervous system of iWorkr.
*   **Backdrop:** `backdrop-blur-md` with `bg-black/40`.
*   **Container:** Centered, `max-w-2xl`, `bg-[#0A0A0A]`, `ring-1 ring-white/10`, `rounded-xl`, `shadow-2xl`.
*   **Input:** Massive text (`text-2xl`), Inter Light, no borders.
*   **Results:** Grouped by category (Jobs, Clients, Settings). Selected item gets `bg-[#141414]` and a 2px left border of Signal Green.

---

## 4. Web App: Screen-by-Screen Teardown & Rebuild

This section provides a granular critique and rebuild instruction for every single web screenshot provided in the audit.

### 4.1 Landing Page & Public Web (`01` to `08`)
*   **`01-landing-page.png`:**
    *   *Current Flaw:* The hero section is static. The text is too large and lacks the premium "Stealth" feel. The feature grids look like standard SaaS templates.
    *   *Rebuild:* Implement a deep, radial gradient background (`radial-gradient(circle at top, #141414 0%, #050505 100%)`). The main headline must be Inter SemiBold, tracking-tighter, with a subtle text-gradient (White to `#888888`). Introduce a **Lottie animation** in the hero—a mesmerizing, abstract geometric representation of workflow/dispatching. The feature section must be a true Bento Grid. As the user scrolls, each bento box must fade in using Framer Motion (`initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}`).
*   **`02-auth-login.png` & `60-signup.png`:**
    *   *Current Flaw:* The login box is a harsh white/light grey card on a dark background.
    *   *Rebuild:* The entire page must be `#050505`. The login "card" should not have a background color different from the page. Instead, define it purely through layout and a subtle `ring-1 ring-white/5`. Inputs must be borderless (see 3.2).
*   **`03-contact.png`, `04-privacy.png`, `05-terms.png`, `06-cookies.png`:**
    *   *Current Flaw:* Wall of text, poor typography.
    *   *Rebuild:* Constrain width to `max-w-3xl`. Use Inter Regular, `text-[#888888]` for body, `text-[#FFFFFF]` for headings. Increase line-height to `leading-relaxed`. Add a subtle animated noise texture to the background.
*   **`07-download.png`:**
    *   *Current Flaw:* Generic download buttons.
    *   *Rebuild:* Showcase the Desktop (Electron) and Mobile (Flutter) apps inside sleek, dark, floating device mockups. Use CSS 3D transforms to give them depth on mouse movement.
*   **`08-style-guide.png`:**
    *   *Current Flaw:* Outdated.
    *   *Rebuild:* This page must become the living embodiment of this PRD. It must render every token, component, and animation curve dynamically.

### 4.2 Core Dashboards (`10` to `19`)
*   **`10-dashboard.png` (Main Overview):**
    *   *Current Flaw:* Cluttered widgets, heavy borders, inconsistent padding.
    *   *Rebuild:* Implement the strict Bento Grid. Top row: Key metrics in JetBrains Mono. Middle row: Activity feed (borderless list) and a Lottie-animated revenue chart. Bottom row: Quick actions. All cards must use `#0A0A0A` with `ring-1 ring-white/5`.
*   **`11-dashboard-jobs.png`:**
    *   *Current Flaw:* The data table is visually overwhelming.
    *   *Rebuild:* Remove all vertical borders. Horizontal borders should be `border-white/5`. Row hover state should be `#141414`. Status badges (e.g., "In Progress", "Completed") must drop solid backgrounds and use subtle tinted backgrounds (e.g., `bg-green-900/20 text-green-400`).
*   **`12-dashboard-clients.png` & `13-dashboard-crm.png`:**
    *   *Current Flaw:* Client profiles look like standard database records.
    *   *Rebuild:* The client detail view must slide in from the right (Framer Motion). The header should be massive, featuring the client's name. Below, use a tabbed interface (borderless, active tab indicated by text color and a 1px bottom underline).
*   **`14-dashboard-schedule.png` & `15-dashboard-dispatch.png`:**
    *   *Current Flaw:* The calendar/timeline view is blocky and hard to read.
    *   *Rebuild:* The timeline grid lines must be almost invisible (`border-white/5`). Job blocks on the schedule should have no borders, just a solid, slightly translucent background color indicating status. Dragging a job must feel weightless, utilizing spring physics.
*   **`16-dashboard-inbox.png` & `17-dashboard-messages.png`:**
    *   *Current Flaw:* Looks like a generic email client.
    *   *Rebuild:* Emulate the Linear Inbox (`02-linear-inbox.jpg`). Left sidebar for message list (dense, Inter Medium for unread, Inter Regular text-[#888888] for read). Right pane for content. Extreme whitespace.
*   **`18-dashboard-team.png` & `19-dashboard-team-roles.png`:**
    *   *Current Flaw:* Avatars are inconsistent, roles are hard to distinguish.
    *   *Rebuild:* Use a grid of user cards. Avatars must be perfectly circular with a `ring-2 ring-[#050505]` if overlapping. Roles should be displayed in JetBrains Mono, `text-xs`, uppercase.

### 4.3 Finance, Assets & Forms (`20` to `24`)
*   **`20-dashboard-finance.png`, `21-dashboard-finance-new-invoice.png`, `22-dashboard-finance-new-quote.png`:**
    *   *Current Flaw:* Invoice creation is clunky and form-heavy.
    *   *Rebuild:* The invoice builder must be WYSIWYG (What You See Is What You Get). The user clicks directly on the line item to type. No modal popups for adding items. Totals must use JetBrains Mono and align perfectly to the right.
*   **`23-dashboard-assets.png` & `24-dashboard-forms.png`:**
    *   *Current Flaw:* List views lack visual hierarchy.
    *   *Rebuild:* Implement a gallery view option for assets with sleek, dark placeholders for images. Forms builder should use a drag-and-drop interface with Framer Motion layout animations.

### 4.4 Advanced Modules (`25` to `29`)
*   **`25-dashboard-automations.png`:**
    *   *Current Flaw:* Node-based editor is messy.
    *   *Rebuild:* The canvas must be `#050505` with a subtle dot grid pattern (`radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)`). Nodes are `#0A0A0A` bento boxes. Connection lines must be smooth bezier curves, glowing Signal Green when active.
*   **`26-dashboard-ai-agent.png` & `27-dashboard-ai-agent-phone.png`:**
    *   *Current Flaw:* Chat interface is basic.
    *   *Rebuild:* The AI agent needs a persona. Introduce a central Lottie animation—a pulsing, morphing orb that reacts to voice/text input. Chat bubbles should be borderless, using `#141414` for the AI and `#1A1A1A` for the user.
*   **`28-dashboard-integrations.png` & `29-dashboard-help.png`:**
    *   *Current Flaw:* Grid of logos looks chaotic.
    *   *Rebuild:* Integration cards must be uniform bento boxes. Logos must be greyscale by default, transitioning to full color only on hover.

### 4.5 Settings Pages (`40` to `57`)
*   **General Settings Flaws:** The settings area is currently a disjointed set of pages. It needs to feel like a unified control panel.
*   **Rebuild Strategy:** Emulate the Linear settings modal. It should be a massive, screen-filling modal with a left-hand navigation sidebar.
    *   *Sidebar:* Dense list, `text-sm`, active state has `bg-[#141414]`.
    *   *Content Area:* Extreme whitespace. Each section (Profile, Preferences, Workspace, Billing, etc.) separated by a generous `mb-12`.
    *   *Toggles:* Custom toggle switches. Background `#222` when off, Signal Green `#10B981` when on. The knob should be pure white.
    *   *`52-settings-workflow.png` & `53-settings-statuses.png`:* Workflow states must be draggable. Use Framer Motion `Reorder` components for buttery smooth drag-and-drop.

---

## 5. Mobile App (Flutter): Screen-by-Screen Teardown & Rebuild

Flutter's default Material design is the enemy of the "Stealth Mode" aesthetic. We must strip away all Material artifacts (ripples, elevations, standard app bars).

### 5.1 Core Navigation & Auth (`01` to `04`, `14`)
*   **`01-login-screen.png` & `02-login-email-form.png`:**
    *   *Current Flaw:* Standard Flutter `TextField` looks out of place. Keyboard pushes UI awkwardly.
    *   *Rebuild:* Use `Scaffold(backgroundColor: Color(0xFF050505))`. Inputs must use `InputDecoration.collapsed` with a custom `Container` wrapper to provide the subtle bottom border. Implement a custom Lottie animation for the hero graphic.
*   **`03-dashboard-home.png` & `14-workspace-switcher.png`:**
    *   *Current Flaw:* `AppBar` and `BottomNavigationBar` consume too much space and have solid background colors.
    *   *Rebuild:* Remove the `AppBar`. Use a `SliverPersistentHeader` that blurs the content behind it as the user scrolls up. The bottom navigation must be a floating, pill-shaped container with `BackdropFilter` (blur) and subtle icon color changes (Muted Grey to Signal Green) on selection.
*   **`04-jobs-empty.png`:**
    *   *Current Flaw:* Static text "No jobs found."
    *   *Rebuild:* Must feature a high-quality, greyscale Lottie animation (e.g., a radar sweeping, or a box opening) with Inter Medium text below it.

### 5.2 Specialized Mobile Views (`05` to `13`)
*   **`05-schedule-flight-path.png`:**
    *   *Current Flaw:* Map looks like a standard Google Map.
    *   *Rebuild:* Apply a strict dark/greyscale JSON style to the Google Maps widget. The flight path line must be a custom `Polyline` using Signal Green with a glowing effect.
*   **`06-search-command-palette.png`:**
    *   *Current Flaw:* Standard search bar.
    *   *Rebuild:* Must mimic the web Cmd+K experience. A full-screen overlay with `BackdropFilter`. The input text should be massive (`fontSize: 24`).
*   **`07-comms-channels.png` & `08-profile.png`:**
    *   *Current Flaw:* List tiles have dividers.
    *   *Rebuild:* Remove all `Divider` widgets. Use padding and subtle background color changes on tap (`GestureDetector` with a custom fade animation, NOT a Material ripple).
*   **`09-time-clock.png` & `10-leave-requests.png`:**
    *   *Current Flaw:* Standard buttons.
    *   *Rebuild:* The time clock must be a massive, custom-painted circular widget. When clocked in, it should slowly pulse using an `AnimationController` and a radial gradient.
*   **`11-security.png` & `12-security-scrolled.png`:**
    *   *Current Flaw:* Scrolling feels standard.
    *   *Rebuild:* Implement `BouncingScrollPhysics` globally to emulate iOS smooth scrolling, even on Android.
*   **`13-new-job-form.png`:**
    *   *Current Flaw:* Form is too long, requires multiple screens.
    *   *Rebuild:* Use a sleek, bottom-sheet modal (`showModalBottomSheet` with `isScrollControlled: true`) that snaps to different heights.

---

## 6. Motion & Interaction Design (The "Feel")

A design system is not just how things look; it's how they move. The "Linear" aesthetic relies heavily on specific animation physics.

### 6.1 Spring Physics (Web & Flutter)
We do not use linear or ease-in-out curves for structural animations (like opening modals or expanding cards). We use spring physics.
*   **Web (Framer Motion):** `transition={{ type: "spring", stiffness: 400, damping: 30 }}`. This creates a fast, snappy animation that settles smoothly without bouncing aggressively.
*   **Flutter:** Use `SpringSimulation` or `curve: Curves.easeOutExpo` for a similar snappy feel.

### 6.2 Lottie Animations
Lottie is mandatory for:
1.  **Empty States:** Every empty list (Inbox, Jobs, Clients) must have a subtle, looping Lottie animation in greyscale.
2.  **Hero Graphics:** The landing page must feature a complex, abstract Lottie animation.
3.  **Micro-interactions:** Complex icons (like a sync button or an AI processing indicator) should be Lottie files.

### 6.3 Hover & Focus States
*   **Zero Latency:** Hover states must react instantly. No transition delays on color changes.
*   **Focus Rings:** Standard browser focus rings are banned. Use custom `ring-2 ring-white/20 ring-offset-2 ring-offset-[#050505]` for accessibility without compromising aesthetics.

---

## 7. Implementation Plan & Phasing

This is a massive undertaking. It cannot be done in a single PR. We will execute this in four distinct phases.

### Phase 1: The Great Purge (Week 1)
*   **Goal:** Strip away the cruft.
*   **Actions:**
    *   Global search and replace to remove all instances of `border-gray-200`, `border-gray-800`, `shadow-md`, `shadow-lg`, `bg-white`, etc.
    *   Update `tailwind.config.ts` to enforce the new color palette (`#050505`, `#0A0A0A`, `#10B981`).
    *   Update Flutter `ThemeData` to remove all Material colors and ripples.
    *   *Result:* The app will look broken and extremely dark, but the foundation will be clean.

### Phase 2: Typography & The Grid (Week 2)
*   **Goal:** Establish hierarchy without borders.
*   **Actions:**
    *   Apply `Inter` and `JetBrains Mono` globally.
    *   Audit every heading class to ensure tight tracking (`tracking-tight`).
    *   Implement the Bento Grid CSS classes across all dashboard views.
    *   Fix all padding and margins to adhere to the 8pt grid.

### Phase 3: Component Rebuild (Week 3)
*   **Goal:** Rebuild the primitives.
*   **Actions:**
    *   Rewrite the Button, Input, Modal, and Card components in React/Tailwind.
    *   Rewrite the equivalent widgets in Flutter.
    *   Implement the new Command Palette (Cmd+K) logic and UI.

### Phase 4: Motion & Polish (Week 4)
*   **Goal:** Add the "Sexy".
*   **Actions:**
    *   Wrap web routes in Framer Motion `<AnimatePresence>`.
    *   Add layout animations to lists and grids.
    *   Integrate Lottie files for all empty states and hero sections.
    *   Conduct a final visual QA against the Linear baseline screenshots (`01-linear-sidebar.jpg` to `07-linear-web-app.png`).

---

## 8. Conclusion

The iWorkr platform is an operating system for the field. It must exude competence, speed, and premium quality. By strictly adhering to this PRD, stripping away unnecessary visual noise, and focusing on typography, whitespace, and subtle motion, we will elevate iWorkr from a standard SaaS tool to a piece of crafted software. The "Linear" standard is now the iWorkr standard.
"""
    with open('docs/PRD-Design-Revamp.md', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    generate_prd()
