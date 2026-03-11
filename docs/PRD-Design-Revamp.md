# iWorkr Design Upgrade PRD

**Project:** iWorkr Design System Rework  
**Status:** Living document  
**Last updated:** March 11, 2026  
**Primary benchmark:** Linear-quality interface discipline, translated into the iWorkr product language  
**Canonical references:** `docs/STYLE_GUIDE.md`, `src/app/globals.css`, `src/CONTEXT.md`

---

## 1. Executive Summary

iWorkr was originally conceived as a field-service operating system with the clarity, calm, and speed of Linear. The product is still directionally aligned with that ambition: the platform is dark-first, keyboard-first, sharp-edged, and restrained in its use of color. However, the current product has drifted in execution. New modules, empty states, paywalls, secondary pages, and mobile surfaces do not consistently express the same level of intention. The result is not a catastrophic design failure, but an uneven one: some screens feel premium and composed, others feel merely dark.

This PRD defines the rework required to restore a coherent iWorkr design language across Web, Flutter, and Desktop. It is not a replacement for the existing style guide. It is the operational design-audit document that translates the visual lessons from the current screenshot set into enforceable product requirements.

The redesign goal is not to imitate Linear literally. The goal is to match Linear’s standard of restraint, consistency, layering discipline, density control, and interaction confidence while remaining unmistakably iWorkr: a field-service platform for dispatch, jobs, CRM, finance, assets, forms, automations, integrations, AI, and mobile operations.

This document is based on a full review of:

- all screenshots in `screenshots/web/`
- all screenshots in `screenshots/flutter/`
- all screenshots in `screenshots/linear/`
- the live design rules in `docs/STYLE_GUIDE.md`
- the active token system in `src/app/globals.css`

### 1.1 Core Diagnosis

The current product drift is caused by five recurring issues:

1. **Tone inconsistency**: marketing, shell, settings, paywalls, and mobile do not all express the same visual confidence.
2. **Composition inconsistency**: some pages are thoughtfully dense while others are under-filled, over-spaced, or structurally unfinished.
3. **Primitive inconsistency**: buttons, toggles, cards, tabs, form fields, and empty states do not always follow one clear hierarchy.
4. **Accent inconsistency**: Signal Green is sometimes used well and sometimes used as a generic “make this feel premium” treatment.
5. **Platform inconsistency**: Flutter often captures the mood well, but web and mobile do not yet feel like the same system with platform-appropriate adaptations.

### 1.2 End State

When this redesign is complete, iWorkr must feel:

- premium, not ornamental
- dense, not cluttered
- quiet, not empty
- fast, not animated for its own sake
- minimal, not unfinished
- monochrome-first, with Signal Green used as a scarce operational accent

The redesign must make every surface feel deliberate. A dark screen alone is not enough. The benchmark is “low-noise, high-confidence software.”

---

## 2. Purpose, Scope, and Source of Truth

### 2.1 Purpose

This PRD defines the design-system rework necessary to make iWorkr visually and behaviorally consistent with its stated `Obsidian / Stealth Mode` direction. It exists to answer four questions:

1. What about the current product feels off?
2. What exactly should iWorkr borrow from Linear?
3. What must remain uniquely iWorkr?
4. What rules must teams follow so drift does not reappear in six weeks?

### 2.2 Scope

This document covers:

- web marketing surfaces
- authentication and onboarding surfaces
- authenticated web application shell
- settings and admin control surfaces
- Flutter mobile parity
- AI, automation, paywall, and empty-state treatment
- module-level design requirements across jobs, schedule, finance, CRM, forms, assets, messaging, and help

This document does not replace:

- implementation details in individual component files
- backend behavior or schema definitions
- module business logic PRDs

### 2.3 Source-of-Truth Hierarchy

To stop future drift, the source-of-truth order is mandatory:

1. `src/app/globals.css`
2. `docs/STYLE_GUIDE.md`
3. this document, `docs/PRD-Design-Revamp.md`
4. local component implementation details

If a screen proposal conflicts with `globals.css` token semantics or the style guide, the screen proposal is wrong unless the token system is intentionally updated first.

### 2.4 Important Clarification

The existing style guide is stronger than the old version of this PRD. The rewrite must therefore **align and operationalize** the current design system, not create a parallel one.

That means:

- light mode remains supported, even though the current audit focuses heavily on dark screenshots
- sharp radii remain the rule
- information density remains a feature
- ghost-tint status styling remains preferred over loud solid fills
- card borders remain more important than card shadows

---

## 3. Audit Inputs and Visual Evidence

### 3.1 Screenshot Sets Reviewed

The design audit incorporated the following:

- `screenshots/linear/01-linear-sidebar.jpg`
- `screenshots/linear/02-linear-inbox.jpg`
- `screenshots/linear/03-linear-new-issue.jpg`
- `screenshots/linear/04-linear-lock-screen-notification.jpg`
- `screenshots/linear/05-linear-project-detail.jpg`
- `screenshots/linear/06-linear-issue-detail.jpg`
- `screenshots/linear/07-linear-web-app.png`

- all relevant web screenshots from `screenshots/web/01-landing-page.png` through `screenshots/web/65-accept-invite.png`
- all Flutter screenshots from `screenshots/flutter/01-login-screen.png` through `screenshots/flutter/14-workspace-switcher.png`

### 3.2 What the Linear Screens Actually Teach

The Linear reference set does **not** primarily teach “use more black.” It teaches:

- high confidence in layout hierarchy
- compact but breathable spacing
- stronger contrast in content than in chrome
- extremely controlled radii
- low-border, low-shadow, high-structure composition
- soft glass only where it adds hierarchy
- careful use of chips, pills, and metadata
- a sense that every control belongs to the same parent system

### 3.3 What the iWorkr Screens Reveal

The current iWorkr product already gets many foundational decisions right:

- dark-first shell
- restrained surfaces
- thin dividers
- JetBrains Mono usage in some places
- emerald accents for operational/live states
- floating mobile bottom navigation

But the screenshot set also reveals repeated issues:

- large empty regions with too little structural content
- pages that look “paused” instead of intentionally calm
- too many isolated card boxes without a stronger page rhythm
- inconsistent use of green, white, and gray for actions
- admin/settings pages that are usable but under-designed
- paywalled screens that feel like placeholders, not premium upgrade experiences
- forms and builders that still behave like admin forms rather than crafted workflows

