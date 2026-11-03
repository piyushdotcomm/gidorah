#!/usr/bin/env bash
# Start Bifrost locally for development (pin the version in the submission).
set -euo pipefail
PORT="${BIFROST_PORT:-8080}"
APP_DIR="${BIFROST_APP_DIR:-$PWD/.gidorah/bifrost}"
mkdir -p "$APP_DIR"
exec npx -y @maximhq/bifrost --app-dir "$APP_DIR" --port "$PORT"
