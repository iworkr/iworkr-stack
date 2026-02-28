# Security Rules — iWorkr

## Secrets management
- Never hardcode secrets in source code.
- All secrets in `.env.local` (local) or Vercel environment variables (production).
- `.env.local.example` documents required keys with placeholder values — never real secrets.
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) is **server-only**. Never prefix with `NEXT_PUBLIC_`.
- Stripe secret key is **server-only**. Only the publishable key is public.

## Authentication
- All authenticated endpoints verify the user via `supabase.auth.getUser()`.
- Never trust client-supplied user IDs — always derive from the JWT.
- API routes that accept external webhooks must validate signatures (Stripe, Polar, Resend, RevenueCat).
- Public endpoints (quote accept/decline, invoice view) use secure tokens, not user IDs.

## Row Level Security (RLS)
- **Every table** must have RLS enabled — no exceptions.
- Policies enforce `organization_id` scoping: users can only access data belonging to their org.
- Use the helper functions in `supabase/migrations/007_core_rls_helpers.sql`.
- When adding a new table: create INSERT, SELECT, UPDATE, DELETE policies immediately.
- Test RLS by querying as different roles (anon, authenticated, service_role).

## Multi-tenancy
- All business data is scoped by `organization_id`.
- Data isolation is enforced at the database level (RLS), not the application level.
- Cross-org queries are only allowed via service_role key in edge functions for admin operations.

## Input validation
- Validate all inputs with Zod schemas in server actions.
- Sanitize user-generated content before rendering (XSS prevention).
- Rate-limit sensitive endpoints (see `src/lib/rate-limit.ts`).

## HTTP security headers (configured in `next.config.ts`)
- `X-Frame-Options: DENY`
- Content Security Policy with allowlists for Supabase, Stripe, Google Maps
- `Strict-Transport-Security` enabled
- `Permissions-Policy` configured
- `X-Content-Type-Options: nosniff`

## Edge Functions
- Validate all inputs before processing.
- Use `Deno.env.get()` for secrets — never hardcode.
- CORS headers must be explicit — don't use `*` in production.
- Webhook handlers must verify signatures before processing payloads.

## File uploads
- Storage bucket policies enforce org-scoped access.
- File size limit: 50MiB (configured in `supabase/config.toml`).
- Validate file types before upload.

## Audit logging
- All destructive or state-changing operations are logged to `audit_log` table.
- Log includes: action type, actor, entity, old/new values, timestamp.
- Audit log is append-only — no UPDATE or DELETE policies for users.

## Dependencies
- Keep dependencies updated. Audit with `pnpm audit` regularly.
- Prefer well-maintained, widely-used packages.
- Review new dependencies for security before adding.
