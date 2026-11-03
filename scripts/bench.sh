#!/usr/bin/env bash
# Run the benchmark: pilot by default, full with --full, real models with --real.
# Requires a running Bifrost gateway (scripts/dev-bifrost.sh) and keys in the env.
set -euo pipefail
MODE="${1:---pilot}"
shift || true
exec node apps/cli/src/main.ts bench "$MODE" "$@"