---

## 4. Design Drift Diagnosis

### 4.1 Marketing Drift

The current landing page in `screenshots/web/01-landing-page.png` is too light, too generic, and too detached from the authenticated product shell. It presents the brand more like a polished startup template than a field operating system. The spacing is generous, but the hero does not express urgency, depth, workflow intelligence, or a distinctive visual motion language.

The supporting marketing pages improve once they go dark, but they still feel separate from the core shell. The public product story is not yet tightly coupled to the product’s strongest visual qualities.

### 4.2 Product Drift

Many authenticated web screens are visually quiet but under-composed. `screenshots/web/10-dashboard.png`, `14-dashboard-schedule.png`, `15-dashboard-dispatch.png`, `18-dashboard-team.png`, `19-dashboard-team-roles.png`, `23-dashboard-assets.png`, and `24-dashboard-forms.png` all show a similar problem: the tone is right, but the content scaffolding is too weak. There is too much empty black with not enough intentional structure.

Linear’s calm never reads as unfinished. Some current iWorkr screens do.

### 4.3 Primitive Drift

The app still lacks a universally reliable hierarchy for:

- default primary action
- destructive action
- ghost action
- live state
- selected state
- paywall state
- empty state

Some screens use white primary CTAs, some use green, some use card-contained buttons, and some use minimally visible controls that disappear into the background. The style guide needs to be obeyed as a system, not quoted selectively.

### 4.4 Platform Drift

Flutter often looks closer to the intended iWorkr brand than certain web modules because the mobile screens commit more consistently to a dark operational tone. However, the mobile app still shows component mismatches:

- list density and dividers are inconsistent
- top actions sometimes float correctly and sometimes feel conventional
- search, sheets, and forms are not yet unified around one motion and elevation model
- some empty states are poetic but too sparse

### 4.5 Paywall and Upgrade Drift

The paywalled automation, AI hub, and integrations screens in `screenshots/web/25-dashboard-automations.png`, `26-dashboard-ai-agent.png`, and `28-dashboard-integrations.png` are too close to blank placeholders. They are dark and centered, but they do not yet sell the premium nature of the capability. Upgrade states must feel aspirational, not merely unavailable.

### 4.6 Settings Drift

The settings suite is usable and mostly coherent, but it currently feels like a well-styled admin panel rather than an elite control environment. The common issues are:

- content blocks that are functional but visually generic
- too much empty canvas relative to the density of configuration
- repeated form rows that do not build enough hierarchy
- a missing “meta-system” feeling across account, jobs, and administration

---

## 5. The iWorkr Interpretation of Linear

### 5.1 What We Emulate

From Linear, iWorkr should emulate:

- monochrome-first interfaces
- compact interface rhythm
- typography-led hierarchy
- subtle layered surfaces
- shallow elevation with strong compositional clarity
- keyboard-first interactions
- animation restraint
- strong list/table rhythm
- premium utility rather than decorative branding

### 5.2 What We Do Not Emulate Literally

iWorkr should **not** become:

- a software issue tracker wearing a service-business logo
- a purple-accent clone of Linear
- a borderless interface with no affordances
- a dashboard that values emptiness over operational usefulness

Linear is a benchmark for interface discipline. iWorkr must still feel like field operations software: dispatching, service jobs, routes, assets, invoices, technicians, and AI support for real-world workflows.

### 5.3 iWorkr-Specific Translation

The iWorkr expression of this benchmark is:

- operational, not editorial
- durable, not trendy
- sharp, not soft
- quiet, not sterile
- premium, not luxurious
- mobile-capable, not desktop-only in thinking

---

## 6. Non-Negotiable Design Principles

These rules are mandatory across web, Flutter, and Electron.

### 6.1 Monochrome First

The interface must be 90-95% zinc, charcoal, black-surface, and off-white text. Signal Green is not decoration. It is reserved for focus, active operational state, positive feedback, live telemetry, and selected brand emphasis.

### 6.2 Density With Restraint

iWorkr must not chase “extreme whitespace” as a stylistic goal. The correct target is **high signal density with generous breathing room around important structure**. Linear works because it is compact but never cramped.

### 6.3 Typography Over Ornament

Hierarchy must come first from:

- size
- weight
- tracking
- contrast
- layout position

Hierarchy must not depend on:

- random accent colors
- thick borders
- oversized shadows
- oversized iconography

### 6.4 Sharp Radii

The product must continue using the sharp radius scale defined in the style guide and token layer. No bubbly corners. No `rounded-2xl` or `rounded-3xl` product language outside special marketing illustrations or platform shells that explicitly warrant it.

### 6.5 Border-First, Shadow-Second

Surfaces must separate primarily through:

- tonal contrast
- subtle border edges
- inset bevels
- layout grouping

Drop shadows are secondary and should only be noticeable on floating layers, menus, popovers, sheets, and upgrade overlays.

### 6.6 Motion Must Signal State Change

Animation is not visual perfume. It exists to communicate:

- focus
- entry
- hierarchy
- selection
- live data
- loading
- success
- system presence

If motion does not improve comprehension, it should be removed.

### 6.7 Empty States Must Feel Intentional

An empty page cannot be just a title, a line of text, and a lonely button on a black background. Empty states must still provide:

- context
- next action
- visual structure
- emotional tone

### 6.8 Mobile Is Not a Secondary Brand

Flutter is not allowed to become the “close enough” version of the brand. It must be a native-feeling expression of the same system: same tokens, same hierarchy, same accent discipline, same motion intent, adapted for touch and device ergonomics.

---

## 7. Canonical Visual Baseline

This section converts the live design system into the baseline the redesign must enforce.

### 7.1 Color System

The dark theme remains the primary visual benchmark:

- base background: `#050505`
- surface 1: `#0A0A0A`
- surface 2: `#141414`
- border base: 5% white alpha
- active border: 12% white alpha
- text primary: `#EDEDED`
- text muted/body: zinc-muted values from the style guide
- Signal Green: `#10B981`

Requirements:

