# Gidorah

**The governed coding agent.** Less spend. Fewer guesses.

Gidorah is a terminal coding agent with a dual-plane control plane:

- **Bifrost is the model plane.** The only path to a model: per-user virtual keys, pre-request budgets with 402, phase routing, model aliases, cross-provider fallbacks with a visible takeover, exact cache, request logs, and a DLP/policy plugin.
- **Tavily is the knowledge plane.** Local-first, version-aware research compressed into cited evidence cards, with a credit budget, a cache, Docs Guard, and a search-depth ladder. Hard-disabled in confidential mode.
- **Gidorah owns** the agent loop, tools, approval gate, context economics, tamper-evident audit chain, red team, flight recorder, benchmark, replay, and the receipts.

Built for HackCulture AI Global Hackathon, Track A (Bifrost by Maxim AI). Both sponsors are structurally required, not decorative.

## Status

| Area | State |
|---|---|
| Agent loop, tools, approvals, resume | Implemented and tested offline |
| Bifrost integration | Implemented against a mock gateway (budgets, 402, routing, fallbacks, DLP, logs); real Bifrost PENDING |
| Tavily Scout, cards, cache, credits, Docs Guard | Implemented and tested against a mock Tavily |
| Confidential mode | Implemented: local-only key path, research disabled, network shell denied, zero-egress tests |
| Audit chain, red team, replay, chaos | Implemented and tested offline |
| Conformance CT-01..CT-40 | 40/40 passing offline |
| Benchmark | Harness implemented; pilot runs with a scripted mock model (real-provider numbers PENDING) |
| Go DLP plugin | Source and tests written; build/test PENDING (no Go toolchain) |
| TypeScript build/typecheck | Real strict `tsc --noEmit` passes; bundler artifacts PENDING |

No provider keys were available for this build. Every real-provider result is marked PENDING in [BUILD_REPORT.md](BUILD_REPORT.md); nothing was fabricated. See [MORNING_RUNBOOK.md](MORNING_RUNBOOK.md) for the exact steps to turn the mock evidence into real evidence.

## Hackathon requirement mapping

| Requirement | Implementation | Evidence |
|---|---|---|
| Survive outages/rate limits, announce takeover | Bifrost fallbacks + routing headers + durable `route/changed` | CT-01, CT-02, CT-03 |
| Per-user budget before every request | Virtual keys + pre-request check + 402 + local fallback policy | CT-04, CT-05, CT-06 |
| Confidential repos local only, prompt-proof | Local-only key, gateway confidential guard, Tavily disabled, network shell denied | CT-07, CT-08, CT-09, CT-28 |
| Writes/shell/git need approval; reads free | Pre-tool classifier + approval service + audit | CT-10, CT-11, CT-23, CT-24 |
| Meaningful Bifrost + Tavily use | Model plane and knowledge plane are required for the loop to run | Architecture + benchmark arms |
| Measured savings | Cost per solved task, p50/p95 variance, token breakdown, raw JSONL | `bench/*/report.md` (mock-model pilot) |

## Quickstart (offline mock mode)

```bash
npm install            # or: pnpm install
npm run build
npm run lint
npm run typecheck
npm test               # 104 tests with node:test
node apps/cli/src/main.ts doctor
node apps/cli/src/main.ts demo --replay      # deterministic offline demo
node apps/cli/src/main.ts conformance        # CT-01..CT-40
node apps/cli/src/main.ts chaos              # dependency-kill suite
node apps/cli/src/main.ts redteam            # injection + canary corpus
node apps/cli/src/main.ts audit verify --all # hash-chain verification
node apps/cli/src/main.ts bench --pilot      # mock-model pilot benchmark
```

With a real Bifrost gateway, Ollama, and keys, set `GIDORAH_MODE=cloud`, fill `.env` from `.env.example`, and follow [MORNING_RUNBOOK.md](MORNING_RUNBOOK.md).

## Architecture

```text
CLI / plain TUI (apps/cli, apps/tui)
  |-- policy plane: repo classification, virtual-key selection, approval classifier, shell lexer
  |-- Tavily Scout: local-first trigger, version-aware query, evidence card, cache, credit budget, Docs Guard
  |-- tool plane: read, repo_map, glob, grep, list, write, edit (patch-first), bash, git, research
  |-- context manager: cap -> clear -> compact (conditional, cache-aware, measured)
  `-- Bifrost client (the only model egress) --> Bifrost --> DeepSeek flash/pro, Ollama local
                                                     `-- DLP/policy plugin (Go)
```

Session events are append-only JSONL with a SHA-256 hash chain; `audit verify` recomputes it and reports the first broken link. A hash chain is tamper-evident, not tamper-proof.

## Repository layout

```text
apps/cli             command entrypoint, all commands
apps/tui             plain TuiEvent renderer (DSH TUI adaptation is PENDING)
packages/core        runtime, tools, context, session/audit, red team, replay, Docs Guard
packages/policy      repo classification, virtual keys, approvals, shell lexer
packages/bifrost     gateway client, DLP gate, mock gateway and providers
packages/tavily      Scout, query builder, evidence cards, SQLite cache, budgets
packages/benchmark   tasks, arms, runner, metrics, report
packages/shared      types, config, canonical JSON, redaction, YAML subset, JSONL
plugins/bifrost-dlp  Go plugin (source and tests; build PENDING)
tests/conformance    CT-01..CT-40
tests/chaos          dependency-kill suite
tests/replay         recorded demo trace (offline replay)
```

## Measurement honesty

The included benchmark run uses a scripted mock model because no provider keys exist here. It exercises the real loop, tools, context manager, session/audit plumbing, and pricing table, but it does not measure model quality. Report, raw rows, and manifest are committed under `bench/` and labeled accordingly. Real-provider results remain PENDING.

## Limitations

- Real Bifrost, Ollama, DeepSeek, and Tavily were unavailable in this environment; their claims are tested against mocks and marked PENDING.
- No Go toolchain: the Bifrost plugin is not compiled or tested here.
- The DSH TUI is not vendored (cannot be fetched offline); v1 ships the mandated plain renderer.
- Benchmark sample is small (pilot: 3 tasks x 4 arms x 1 run) and mock-model only.

## Licensing and attribution

Gidorah is Apache-2.0. Bifrost is Apache-2.0 by Maxim AI; Gidorah is not an official Bifrost product. Tavily is a commercial API used under its terms. The planned DeepSeek Harness TUI adaptation is MIT AND BSD-3-Clause and is not vendored in this build. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [third_party/README.md](third_party/README.md).

## Docs

Start with [docs/README.md](docs/README.md): product brief, requirements, architecture, engineering plan, benchmark plan, delivery plan, ADRs, and licensing.
