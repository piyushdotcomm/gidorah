# Gidorah build report (current)

Evidence-first. Chronology and superseded runs: `BUILD_LOG.md`. One-page state:
`FINAL_STATE.md`. Commands are reproducible from this repository.

## Verified with real services

- Real Bifrost 2.4.0 (built from source) on `:8080`; real Fireworks AI models
  (30 available, e.g. deepseek-v4p1-flash) and real Ollama 0.40.13 with a 3B
  GGUF model.
- Real agent work: a failing test fixed through `read/edit/bash` in a real CLI
  session; 103-event session, valid audit chain (`evidence/real-coding-task-2026-11-03.json`).
- Real Tavily: 332-token evidence card, 6 facts, 3 official sources, high
  confidence, 1 credit, then a 0-credit cache hit (`evidence/real-tavily-2026-11-03.json`).
- Real confidential path: local-only key rejects a cloud model with 403; 3B
  local inference through Bifrost returns 200 (`evidence/real-local-3b-2026-11-03.json`).
- Real chaos: kill Bifrost (client fails with a clear provider error), Tavily
  outage degrades, network drop is structured. `tests/chaos/real.test.ts`.

## Verified offline (mock)

Conformance CT-01..CT-40, mock Bifrost budget/402/fallback/confidential flows,
mock Tavily cache/credits, replay demo, CLI contract, audit tamper tests, red
team corpus with canary 0.

## Benchmark

The corrected v2 task set (`packages/benchmark/src/tasks.ts`) has 6 Class A
repo-local tasks and 6 Class B runtime-docs-dependent tasks, every one validated
fail-before/pass-after by `packages/benchmark/test/tasks.test.ts`. Per-phase
cascade is wired through `modelAliasByPhase` and tested. Arms are limited to A
(always strong), C (cheap explore/edit, strong verify) and D (C plus docs-first
Tavily research on Class B). Metrics come from session events (research calls
and credits, patch tokens, full-file reads, approval prompts, cache hits).
Cost uses the published Fireworks Standard rates in
`packages/shared/src/pricing.ts`.

Old synthetic-math runs (`bench/real_mw0etfge`, `bench/real_mw0ffoii`,
`bench/real_mw0g3w0s`) and the hung run (`real_mw0f94jv`) are kept, labelled
superseded, and are not used as evidence.

## Verification

typecheck PASS; lint 75 files 0 failures; 140 tests PASS; conformance 40/40;
chaos 8/8; audit chain VALID; redteam 20/20 blocked, canary 0; demo replay PASS;
Go plugin vet clean and tests ok; no tracked key material; clean working tree.

## Measurements

CLI cold start 144 ms average (target <150 ms); DLP scan 7.6 microseconds per
4 KB request (target <20 ms p95); session resume 2 ms for 101 events (target
<2 s); core+policy line coverage 80.0 percent (target >=80).

## External blockers (not code)

1. Live gateway DLP/canary: requires loading the Go plugin into a Linux Bifrost
   (native Go plugins are Linux `.so`; Windows cannot).
2. Record the 3-minute demo, slides, star the Bifrost repo.
3. Rotate the keys pasted into chat and the local `sk-bf-` dev key.
4. Full DSH TUI package integration behind `gidorah` (plain renderer plus
   adapter panels ship today).

## Licenses

Apache-2.0 for Gidorah. Bifrost Apache-2.0 (Maxim AI, not an official product).
Tavily commercial terms. DSH TUI vendored under MIT AND BSD-3-Clause with
LICENSE/NOTICE in `third_party/dsh-tui`. Full register: `third_party/README.md`.
## Corrected benchmark evidence (v2 task set)

- Cascade is real: `bench/real_mw0g3w0s/traces/A1-C-0.jsonl` shows `glm-5p3-flash` for explore/edit and `deepseek-v4p1-flash` for verify. A runtime test asserts the phase switch.
- Task validity: all 12 tasks are validated fail-before/pass-after by `packages/benchmark/test/tasks.test.ts` (6 Class A repo-local, 6 Class B runtime-docs-dependent).
- Corrected pilot: 9 rows, 7 solved, cost per solved task $0.006454.
- Class B full set (B1..B6, arms A/C/D): 18 rows, 16 solved, pass@1 88.9%, cost per solved task $0.006792, 313,088 tokens, 157 model requests.
  - arm A (always strong): 5/6 solved; arm C (cascade): 6/6; arm D (cascade plus deterministic docs-first Tavily research): 5/6.
  - arm D made one Tavily call and spent one credit per Class B task, and was cheaper per row than arm A (for example B5: $0.002534 vs $0.003140; B6: $0.002049 vs $0.011093).
- Metrics are derived from session events: research calls count `research/result` only, research credits sum real Tavily usage, patch tokens/full-file reads/approval prompts/cache hits come from the event stream, and errored/timeout rows are counted separately.
- Pricing: TokenUsage.input is treated as uncached input; cacheRead is billed separately, with a test using cacheRead > 0.
- Superseded: the earlier synthetic-math runs and the uncapped hung run stay in `bench/` and are labelled in `BUILD_LOG.md`. The A-class full run was partially recorded (`real_mw0g7hvx`) before the Class B run; it is not used as the headline.