- black void backgrounds are acceptable, but content surfaces may not collapse into the same value without tonal separation
- green must never fill large dashboard regions
- semantic colors are allowed for status systems, but only as ghost tints or small indicators

### 7.2 Surface Hierarchy

All surfaces must declare their role clearly:

- **canvas**: the full page background
- **shell chrome**: sidebar, topbar, dock, bottom nav
- **panel surface**: cards, settings groups, lists, tables, widgets
- **floating surface**: dropdowns, sheets, modals, command palette

Current issue: some screens use a correct surface color but fail to establish hierarchy because too many surfaces sit at the same tone with too little grouping.

### 7.3 Typography Baseline

Inter and JetBrains Mono remain non-negotiable.

Requirements:

- headings use tight tracking
- monospace is used for IDs, money, dates, counts, tables, and operational metadata
- body copy remains compact and readable
- no screen should rely on more than two dominant weights at once
- uppercase mono overlines should remain a consistent framing pattern, not appear randomly

### 7.4 Spacing Baseline

The product must use the existing spacing cadence from the style guide. However, spacing must be applied by function:

- page-level spacing for major sections
- tighter spacing for operational lists
- denser spacing inside admin tables
- larger whitespace only around hero moments, modals, and key focus areas

The redesign must remove both extremes:

- cramped, form-heavy packing
- vast black emptiness with no structure

### 7.5 Border and Elevation Baseline

Requirements:

- cards: subtle border, almost no visible shadow
- popovers: deeper shadow, tighter radius
- sheets: clear border separation and directional movement
- widgets: subtle glass/bevel enhancement allowed
- no generic `shadow-lg` look

### 7.6 Motion Baseline

The animation system already defines strong defaults:

- `ease-out-expo` for primary motion
- spring for shells and toggles
- small scale/opacity transitions for overlays
- staggered reveal for sections and widgets

The redesign must standardize these so that:

- marketing motion feels related to product motion
- Flutter and web share the same intent, even if not the same exact APIs
- live operational modules use motion to indicate freshness and state, not novelty

### 7.7 Texture Baseline

Texture is a quiet differentiator in iWorkr and must be preserved:

- noise overlay
- dot grid
- line grid
- green light cone in widgets
- soft radial glows

Current issue: some screens use these textures effectively while many others drop back to plain dark emptiness. The rework must use texture more consistently, but always at low opacity.

---

## 8. Primitive Component Standards

The redesign must reassert a consistent grammar for primitives.

### 8.1 Buttons and CTA Hierarchy

There must be three standard action levels:

1. **Default primary action**
   - usually white on dark surfaces
   - used for page-confirming actions, save actions, modal confirmations

2. **Brand/activation action**
   - Signal Green
   - used for live, creation, acquisition, upgrade, and field-action emphasis

3. **Secondary / ghost action**
   - outline, transparent, or subtle surface treatment
   - never visually equal to primary

Requirements:

- one dominant CTA per screen region
- green must be sparse and meaningful
- white primary buttons should remain the default inside dense workflow surfaces
- upgrade or live-action contexts may use green as the stronger emphasis

### 8.2 Inputs and Form Rows

Inputs must not feel like generic admin forms. Every form must support:

- consistent label placement
- clear placeholder hierarchy
- focus-ring behavior
- predictable radius
- quiet but visible borders

Current issue:

- some forms are elegant but too low contrast
- invoice and quote creation still feel form-bound rather than task-native
- Flutter auth and creation flows still inherit some standard mobile form behavior instead of custom iWorkr behavior

### 8.3 Cards, Panels, and Widget Shells

Cards must be used to group related information, not simply because a blank page looks empty.

Rules:

- a card must represent a meaningful object, cluster, or system region
- cards should rarely be nested more than two layers deep
- widget shells may use light-cone, noise, and spotlight treatments
- static admin sections should be cleaner and flatter than dashboard widgets

### 8.4 Tables and Lists

Linear’s greatest strength is often its list rhythm. iWorkr must raise its table/list quality across jobs, clients, team, statuses, templates, integrations, and communications.

Requirements:

- rows must have reliable hover and selected states
- vertical separators should be minimized
- headers must be subtle but legible
- critical metadata must align cleanly
- empty table states should not collapse into a nearly blank page

### 8.5 Tabs, Segmented Controls, and Filters

Tabs must clearly declare:

- current selection
- available scope
- hierarchy relative to the page title

Current issue:

- some tab bars are too quiet and disappear into the chrome
- some segmented controls on mobile are good in mood but need stronger active-state precision

### 8.6 Modals, Drawers, and Sheets

All overlays must feel like they belong to one system:

- same radii family
- same blur logic
- same scale/fade behavior
- same action footer structure

Flutter sheets must especially mirror this discipline. `screenshots/flutter/13-new-job-form.png` is promising, but it still needs stronger field grouping and a more compositional sense of progression.

### 8.7 Toggles and States

Toggles appear heavily across settings and mobile security. They are one of the most repeated system primitives and must be perfect.

Requirements:

- consistent size, track radius, knob color, and motion
- off states remain legible, not muddy
- on states use Signal Green without looking neon
- grouped settings rows need more visual hierarchy between label, explanation, and control

### 8.8 Status Pills, Chips, and Labels

The status system should stay in ghost-tint mode:

- subtle tinted backgrounds
- strong text color
- restrained borders
- minimal visual noise

CRM, labels, invoice status, team role chips, and mobile task chips must all obey this rule.

### 8.9 Command Palette and Search

The command palette is a brand-defining interface and must feel premium everywhere.

Web requirements:

- strong overlay backdrop
- high-contrast input field
- grouped results
- active item clarity
- keyboard affordance visibility

Flutter requirements:

- `screenshots/flutter/06-search-command-palette.png` is directionally correct
- input should feel more commanding and less like a standard mobile search bar
- result groups and chips need stronger density and hierarchy

### 8.10 Empty, Loading, and Upgrade States

These are currently some of the weakest categories and require immediate improvement.

Requirements:

- empty states must use illustration, motion, or structural scaffolding
- loading states must use shimmer/skeletons, not blank black waiting rooms
- upgrade states must show value, not just blockage

---

## 9. Platform Audit: Web Marketing and Public Product

### 9.1 Landing Page

