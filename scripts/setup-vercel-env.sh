#!/usr/bin/env bash
# ============================================================
# iWorkr — Set Vercel Environment Variables
# Run: bash scripts/setup-vercel-env.sh
# Requires: vercel CLI authenticated (run `vercel login` first)
# Copy to setup-vercel-env.local.sh and fill in real values; never commit secrets.
# ============================================================

set -euo pipefail

PROJECT="iworkr-stack"
TEAM="aiva-io"

echo "Setting environment variables for $PROJECT..."
echo ""

# Helper to set an env var
set_env() {
  local key="$1"
  local value="$2"
  local target="${3:-production preview development}"
  
  echo "  → $key ($target)"
  
  # Remove existing (ignore if not found)
  for t in $target; do
    echo "$value" | npx vercel env rm "$key" "$t" --yes 2>/dev/null || true
  done
  
  # Add new
  for t in $target; do
    echo "$value" | npx vercel env add "$key" "$t" 2>/dev/null || true
  done
}

# ── Site Configuration ──
set_env "NEXT_PUBLIC_SITE_URL" "https://iworkrapp.com"
set_env "NEXT_PUBLIC_SITE_NAME" "iWorkr"
set_env "NEXT_PUBLIC_APP_URL" "https://iworkrapp.com"

# ── Supabase (set in Vercel or use .env.local values) ──
set_env "NEXT_PUBLIC_SUPABASE_URL" "${NEXT_PUBLIC_SUPABASE_URL:?Error: NEXT_PUBLIC_SUPABASE_URL environment variable is required}"
set_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?Error: NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required}"
set_env "SUPABASE_SERVICE_ROLE_KEY" "${SUPABASE_SERVICE_ROLE_KEY:?Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required}"

# ── Polar.sh ──
set_env "POLAR_ACCESS_TOKEN" "${POLAR_ACCESS_TOKEN:-}"
set_env "POLAR_WEBHOOK_SECRET" "${POLAR_WEBHOOK_SECRET:-}"
set_env "POLAR_ORGANIZATION_ID" "${POLAR_ORGANIZATION_ID:-}"
set_env "POLAR_SUCCESS_URL" "https://iworkrapp.com/dashboard?checkout=success&checkout_id={CHECKOUT_ID}"

# ── Email (Resend) ──
set_env "ADMIN_EMAIL" "${ADMIN_EMAIL:?Error: ADMIN_EMAIL environment variable is required}"
set_env "RESEND_API_KEY" "${RESEND_API_KEY:-}"

# ── Google Maps ──
set_env "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" "${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:-}"

# ── OpenAI (optional) ──
set_env "OPENAI_API_KEY" "${OPENAI_API_KEY:-}"

echo ""
echo "✓ All environment variables set!"
echo ""
echo "Set real secrets via: export VAR=value before running, or in Vercel dashboard."
echo "Now deploy:"
echo "  npx vercel --prod"
