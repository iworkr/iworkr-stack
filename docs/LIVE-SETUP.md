# iWorkr Live Setup Guide

Complete steps to go live with Supabase + Polar.sh billing.

---

## 1. Run Database Migrations

Your Supabase project (`iaroashargzwsuuciqox`) uses IPv6-only direct connections. Run the bundled migration through the **Supabase Dashboard SQL Editor**.

1. Go to: **https://supabase.com/dashboard/project/iaroashargzwsuuciqox/sql/new**
2. Copy the contents of `supabase/migrations/BUNDLED_ALL_MIGRATIONS.sql`
3. Paste and click **Run**

This creates all core tables, enums, RLS policies, and helper functions.

---

## 2. Get Supabase API Keys

1. Go to: **https://supabase.com/dashboard/project/iaroashargzwsuuciqox/settings/api**
2. Copy these values:
   - **Project URL**: `https://iaroashargzwsuuciqox.supabase.co`
   - **anon (public) key**: `eyJ...`
   - **service_role (secret) key**: `eyJ...`

---

## 3. Set Vercel Environment Variables

Go to: **Vercel Dashboard → iWorkr project → Settings → Environment Variables**

Add these (for **Production**, **Preview**, and **Development** scopes):

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://iworkrapp.com` | Primary domain |
| `NEXT_PUBLIC_SITE_NAME` | `iWorkr` | |
| `NEXT_PUBLIC_APP_URL` | `https://iworkrapp.com` | |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iaroashargzwsuuciqox.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (from step 2) | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (from step 2) | Secret — server only |
| `POLAR_ACCESS_TOKEN` | `polar_oat_3J47yJELxt78ZhU9Aczh8tiLtLr4pRk4KGvPM0t29k0` | Secret |
| `POLAR_WEBHOOK_SECRET` | (from step 4 below) | Secret |
| `POLAR_ORGANIZATION_ID` | `dd117984-3a0f-4b5a-8137-6e4d51bcac37` | |
| `POLAR_SUCCESS_URL` | `https://iworkrapp.com/dashboard?checkout=success&checkout_id={CHECKOUT_ID}` | |
| `ADMIN_EMAIL` | `admin@iworkrapp.com` | Reply-to for emails |
| `RESEND_API_KEY` | `re_6qBZsHDx_AR2p8RPWw6KsFrwvXimsPS2s` | Secret |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `AIzaSyCm2qIL3j_gV4SuQC3ycetFsNVX-NsWfwo` | Public |
| `OPENAI_API_KEY` | `sk-proj-...` | Secret |

> **To change the domain later**: update `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `POLAR_SUCCESS_URL`, and the Polar webhook URL.

---

## 4. Configure Polar.sh Webhook

1. Go to: **https://dashboard.polar.sh/dd117984-3a0f-4b5a-8137-6e4d51bcac37/settings/webhooks**
2. Click **Add Webhook**
3. Set:
   - **URL**: `https://iworkrapp.com/api/webhook/polar`
   - **Events**: `subscription.created`, `subscription.updated`, `subscription.revoked`, `customer.updated`
   - **Secret**: Generate one and copy it
4. Save the webhook secret and add it as `POLAR_WEBHOOK_SECRET` in Vercel (step 3)

---

## 5. Update `.env.local` for Local Development

After getting your Supabase keys, update `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key
POLAR_WEBHOOK_SECRET=whsec_...your-webhook-secret
```

---

## 6. Redeploy

After setting all environment variables in Vercel:

```bash
# Push to trigger redeploy, or:
vercel --prod
```

---

## Architecture

### Checkout Flow
```
User clicks "Start free trial" on pricing/billing page
  → GET /api/checkout?productId=xxx
  → @polar-sh/nextjs creates Polar checkout session
  → User redirected to Polar hosted checkout
  → After payment, redirected to POLAR_SUCCESS_URL
  → Polar fires webhook to /api/webhook/polar
  → Webhook handler updates subscriptions table in Supabase
```

### Polar Product Mapping

| Plan | Product ID | Price ID (Monthly) | Price |
|---|---|---|---|
| Starter | `95b33e16-0141-4359-8d6c-464b5f08a254` | `a70530fd-5055-4477-9bf6-291428d08856` | $47/mo |
| Standard | `7673fa11-335c-4e37-a5cf-106f17202e58` | `5ed03136-ef53-4795-8512-fcae419212a6` | $97/mo |
| Enterprise | `e5ac6ca6-8dfa-4be8-85aa-87c2eac2633e` | `72baea92-875b-4ed1-9ae3-fed6f349f7ad` | $247/mo |

All plans include a **14-day free trial**.

### Changing the Domain

To move from `iworkr-stack.vercel.app` to a custom domain:

1. Update `NEXT_PUBLIC_APP_URL` in Vercel env vars
2. Update `POLAR_SUCCESS_URL` in Vercel env vars
3. Update the webhook URL in Polar Dashboard
4. Update `additional_redirect_urls` in `supabase/config.toml` if using Supabase Auth redirects
5. Redeploy

---

## Files Changed

| File | Purpose |
|---|---|
| `src/app/api/checkout/route.ts` | Polar checkout endpoint (GET) |
| `src/app/api/portal/route.ts` | Polar customer portal (GET) |
| `src/app/api/webhook/polar/route.ts` | Polar webhook handler (POST) |
| `src/lib/plans.ts` | Plan definitions with real Polar product/price IDs |
| `src/lib/billing-store.ts` | Billing state management |
| `src/app/settings/billing/page.tsx` | Billing settings UI |
| `src/components/sections/pricing.tsx` | Landing page pricing CTAs |
| `.env.local` | Local environment config |
| `.env.local.example` | Environment template |
