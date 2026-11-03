# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 32, solved: 13, pass@1: 40.6%
- Cost per solved task: $0.007097
- Cost per successful task: $0.007097
- Total tokens: 285654, model requests: 191
- p50 row cost: $0.003407, p95 row cost: $0.005349

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | no | 10098 | $0.004151 | 6 | 13 | 11883 |
| A1 | A | C | 0 | yes | 6390 | $0.001164 | 5 | 6 | 16135 |
| A2 | A | A | 0 | no | 9352 | $0.003635 | 6 | 13 | 32124 |
| A2 | A | C | 0 | yes | 8015 | $0.001533 | 6 | 11 | 33336 |
| A3 | A | A | 0 | no | 9720 | $0.003831 | 6 | 13 | 10625 |
| A3 | A | C | 0 | yes | 7049 | $0.001247 | 6 | 7 | 20817 |
| A4 | A | A | 0 | no | 10403 | $0.004593 | 6 | 12 | 16429 |
| A4 | A | C | 0 | no | 6729 | $0.001047 | 6 | 8 | 16614 |
| A5 | A | A | 0 | yes | 11228 | $0.004933 | 6 | 13 | 16439 |
| A5 | A | C | 0 | no | 7343 | $0.001314 | 6 | 9 | 15429 |
| A6 | A | A | 0 | no | 12145 | $0.005988 | 6 | 14 | 21892 |
| A6 | A | C | 0 | yes | 8206 | $0.001664 | 6 | 7 | 18252 |
| A7 | A | A | 0 | no | 9759 | $0.003931 | 6 | 13 | 13502 |
| A7 | A | C | 0 | yes | 9179 | $0.001950 | 6 | 10 | 24326 |
| A8 | A | A | 0 | yes | 10081 | $0.004164 | 6 | 11 | 15459 |
| A8 | A | C | 0 | no | 7290 | $0.001309 | 6 | 9 | 15235 |
| B1 | B | A | 0 | no | 10904 | $0.004828 | 6 | 15 | 16973 |
| B1 | B | C | 0 | no | 6706 | $0.001132 | 6 | 6 | 6973 |
| B2 | B | A | 0 | no | 10152 | $0.004175 | 6 | 13 | 13568 |
| B2 | B | C | 0 | yes | 7330 | $0.001286 | 6 | 7 | 7876 |
| B3 | B | A | 0 | no | 9141 | $0.003407 | 6 | 12 | 8294 |
| B3 | B | C | 0 | yes | 7528 | $0.001260 | 6 | 9 | 7358 |
| B4 | B | A | 0 | no | 10851 | $0.004835 | 6 | 16 | 15886 |
| B4 | B | C | 0 | yes | 8331 | $0.001658 | 6 | 9 | 12199 |
| B5 | B | A | 0 | no | 10392 | $0.004214 | 6 | 13 | 11379 |
| B5 | B | C | 0 | yes | 7270 | $0.001309 | 6 | 10 | 7400 |
| B6 | B | A | 0 | no | 11102 | $0.005349 | 6 | 12 | 18985 |
| B6 | B | C | 0 | yes | 7172 | $0.001248 | 6 | 9 | 7177 |
| B7 | B | A | 0 | no | 9993 | $0.004128 | 6 | 13 | 12245 |
| B7 | B | C | 0 | no | 7478 | $0.001274 | 6 | 11 | 6993 |
| B8 | B | A | 0 | no | 10078 | $0.004058 | 6 | 13 | 12011 |
| B8 | B | C | 0 | yes | 8239 | $0.001638 | 6 | 12 | 11038 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.
- Small sample: pilot is 3 tasks x 4 arms x 1 run. Full mode is 16 tasks x arms x runs.
