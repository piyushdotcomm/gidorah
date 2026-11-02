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
| Go plugin compile/vet/test | no Go toolchain | Go 1.22+ |
| DSH TUI vendoring | package not fetchable offline | network + license copy |
| Bundled dist artifacts | tsdown not installed | registry install |

## Deviations

ADR-0013 (dependency-free runtime, node:test, node:sqlite, custom scripts), ADR-0014 (plain TUI first), ADR-0015 (mock-first evidence, repo-local `.gidorah` fallback). Documented in docs/05-decisions/README.md.

## Next actions

1. Run MORNING_RUNBOOK.md sections 2-4 with keys.
2. Replace PENDING rows here and in BUILD_REPORT.md with real command output.
3. Run `go test ./...` in plugins/bifrost-dlp and vendor the DSH TUI.
