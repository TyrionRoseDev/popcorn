#!/usr/bin/env bash
# One command: explores every interleaving of concurrent achievement evaluations
# against the real src/lib/evaluate-achievements.ts. No database, no network.
# Uses the repo's own pinned vitest (bun.lock); needs `bun install` once.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
cd "$REPO_ROOT"
exec bunx --bun=false vitest run --config "$SKILL_DIR/vitest.config.ts" --reporter=verbose "$@"
