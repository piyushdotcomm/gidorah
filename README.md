# Gidorah

**The governed coding agent.** Less spend. Fewer guesses.

Gidorah is a terminal coding agent with a dual-plane control plane. Bifrost is the only path to a model (virtual keys, pre-request budgets, routing, fallbacks, logs). Tavily is the only external knowledge path (local-first, cited evidence cards, credit budget, cache, Docs Guard). Gidorah owns the loop, tools, approvals, context economics, audit chain, flight recorder, and benchmark.

HackCulture AI Global Hackathon, Track A (Bifrost by Maxim AI). Both sponsors are structural.

## Status: verified real, offline-mock, pending

| Area | Verified with real services | Offline/mock evidence | Pending |
|---|---|---|---|
| Agent loop, tools, approvals, policy, session, context | Real Fireworks model fixed a failing test through `read/edit/bash`; real CLI sessions; audit chain valid | 140 tests, 40 conformance tests | None known |
| Bifrost model plane | Real Bifrost 2.4.0 built from source, real Fireworks routing, real local-only key rejection (403), real Ollama routing | Mock gateway for budgets/402/fallbacks; real 2.4.0 path exercised | Live gateway DLP plugin load (native Go plugins are Linux .so) |
| Tavily knowledge plane | Real API: 332-token card, 3 official sources, 1 credit, cache hit at 0 credits | Mock Tavily for CT-13..20 | Measured benchmark impact of arm D (corrected run) |
| Benchmark | Corrected v2 task set (6 repo-local + 6 runtime-docs tasks, each validated fail-before/pass-after); real cascade verified by phase; Class B run 18 rows, 16 solved, arm D uses 1 Tavily call/1 credit per task | Pilot 9 rows, 7 solved | Full A-class run (partial record kept); larger multi-run sweep |
| TUI / UX | Plain renderer and TUI adapter panels (status, transcript, approval, takeover, research, DLP, Docs Guard, trace, receipt) with tests; CLI contract tests | DSH TUI package vendored with LICENSE/NOTICE | Both DSA package wired behind `gidorah` |
| Go DLP plugin | `go vet` and `go test` against real Bifrost core v1.14.1 | DLP twin exercised in the mock gateway | Loaded into a live Linux Bifrost |
| Audit, red team, conformance, chaos | Real-service chaos: Bifrost kill, Tavily outage, network drop | 40/40 conformance, 8/8 chaos, canary 0 | Live gateway canary scan |
| Docs and submission | Current state in this file, BUILD_REPORT.md, FINAL_STATE.md | BUILD_LOG.md chronology | Demo recording, slides, Bifrost repo star, key rotation |

Numbers measured on this machine: 140 tests passing; 40 conformance; 8 chaos; CLI cold start 144 ms average (target <150); DLP scan 7.6 microseconds per 4 KB request (target <20 ms p95); session resume 2 ms for 101 events (target <2 s); core+policy coverage 80.0 percent.

Benchmark history is explicit: earlier synthetic-math runs are superseded and labelled in `BUILD_LOG.md`; they are not used as evidence.

## Quickstart

```bash
npm ci
npm run build
npm run lint
npm run typecheck
npm test
node apps/cli/src/main.ts doctor
node apps/cli/src/main.ts demo --replay
node apps/cli/src/main.ts conformance
node apps/cli/src/main.ts chaos
node apps/cli/src/main.ts redteam
node apps/cli/src/main.ts audit verify --all
node apps/cli/src/main.ts bench --real --pilot
```

Real gateway runs need `BIFROST_BASE_URL`, `BIFROST_VK_CLOUD`, `TAVILY_API_KEY` and a provider-qualified `GIDORAH_MODEL_ALIAS` (for example `fireworks/accounts/fireworks/models/deepseek-v4p1-flash`). Provider keys live in Bifrost, never in the Gidorah process. See `MORNING_RUNBOOK.md`.

## Architecture

```text
CLI / TUI adapter
  |-- policy: repo classification, virtual-key selection, approval classifier, shell lexer
  |-- Tavily Scout: local-first, version-aware, cited cards, cache, credits, Docs Guard
  |-- tools: read, repo_map, glob, grep, list, write, edit (patch-first), bash, git, research
  |-- context: cap -> clear -> conditional compact (cache-aware, measured)
  `-- Bifrost client (only model egress) --> Bifrost --> Fireworks models / Ollama local
```

Sessions are append-only JSONL with a SHA-256 hash chain; `audit verify` recomputes it. A hash chain is tamper-evident, not tamper-proof.

## Repo layout

`apps/cli`, `apps/tui`, `packages/{core,policy,bifrost,tavily,benchmark,shared}`, `plugins/bifrost-dlp`, `tests/{conformance,chaos,redteam,replay,cli}`, `config/`, `docs/`, `third_party/dsh-tui`.

## Limitations

- No live gateway DLP: the plugin is SDK-bound and source-tested; Windows cannot load native Go plugins.
- The corrected real benchmark is a small sample; Task set is 12 tasks with real Node APIs, not a third-party OSS repository.
- `pnpm install` cannot complete in this sandbox; the repo standard is npm with `package-lock.json`.
- Full DSH TUI integration is in progress; the shipped surface is the plain renderer plus adapter panels.
- Real demo recording and submission slides are external actions.

## Licensing and attribution

Gidorah is Apache-2.0. Bifrost is Apache-2.0 by Maxim AI and Gidorah is not an official Bifrost product. Tavily is a commercial API used under its terms. The vendored DSH TUI is MIT AND BSD-3-Clause with its own LICENSE and NOTICE in `third_party/dsh-tui`. See `LICENSE`, `NOTICE`, `third_party/README.md`.

## Docs

`docs/` holds the product, architecture, engineering, evaluation, delivery, ADR, and licensing documents. `BUILD_REPORT.md` holds the current evidence and commands; `BUILD_LOG.md` holds chronology and superseded runs; `FINAL_STATE.md` is the one-page submission state.