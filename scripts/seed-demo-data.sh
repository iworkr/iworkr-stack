#!/usr/bin/env bash
# ============================================================
# iWorkr — Seed Demo Data
# Run AFTER a user has signed up and completed onboarding.
# Usage: bash scripts/seed-demo-data.sh
# ============================================================

set -euo pipefail

SUPABASE_TOKEN="${SUPABASE_TOKEN:?Error: SUPABASE_TOKEN environment variable is required}"
SUPABASE_PROJECT="${SUPABASE_PROJECT:?Error: SUPABASE_PROJECT environment variable is required}"
API_URL="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT}/database/query"

echo "Running seed data on Supabase..."

SEED_SQL=$(python3 -c "
import json
with open('supabase/seed.sql') as f:
    sql = f.read()
print(json.dumps({'query': sql}))
")

RESULT=$(echo "$SEED_SQL" | curl -s -X POST \
  -H "Authorization: Bearer ${SUPABASE_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API_URL}" \
  -d @-)

echo "$RESULT"

echo ""
echo "Verifying row counts..."

curl -s -X POST \
  -H "Authorization: Bearer ${SUPABASE_TOKEN}" \
  -H "Content-Type: application/json" \
  "${API_URL}" \
  -d '{"query": "SELECT tablename, (xpath('\''/row/count/text()'\'', query_to_xml(format('\''SELECT count(*) FROM public.%I'\'', tablename), true, false, '\'''\'')))[1]::text::int AS count FROM pg_tables WHERE schemaname = '\''public'\'' ORDER BY tablename;"}' 2>&1 | python3 -c "
import json, sys
rows = json.load(sys.stdin)
total = 0
for r in rows:
    c = r.get('count', 0) or 0
    total += int(c)
    if int(c) > 0:
        print(f'  ✓ {r[\"tablename\"]:<30} {c} rows')
    else:
        print(f'  · {r[\"tablename\"]:<30} {c} rows')
print(f'')
print(f'  Total: {total} rows')
" 2>/dev/null || echo "  (Unable to parse counts)"

echo ""
echo "Done! Sign in at https://iworkrapp.com to see your data."
