#!/usr/bin/env bash
set -euo pipefail

# Patrol may generate imports stripped of the leading slash for absolute paths.
# Mirror integration_test into patrol_test/<absolute-path-without-leading-slash>/integration_test.
REAL_INTEGRATION_PATH="$(python3 - <<'PY'
import os
print(os.path.realpath("integration_test"))
PY
)"
REAL_PROJECT_PATH="$(dirname "$REAL_INTEGRATION_PATH")"
ALIAS_BASE="patrol_test/${REAL_PROJECT_PATH#/}"

mkdir -p "$ALIAS_BASE"
ln -sfn "$REAL_INTEGRATION_PATH" "$ALIAS_BASE/integration_test"

echo "Prepared Patrol import shim at $ALIAS_BASE/integration_test"
