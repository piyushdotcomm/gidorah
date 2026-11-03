# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 18 evaluated, 16 solved, 0 errored/timeout, 0 missing, pass@1: 88.9%
- Cost per solved task: $0.006792
- Cost per successful task: $0.006792
- Total tokens: 313088, model requests: 157
- p50 row cost: $0.005277, p95 row cost: $0.011762

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| B1 | B | A | 0 | no | 26426 | $0.009837 | 12 | 21 | 25571 |
| B1 | B | C | 0 | yes | 18335 | $0.006803 | 9 | 13 | 21919 |
| B1 | B | D | 0 | no | 30041 | $0.008688 | 12 | 19 | 33170 |
| B2 | B | A | 0 | yes | 25593 | $0.010100 | 12 | 17 | 24860 |
| B2 | B | C | 0 | yes | 12428 | $0.003903 | 8 | 9 | 14917 |
| B2 | B | D | 0 | yes | 15716 | $0.005100 | 8 | 10 | 45582 |
| B3 | B | A | 0 | yes | 28685 | $0.011762 | 12 | 23 | 34160 |
| B3 | B | C | 0 | yes | 10683 | $0.003327 | 7 | 8 | 12122 |
| B3 | B | D | 0 | yes | 12392 | $0.003017 | 7 | 8 | 16922 |
| B4 | B | A | 0 | yes | 20656 | $0.008173 | 10 | 15 | 22925 |
| B4 | B | C | 0 | yes | 16444 | $0.005277 | 10 | 12 | 18839 |
| B4 | B | D | 0 | yes | 16164 | $0.004806 | 8 | 11 | 36680 |
| B5 | B | A | 0 | yes | 17148 | $0.007169 | 9 | 13 | 31815 |
| B5 | B | C | 0 | yes | 8753 | $0.003140 | 5 | 7 | 17935 |
| B5 | B | D | 0 | yes | 10433 | $0.002534 | 6 | 8 | 15216 |
| B6 | B | A | 0 | yes | 27576 | $0.011093 | 12 | 17 | 32987 |
| B6 | B | C | 0 | yes | 7413 | $0.001893 | 5 | 6 | 9915 |
| B6 | B | D | 0 | yes | 8202 | $0.002049 | 5 | 6 | 11749 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.
- Small sample: pilot is 3 tasks x 4 arms x 1 run. Full mode is 16 tasks x arms x runs.
