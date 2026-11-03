# BUILD STATUS

**Project:** Gidorah, the governed coding agent.
**Brief:** autonomous build from the docs in `docs/` (Draft v0.6).
**Started:** 2026-11-03T03:23+05:30 (Asia/Calcutta).
**Last updated:** 2026-11-03, final state.

## Milestones

| Milestone | State | Notes |
|---|---|---|
| M0 Groundwork | DONE (offline scope) | Env audited, licenses recorded, build scaffolded, spikes replaced by mock equivalents |
| M1 Backbone | DONE | workspace, Bifrost client + mock gateway/providers, Tavily mock + cache, session JSONL, doctor |
| M2 Agent spine | DONE | loop, 10 tools, patch-first edit, approvals, resume, plain renderer |
| M3 Policy + dual plane | DONE | classification, keys, budget/402, confidential zero-egress, phase routing, Scout, Docs Guard, CT-01..CT-40 |
| M4 Evidence and security | DONE | flight recorder, benchmark harness + pilot, DLP, audit chain, redteam, context economics, CLI contract, TUI panels (plain) |
| M4.5 Upgrades | PARTIAL | complexity-router and cache arms modeled in benchmark; Code Mode arm CUT (no real Bifrost), docs index stretch CUT |
| M5 Demo and submission | DONE (offline) | replay, chaos, demo, LICENSE/NOTICE, README, BUILD_REPORT, final scan |

## Verification (final run, 2026-11-03)

| Command | Result |
|---|---|
| node scripts/build.ts | PASS (8 entrypoints) |
| node scripts/lint.ts | PASS (66 files, 0 failures) |
| node scripts/typecheck.ts | PASS (tsc 7.0.2 strict, 0 errors) |
| node scripts/run-tests.ts | PASS (104 tests) |
| gidorah doctor | PASS (mock mode; real deps PENDING) |
| gidorah demo --replay | PASS offline |
| gidorah audit verify --all | PASS (chain valid) |
| gidorah conformance | PASS 40/40 |
| gidorah chaos | PASS 5/5 |
| gidorah redteam | PASS 20/20 blocked, canary 0 |
| gidorah bench --pilot | PASS (12 rows, 12 solved, mock model) |

## Committed evidence

- `tests/replay/demo.jsonl` - recorded demo trace for offline replay.
- `bench/run_mvztjgwg/{raw.jsonl,report.md,manifest.json,traces/}` - pilot benchmark artifacts.
- `tests/conformance/conformance.test.ts` - CT-01..CT-40.

## PENDING (never fabricated)

| Item | Why | Unblock |
|---|---|---|
| Real Bifrost / DeepSeek / Ollama / Tavily results | no keys, no services | MORNING_RUNBOOK.md |
| Real benchmark (model quality, real spend) | above | `bench --pilot`, inspect rows, then `bench --full` |
| Go plugin compile/vet/test | DONE: Go 1.27.3, vet clean, tests pass | real SDK binding |
| DSH TUI vendoring | package not fetchable offline | network + license copy |
| Bundled dist artifacts | tsdown not installed | registry install |

## Deviations

ADR-0013 (dependency-free runtime, node:test, node:sqlite, custom scripts), ADR-0014 (plain TUI first), ADR-0015 (mock-first evidence, repo-local `.gidorah` fallback). Documented in docs/05-decisions/README.md.

## Next actions

1. Run MORNING_RUNBOOK.md sections 2-4 with keys.
2. Replace PENDING rows here and in BUILD_REPORT.md with real command output.
3. Bind the plugin to the real Bifrost SDK and vendor the DSH TUI.

## Toolchain installed during this session (2026-11-03, post-build)

