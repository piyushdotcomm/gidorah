# Final state (one page)

## Verified with real services
- Native TUI: session loop, streaming, approvals with diffs, tool cards, resume replay, cancellation, plain/non-TTY fallback (`apps/tui`, demo in `apps/tui/DEMO.md`).
- Bifrost 2.4.0 built from source, real Fireworks routing, real Ollama.
- Real coding task: failing test to passing via agent tools.
- Real Tavily card with citations and a cache hit.
- Confidential: local 3B inference through Bifrost; local key rejects cloud (403).
- Real chaos: Bifrost kill, Tavily outage, network drop.

## Offline/mock only
- Budget 402, fallback chains, DLP twin, replay demo, conformance, red team,
  CLI contract, audit tamper tests.

## Pending (external)
- Live gateway DLP and canary scan: needs a Linux Bifrost loading the Go plugin.
- Demo recording and slides, Bifrost repo star, key rotation.
- DSH package integration (vendored with LICENSE/NOTICE, not wired; the native TUI ships).
- 3-5 run variance sweep (single-run full results are in `bench/`); older runs labelled superseded.

## Known limitations
- The corrected benchmark uses 12 authored tasks over real Node APIs, not a
  third-party OSS repository; sample size is small.
- `pnpm install` is not usable in this sandbox; npm is the repo standard.
- Windows cannot load native Go plugins.

## Exact commands
```bash
npm ci && npm run build && npm run lint && npm run typecheck && npm test
node apps/cli/src/main.ts demo --replay
node apps/cli/src/main.ts conformance
node apps/cli/src/main.ts chaos
node apps/cli/src/main.ts audit verify --all
node apps/cli/src/main.ts redteam
node apps/cli/src/main.ts bench --real --pilot
node apps/cli/src/main.ts bench --real --full
```
## Review correction pass (latest)

- Full 12-task run recorded under `bench/` (12 tasks x A/C/D/F, 1 run). A 3-run pilot measures variance. Current evidence: `bench/real_mw0nvfe6` (post-fix full run, 48 rows, 47 solved, 97.9%) and `bench/real_mw0ksdno` (post-fix 3-run pilot, 27 rows, 24 solved). Post-fix runs carry failure fields, split research accounting, and retained failure logs.
- Tavily evidence is mixed; the current full run is a negative. Current full `real_mw0nvfe6`: C 12/12, D 12/12, D costs ~35% more per solved. Class B-only: D 5/6 vs C 6/6. Post-fix pilot: D 9/9 vs C 8/9 vs A 7/9. No reliable pass-rate claim is made.
- Real 402, real primary-provider fallback, and live gateway DLP are explicitly NOT demonstrated; see `BUILD_REPORT.md` and evidence files.
- Patch-first/repo-map are always-on and not ablated; no savings claim.

### Full run (pre-fix economics only, 12 tasks x arms A/C/D/F, 1 run)

Rows 48, evaluated 48, solved 45, pass@1 93.8 percent, errored 0.
Total cost $0.200050, cost per solved task $0.004446, tokens 628361, model requests 360.

| Arm | Solved | Cost USD | Cost per solved |
|---|---|---|---|
| A | 10/12 | $0.085578 | $0.008558 |
| C | 11/12 | $0.046530 | $0.004230 |
| D | 12/12 | $0.046872 | $0.003906 |
| F | 12/12 | $0.021069 | $0.001756 |

Class A: 24/24 solved. Class B: 21/24 solved. Class B by arm: A 4/6, C 5/6, D 6/6, F 6/6.
This run predates failure fields: no categories, and its failed rows are not evidence for failure classification.
Tavily honesty: current full run C 12/12 vs D 12/12 with D ~35 percent more expensive per solved; Class B-only D 5/6 vs C 6/6; post-fix pilot D 9/9 vs C 8/9 vs A 7/9. The three samples disagree at small n; no reliable pass-rate claim is made.

## Strategic honesty

The current full run is F $0.001689 per solved, C $0.002972, D $0.004003, A $0.009667. F ties C and D at 1.76-2.37x lower cost; C is cheaper than D. Cascade and Tavily are insurance for harder repositories, not measured savings here.

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

## Post-fix full run (current evidence)

Rows 48, evaluated 48, solved 47, errored 0, pass@1 97.9 percent, cost $0.210305, cost/solved $0.004475.

| Arm | Solved | Errored | Cost | Cost/solved |
|---|---|---|---|---|
| A | 11/12 | 0 | $0.106339 | $0.009667 |
| C | 12/12 | 0 | $0.035661 | $0.002972 |
| D | 12/12 | 0 | $0.048037 | $0.004003 |
| F | 12/12 | 0 | $0.020268 | $0.001689 |

Class A: 24/24; Class B: 23/24.

Failures and timeouts:
- B1 armA: status evaluated, category step_limit, stepLimit true, detail 1: x counts rows (1.2991ms) i tests 1 i suites 0 i pass 0 i fail 1 i cancelled 0 i skipped 0 i todo 0 i duration_ms 11.1754 x failing tests:

Research totals: preCalls 6, preCredits 6, toolCalls 6, toolCredits 6, attempts 24, denied 12.
Cache reconciliation: research_usage 12 calls / 12 credits; rows sum 12 calls / 12 credits (call surplus is cache-hit research).

Manifest: mode real-full-targeted, runs 1, maxSteps 20, temperature 0, taskTimeoutMs 240000, clientTimeoutMs 120000, taskFilter [], armFilter ["A","C","D","F"].


## B1-A fix result

After the edit-nudge prompt ("after at most two exploratory reads or probes, apply the edit and run the test"), A rerun B1 three times (`bench/real_mw0olcgu`): 3/3 passed, 0 errors, $0.004962 per solved task. The earlier 20-step A loop no longer reproduces on B1. The other arms already solved B1 without research, so this confirms the failure was an A-arm loop, not a docs gap. A full 48/48 run is now expected but not yet re-run as a whole; the full-run headline remains 47/48.


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

`bench/real_mw0or6tw` (promptVersion `edit-nudge-v1`, recorded in the manifest) is the current full run: 48/48 solved, 100%, $0.111062 total, $0.002314 per solved. Per arm: A 12/12 $0.003797, C 12/12 $0.001802, D 12/12 $0.002383, F 12/12 $0.001272 per solved. Research reconciled: pre 6/6, tool 1/1, attempts 7, denied 0, cache 7/7. The earlier 47/48 (`real_mw0nvfe6`) was pre-nudge and is superseded. The current full run is still a negative for Tavily as a pass-rate lever: C matches D at 12/12 and is ~25 percent cheaper; F is cheapest of all. Cascade also shows no pass-rate gain over F, only cost differences. Tavily value remains citations and cost avoidance, not accuracy.