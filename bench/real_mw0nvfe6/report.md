# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 48 evaluated, 47 solved, 0 errored/timeout, 0 missing, pass@1: 97.9%
- Cost per solved task: $0.004475 (cost per successful task is undefined until retries are tracked)
- Total tokens: 660316, model requests: 347
- p50 row cost: $0.002585, p95 row cost: $0.015197

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | yes | 7798 | $0.003011 | 5 | 7 | 7801 |
| A1 | A | C | 0 | yes | 6092 | $0.001367 | 5 | 5 | 6149 |
| A1 | A | D | 0 | yes | 6131 | $0.001381 | 5 | 5 | 8697 |
| A1 | A | F | 0 | yes | 5790 | $0.000981 | 5 | 5 | 5449 |
| A2 | A | A | 0 | yes | 7776 | $0.002958 | 5 | 7 | 8309 |
| A2 | A | C | 0 | yes | 6184 | $0.001412 | 5 | 5 | 5720 |
| A2 | A | D | 0 | yes | 6327 | $0.001465 | 5 | 6 | 6075 |
| A2 | A | F | 0 | yes | 5921 | $0.001011 | 5 | 6 | 5869 |
| A3 | A | A | 0 | yes | 10492 | $0.003866 | 6 | 8 | 9854 |
| A3 | A | C | 0 | yes | 6231 | $0.001385 | 5 | 6 | 5346 |
| A3 | A | D | 0 | yes | 6286 | $0.001440 | 5 | 6 | 6147 |
| A3 | A | F | 0 | yes | 5857 | $0.000976 | 5 | 6 | 5236 |
| A4 | A | A | 0 | yes | 10938 | $0.004174 | 6 | 8 | 10317 |
| A4 | A | C | 0 | yes | 6521 | $0.001505 | 5 | 6 | 6104 |
| A4 | A | D | 0 | yes | 6436 | $0.001448 | 5 | 6 | 6682 |
| A4 | A | F | 0 | yes | 6084 | $0.001047 | 5 | 6 | 5652 |
| A5 | A | A | 0 | yes | 11660 | $0.004920 | 6 | 8 | 14440 |
| A5 | A | C | 0 | yes | 6912 | $0.001649 | 5 | 6 | 7414 |
| A5 | A | D | 0 | yes | 7313 | $0.001868 | 5 | 6 | 9885 |
| A5 | A | F | 0 | yes | 6792 | $0.001315 | 5 | 6 | 8406 |
| A6 | A | A | 0 | yes | 10091 | $0.003943 | 6 | 8 | 10667 |
| A6 | A | C | 0 | yes | 6503 | $0.001520 | 5 | 6 | 6638 |
| A6 | A | D | 0 | yes | 6337 | $0.001455 | 5 | 6 | 5869 |
| A6 | A | F | 0 | yes | 6124 | $0.001081 | 5 | 6 | 6679 |
| B1 | B | A | 0 | no | 61614 | $0.023374 | 20 | 37 | 46280 |
| B1 | B | C | 0 | yes | 15493 | $0.005336 | 8 | 11 | 19287 |
| B1 | B | D | 0 | yes | 20234 | $0.005164 | 8 | 11 | 27857 |
| B1 | B | F | 0 | yes | 13213 | $0.002674 | 8 | 11 | 18288 |
| B2 | B | A | 0 | yes | 39171 | $0.015197 | 15 | 20 | 38004 |
| B2 | B | C | 0 | yes | 13912 | $0.004907 | 8 | 10 | 15770 |
| B2 | B | D | 0 | yes | 12516 | $0.003821 | 6 | 8 | 19581 |
| B2 | B | F | 0 | yes | 19062 | $0.003822 | 11 | 13 | 25126 |
| B3 | B | A | 0 | yes | 42579 | $0.016775 | 15 | 25 | 42093 |
| B3 | B | C | 0 | yes | 22678 | $0.008069 | 11 | 13 | 24504 |
| B3 | B | D | 0 | yes | 31915 | $0.011693 | 12 | 16 | 42368 |
| B3 | B | F | 0 | yes | 9843 | $0.001920 | 7 | 9 | 14427 |
| B4 | B | A | 0 | yes | 15019 | $0.006078 | 8 | 10 | 20333 |
| B4 | B | C | 0 | yes | 11369 | $0.003639 | 7 | 9 | 12686 |
| B4 | B | D | 0 | yes | 20429 | $0.006511 | 8 | 10 | 21308 |
| B4 | B | F | 0 | yes | 11477 | $0.002137 | 8 | 10 | 13403 |
| B5 | B | A | 0 | yes | 37693 | $0.014880 | 16 | 23 | 40308 |
| B5 | B | C | 0 | yes | 8975 | $0.002287 | 6 | 7 | 14483 |
| B5 | B | D | 0 | yes | 8022 | $0.001754 | 5 | 6 | 21092 |
| B5 | B | F | 0 | yes | 6441 | $0.001174 | 5 | 6 | 7759 |
| B6 | B | A | 0 | yes | 17825 | $0.007162 | 9 | 12 | 22026 |
| B6 | B | C | 0 | yes | 9866 | $0.002585 | 6 | 7 | 16341 |
| B6 | B | D | 0 | yes | 28890 | $0.010035 | 10 | 12 | 40754 |
| B6 | B | F | 0 | yes | 9484 | $0.002130 | 6 | 7 | 18002 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Errored/timeout rows are counted in the header and are not treated as test failures.
- Sample: pilot is 3 tasks x 3 arms; full is 12 tasks x 4 arms. Runs, maxSteps, temperature, task/client timeouts, and filters are recorded in manifest.json.
