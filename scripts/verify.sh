#!/usr/bin/env bash
# Run every test and build in the repo. Any agent can run this to check the whole system.
# Usage: scripts/verify.sh [--quick]   (--quick skips the npm installs and Next/Expo builds)
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
QUICK=${1:-}
PY=${PYTHON:-python3}
results=()
step() { # name, command
  echo -e "\n=== $1"
  if (cd "$ROOT" && bash -c "$2"); then results+=("PASS  $1"); else results+=("FAIL  $1"); fi
}

step "zfactory tests + handoff check" "$PY -m pytest -q && PYTHONPATH=src $PY -m zfactory handoff check"
step "Mahn-Agent tests" "cd apps/mahn-agent && $PY -m pytest -q"
if command -v npm >/dev/null; then
  step "ZAIN LABS content check" "cd apps/zainlabs/content && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm run check"
  if [ "$QUICK" != "--quick" ]; then
    step "ZAIN LABS website typecheck + build" "cd apps/zainlabs/web && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npx tsc --noEmit && npx next build"
    step "ZAIN LABS app typecheck + web export" "cd apps/zainlabs/mobile && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npx tsc --noEmit && EXPO_OFFLINE=1 CI=1 npx expo export --platform web --output-dir /tmp/zainlabs-mobile-export"
  fi
else
  results+=("SKIP  Node projects (npm not installed)")
fi

echo -e "\n=== Summary"
printf '%s\n' "${results[@]}"
! printf '%s\n' "${results[@]}" | grep -q '^FAIL'
