# Morning runbook (current)

This is the current, verified prerequisite list. Older appendices below describe
earlier states; where they disagree, this section wins.

## Already installed on this machine

- Node 26.13.0 (repo targets Node 22.6+), npm 11 with `package-lock.json`.
- Go 1.27.3 in `.tools/go`; `plugins/bifrost-dlp` passes `go vet` and `go test`
  against the real Bifrost core SDK.
- Bifrost 2.4.0 built from source in `.tools/bifrost-bin`, running on `:8080`.
- Ollama 0.40.13 in `.tools/ollama`, running on `:11434`, with
  `qwen2.5-coder:3b` imported from GGUF.
- TypeScript 7.0.2; `npm run build/lint/typecheck/test` all pass.

## Credentials (Bifrost owns provider keys)

```bash
# Bifrost shell
export FIREWORKS_API_KEY=fw_...
export BIFROST_SETUP_TOKEN=<any local secret>

# Gidorah shell (no provider key here)
export GIDORAH_MODE=cloud
export BIFROST_BASE_URL=http://127.0.0.1:8080/openai
export BIFROST_VK_CLOUD=sk-bf-...
export TAVILY_API_KEY=tvly-...
export GIDORAH_MODEL_ALIAS=fireworks/accounts/fireworks/models/deepseek-v4p1-flash
export GIDORAH_MAX_TOKENS=1500
```

## Start the stack

```bash
node .tools/datasheet-server.mjs
.tools/ollama/ollama.exe serve
.tools/bifrost-bin/bifrost-http.exe --app-dir .tools/bifrost-app --port 8080
node apps/cli/src/main.ts doctor
```

## Gates

```bash
npm ci && npm run build && npm run lint && npm run typecheck && npm test
node apps/cli/src/main.ts conformance
node apps/cli/src/main.ts chaos
node apps/cli/src/main.ts audit verify --all
node apps/cli/src/main.ts redteam
node apps/cli/src/main.ts demo --replay
node apps/cli/src/main.ts bench --real --pilot
node apps/cli/src/main.ts bench --real --full
```

## Still external

1. Load the Go plugin into a Linux Bifrost (`-buildmode=plugin`) for live
   gateway DLP and canary evidence.
2. Record the 3-minute demo, add slides, star the Bifrost repo.
3. Rotate the keys shared in chat and the local `sk-bf-` dev key.