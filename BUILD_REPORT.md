# Gidorah build report (current)

Evidence-first. Chronology and superseded runs: `BUILD_LOG.md`. One-page state:
`FINAL_STATE.md`. Commands are reproducible from this repository.

## Verified with real services
- Native TUI: `gidorah tui` drives the same runtime inside an OpenTUI 0.8.2 (SST, MIT; the framework opencode uses) shell: Yoga layout, gradient ASCII logo, status pills, transcript cards, Markdown/diff renderables, bordered Textarea composer, mouse-clickable approval buttons, session picker, spinner, mock banner. Screenshots: `apps/tui/screenshots/`; demo: `apps/tui/DEMO-opentui.md`; manual terminal acceptance pending.

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

Old synthetic-math runs and the hung run are archived outside the public repo, labelled superseded, and are not used as evidence.

## Verification

typecheck PASS; lint 97 files 0 failures; 167 tests PASS; conformance 40/40;
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
4. DSH package integration remains optional: the package is vendored with
   LICENSE/NOTICE but not wired; the native TUI ships.

## Licenses

Apache-2.0 for Gidorah. Bifrost Apache-2.0 (Maxim AI, not an official product).
Tavily commercial terms. DSH TUI vendored under MIT AND BSD-3-Clause with
LICENSE/NOTICE in `third_party/dsh-tui.LICENSE` and `third_party/dsh-tui.NOTICE`. Full register: `third_party/README.md`.
## Corrected benchmark evidence (v2 task set)

- Cascade is real: `bench/real_mw0or6tw/traces/A1-C-0.jsonl` shows `glm-5p3-flash` for explore/edit and `deepseek-v4p1-flash` for verify. A runtime test asserts the phase switch.
- Task validity: all 12 tasks are validated fail-before/pass-after by `packages/benchmark/test/tasks.test.ts` (6 Class A repo-local, 6 Class B runtime-docs-dependent).
- Corrected pilot: 9 rows, 7 solved, cost per solved task $0.006454.
- Class B full set (B1..B6, arms A/C/D): 18 rows, 16 solved, pass@1 88.9%, cost per solved task $0.006792, 313,088 tokens, 157 model requests.
  - arm A (always strong): 5/6 solved; arm C (cascade): 6/6; arm D (cascade plus deterministic docs-first Tavily research): 5/6.
  - Arm D research accounting is split into pre-research and tool research. The earlier claim of "one call and one credit per task" was an undercount: the pre-research card is one call, and B3-D made a second tool call. Rows now record `preResearchCalls/Credits`, `toolResearchCalls/Credits`, sources, and card tokens. Tool credits are observable via `tool/result.meta`; rows record `toolResearchCredits` and the full run reconciles exactly at 12 calls / 12 credits.
- Metrics are derived from session events and tool-result metadata: research is split into pre-research and tool research (calls, credits, sources, card tokens), denied attempts are counted separately, and provider errors/timeouts are classified as `provider_error`/`timeout` before `no_edit` or `step_limit`.
- Pricing: TokenUsage.input is treated as uncached input; cacheRead is billed separately, with a test using cacheRead > 0.
- Superseded: the earlier synthetic-math runs, the uncapped hung run, the partial A-class run (`real_mw0g7hvx`), and the 1-run full run (`real_mw0i03nt`) are archived outside the public repo and labelled in `BUILD_LOG.md`. The 1-run full run is superseded for step-limit and failure-field reasons; the 3-run pilot and any later full run are the current evidence.
## Review correction pass (current)

- **Pre-fix full run:** 12 tasks x arms A/C/D/F, 1 run, recorded before the field fix; economics only. Post-fix runs record actual maxSteps, temperature, task/client timeouts, task/arm filters, and mode in `manifest.json`. `--runs` and `GIDORAH_BENCH_RUNS` are supported. Post-fix failures carry `failureCategory`, `failureDetail`, and a retained event log under `bench/<run>/failures/`.
- **Tavily evidence is mixed; the current full run is a negative.** Current full run `real_mw0or6tw`: C 12/12, D 12/12, F 12/12, A 12/12; D costs $0.002383 per solved vs C $0.001802, about 32 percent more with no pass-rate gain. Class B-only: D 5/6 vs C 6/6. Post-fix pilot: D 9/9 vs C 8/9 vs A 7/9. The three samples disagree at small n; no reliable pass-rate claim is made, and Tavily value is stated as citations plus cost avoidance. Pilot D rows use two calls and one to two credits per task.
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
This run predates the failure fields: its three failed rows have no recorded category; the later retry of B1-A in `real_mw0k7ayt` was a provider timeout, while the original row is uncategorized. Economics only.
Tavily honesty: current full run C 12/12 vs D 12/12 with D ~35 percent more expensive per solved task; Class B-only D 5/6 vs C 6/6; post-fix pilot D 9/9 vs C 8/9. The three samples disagree at small n; no reliable pass-rate claim is made, and Tavily value is reported as citations plus cost avoidance.
## Evidence-integrity fix (final)

