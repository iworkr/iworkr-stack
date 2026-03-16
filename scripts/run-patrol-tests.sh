#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLUTTER_DIR="$ROOT_DIR/flutter"

TARGET_DEVICE="${1:-iPhone 17}"
TARGET_OS="${2:-26.2}"

echo "=> Bootstrapping Patrol environment..."
cd "$FLUTTER_DIR"
source ./scripts/prepare_patrol_env.sh

export PATH="$HOME/.pub-cache/bin:$PATH"
if ! command -v patrol >/dev/null 2>&1; then
  echo "=> patrol_cli not found, activating..."
  dart pub global activate patrol_cli
fi

resolve_simulator() {
  python3 - "$TARGET_DEVICE" "$TARGET_OS" <<'PY'
import json
import re
import subprocess
import sys

preferred_name = sys.argv[1]
preferred_os = sys.argv[2]

devices_payload = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "--json"]))
runtimes_payload = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "runtimes", "--json"]))

def parse_version(v):
    return tuple(int(x) for x in re.findall(r"\d+", v))

runtime_versions = set()
for runtime in runtimes_payload.get("runtimes", []):
    if not runtime.get("isAvailable", False):
        continue
    if runtime.get("platform") != "iOS":
        continue
    version = runtime.get("version")
    if version:
        runtime_versions.add(version)

if preferred_os not in runtime_versions and runtime_versions:
    preferred_os = sorted(runtime_versions, key=parse_version)[-1]

all_devices = []
for runtime_id, items in devices_payload.get("devices", {}).items():
    if "iOS" not in runtime_id:
        continue
    m = re.search(r"iOS[- ](\d+(?:[-.]\d+)*)", runtime_id)
    if not m:
        continue
    os_version = m.group(1).replace("-", ".")
    for d in items:
        if not d.get("isAvailable", False):
            continue
        all_devices.append({
            "name": d["name"],
            "udid": d["udid"],
            "state": d.get("state", "Shutdown"),
            "os": os_version,
        })

chosen = None
for d in all_devices:
    if d["name"] == preferred_name and d["os"] == preferred_os:
        chosen = d
        break

if chosen is None:
    candidates = [d for d in all_devices if d["name"] == preferred_name]
    if candidates:
        chosen = sorted(candidates, key=lambda x: parse_version(x["os"]), reverse=True)[0]

if chosen is None:
    iphone_candidates = [d for d in all_devices if d["name"].startswith("iPhone")]
    if iphone_candidates:
        chosen = sorted(iphone_candidates, key=lambda x: parse_version(x["os"]), reverse=True)[0]

if chosen is None:
    raise SystemExit("No available iOS simulators found.")

print(f'{chosen["name"]}\t{chosen["os"]}\t{chosen["udid"]}\t{chosen["state"]}')
PY
}

SIM_INFO="$(resolve_simulator)"
IFS=$'\t' read -r RESOLVED_NAME RESOLVED_OS RESOLVED_UDID RESOLVED_STATE <<< "$SIM_INFO"

echo "=> Target simulator: $RESOLVED_NAME ($RESOLVED_OS) [$RESOLVED_UDID]"
if [[ "$RESOLVED_STATE" != "Booted" ]]; then
  echo "=> Booting simulator..."
  xcrun simctl boot "$RESOLVED_UDID" >/dev/null 2>&1 || true
fi
xcrun simctl bootstatus "$RESOLVED_UDID" -b

echo "=> Executing Patrol suite..."
patrol test --ios "$RESOLVED_OS" -d "$RESOLVED_UDID" -t integration_test
