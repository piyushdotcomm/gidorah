# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 12, solved: 8, pass@1: 66.7%
- Cost per solved task: $0.004429
- Cost per successful task: $0.004429
- Total tokens: 135410, model requests: 88
- p50 row cost: $0.002166, p95 row cost: $0.008597

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | yes | 12742 | $0.005434 | 7 | 11 | 19266 |
| A1 | A | C | 0 | yes | 13011 | $0.002123 | 10 | 14 | 13587 |
| A1 | A | D | 0 | yes | 12990 | $0.002085 | 10 | 13 | 49198 |
| A1 | A | F | 0 | yes | 5997 | $0.001026 | 5 | 6 | 27805 |
| A2 | A | A | 0 | no | 21142 | $0.008597 | 10 | 18 | 29187 |
| A2 | A | C | 0 | yes | 13928 | $0.002479 | 9 | 11 | 20157 |
| A2 | A | D | 0 | no | 14769 | $0.002766 | 10 | 12 | 35887 |
| A2 | A | F | 0 | yes | 12266 | $0.002166 | 9 | 10 | 32810 |
| A3 | A | A | 0 | yes | 18192 | $0.007011 | 9 | 14 | 21005 |
| A3 | A | C | 0 | yes | 8359 | $0.001419 | 7 | 8 | 33581 |
| A3 | A | D | 0 | no | 2014 | $0.000326 | 2 | 3 | 15871 |
| A3 | A | F | 0 | no | 0 | $0.000000 | 0 | 0 | 5 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.
- Small sample: pilot is 3 tasks x 4 arms x 1 run. Full mode is 16 tasks x arms x runs.