| Tool | Version | State |
|---|---|---|
| Go | 1.27.3 windows/amd64 | Installed in `.tools/go`; `go vet ./...` and `go test ./...` pass for `plugins/bifrost-dlp` |
| pnpm | 12.16.1 standalone | Installed in `.tools/pnpm`; `pnpm run build/lint/typecheck/test` all pass. `pnpm install` is blocked by the sandbox (store operation lock outside the workspace), so dependencies were installed with `npm install` and are present in `node_modules` |
| Bifrost gateway | npm 1.6.3 wrapper, http binary 2.4.0 | Installed; binary download/resume and gateway startup being finalized |
| Ollama | 0.40.13 | Download in progress (1.5 GB Windows zip); model pull next |
| TypeScript | 7.0.2 + @types/node 26.6.6 | Installed; strict typecheck green |

All toolchains are in `.tools/` (gitignored) except the npm-installed `node_modules`. Nothing in this table changes a PENDING claim about real provider calls: those still need `DEEPSEEK_API_KEY` and `TAVILY_API_KEY`.

## Post-build toolchain install and real-service verification (2026-11-03, 11:10-12:20 IST)

The user asked to download and install whatever was needed. This session installed real toolchains and ran real services, not just mocks.

### Installed (all under `.tools/`, gitignored)

| Tool | Version | State |
|---|---|---|
| Go | 1.27.3 windows/amd64 | verified: `go vet ./...` exit 0, `go test ./...` -> `ok github.com/gidorah/bifrost-dlp 4.782s` |
| pnpm | 12.16.1 standalone | `pnpm run build/lint/typecheck/test` pass; `pnpm install` is blocked by the sandbox (symlink/EPERM), dependencies are installed with npm |
| Bifrost | 2.4.0, built from source (`transports/bifrost-http`) | running: `successfully started bifrost, serving UI on http://localhost:8080/`; built because the npm CDN was throttled to ~0.6 MB/min |
| Ollama | 0.40.13 (Windows zip) | installed and running on 127.0.0.1:11434 (`/api/version` -> 200) |
| TypeScript | 7.0.2 + @types/node 26.6.6 | strict `tsc --noEmit` passes |

### Real evidence captured

`evidence/real-services-2026-11-03.json` (redacted local key):

- Bifrost root serves HTML (200).
- A chat completion sent with the real virtual key `gidorah-local` is routed by Bifrost to provider `ollama`; response headers include `x-bifrost-routing-info-provider: ollama`, `x-bifrost-routing-info-model: qwen2.5-coder:0.5b`, `x-bifrost-routing-info-key: ollama-local`, `x-bifrost-trace-id`, `x-bifrost-upstream-latency-ms: 36.255`.
- The request reached the real Ollama server (it answered, 404 `model 'qwen2.5-coder:0.5b' not found` because the weights are not downloaded).
- So the real path `Gidorah Bifrost client -> real Bifrost -> real Ollama` is verified up to model availability. Real inference is the only remaining gap.

### Model weights (resolved)

`qwen2.5-coder:0.5b` is installed (397,821,516 bytes, digest verified). Ollama's CDN stalled at 95 percent, so the remaining tail was completed with one range request to the registry blob URL and the blob was moved into place; `ollama pull` then verified the digest and reported success. Real inference through real Bifrost and real Ollama now works. Quality note: 0.5b output is largely gibberish, so 3B or larger weights remain the recommendation for the demo.

### Bifrost configuration notes (needed for a rerun)

- `--app-dir .tools/bifrost-app` needs a BOM-free `config.json`; PowerShell `Set-Content` writes a BOM that Bifrost rejects, use Node or `UTF8Encoding(false)`.
- Bifrost fatals on startup when it cannot reach `https://getbifrost.ai/datasheet` and `.../model-parameters`. Fixed by serving local `{}` datasheets (`.tools/datasheet-server.mjs`, port 8099) and setting `framework.pricing.pricing_url` and `framework.pricing.model_parameters_url` to those local URLs.
- The virtual key value in the config lacked the `sk-bf-` prefix, so Bifrost generated one; it can be read from `config.db` table `governance_virtual_keys` column `value`.
- The `/api` dashboard surface is 403 until `setup_token` is configured; the OpenAI-compatible chat endpoint works with the virtual key.

### Still PENDING

