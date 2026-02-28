---
name: build-nextjs-app
description: Scaffold and build Next.js features for iWorkr — App Router, server actions, Supabase integration, Tailwind v4, Zustand stores, with iWorkr conventions enforced.
---

# Build Next.js App Skill — iWorkr

## Step 1 — Understand the existing structure
Before creating anything, scan and follow existing patterns:

### Routes (`src/app/`)
- Dashboard routes: `src/app/dashboard/<module>/page.tsx`
- Settings routes: `src/app/settings/<section>/page.tsx`
- Public routes: `src/app/<page>/page.tsx`
- Layout: `src/app/layout.tsx` (root), `src/app/dashboard/layout.tsx` (shell)

### Server actions (`src/app/actions/`)
- One file per domain: `jobs.ts`, `clients.ts`, `finance.ts`, `schedule.ts`, etc.
- Pattern: `"use server"` → auth check → Zod validation → Supabase query → return result
- Error shape: `{ error: string }` or `{ data: T }`

### API routes (`src/app/api/`)
- Webhooks: `api/webhook/polar/`, `api/stripe/`
- Public endpoints: `api/quotes/[id]/accept/`, `api/invoices/public/`
- Internal: `api/automation/`, `api/schedule/validate/`

### Components (`src/components/`)
- Domain components: `src/components/<domain>/` (e.g., `finance/`, `jobs/`, `schedule/`)
- Shared UI: `src/components/ui/` (badge, modal, shimmer, etc.)
- Shell: `src/components/shell/` (sidebar, header, command palette)
- Providers: `src/components/providers/` (auth, theme)

### State (`src/lib/`)
- Zustand stores: `<domain>-store.ts` (e.g., `jobs-store.ts`, `finance-store.ts`)
- Data utilities: `<domain>-data.ts` for static data/enums
- Format utilities: `format.ts`
- Validation: `validation.ts` (shared Zod schemas)

## Step 2 — Add a new feature (checklist)

### New dashboard module
1. Create route: `src/app/dashboard/<module>/page.tsx`
2. Create server actions: `src/app/actions/<module>.ts`
3. Create Zustand store: `src/lib/<module>-store.ts`
4. Create components: `src/components/<module>/`
5. Add to sidebar navigation (in shell component)
6. Add Supabase migration if new tables needed

### New settings page
1. Create route: `src/app/settings/<section>/page.tsx`
2. Follow existing settings page layout pattern (title + description + card)
3. Add to settings sidebar navigation

### New API route
1. Create handler: `src/app/api/<path>/route.ts`
2. Validate auth (unless intentionally public)
3. Rate limit sensitive endpoints
4. Add to API documentation if external-facing

## Step 3 — Conventions to enforce

### Supabase client usage
```typescript
// Server components / server actions
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Client components
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
```

### Auth pattern in server actions
```typescript
"use server"
import { createClient } from '@/lib/supabase/server'

export async function myAction(input: MyInput) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Unauthorized' }

  // Get user's organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.active_organization_id) return { error: 'No active organization' }

  // Business logic here, always scoped by organization_id
}
```

### Zustand store pattern
```typescript
import { create } from 'zustand'

interface MyStore {
  items: Item[]
  loading: boolean
  loadItems: () => Promise<void>
}

export const useMyStore = create<MyStore>((set) => ({
  items: [],
  loading: false,
  loadItems: async () => {
    set({ loading: true })
    const result = await myServerAction()
    if (!result.error) set({ items: result.data })
    set({ loading: false })
  },
}))
```

## Step 4 — Style enforcement
- Use Tailwind v4 utilities. Theme tokens from `globals.css`.
- Dark theme is default. Test both themes.
- Follow `docs/STYLE_GUIDE.md` for component styling.
- Use `.widget-glass` for dashboard cards.
- Use `.font-display` for page titles.
- Use `.btn-micro` for interactive buttons.

## Step 5 — Verification
1. `pnpm build` — zero errors
2. `pnpm lint` — passes
3. `pnpm test` — affected tests pass
4. Visual check on dev server
5. Mobile responsive check (375px, 768px, 1440px)

## Step 6 — INCOMPLETE trails
- Any unimplemented routes, actions, or components must include `INCOMPLETE:` comments.
- Any features gated behind missing API keys: `INCOMPLETE:BLOCKED(<KEY>)`.