Evidence: `screenshots/web/01-landing-page.png`

Current state:

- polished but generic
- too bright relative to the product shell
- hero has insufficient mood and not enough product-specific tension
- the page reads more like a marketing homepage template than the front door to a field operating system

Required redesign:

- bring the landing page much closer to the product shell’s tonal world
- use a darker, more atmospheric palette
- connect hero storytelling to service workflow: dispatch, schedule, finance, field visibility, AI coordination
- elevate the screenshot/mockup treatment with more depth, layering, and motion
- introduce richer bento storytelling, not just feature boxes

Acceptance criteria:

- hero, bento grids, and pricing feel recognizably part of the same family as the app
- marketing does not feel lighter, softer, or more generic than the shell
- motion and textures feel related to the product

### 9.2 Auth and Signup

Evidence: `screenshots/web/02-auth-login.png`, `60-signup.png`

Strengths:

- appropriately sparse
- good dark background
- reasonable emotional tone

Issues:

- composition is almost too sparse
- fields and buttons need a stronger “system” feel
- the screen could better communicate trust and product identity

Requirements:

- keep the restraint
- strengthen hierarchy around logo, title, and auth choices
- make the auth stack feel more composed and less floating in void space
- use texture and subtle scaffolding instead of adding heavy card frames

### 9.3 Legal and Contact Pages

Evidence: `screenshots/web/03-contact.png`, `04-privacy.png`, `05-terms.png`, `06-cookies.png`

Current issue:

- readable, but visually generic
- legal pages are acceptable functionally but not yet premium
- contact form uses green too loudly relative to the rest of the composition

Requirements:

- maintain narrow reading width
- improve type rhythm, line spacing, and content sectioning
- use system-consistent overlines and separators
- ensure the contact form reflects the same input and button hierarchy as the product

### 9.4 Download and Get App

Evidence: `screenshots/web/07-download.png`, `30-dashboard-get-app.png`

Current issue:

- useful structure, but not enough wow
- desktop and mobile acquisition screens need more product packaging quality

Requirements:

- introduce more editorial framing around devices, benefits, and distribution
- preserve operational usefulness like QR code and SMS send
- align with the app’s surface treatment and not generic app-store landing design

### 9.5 Setup, Join, Checkout, and Error States

Evidence: `screenshots/web/61-setup.png`, `62-join.png`, `63-checkout.png`, `64-404-not-found.png`, `65-accept-invite.png`

Current state:

- dark and mostly cohesive
- setup completion and 404 have some atmosphere
- invite failure and join states are functional but a bit ordinary
- checkout is structurally solid but could feel more premium

Requirements:

- all edge-state screens must feel like part of the command center
- checkout must emphasize safety, clarity, and confidence without looking like a third-party embed dropped into a dark page
- invalid/invite screens should use stronger iconography, motion, and hierarchy

---

## 10. Platform Audit: Authenticated Web Product

### 10.1 Shell Quality

Evidence across almost all authenticated web screenshots

The shell is one of the stronger parts of iWorkr. The sidebar, topbar, and global tone are already close to the target. However, the shell needs tighter consistency in:

- active-state emphasis
- cross-module table/list rhythm
- visual balance between left chrome and main canvas
- how empty regions are treated

The sidebar must remain understated, but labels and state markers should never become so dim that the product feels underpowered.

### 10.2 Dashboard

Evidence: `screenshots/web/10-dashboard.png`

Current issue:

- the widget layout feels close to correct but too quiet
- widgets lack enough internal hierarchy
- empty widgets read as placeholders rather than live operational containers

Requirements:

- increase information architecture inside widgets
- make each widget header, value, trend, and state more legible
- preserve low-noise chrome while raising content contrast
- make dashboard density feel purposeful rather than sparse

### 10.3 Jobs and Clients

Evidence: `screenshots/web/11-dashboard-jobs.png`, `12-dashboard-clients.png`

Current issue:

- jobs and clients are structurally clean but emotionally flat
- empty states do not carry enough intention
- filters and search do not yet feel like elite command tools

Requirements:

- improve list hierarchy
- ensure empty states offer clear next actions and supporting context
- tighten header/filter/table relationships
- make row interactions feel more alive and precise

### 10.4 CRM / Sales Pipeline

Evidence: `screenshots/web/13-dashboard-crm.png`

Current issue:

- the board is readable, but color chips at the top of columns are more assertive than the rest of the app
- columns feel under-filled and under-structured

Requirements:

- soften semantic color presentation
- use color as category guidance, not neon signaling
- improve empty-lane structure and drag affordances
- ensure cards, counts, and pipeline actions feel aligned with the status-chip system

### 10.5 Schedule and Dispatch

Evidence: `screenshots/web/14-dashboard-schedule.png`, `15-dashboard-dispatch.png`

This is one of the largest design opportunities in the app.

Current issue:

- schedule is too empty
- dispatch is visually under-expressed
- the most operationally important modules in the product currently do not feel the most sophisticated

Requirements:

- increase the tactical quality of time, crew, and route visualization
- strengthen grid, now-line, block, and lane rhythm
- make dispatch feel alive through motion, telemetry markers, subtle radar, and hierarchy
- use texture and animation to support real-time field operations

### 10.6 Inbox and Messages

Evidence: `screenshots/web/16-dashboard-inbox.png`, `17-dashboard-messages.png`

Current issue:

- the split-pane structure is correct, but current empty states feel too inert
- the messaging system lacks the dense, focused confidence visible in Linear’s inbox

Requirements:

- increase conversation list quality
- strengthen unread, active, and thread states
- improve the right-pane composition and message rhythm
- preserve quietness without letting the product feel blank

### 10.7 Team and Roles

Evidence: `screenshots/web/18-dashboard-team.png`, `19-dashboard-team-roles.png`

Current issue:

- functionally clean but too bare
- role management especially looks unfinished rather than intentionally minimal

Requirements:

- introduce stronger roster hierarchy, richer metadata grouping, and more spatial definition
- role management needs a serious system surface, not a left rail and empty void
- permissions should feel command-grade and structured

### 10.8 Finance

Evidence: `screenshots/web/20-dashboard-finance.png`, `21-dashboard-finance-new-invoice.png`, `22-dashboard-finance-new-quote.png`

