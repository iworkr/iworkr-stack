#!/usr/bin/env bash
# ============================================================
# iWorkr — Push all migrations to live DB and seed for production
# Usage: from repo root: bash scripts/push-migrations-live.sh
# Requires: SUPABASE_ACCESS_TOKEN (Supabase dashboard → Account → Access Tokens)
# Or run migrations manually: Dashboard SQL Editor → paste BUNDLED_ALL_MIGRATIONS.sql → Run
# ============================================================

set -euo pipefail

read -p "WARNING: This will modify the PRODUCTION database. Type 'yes' to continue: " confirm; if [ "$confirm" != "yes" ]; then echo "Aborted."; exit 1; fi

SUPABASE_TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
PROJECT_ID="${SUPABASE_PROJECT:?Error: SUPABASE_PROJECT environment variable is required}"
API_URL="https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "${SUPABASE_TOKEN}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN not set. Run migrations and seed manually:"
  echo "  1. Dashboard SQL Editor: paste and run supabase/migrations/BUNDLED_ALL_MIGRATIONS.sql"
  echo "  2. Then run supabase/seed/seed.sql and supabase/seed.sql (or set SUPABASE_ACCESS_TOKEN and re-run this script)"
  exit 1
fi

echo "=== 1. Pushing migrations (full bundle) ==="
BUNDLE_JSON=$(python3 -c "
import json
with open('supabase/migrations/BUNDLED_ALL_MIGRATIONS.sql') as f:
    sql = f.read()
print(json.dumps({'query': sql}))
")

RESULT=$(echo "$BUNDLE_JSON" | curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${SUPABASE_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API_URL}" \
  -d @-)

HTTP_CODE=$(echo "$RESULT" | tail -n1)
BODY=$(echo "$RESULT" | sed '$d')

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Migration bundle returned HTTP $HTTP_CODE"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
  echo ""
  echo "If the live DB already has schema, run only new migrations (039–043) in Supabase Dashboard SQL Editor:"
  echo "  https://supabase.com/dashboard/project/${PROJECT_ID}/sql/new"
  exit 1
fi

echo "Migrations applied successfully."
echo ""

echo "=== 2. Seeding base org (seed/seed.sql) ==="
BASE_SEED_JSON=$(python3 -c "
import json
with open('supabase/seed.sql') as f:
    sql = f.read()
print(json.dumps({'query': sql}))
")
echo "$BASE_SEED_JSON" | curl -s -X POST \
  -H "Authorization: Bearer ${SUPABASE_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API_URL}" \
  -d @- | python3 -m json.tool 2>/dev/null || true
echo ""

# WARNING: The following inserts demo data using the first organization found
# (SELECT id FROM public.organizations LIMIT 1). Review before running in production.
echo "=== 3. Seeding demo/production data (seed.sql) ==="
DEMO_SEED_JSON=$(python3 -c "
import json
with open('supabase/seed.sql') as f:
    sql = f.read()
print(json.dumps({'query': sql}))
")
echo "$DEMO_SEED_JSON" | curl -s -X POST \
  -H "Authorization: Bearer ${SUPABASE_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API_URL}" \
  -d @- | python3 -m json.tool 2>/dev/null || true
echo ""

echo "Done. Live DB is up to date and seeded. Sign in at https://iworkrapp.com"
