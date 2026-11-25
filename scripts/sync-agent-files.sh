#!/usr/bin/env bash
# Copy AGENTS.md to CLAUDE.md and GEMINI.md everywhere an AGENTS.md exists, so every agent reads the same rules.
set -euo pipefail
cd "$(dirname "$0")/.."
find . -name AGENTS.md -not -path "*/node_modules/*" | while read -r f; do
  d=$(dirname "$f")
  cp "$f" "$d/CLAUDE.md"
  cp "$f" "$d/GEMINI.md"
  echo "synced $d"
done