Current issue:

- finance overview is strong in tone, weaker in content density
- invoice and quote creation flows are still too form-like
- preview areas need to feel alive and document-like, not just blank preview rectangles

Requirements:

- finance overview must feel trustworthy and precise
- data density must increase without clutter
- invoice and quote creation must move toward task-native document composition
- totals, tax, discounts, and states must align perfectly in mono presentation

### 10.9 Assets and Forms

Evidence: `screenshots/web/23-dashboard-assets.png`, `24-dashboard-forms.png`

Current issue:

- both screens are elegant but under-designed
- neither uses enough visual scaffolding to communicate capability richness

Requirements:

- asset management should feel like an operational inventory command surface
- forms should feel like compliance and field-capture tooling, not merely another list page
- empty states should demonstrate system potential

### 10.10 Automations, AI, Integrations, and Help

Evidence: `screenshots/web/25-dashboard-automations.png`, `26-dashboard-ai-agent.png`, `27-dashboard-ai-agent-phone.png`, `28-dashboard-integrations.png`, `29-dashboard-help.png`

Current issue:

- automation and integrations paywalls are too close to placeholder upgrade cards
- AI hub lock screen is too sparse
- AI phone configuration is stronger, but still needs tighter system hierarchy
- help is useful, but its card layout and search area need more refinement

Requirements:

- paid capability surfaces must feel aspirational and premium
- AI must have a stronger presence and persona without becoming theatrical
- help must feel like an intelligent operational assistant, not a generic help center

---

## 11. Platform Audit: Settings and Administration

### 11.1 Overall Settings Frame

Evidence: `screenshots/web/40-settings.png` through `57-settings-import.png`

The settings layout is one of the more coherent families in the app, but it still lacks the finished confidence of Linear’s deeper settings surfaces.

The most common issues are:

- too much black around relatively small content areas
- rows that are functional but not strongly tiered
- a feeling of “styled settings forms” rather than a unified operating environment

### 11.2 Individual Settings Areas

**Profile, Preferences, Workspace**

- need stronger page-intro hierarchy
- inputs should feel more system-native
- section grouping should be more deliberate

**Members, Billing, Notifications, Security**

- good base structure
- require richer table/list hierarchy and more intentional grouping
- billing especially should feel more premium and more tied to subscription value

**Integrations, Connected Accounts, Communications**

- strong utility
- need more differentiation between connection state, availability, and management state

**Templates, Workflow, Statuses, Labels**

- good examples of low-noise admin surfaces
- need more deliberate interaction design for reorder, edit, and bulk state management

**Branches, Developer API, Import/Export**

- structurally fine
- need more visual character and stronger object-level hierarchy

### 11.3 Settings Rework Standard

The whole settings area must feel like one large, elite control surface.

Requirements:

- consistent intro structure per page
- tighter max-width decisions
- stronger grouping of related rows
- better use of mono metadata
- clearer distinction between read-only info, editable settings, and dangerous/destructive actions

---

## 12. Platform Audit: Flutter Mobile

### 12.1 What Mobile Already Gets Right

The Flutter app already captures several important qualities:

- dark operational tone
- floating dock-style bottom navigation
- restrained use of emerald
- good use of compact cards
- command-center feeling in the dashboard and profile areas

### 12.2 What Mobile Still Needs

The mobile app still needs stronger standardization around:

- list rhythm
- top-right utility controls
- field/input treatment
- sheet composition
- empty-state richness
- action hierarchy

### 12.3 Auth

Evidence: `screenshots/flutter/01-login-screen.png`, `02-login-email-form.png`

Current issue:

- atmospheric, but still a bit too static
- email/password form feels more like a themed auth template than a crafted iWorkr access flow

Requirements:

- keep the dark grid and logo-led identity
- improve input prominence and focus behavior
- ensure keyboard presence does not degrade composition
- introduce subtle motion or operational ambience

### 12.4 Dashboard and Context Switcher

Evidence: `screenshots/flutter/03-dashboard-home.png`, `14-workspace-switcher.png`

Current issue:

- dashboard is one of the strongest mobile screens
- context switcher sheet needs more substance and better account/workspace object treatment

Requirements:

- keep the floating dock
- strengthen sheet content hierarchy
- ensure dashboard cards feel related to web widgets, not merely inspired by them

### 12.5 Jobs and Schedule

Evidence: `screenshots/flutter/04-jobs-empty.png`, `05-schedule-flight-path.png`

Current issue:

- good atmosphere, low information yield
- schedule view especially needs stronger operational richness when data is absent

Requirements:

- improve empty-state structure
- give schedule stronger routing/dispatch character
- use map and path styling as a premium differentiator

### 12.6 Command Search

Evidence: `screenshots/flutter/06-search-command-palette.png`

This is promising, but it must feel more commanding and less like a mobile search overlay.

Requirements:

- stronger input presence
- better result grouping
- clearer active/press states
- tighter spacing and more “control center” energy

### 12.7 Comms and Profile

Evidence: `screenshots/flutter/07-comms-channels.png`, `08-profile.png`

Current issue:

- functional but slightly repetitive row rhythm
- profile surface is strong but could better distinguish navigational groups from account summaries

Requirements:

- reduce list monotony
- improve section transitions
- use dividers sparingly and with more intentional row emphasis

### 12.8 Time and Leave

Evidence: `screenshots/flutter/09-time-clock.png`, `10-leave-requests.png`

Current issue:

- time clock has good mood but needs stronger core interaction presence
- leave requests empty state is too sparse

Requirements:

- elevate the time clock as a signature interaction
- make the central action unmistakable
- improve empty-state confidence and next-step framing

### 12.9 Security and New Job Sheet

Evidence: `screenshots/flutter/11-security.png`, `12-security-scrolled.png`, `13-new-job-form.png`

Current issue:

- security is one of the better mobile settings flows but still needs better row hierarchy
- new-job bottom sheet is directionally excellent but needs more disciplined grouping and a clearer multi-step rhythm

Requirements:

- preserve the premium security tone
- refine typography and hierarchy in subscription/security rows
- turn the new-job sheet into a flagship mobile workflow surface

---

## 13. Module-by-Module Rework Requirements

