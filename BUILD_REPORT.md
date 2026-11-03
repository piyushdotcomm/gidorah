# Gidorah build report

**Date:** 2026-11-03 (Asia/Calcutta). **Mode:** offline mock-first build, no provider keys.
**Draft:** v0.6 docs implemented as a working repository.

## What was built

A dependency-light TypeScript/Node monorepo that implements the dual-plane control plane from `docs/`:

- `apps/cli` - the full command surface (`run`, `resume`, `doctor`, `budget`, `trace`, `receipt`, `audit`, `redteam`, `demo`, `bench`, `conformance`, `chaos`, `policy`, `config`, `version`), with `--json`, `--plain`, stdout/stderr separation, exit codes, SIGINT handling.
- `apps/tui` - plain `TuiEvent` renderer (status line, transcript, approvals, takeover, research card, DLP notice, Docs Guard) with ANSI/control stripping. DSH TUI vendoring is PENDING.
- `packages/core` - turn/step runtime, approval gate, budget service, 10 tools (patch-first `edit`, `repo_map`, shell lexer-gated `bash`, `git`, `research`), context economics (cap -> clear -> conditional compact), hash-chained session store with resume, audit verify/export and anchoring, red-team corpus plus canary scanner, replay, Docs Guard.
- `packages/bifrost` - OpenAI-compatible client (routing headers, 402/429/503 mapping, streaming), DLP/confidential guard, mock Bifrost gateway (virtual keys, provider allowlists, pre-request budgets with 402, phase routing, aliases, fallbacks with headers, request logs, DLP) and mock DeepSeek/Ollama providers.
- `packages/policy` - YAML policy schema with fail-closed loading, repo classification (path/remote/marker), virtual-key selection, approval classifier, real shell lexer, read-only allowlist.
- `packages/tavily` - Scout with local-first short-circuit, version-aware query builder, 700-token cited evidence cards, SQLite cache (node:sqlite), credit budget, task call cap, graceful outage handling, mock Tavily.
- `packages/benchmark` - 16 task specs (8 Class A, 8 Class B), 7 arms, real loop/tools/context execution with a scripted mock model, metrics, raw JSONL, manifest, report.
- `packages/shared` - types, canonical JSON/hashing, redaction and canary scanning, YAML subset parser, config/paths, JSONL.
- `plugins/bifrost-dlp` - Go plugin source and tests for the confidential guard, 10-class DLP scanner (block/redact, fail closed, class+hash logging) and policy headers. Verified with Go 1.27.3: `go vet` clean and `go test ./...` passes; real Bifrost SDK binding PENDING.
- `config/` - policy, Bifrost providers/keys/routing examples, cloud and confidential profiles.
- `tests/conformance` (CT-01..CT-40), `tests/chaos`, `tests/replay`, `tests/fixtures`.
- Docs: ADR-0013 (offline dependency-free runtime), ADR-0014 (plain TUI first), ADR-0015 (mock-first evidence and honest PENDING), plus README, NOTICE, third-party register, BUILD_STATUS, MORNING_RUNBOOK.

## Commands run and results

Run from `C:\Users\13725\OneDrive\Desktop\gidorah` on Node v26.13.0, Windows 11 sandbox.

