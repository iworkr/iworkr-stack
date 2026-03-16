#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_FILE="${1:-$ROOT_DIR/supabase/tests/pgtap/panopticon_rls.sql}"

if [[ ! -f "$TEST_FILE" ]]; then
  echo "pgTAP file not found: $TEST_FILE"
  exit 1
fi

pushd "$ROOT_DIR" >/dev/null

SUPABASE_CMD="supabase"
if ! command -v supabase >/dev/null 2>&1; then
  SUPABASE_CMD="npx supabase"
fi

wait_for_local_supabase() {
  local attempts=0
  local max_attempts=30

  until python3 - <<'PY'
import json
import sys
import urllib.request

url = "http://127.0.0.1:54321/rest/v1/"
req = urllib.request.Request(url, method="GET")
req.add_header("apikey", "test")
try:
    with urllib.request.urlopen(req, timeout=2) as resp:
        sys.exit(0 if 200 <= resp.status < 500 else 1)
except Exception:
    sys.exit(1)
PY
  do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge "$max_attempts" ]]; then
      echo "Supabase local API did not become healthy in time."
      return 1
    fi
    sleep 2
  done
}

retry_db_reset() {
  local tries=0
  local max_tries=3
  while true; do
    if "$SHELL" -lc "${SUPABASE_CMD} db reset --local --no-seed >/dev/null"; then
      return 0
    fi
    tries=$((tries + 1))
    if [[ "$tries" -ge "$max_tries" ]]; then
      echo "Supabase db reset failed after ${max_tries} attempts."
      return 1
    fi
    sleep 3
  done
}

"$SHELL" -lc "${SUPABASE_CMD} start >/dev/null"
wait_for_local_supabase
retry_db_reset
wait_for_local_supabase

DB_URL="$("$SHELL" -lc "${SUPABASE_CMD} status --output json" | python3 -c 'import json,sys;print(json.load(sys.stdin)["DB_URL"])')"

if [[ -z "$DB_URL" ]]; then
  echo "Could not determine local Supabase DB_URL"
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$TEST_FILE"

popd >/dev/null