This section defines the actual product redesign requirements by module.

### 13.1 Landing

Must become darker, richer, more product-native, and more cinematic without becoming noisy.

Required:

- darker hero world
- stronger screenshot integration
- more meaningful bento stories
- refined motion and Lottie use
- premium pricing presentation
- testimonials that feel editorial, not template-driven

### 13.2 Auth and Entry

Must communicate trust, precision, and speed.

Required:

- quieter but stronger composition
- consistent input styling across web and mobile
- unified copy tone
- clear access hierarchy

### 13.3 Onboarding and Setup

Must feel like a system boot sequence, not a form wizard.

Required:

- staged progress
- controlled motion
- operational language
- stronger completion and provisioning states

### 13.4 Dashboard

Must feel like the field operating system at a glance.

Required:

- richer widget density
- clearer hierarchy within each widget
- live operational feel without visual chaos

### 13.5 Jobs

Must feel like a command list, not an empty spreadsheet shell.

Required:

- superior list rhythm
- stronger status and due-date treatment
- more deliberate empty state

### 13.6 Clients and CRM

Must feel like high-quality customer intelligence, not just records and columns.

Required:

- more refined list/detail transitions
- softer semantic color usage in CRM lanes
- better object hierarchy for account-level information

### 13.7 Schedule and Dispatch

This is a signature differentiator and must become one of the strongest modules visually.

Required:

- tactical timeline quality
- live dispatch motion cues
- better route/state visualization
- stronger mobile map treatment

### 13.8 Inbox and Messages

Must feel dense, focused, and premium.

Required:

- better thread hierarchy
- stronger unread/read distinction
- richer empty and first-use states

### 13.9 Team and Roles

Must feel like a serious control layer for operational staffing and permissions.

Required:

- richer roster presentation
- permission architecture that feels designed, not merely rendered

### 13.10 Finance

Must feel exact, trustworthy, and operationally elegant.

Required:

- stronger overview density
- document-native builders
- premium billing/quote/invoice presentation

### 13.11 Assets

Must communicate physical inventory, readiness, and field logistics.

Required:

- more visual object identity
- stronger empty-state potential
- clearer fleet/inventory/audit distinction

### 13.12 Forms

Must feel like compliance and field capture infrastructure.

Required:

- stronger template/submission hierarchy
- better builder ambition
- premium empty states and first-run guidance

### 13.13 Automations

Must feel like a powerful paid system, not an upgrade card.

Required:

- richer graph/canvas direction
- better explanation of value
- stronger differentiation between free limitation and premium capability

### 13.14 AI Agent

Must feel like a high-value operational intelligence layer.

Required:

- stronger AI presence
- more coherent persona without gimmick
- better transition between locked, configured, and active states

### 13.15 Integrations

Must feel like a trusted connectivity layer.

Required:

- better connected/disconnected/syncing hierarchy
- improved upgrade and enterprise framing

### 13.16 Help

Must feel like an intelligent assistance center inside the command environment.

Required:

- stronger search presence
- richer category cards
- more useful community and support framing

### 13.17 Settings

Must feel like a unified control center.

Required:

- stronger page intros
- better row hierarchy
- more intentional spacing
- more premium state and management treatments

---

## 14. Screenshot-Indexed Findings

This section records the screenshot-based findings that informed the redesign requirements.

### 14.1 Linear References

| Screenshot | Key lesson |
|---|---|
| `linear/01-linear-sidebar.jpg` | Dense navigation can still feel calm when chrome is quiet and active states are precise. |
| `linear/02-linear-inbox.jpg` | Inbox quality comes from list rhythm, avatar cadence, metadata contrast, and a soft but obvious active item. |
| `linear/03-linear-new-issue.jpg` | Creation flows must feel immediate, spacious, and chip-driven without losing hierarchy. |
| `linear/04-linear-lock-screen-notification.jpg` | Texture and glass should be subtle, cinematic, and sparse. |
| `linear/05-linear-project-detail.jpg` | Metadata chips, section spacing, and content hierarchy can coexist without heavy borders. |
| `linear/06-linear-issue-detail.jpg` | Threaded detail views should stack layers gently and keep comments highly readable. |
| `linear/07-linear-web-app.png` | Marketing can be dark, modular, and premium without looking heavy or noisy. |

### 14.2 Web Marketing and Public Pages

| Screenshot | Finding |
|---|---|
| `web/01-landing-page.png` | Too bright and generic compared with product shell. |
| `web/02-auth-login.png` | Good restraint, needs stronger composition. |
| `web/03-contact.png` | Form is functional but generic and overly dependent on green emphasis. |
| `web/04-privacy.png` | Good readability, needs stronger premium editorial rhythm. |
| `web/05-terms.png` | Similar to privacy: functional, not yet premium. |
| `web/06-cookies.png` | Stronger than other legal pages, but still system-light in feel. |
| `web/07-download.png` | Better tonal alignment, needs more packaging and depth. |
| `web/08-style-guide.png` | Useful reference page; should become more obviously canonical and system-driven. |
| `web/60-signup.png` | Sparse and calm; needs stronger identity presence. |
| `web/61-setup.png` | Good completion mood; can be more system-cinematic. |
| `web/62-join.png` | Functional invalid state, too generic. |
| `web/63-checkout.png` | Structurally sound but could feel more premium. |
| `web/64-404-not-found.png` | One of the better edge states; should become the standard for atmospheric system pages. |
| `web/65-accept-invite.png` | Works functionally; needs stronger invitation/error hierarchy. |

### 14.3 Web Product Modules

