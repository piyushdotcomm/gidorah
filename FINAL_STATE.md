# Final state (one page)

## Verified with real services
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
- Full DSH TUI integration behind the CLI.
- Full corrected benchmark run (see `bench/` and `BUILD_REPORT.md`).

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

- Full 12-task run recorded under `bench/` (A/C/D, 1 run; failures carry `failureCategory`).
- Tavily is reported as an honest negative for pass rate (C 6/6 vs D 5/6) and reframed as citations plus cost avoidance.
- Real 402, real primary-provider fallback, and live gateway DLP are explicitly NOT demonstrated; see `BUILD_REPORT.md` and evidence files.
- Patch-first/repo-map are always-on and not ablated; no savings claim.

### Full corrected run (12 tasks x arms A/C/D/F, 1 run)

Rows 48, evaluated 48, solved 45, pass@1 93.8 percent, errored 0.
Total cost $0.200050, cost per solved task $0.004446, tokens 628361, model requests 360.

| Arm | Solved | Cost USD | Cost per solved |
|---|---|---|---|
| A | 10/12 | $0.085578 | $0.008558 |
| C | 11/12 | $0.046530 | $0.004230 |
| D | 12/12 | $0.046872 | $0.003906 |
| F | 12/12 | $0.021069 | $0.001756 |

Class A: 24/24 solved. Class B: 21/24 solved. Class B by arm: A 4/6, C 5/6, D 6/6, F 6/6.
Failure categories present in raw rows where a task failed; no errored/timeout rows in this run.
Tavily honesty: full run arm D 12/12 vs C 11/12 (one task), Class B-only run arm D 5/6 vs C 6/6. The two samples disagree and n=12; no reliable pass-rate win is claimed. Tavily value reported as citations plus cost avoidance.