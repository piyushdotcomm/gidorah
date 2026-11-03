# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 27 evaluated, 24 solved, 0 errored/timeout, 0 missing, pass@1: 88.9%
- Cost per solved task: $0.006910 (cost per successful task is undefined until retries are tracked)
- Total tokens: 495230, model requests: 229
- p50 row cost: $0.003745, p95 row cost: $0.022689

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | yes | 10516 | $0.003943 | 6 | 8 | 14882 |
| A1 | A | A | 1 | yes | 10338 | $0.003810 | 6 | 8 | 10326 |
| A1 | A | A | 2 | yes | 10165 | $0.004006 | 6 | 9 | 11800 |
| A1 | A | C | 0 | yes | 6168 | $0.001371 | 5 | 5 | 5488 |
| A1 | A | C | 1 | yes | 6227 | $0.001392 | 5 | 5 | 6836 |
| A1 | A | C | 2 | yes | 6174 | $0.001384 | 5 | 5 | 11568 |
| A1 | A | D | 0 | yes | 6643 | $0.001646 | 5 | 6 | 9834 |
| A1 | A | D | 1 | yes | 6238 | $0.001410 | 5 | 6 | 6475 |
| A1 | A | D | 2 | yes | 6192 | $0.001390 | 5 | 5 | 7164 |
| A2 | A | A | 0 | yes | 10316 | $0.003745 | 6 | 8 | 10135 |
| A2 | A | A | 1 | yes | 10409 | $0.003844 | 6 | 8 | 11497 |
| A2 | A | A | 2 | yes | 7782 | $0.002972 | 5 | 7 | 12016 |
| A2 | A | C | 0 | yes | 6316 | $0.001455 | 5 | 6 | 6853 |
| A2 | A | C | 1 | yes | 6174 | $0.001406 | 5 | 5 | 6900 |
| A2 | A | C | 2 | yes | 6341 | $0.001497 | 5 | 6 | 7312 |
| A2 | A | D | 0 | yes | 6224 | $0.001449 | 5 | 5 | 8018 |
| A2 | A | D | 1 | yes | 6163 | $0.001387 | 5 | 5 | 6102 |
| A2 | A | D | 2 | yes | 6221 | $0.001449 | 5 | 5 | 6565 |
| B1 | B | A | 0 | no | 60244 | $0.022689 | 20 | 37 | 57310 |
| B1 | B | A | 1 | no | 57589 | $0.020838 | 20 | 32 | 50218 |
| B1 | B | A | 2 | yes | 61722 | $0.023270 | 20 | 29 | 58878 |
| B1 | B | C | 0 | yes | 27545 | $0.009139 | 13 | 16 | 29579 |
| B1 | B | C | 1 | no | 55761 | $0.018910 | 20 | 39 | 44247 |
| B1 | B | C | 2 | yes | 19677 | $0.006978 | 10 | 12 | 23225 |
| B1 | B | D | 0 | yes | 15631 | $0.004600 | 7 | 10 | 19095 |
| B1 | B | D | 1 | yes | 36693 | $0.011894 | 14 | 18 | 31980 |
| B1 | B | D | 2 | yes | 25761 | $0.007961 | 10 | 13 | 24946 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Errored/timeout rows are counted in the header and are not treated as test failures.
- Sample: pilot is 3 tasks x 3 arms; full is 12 tasks x 4 arms. Runs, maxSteps, temperature, task/client timeouts, and filters are recorded in manifest.json.