| Screenshot | Finding |
|---|---|
| `web/10-dashboard.png` | Tone is correct, widget composition too quiet. |
| `web/11-dashboard-jobs.png` | Clean but too empty; list/table needs more identity. |
| `web/12-dashboard-clients.png` | Similar issue: calm but under-composed. |
| `web/13-dashboard-crm.png` | Column semantics too colorful relative to system; lanes too empty. |
| `web/14-dashboard-schedule.png` | Most obvious gap: not enough tactical richness. |
| `web/15-dashboard-dispatch.png` | Underpowered for a signature module. |
| `web/16-dashboard-inbox.png` | Good split-pane base, weak empty-state substance. |
| `web/17-dashboard-messages.png` | Same as inbox; too inert when empty. |
| `web/18-dashboard-team.png` | Functional roster, too little hierarchy. |
| `web/19-dashboard-team-roles.png` | Feels unfinished, not intentionally minimal. |
| `web/20-dashboard-finance.png` | Good tonal baseline, needs more analytical richness. |
| `web/21-dashboard-finance-new-invoice.png` | Workflow still too form-like, preview too blank. |
| `web/22-dashboard-finance-new-quote.png` | Better structure, still too generic as a document builder. |
| `web/23-dashboard-assets.png` | Too little object identity and future-state storytelling. |
| `web/24-dashboard-forms.png` | Calm but underdeveloped as a workflow surface. |
| `web/25-dashboard-automations.png` | Upgrade state too placeholder-like. |
| `web/26-dashboard-ai-agent.png` | Locked AI state too sparse. |
| `web/27-dashboard-ai-agent-phone.png` | Better than AI lock state, but needs tighter config hierarchy. |
| `web/28-dashboard-integrations.png` | Upgrade state too similar to automations; lacks differentiated value framing. |
| `web/29-dashboard-help.png` | Useful but needs more premium support intelligence styling. |
| `web/30-dashboard-get-app.png` | Good utility structure; needs more brand packaging. |

### 14.4 Web Settings

| Screenshot | Finding |
|---|---|
| `web/40-settings.png` | Solid baseline settings composition. |
| `web/41-settings-profile.png` | Simple and clean; could carry stronger identity and hierarchy. |
| `web/42-settings-preferences.png` | Functional; row system should feel more refined. |
| `web/43-settings-workspace.png` | Strong content, but hierarchy can be more premium. |
| `web/44-settings-members.png` | Too much negative space relative to list content. |
| `web/45-settings-billing.png` | Clean, but billing value framing is still basic. |
| `web/46-settings-notifications.png` | Good toggle structure; could use stronger grouping. |
| `web/47-settings-security.png` | Simple and clear; needs more premium risk/auth hierarchy. |
| `web/48-settings-integrations.png` | Connection cards useful, but state hierarchy can improve. |
| `web/49-settings-connected.png` | Functional list; needs richer account-state treatment. |
| `web/50-settings-communications.png` | Strong module candidate; row hierarchy and edit affordances can improve. |
| `web/51-settings-templates.png` | Good baseline list design. |
| `web/52-settings-workflow.png` | Needs more system expressiveness for a workflow-defining page. |
| `web/53-settings-statuses.png` | Strong low-noise list; could better support editing/reordering. |
| `web/54-settings-labels.png` | Useful but slightly too plain relative to semantic color strategy. |
| `web/55-settings-branches.png` | Empty state too generic. |
| `web/56-settings-developers.png` | Good structure; needs more premium object treatment. |
| `web/57-settings-import.png` | Useful but visually basic. |

### 14.5 Flutter

| Screenshot | Finding |
|---|---|
| `flutter/01-login-screen.png` | Strong mood, needs more motion and auth hierarchy. |
| `flutter/02-login-email-form.png` | Auth fields need stronger crafted treatment. |
| `flutter/03-dashboard-home.png` | One of the strongest mobile screens. |
| `flutter/04-jobs-empty.png` | Good tone, empty state too sparse. |
| `flutter/05-schedule-flight-path.png` | Promising schedule framing, insufficient operational richness. |
| `flutter/06-search-command-palette.png` | Good direction; needs more commanding input and grouping. |
| `flutter/07-comms-channels.png` | Useful, but row rhythm becomes repetitive. |
| `flutter/08-profile.png` | Strong utility surface; group hierarchy can improve. |
| `flutter/09-time-clock.png` | Good mood, core clock interaction should be more signature. |
| `flutter/10-leave-requests.png` | Empty state too light in structure. |
| `flutter/11-security.png` | Strong module; needs more polish in grouped settings rhythm. |
| `flutter/12-security-scrolled.png` | Subscription/security stacking is promising; refine clarity and hierarchy. |
| `flutter/13-new-job-form.png` | Best example of mobile workflow ambition; should become the standard. |
| `flutter/14-workspace-switcher.png` | Nice sheet foundation; context objects need richer treatment. |

---

## 15. Rollout Strategy

This redesign should not be executed as isolated one-off polish tasks. It should be delivered in phases.

### Phase 1: Reassert the System ✅ COMPLETE

Focus:

- ✅ token compliance — all `#050505`, `#080808`, `#0A0A0A`, `#0F0F0F` replaced with CSS variable tokens across 60+ files
- ✅ button hierarchy — `stealth-btn-primary`, `stealth-btn-brand`, `stealth-btn-ghost`, `stealth-btn-danger` system added to globals.css and applied across modals and pages
- ✅ form/input compliance — token-based borders, radii, and focus states standardized
- ✅ shell consistency — sidebar and topbar use full token system, command menu tokenized
- ✅ settings consistency — all 16 settings pages now have mono overline + heading + subtitle pattern with `stealth-settings-group` and `stealth-settings-row` classes
- ✅ neon green eradicated — zero instances of `#00E676` / `#00C853` remain in `src/`; all replaced with Signal Green `#10B981`
- ✅ noise texture standardized — `stealth-noise` CSS class with `var(--noise-opacity)` applied to all pages
- ✅ ghost-tint CSS variables added — `--ghost-emerald`, `--ghost-rose`, `--ghost-amber`, `--ghost-blue`, `--ghost-violet`, `--ghost-zinc` with text and strong variants

### Phase 2: Upgrade High-Traffic Operational Modules ✅ COMPLETE

Focus:

- ✅ dashboard — COMMAND CENTER overline, upgraded heading hierarchy, atmospheric glow, signal-pulse live indicator, richer widget interiors
- ✅ jobs — OPERATIONS overline, atmospheric glow, table headers in mono pattern, confetti and status-fill animations preserved
- ✅ clients — CLIENT INTELLIGENCE overline, analytical LTV strip with mono labels, token-based table headers
- ✅ schedule — TACTICAL TIMELINE overline, commanding date header, stealth-tab system, enhanced now-line with time label and glow, empty row hints
- ✅ dispatch — LIVE DISPATCH command bar with fleet count, edge vignettes, noise texture
- ✅ inbox/messages — COMMS overline, noise texture, stronger unread glow, keyboard shortcut hints, richer empty states
- ✅ finance — FINANCE overline, mono metric cards with analytical styling, tabular-nums values, noise texture
- ✅ team — PERSONNEL overline, atmospheric glow, on-job stat pill, mono table headers
- ✅ CRM — SALES PIPELINE overline, ghost-tint column headers (6% bg, 12% border), richer empty lane placeholders