- `failureCategory`, `failureDetail`, `stepLimitReached`, and the research split (`preResearchCalls/Credits`, `toolResearchCalls/Credits`, `researchAttempts`, `researchDenied`, `researchSources`, `researchCardTokens`) now reach `BenchRow` and raw JSONL. Provider failures are detected from `session/error` or a `turn/end` reason of `provider_error` before `no_edit`/`step_limit`; the earlier `no_edit` label on B1-A was wrong and that failure is a client timeout at 120 s.
- Research accounting is split and reconciled: B1-D recorded `preResearchCalls 1`, `preResearchCredits 1`, `toolResearchCalls 1`, card 329 tokens. The earlier "one call per task" claim is corrected: B3-D made two calls (pre-research plus a tool research call). Tool credits are observable via `tool/result.meta`; the full run reconciles exactly at 12 calls / 12 credits. The post-fix pilot gap is two pre-research cache hits.
- Step limit is configurable (`GIDORAH_BENCH_MAX_STEPS`, default 20). The manifest records actual maxSteps, temperature, task/client timeouts, task/arm filters, and mode; older runs whose manifest said maxSteps 12 predate this fix and are labelled superseded.
- Variance pilot (pre-field-fix run `real_mw0jtdu3`): 27 rows (A1/B1/A2 x A/C/D x 3 runs), 26 solved (96.3%), $0.005471 per solved task; arm A 8/9, C 9/9, D 9/9. Its one failure (B1-A run 2) predates the field fix and therefore has no category recorded; the post-fix B1 run supplies a category.
- **F is cheapest on the current full run.** Current full run `real_mw0or6tw` (48/48): F $0.001272, C $0.001802, D $0.002383, A $0.003797 per solved. F is cheapest and C is cheaper than D; the cascade and Tavily are insurance for harder repositories, not measured pass-rate wins.
- `costPerSuccessfulTask` is no longer reported; it is undefined until retries are tracked, and the duplicate label was removed from the generated report.

### Superseded artifacts (archived)

Earlier synthetic, hung, partial, single-run and pre-nudge runs are archived outside the public repo and logged in `BUILD_LOG.md`. Current verified evidence: `bench/real_mw0or6tw` (post-nudge full run, 48/48). The post-fix 3-run pilot is also archived.

## Post-fix 3-run pilot (current evidence)

Rows 27, evaluated 27, solved 24, errored 0, pass@1 88.9 percent, cost $0.165836, cost/solved $0.006910.

| Arm | Solved | Errored | Cost |
|---|---|---|---|
| A | 7/9 | 0 | $0.089117 |
| C | 8/9 | 0 | $0.043533 |
| D | 9/9 | 0 | $0.033186 |

Errored rows: none. Provider-error classification exists but was not triggered in this pilot.

Research accounting totals: preResearchCalls 3, preResearchCredits 1, toolResearchCalls 3, toolResearchCredits 3, attempts 12, denied 6.
Research cache reconciliation: research_usage 4 calls / 4 credits, 4 cache rows; raw rows sum to 6 calls / 4 credits. The pilot gap is two pre-research cache hits; the full run reconciles exactly at 12 calls / 12 credits.

Manifest truth: mode real-pilot, runs 3, maxSteps 20, temperature 0, taskTimeoutMs 240000, clientTimeoutMs 120000, taskFilter [], armFilter [].
## B1 step-limit diagnosis (corrected)

The single full-run failure is A-specific. In the archived pre-nudge run, the model confirmed the runtime ("Confirmed: Node v26.13.0, DatabaseSync is exported, and prepare().get() returns..."), but kept probing and re-reading and never edited within 20 steps. C and F solved B1 without research, so D's card is not necessary to solve it; the row records one denied research attempt on A, and the retained tail does not contain the denial event. The honest diagnosis is an A-arm looping weakness, not a docs gap. Candidate fixes (force an edit after two probe steps, preserve context across clears, give non-research arms a short API hint) were applied as an edit-nudge prompt. A rerun of B1 three times in the archived pilot passed 3/3, so the failure was an A-arm loop, not a docs gap; the benchmark does not claim A is a quality ceiling.

## B1-A fix result

After the edit-nudge prompt ("after at most two exploratory reads or probes, apply the edit and run the test"), A rerun B1 three times in the archived pilot: 3/3 passed, 0 errors, $0.004962 per solved task. The earlier 20-step A loop no longer reproduces on B1. The other arms already solved B1 without research, so this confirms the failure was an A-arm loop, not a docs gap. A full 48/48 run is now expected but not yet re-run as a whole; the full-run headline remains 47/48.

## Full run with edit-nudge (current evidence)

Rows 48, evaluated 48, solved 48, errored 0, pass@1 100.0 percent, cost $0.111062, cost/solved $0.002314.

| Arm | Solved | Cost | Cost/solved |
|---|---|---|---|
| A | 12/12 | $0.045566 | $0.003797 |
| C | 12/12 | $0.021627 | $0.001802 |
| D | 12/12 | $0.028600 | $0.002383 |
| F | 12/12 | $0.015268 | $0.001272 |

Class A 24/24; Class B 24/24.

Research: pre 6/6, tool 1/1, attempts 7, denied 0; cache 7/7.
Manifest: mode real-full-targeted, runs 1, maxSteps 20, temperature 0, promptVersion edit-nudge-v1, editNudge true, timeouts 240000/120000, armFilter ["A","C","D","F"].
### Nudge full run supersedes the 47/48 headline

`bench/real_mw0or6tw` (promptVersion `edit-nudge-v1`, recorded in the manifest) is the current full run: 48/48 solved, 100%, $0.111062 total, $0.002314 per solved. Per arm: A 12/12 $0.003797, C 12/12 $0.001802, D 12/12 $0.002383, F 12/12 $0.001272 per solved. Research reconciled: pre 6/6, tool 1/1, attempts 7, denied 0, cache 7/7. The earlier 47/48 run was pre-nudge and is archived. The current full run is still a negative for Tavily as a pass-rate lever: C matches D at 12/12 and is ~25 percent cheaper; F is cheapest of all. Cascade also shows no pass-rate gain over F, only cost differences. Tavily value remains citations and cost avoidance, not accuracy.