| Command | Result |
|---|---|
| `node scripts/build.ts` (`pnpm build`) | PASS: 8 package/app entrypoints load |
| `node scripts/lint.ts` (`pnpm lint`) | PASS: 66 files, 0 failures (no provider SDK/URL egress, no secrets, no skipped tests, honest security language) |
| `node scripts/typecheck.ts` (`pnpm typecheck`) | PASS: tsc 7.0.2 strict `--noEmit`, 0 errors |
| `node scripts/run-tests.ts` (`pnpm test`) | PASS: 104 tests, 0 failures, 0 skipped |
| `node apps/cli/src/main.ts doctor` | PASS: node, git, gidorah home, policy, classification, mock gateway/providers/Tavily; real deps PENDING |
| `node apps/cli/src/main.ts demo --record` then `--replay` | PASS: deterministic scenes recorded and replayed offline |
| `node apps/cli/src/main.ts audit verify --all` | PASS: session hash chain valid |
| `node apps/cli/src/main.ts redteam` | PASS: 20/20 attacks blocked, 0 bypassed, canary egress 0 (mock-mode classifier regression; live egress scan PENDING) |
| `node apps/cli/src/main.ts conformance` | PASS: 40/40 (CT-01..CT-40), offline mocks |
| `node apps/cli/src/main.ts chaos` | PASS: 5/5 (Bifrost kill, Ollama kill in confidential, Tavily kill, network drop, process-kill resume) |
| `node apps/cli/src/main.ts bench --pilot` | PASS: 12 rows, 12 solved, pass@1 100%, cost per solved task $0.000417 (mock scripted model; see validity note) |

## Requirements coverage

All four hackathon behaviors plus both sponsor integrations have automated evidence:

- Failover/takeover: CT-01/02/03 (fallback headers, durable `route/changed`, structured all-fail error).
- Budget: CT-04/05/06 (one 80% warning, 402 authority with local fallback, concurrent no-overspend with admission reservation).
- Confidentiality: CT-07/08/09/28 (local-only key, forged header rejected, zero research/network calls).
- Approvals: CT-10/11/23/24 (bypass prompt still asks, denial never executes, path escape denied, git alias asks).
- Token/context discipline: CT-34 plus benchmark arms; cap-before-compact enforced in `buildContext`.
- DLP: CT-25/26/27 (fake AWS key blocked before upstream, private key blocked, false-positive corpus clean).
- Audit/red team: CT-35/36/37/38/39/40 plus `redteam` (0 bypasses, canary 0).
- Mocks are test doubles; the real-provider versions are PENDING below.

## Conformance results

CT-01..CT-40: **40 passed, 0 failed, 0 skipped** (`tests/conformance/conformance.test.ts`).

## Benchmark results (pilot)

- Mode: mock-model harness measurement (real model quality NOT measured).
- Pilot: 3 tasks x 4 arms (A always-Pro, C cascade, D full dual-plane, F always-Flash) x 1 run = 12 rows.
- pass@1 = 100%; 12 solved / 12 evaluated; cost per solved task = $0.000417 (mock price table); 14,496 tokens; 48 model requests; 0 missing/errored rows.
- Per-arm table, raw JSONL, manifest, and per-row trace records: `bench/run_mvztjgwg/report.md`, `raw.jsonl`, `manifest.json`, `traces/`.
- Full 16-task run: not executed in this build (honest scope reduction, recorded in BUILD_STATUS).

## Audit and red-team results

- Audit: hash chain valid; tamper fixture fails at the edited event (CT-36); export redacted (CT-39); anchor head written (CT-40).
- Red team: 20 corpus attacks, 20 blocked, 0 bypassed, canary egress 0 in mock mode.
- Limitation: mock mode performs no real egress, so live canary scanning is PENDING with real providers.

## Demo and replay results

- `demo --record` produced a deterministic trace with 5 scenes: approvals (read/allow, write/deny), confidential injection + DLP block + local model served, 429 fallback with takeover banner, cited research card, budget warning + receipt.
- `demo --replay` renders the committed trace offline with no network.

## Deviations and ADRs

- ADR-0013: dependency-free runtime; Node type stripping, `node:test`, `node:sqlite`; custom lint/typecheck/build scripts; file-redirected subprocess capture.
- ADR-0014: plain TUI renderer first; DSH TUI vendoring deferred.
- ADR-0015: mock-first evidence with honest PENDING; runtime data falls back to repo-local `.gidorah` when `GIDORAH_HOME` is unset.
- TypeScript toolchain was installed mid-build from a local npm cache after a Node fetch probe succeeded; real `tsc` strict typecheck now passes.

## Blockers and pending items

