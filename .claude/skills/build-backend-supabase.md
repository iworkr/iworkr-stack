---
name: build-backend-supabase
description: Design and implement Supabase schema, RLS policies, Edge Functions, and CRON/job architecture for iWorkr with security-first defaults, multi-tenancy, and clear verification.
---

# Supabase Backend Skill — iWorkr

## Architecture principles (from PRD-Backend.md)
1. **Multi-tenancy first** — every functional table has `organization_id`. RLS enforces isolation.
2. **Polar.sh is billing source of truth** — `subscriptions` table is a read-cache, never write-master.
3. **Modular schema** — Core (auth/billing/org) + Modules (business logic). Adding a module only requires tables + RLS.
4. **Edge-compute** — Heavy logic runs in Supabase Edge Functions (Deno). Secrets never leave server.
5. **Realtime by default** — Tables with live UI state have Realtime enabled.
6. **Audit everything** — State-changing operations log to `audit_log`.
7. **Soft deletes** — Critical entities use `archived_at`. Hard deletes for ephemeral data only.

## Step 1 — Model the data

### Table conventions
- UUIDs for primary keys: `gen_random_uuid()`
- All timestamps: `timestamptz` defaulting to `now()`
- Required columns for every functional table:
  - `id uuid primary key default gen_random_uuid()`
  - `organization_id uuid not null references organizations(id)`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Use existing enums from `supabase/migrations/002_enums.sql` where applicable.
- Add new enums in a new migration if needed.

### Migration naming
- Sequential: `NNN_description.sql` (e.g., `062_add_fleet_tracking.sql`)
- Check `supabase/migrations/` for the next available number.
- Never modify deployed migrations — create new ones.

### Relationships
- Foreign keys with `on delete cascade` for child records.
- Foreign keys with `on delete set null` for optional references.
- Indexes on frequently queried columns: `organization_id`, `status`, `created_at`.

## Step 2 — Security-first (RLS)

### RLS template for every new table
```sql
alter table public.my_table enable row level security;

-- SELECT: org members can read their org's data
create policy "my_table_select" on public.my_table
  for select using (
    organization_id in (
      select organization_id from public.members
      where user_id = auth.uid()
    )
  );

-- INSERT: org members can insert for their org
create policy "my_table_insert" on public.my_table
  for insert with check (
    organization_id in (
      select organization_id from public.members
      where user_id = auth.uid()
    )
  );

-- UPDATE: org members can update their org's data
create policy "my_table_update" on public.my_table
  for update using (
    organization_id in (
      select organization_id from public.members
      where user_id = auth.uid()
    )
  );

-- DELETE: org admins/owners can delete
create policy "my_table_delete" on public.my_table
  for delete using (
    organization_id in (
      select organization_id from public.members
      where user_id = auth.uid()
      and role in ('owner', 'admin')
    )
  );
```

### RLS helpers
- Use functions from `007_core_rls_helpers.sql` for common patterns.
- Test with different user contexts: anon (should fail), auth user in org (should succeed), auth user in different org (should fail).

## Step 3 — Edge Functions

### Existing functions (20 total)
Located in `supabase/functions/`. Key ones:
- `automation-worker` — executes automation actions
- `create-terminal-intent` — Stripe Terminal payment intents
- `polar-webhook` — Polar.sh billing webhooks
- `stripe-webhook` — Stripe payment webhooks
- `resend-webhook` — email delivery webhooks
- `revenuecat-webhook` — mobile subscription webhooks
- `process-mail` — inbound email processing
- `process-sync-queue` — integration sync worker
- `send-push` — push notification delivery
- `generate-pdf` — PDF generation

### New function conventions
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate input
    const body = await req.json()
    // ... business logic ...

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

## Step 4 — Jobs / CRON architecture

### Existing patterns
- **Automation cron**: `/api/automation/cron` endpoint processes deferred actions, overdue invoices, schedule reminders. Called every 5–15 minutes.
- **Edge function workers**: `automation-worker`, `process-sync-queue`, `run-automations` for background processing.
- **pg_cron / pg_net**: Available via Supabase extensions for database-level scheduling.

### New job conventions
- Jobs must be **idempotent** — safe to retry.
- Log job runs: start time, end time, result, error (if any).
- Use `supabase/functions/` for complex background work.
- Use `/api/` cron routes for lighter periodic checks.
- Rate limit job execution to prevent thundering herd.

## Step 5 — Verification
1. Run `supabase db reset` — all migrations apply cleanly.
2. Run test queries against local Supabase (Studio at `localhost:54323`).
3. Test RLS: query as different users/roles.
4. Test Edge Functions: `supabase functions serve` + sample payloads.
5. Document required env keys in `.env.local.example`.
6. Provide sample seed data if adding new tables.

## Step 6 — INCOMPLETE trails
- Any missing RLS policy: `-- INCOMPLETE:PARTIAL — Missing UPDATE/DELETE policies`
- Any stubbed Edge Function: `// INCOMPLETE:PARTIAL — Handler scaffolded; business logic pending`
- Any missing index: `-- INCOMPLETE:TODO — Add index on (organization_id, status) for query performance`
