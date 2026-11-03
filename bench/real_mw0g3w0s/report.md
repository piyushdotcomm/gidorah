# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 9 evaluated, 7 solved, 0 errored/timeout, 0 missing, pass@1: 77.8%
- Cost per solved task: $0.006454
- Cost per successful task: $0.006454
- Total tokens: 135121, model requests: 74
- p50 row cost: $0.004756, p95 row cost: $0.010084

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | yes | 19698 | $0.007141 | 10 | 16 | 16134 |
| A1 | A | C | 0 | yes | 7288 | $0.001620 | 6 | 6 | 9292 |
| A1 | A | D | 0 | yes | 6247 | $0.001457 | 5 | 5 | 12292 |
| A2 | A | A | 0 | yes | 12544 | $0.004756 | 7 | 10 | 11361 |
| A2 | A | C | 0 | yes | 7934 | $0.001971 | 6 | 6 | 8590 |
| A2 | A | D | 0 | yes | 6325 | $0.001458 | 5 | 5 | 6474 |
| B1 | B | A | 0 | yes | 25219 | $0.010084 | 11 | 16 | 23957 |
| B1 | B | C | 0 | no | 23312 | $0.008022 | 12 | 16 | 21837 |
| B1 | B | D | 0 | no | 26554 | $0.008668 | 12 | 21 | 24571 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.
- Small sample: pilot is 3 tasks x 4 arms x 1 run. Full mode is 16 tasks x arms x runs.
