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

typecheck PASS; lint 79 files 0 failures; 140 tests PASS; conformance 40/40;
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
  - Arm D research accounting is split into pre-research and tool research. The earlier claim of "one call and one credit per task" was an undercount: the pre-research card is one call, and B3-D made a second tool call. Rows now record `preResearchCalls/Credits`, `toolResearchCalls/Credits`, sources, and card tokens. Credits for tool-initiated calls cannot be read because no `research/result` event is emitted; that residual undercount is stated, not hidden.
- Metrics are derived from session events and tool-result metadata: research is split into pre-research and tool research (calls, credits, sources, card tokens), denied attempts are counted separately, and provider errors/timeouts are classified as `provider_error`/`timeout` before `no_edit` or `step_limit`.
- Pricing: TokenUsage.input is treated as uncached input; cacheRead is billed separately, with a test using cacheRead > 0.
- Superseded: the earlier synthetic-math runs, the uncapped hung run, the partial A-class run (`real_mw0g7hvx`), and the 1-run full run (`real_mw0i03nt`) stay in `bench/` and are labelled in `BUILD_LOG.md`. The 1-run full run is superseded for step-limit and failure-field reasons; the 3-run pilot and any later full run are the current evidence.
## Review correction pass (current)

- **Full run:** 12 tasks x arms A/C/D/F, 1 run, recorded before the field fix; economics only. Post-fix runs record actual maxSteps, temperature, task/client timeouts, task/arm filters, and mode in `manifest.json`. `--runs` and `GIDORAH_BENCH_RUNS` are supported. Post-fix failures carry `failureCategory`, `failureDetail`, and a retained event log under `bench/<run>/failures/`.
- **Tavily is an honest negative on pass rate.** Class B: arm C 6/6, arm D 5/6, so research did not improve correctness in this sample; it added one customer-visible citation per task at one credit each and lower per-row cost than arm A in places. Claims in README/FINAL_STATE are reframed to citations and cost avoidance, not a pass-rate win.
- **Patch-first and repo-map are always-on and not ablated.** Arms no longer pretend otherwise; no savings claim is made for them.
- **Real 402 budget is NOT demonstrated.** A tiny-budget virtual key was wired through governance budgets and model configs on a separate Bifrost instance; requests still returned 200. The captured attempts are in `evidence/real-budget-402-2026-11-03.json` and the claim is downgraded to "offline/402 tested with the mock gateway".
- **Real provider fallback/takeover is NOT demonstrated** against a real primary provider; the mock gateway covers the fallback headers/banner and real chaos covers a Bifrost kill. Downgraded accordingly.
- **Real confidential zero-egress** is partially real: local 3B inference through Bifrost and a real 403 for a cloud model with the local key; Tavily-disabled, network-shell-denied, and canary-egress checks remain offline/mock.
- **Live gateway DLP** remains source-tested only (Windows cannot load native Go plugins); every claim says so.

### Full run (pre-fix fields; economics only, 12 tasks x arms A/C/D/F, 1 run)

Rows 48, evaluated 48, solved 45, pass@1 93.8 percent, errored 0.
Total cost $0.200050, cost per solved task $0.004446, tokens 628361, model requests 360.

| Arm | Solved | Cost USD | Cost per solved |
|---|---|---|---|
| A | 10/12 | $0.085578 | $0.008558 |
| C | 11/12 | $0.046530 | $0.004230 |
| D | 12/12 | $0.046872 | $0.003906 |
| F | 12/12 | $0.021069 | $0.001756 |

Class A: 24/24 solved. Class B: 21/24 solved. Class B by arm: A 4/6, C 5/6, D 6/6, F 6/6.
This run predates the failure fields: its three failed rows have no recorded category, and B1-A is now known to be a provider timeout, not a model failure. Use it for economics only, not for failure or research claims.
Tavily honesty: full run arm D 12/12 vs C 11/12 (one task), Class B-only run arm D 5/6 vs C 6/6. The two samples disagree and n=12; no reliable pass-rate win is claimed. Tavily value reported as citations plus cost avoidance.
## Evidence-integrity fix (final)