Real DeepSeek and Tavily calls (no keys), Ollama model weights and inference (CDN blocked), the Go plugin binding to the real Bifrost plugin SDK (build/test of the plugin itself is verified), DSH TUI vendoring, and `pnpm install` under this sandbox.
### Final real-run results (12:30-12:55 IST)

- `ollama pull` -> `verifying sha256 digest` then `success`; `/api/tags` shows `qwen2.5-coder:0.5b` (397,821,516 bytes).
- Gidorah's own `createBifrostClient` completed against real Bifrost: served `ollama/qwen2.5-coder:0.5b`, 47 tokens, finish `length`.
- Streaming through Gidorah's client also works. This exposed a real bug: Bifrost keeps the SSE connection open after `[DONE]`, so the client parser now stops on `[DONE]` instead of waiting for EOF.
- A real CLI session ran: `gidorah run "Say hi ..." --yes` with `GIDORAH_MODE=cloud`, the real gateway, and `GIDORAH_MODEL_ALIAS=ollama/qwen2.5-coder:0.5b`. Receipt: success, 243 tokens. The session hash chain verified valid (7 events). Evidence: `evidence/real-services-2026-11-03.json`.
- New documented overrides: `GIDORAH_MODEL_ALIAS` (provider-qualified model for real gateways) and `GIDORAH_MAX_TOKENS` (required with the tiny model; without a token cap it streams indefinitely and non-streaming requests hang).
- Still PENDING: DeepSeek and Tavily keys, 3B+ model quality, Go plugin binding to the real Bifrost SDK, DSH TUI vendoring, `pnpm install` under this sandbox.
## Real Fireworks cloud runs, Tavily, and a real coding task (13:25-13:50 IST)

The user supplied a Tavily key and a Fireworks AI key. Fireworks replaces the DeepSeek key: it is OpenAI-compatible and Bifrost has a native `fireworks` provider.

### What was verified with real credentials

- Bifrost configured with the native `fireworks` provider (`x-bf` cloud key `gidorah-cloud`), plus the existing local Ollama provider. Model list includes `accounts/fireworks/models/deepseek-v4p1-flash`, `qwen3p8-max`, `glm-5p3`.
- Real completion through Bifrost: HTTP 200 in ~1s, routing header `x-bifrost-routing-info-provider: fireworks`, content `ready`.
- Real Gidorah CLI session on the Fireworks model: coherent reply "Hi! I'm Gidorah, ready to help with your terminal coding tasks.", 234 tokens, hash chain valid.
- Real Tavily through Gidorah's Scout (`packages/tavily/src/client.ts`, new real HTTP client): a Stripe webhook question produced a 332-token evidence card with 6 facts and 3 sources (`docs.stripe.com`, `github.com`), high confidence, 1 credit; the repeat call was a cache hit at 0 credits. Usage ledger recorded 1 call, 1 credit.
- **Real coding task**: a fixture repo with a failing test was handed to Gidorah running the Fireworks model. The model used the tools, patched `math.js` from `n + 100` to `n * 100`, and the test went from 1 failing to 1 passing. Evidence: `evidence/real-coding-task-2026-11-03.json` (session events, tool calls, chain validity).

### Code changes required for real models

- The agent request now advertises workspace tool schemas (`tools` + `tool_choice: auto`) to the model. Without this, a real model could never call a tool; the mock provider had hidden the gap.
- New real Tavily HTTP client (`createTavilyClient`) using Bearer auth, cheap search depth, `chunks_per_source: 2`, no raw page content, extract limited to chosen URLs.

### Credential hygiene

Keys are stored only in `.tools/credentials.env` (gitignored) and passed as environment variables. They are not in the repo, the evidence files, or the session logs. Because both keys were pasted into a chat message, rotate them when the demo work is done.

### Still PENDING

Real benchmark numbers with the benchmark harness (the harness still uses its scripted model; wiring it to Bifrost is the next step), the 3B local model import (GGUF downloading), Go plugin binding to the real Bifrost SDK, DSH TUI vendoring, and `pnpm install` in sandboxed environments.