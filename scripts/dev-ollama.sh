#!/usr/bin/env bash
# Start Ollama and pull the local coding model used for confidential mode.
set -euo pipefail
MODEL="${OLLAMA_MODEL:-qwen2.5-coder:3b}"
if ! command -v ollama >/dev/null 2>&1; then
  echo "ollama is not installed: https://ollama.com/download" >&2
  exit 1
fi
ollama serve &
sleep 2
ollama pull "$MODEL"
echo "Ollama running on ${OLLAMA_URL:-http://127.0.0.1:11434} with $MODEL"