### Phase 3: Upgrade Premium and Differentiator Surfaces ✅ COMPLETE

Focus:

- ✅ landing page — dark hero with atmospheric emerald glow, noise texture, bg-line-grid, Signal Green CTAs, system-integrated download strip, mockup depth with emerald glow
- ✅ bento grid — line grid background, noise texture, atmospheric glow, brand-tinted schedule/chat/finance elements
- ✅ pricing — emerald ghost-tint recommended plan, line grid, noise, atmospheric glow
- ✅ testimonials — editorial card treatment, brand quote marks, metric badge
- ✅ final CTA — commanding emerald glow, Signal Green button with glow shadow
- ✅ automations — AUTOMATIONS overline, stealth-paywall CSS class, brand-green CTA
- ✅ AI agent — AI WORKFORCE overline, muted violet accents, atmospheric violet glow, staggered card animation
- ✅ integrations — INTEGRATIONS overline, token-based borders, consistent tab indicators
- ✅ help — Intelligence Center overline, command surface search bar, token-based category cards, enriched empty states
- ✅ forms — COMPLIANCE overline, capability hint row, analytical stats
- ✅ assets — ASSET COMMAND overline, mono KPI cards, tabular-nums values
- ✅ feature gate — redesigned from basic overlay to aspirational paywall with radial glow, pulsing lock, trial messaging

### Phase 4: Mobile Parity and Edge-State Quality ✅ COMPLETE

Focus:

- ✅ Flutter theme tokens — Alabaster light theme corrected to match web (canvas, surface1, surface2, borders, textPrimary)
- ✅ Flutter empty state animations — zen-breathe and signal-pulse corrected to match web spec (scale and opacity ranges)
- ✅ Flutter core widgets audited — all 6 widgets fully compliant with ObsidianTheme tokens
- ✅ Auth page — token-based borders and backgrounds, standardized noise grain, atmospheric glow, premium status bar
- ✅ Onboarding/setup — token-based backgrounds, noise texture, atmospheric glow
- ✅ Checkout — tokenized surfaces and borders, dual atmospheric glows, premium form wrapper
- ✅ Join/invite — token-based backgrounds, noise texture, atmospheric elements
- ✅ 404/error — token-based backgrounds, standardized noise
- ✅ Signup — token-based background, noise texture, atmospheric glow
- ✅ Legal pages — token-based colors throughout, noise texture, atmospheric glow
- ✅ Contact — tokenized form inputs and buttons, noise texture
- ✅ Download — token-based styling, atmospheric treatment
- ✅ Dashboard widgets — all 6 upgraded with ghost-tint tokens, mono labels, tabular-nums values, enriched empty states
- ✅ Job/client detail pages — noise texture, mono section headings, tabular-nums for financial values
- ✅ Invoice/quote builders — noise texture, document-native feel with mono labels, token-based borders
- ✅ Shared modals — create-job, create-client, create-invoice, upgrade-modal all tokenized
- ✅ Command menu and slide-over — fully tokenized

---

## 16. Governance Rules

To prevent design drift from recurring:

### 16.1 New UI patterns must be justified

Before adding a new component pattern, the team must ask:

- does a pattern already exist in `docs/STYLE_GUIDE.md`?
- can this be expressed through existing tokens and primitives?
- is this a one-off or a reusable system pattern?

### 16.2 No local aesthetic improvisation

It is not acceptable to introduce:

- ad hoc shadows
- random radii
- custom greens
- arbitrary spacing systems
- one-page-only button semantics

### 16.3 Every major UI PR must include visual verification

Verification must include at least one of:

- updated screenshots
- side-by-side before/after comparison
- explicit notes on how the change complies with this PRD and the style guide

### 16.4 Drift checklist for reviewers

Reviewers must ask:

- does this look like iWorkr, not just a dark app?
- does this look dense and intentional, not sparse and unfinished?
- is Signal Green being used sparingly?
- do the primitives match the system?
- does web/mobile parity still hold?

---

## 17. Acceptance Criteria

The redesign is successful when:

1. ✅ marketing and product feel like members of the same family — landing page now uses dark Obsidian palette, noise texture, atmospheric glows, and Signal Green CTAs consistent with the product shell
2. ✅ schedule, dispatch, finance, and AI feel like premium flagship modules — all have mono overlines, atmospheric treatment, command-center headers, and enriched visual hierarchy
3. ✅ empty states no longer read as placeholders — all modules have enriched empty states with zen-breathe/signal-pulse animations, descriptive copy, and actionable CTAs
4. ✅ settings feel like a real control center, not a themed admin page — all 16 settings pages have consistent mono overline + heading + subtitle pattern with stealth-settings-group classes
5. ✅ Flutter and web clearly share one design language — Flutter theme tokens corrected to match web, animation parameters aligned, all core widgets verified against ObsidianTheme
6. ✅ buttons, forms, toggles, cards, tables, and overlays follow one predictable hierarchy — stealth-btn system, stealth-tab system, stealth-table system, stealth-settings-row system all enforced via globals.css
7. ✅ the product feels more Linear in discipline, but more iWorkr in operational identity — mono overlines establish command-center identity, ghost-tint status system ensures restrained color usage, atmospheric glow and noise give every surface depth

---

## 18. Final Standard

iWorkr should feel like software built by people who know exactly what to remove and exactly what to emphasize.

The redesign is not about adding decoration. It is about restoring confidence:

- confidence in hierarchy
- confidence in density
- confidence in motion
- confidence in product structure
- confidence that every screen belongs to the same command environment

Linear is the benchmark for interface discipline. iWorkr’s redesign must apply that discipline to field operations. The result should be a cleaner, sharper, more modern operating system for service businesses, not a collection of dark screens with shared colors.