| Item | Status | Unblock |
|---|---|---|
| Real Bifrost budget/fallback/logs | PENDING | run Bifrost 8080 + virtual keys (MORNING_RUNBOOK) |
| Real Ollama confidential mode | PENDING | install Ollama + 3B model |
| Real Tavily evidence | PENDING | TAVILY_API_KEY |
| Real DeepSeek Flash/Pro | PENDING | DEEPSEEK_API_KEY in Bifrost |
| Real benchmark numbers (model quality) | PENDING | keys + budget; run `bench --pilot` then `--full` |
| Go plugin compile/vet/test | DONE: Go 1.27.3, `go vet` clean, `go test` ok (4.782s) | real Bifrost SDK binding still PENDING |
| DSH TUI vendoring | PENDING | network access to the TUI package |
| Bundled dist artifacts (tsdown) | PENDING | install tsdown (registry) |

## Known limitations

- No real provider was exercised; the security and policy claims are validated against mocks, conformance tests, and the TypeScript DLP twin.
- The benchmark is a mock-model harness measurement, not evidence of model quality or real spend.
- Small sample: pilot is 3 tasks x 4 arms x 1 run.
- Node 26 was used instead of the documented 22/24 LTS because it is what the machine has; the code targets Node 22.6+ APIs.
- Sandbox constraints: piped child stdio is denied, so tests use `--test-isolation=none` and tools capture output through files.

## How to run

```bash
npm install                     # or pnpm install (registry available)
node scripts/build.ts
node scripts/lint.ts
node scripts/typecheck.ts
node scripts/run-tests.ts
node apps/cli/src/main.ts doctor
node apps/cli/src/main.ts demo --replay
node apps/cli/src/main.ts conformance
node apps/cli/src/main.ts chaos
node apps/cli/src/main.ts redteam
node apps/cli/src/main.ts audit verify --all
node apps/cli/src/main.ts bench --pilot
```

Real providers and the full five-run benchmark: see MORNING_RUNBOOK.md.

## License and attribution

Gidorah is Apache-2.0 (LICENSE). Attributions: Bifrost (Apache-2.0, Maxim AI; not an official product), Tavily (commercial API), planned DSH TUI (MIT AND BSD-3-Clause, not vendored), pi-tui (MIT, not vendored), TypeScript/@types/node (dev only). Full register: third_party/README.md and NOTICE.

## Real toolchain and service verification (post-build, 2026-11-03)

Installed after the initial mock-first build: Go 1.27.3 (Bifrost plugin `go vet` clean, `go test ./...` ok 4.782s), pnpm 12.16.1 standalone (`pnpm run build/lint/typecheck/test` pass), TypeScript 7.0.2 strict typecheck, Bifrost 2.4.0 built from source and running on 8080, Ollama 0.40.13 running on 11434.

Real routing evidence (`evidence/real-services-2026-11-03.json`): a chat completion with the generated local virtual key was routed by real Bifrost to the real Ollama provider (routing headers present, 36 ms upstream latency) and reached Ollama, which returned 404 because the model weights are not downloaded. This verified the real client -> gateway -> local runtime path. Real inference is now VERIFIED as well: `qwen2.5-coder:0.5b` was installed (digest verified after completing the stalled tail with a range request), and a real CLI session ran end-to-end (`gidorah run ... --yes`, 243 tokens, valid hash chain). Model output quality is poor at 0.5b; 3B+ weights remain the recommendation. See `evidence/real-services-2026-11-03.json`.

`pnpm install` remains blocked by the sandbox (symlink EPERM); `npm install` is the working dependency path here. Full rerun steps are in `MORNING_RUNBOOK.md`.
## Final real-run addendum

Two fixes were required by real-gateway testing: the SSE parser now stops at `[DONE]` (Bifrost keeps the stream open after it), and the runtime accepts `GIDORAH_MODEL_ALIAS` and `GIDORAH_MAX_TOKENS` so a real provider-qualified model can be used and capped. All 104 tests, the strict typecheck, and lint still pass after these changes.