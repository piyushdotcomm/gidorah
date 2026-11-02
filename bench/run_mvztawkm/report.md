# Gidorah benchmark report

> **Mock-model harness measurement.** No provider keys exist in this build, so the agent loop, tools, context management, and session/audit plumbing run for real against a scripted mock model. The numbers below are real outputs of those runs but do NOT measure model quality. Real-provider results are PENDING: see MORNING_RUNBOOK.md.

- Run: run_mvztawkm
- Mode: pilot
- Node: v26.13.0
- Task set hash: 42564ee66eef250c4b7f85fd1438c1b662a87a76c641d24ac9c69b92ba3dec68
- Arms: A, C, D, F

## Results by arm

| Arm | Evaluated | Solved | pass@1 | Cost per solved | p50 row cost | p95 row cost | Tokens | Model requests | Research calls | Unnecessary research |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 3 | 0 | 0.0% | $0.000000 | $0.000896 | $0.000896 | 4151 | 12 | 0 | 0 |
| C | 3 | 0 | 0.0% | $0.000000 | $0.000205 | $0.000205 | 4152 | 12 | 0 | 0 |
| D | 3 | 0 | 0.0% | $0.000000 | $0.000205 | $0.000205 | 4152 | 12 | 0 | 0 |
| F | 3 | 0 | 0.0% | $0.000000 | $0.000205 | $0.000205 | 4151 | 12 | 0 | 0 |

## Per-task rows

| Task | Class | Arm | Run | Passed | Tokens | Cost | Research calls | Model requests |
|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | no | 1383 | $0.000895 | 0 | 4 |
| A1 | A | C | 0 | no | 1384 | $0.000205 | 0 | 4 |
| A1 | A | D | 0 | no | 1384 | $0.000205 | 0 | 4 |
| A1 | A | F | 0 | no | 1384 | $0.000205 | 0 | 4 |
| A2 | A | A | 0 | no | 1384 | $0.000896 | 0 | 4 |
| A2 | A | C | 0 | no | 1384 | $0.000205 | 0 | 4 |
| A2 | A | D | 0 | no | 1384 | $0.000205 | 0 | 4 |
| A2 | A | F | 0 | no | 1383 | $0.000205 | 0 | 4 |
| A3 | A | A | 0 | no | 1384 | $0.000896 | 0 | 4 |
| A3 | A | C | 0 | no | 1384 | $0.000205 | 0 | 4 |
| A3 | A | D | 0 | no | 1384 | $0.000205 | 0 | 4 |
| A3 | A | F | 0 | no | 1384 | $0.000205 | 0 | 4 |

## Validity notes

- Missing/errored/skipped rows: 0 (offline scripted runs cannot fail on a provider).
- Cost uses the mock gateway price table in packages/bifrost/src/mock-gateway.ts, not real invoices.
- Cold vs warm cache: not measured offline; PENDING with real Bifrost.
- Provider prompt-cache savings are not claimed; cache read tokens are 0 in this measurement.
- Task set: 8 Class A (repo-local, zero research allowed) and 8 Class B (docs-dependent) for full runs; pilot uses the first three tasks and arms A, C, D, F.