- `failureCategory`, `failureDetail`, `stepLimitReached`, and the research split (`preResearchCalls/Credits`, `toolResearchCalls/Credits`, `researchAttempts`, `researchDenied`, `researchSources`, `researchCardTokens`) now reach `BenchRow` and raw JSONL. Provider failures are detected from `session/error` or a `turn/end` reason of `provider_error` before `no_edit`/`step_limit`; the earlier `no_edit` label on B1-A was wrong and that failure is a client timeout at 120 s.
- Research accounting is split and reconciled: B1-D recorded `preResearchCalls 1`, `preResearchCredits 1`, `toolResearchCalls 1`, card 329 tokens. The earlier "one call per task" claim is corrected: B3-D made two calls (pre-research plus a tool research call). Credits for tool-initiated calls remain unobservable because no `research/result` event is emitted; that residual undercount is stated, not hidden.
- Step limit is configurable (`GIDORAH_BENCH_MAX_STEPS`, default 20). The manifest records actual maxSteps, temperature, task/client timeouts, task/arm filters, and mode; older runs whose manifest said maxSteps 12 predate this fix and are labelled superseded.
- Variance pilot (pre-field-fix run `real_mw0jtdu3`): 27 rows (A1/B1/A2 x A/C/D x 3 runs), 26 solved (96.3%), $0.005471 per solved task; arm A 8/9, C 9/9, D 9/9. Its one failure (B1-A run 2) predates the field fix and therefore has no category recorded; the post-fix B1 run supplies a category.
- **Arm F dominates this task set.** Full run: F 12/12 at $0.001756 per solved, D 12/12 at $0.003906, C 11/12 at $0.004230, A 10/12 at $0.008558. The honest comparison is D vs F and C vs F: the always-cheap arm is cheaper and at least as reliable. This task set does **not** demonstrate cascade or Tavily value; they are framed as insurance for harder, larger repos, not as measured wins here. No pass-rate claim is made.
- `costPerSuccessfulTask` is no longer reported; it is undefined until retries are tracked, and the duplicate label was removed from the generated report.

### Superseded artifacts (kept, labelled)

`bench/real_mw0etfge` (synthetic pilot), `bench/real_mw0f94jv` (hung), `bench/real_mw0ffoii` (synthetic tasks, fake cascade), `bench/real_mw0g3w0s` (corrected pilot, pre research trigger), `bench/real_mw0g7hvx` (partial A run), `bench/real_mw0gj157` (Class B only), `bench/real_mw0i03nt` (full 1-run, pre field fix), `bench/real_mw0jtdu3` (variance pilot, pre field fix). Current verified evidence: `bench/real_mw0k7ayt` (post-fix fields) plus the full-run economics table above.

## Post-fix 3-run pilot (current evidence)

Rows 27, evaluated 27, solved 24, errored 0, pass@1 88.9 percent, cost $0.165836, cost/solved $0.006910.

| Arm | Solved | Errored | Cost |
|---|---|---|---|
| A | 7/9 | 0 | $0.089117 |
| C | 8/9 | 0 | $0.043533 |
| D | 9/9 | 0 | $0.033186 |

Errored rows: none. Provider-error classification exists but was not triggered in this pilot.

Research accounting totals: preResearchCalls 3, preResearchCredits 1, toolResearchCalls 3, toolResearchCredits 3, attempts 12, denied 6.
Research cache reconciliation: research_usage 4 calls / 4 credits, 4 cache rows; raw rows sum to 6 calls / 4 credits. Any gap is tool-initiated calls whose credits were not observable; this is stated, not hidden.

Manifest truth: mode real-pilot, runs 3, maxSteps 20, temperature 0, taskTimeoutMs 240000, clientTimeoutMs 120000, taskFilter [], armFilter [].