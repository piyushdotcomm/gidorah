# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 27 evaluated, 26 solved, 0 errored/timeout, 0 missing, pass@1: 96.3%
- Cost per solved task: $0.005471 (cost per successful task is undefined until retries are tracked)
- Total tokens: 424581, model requests: 221
- p50 row cost: $0.003667, p95 row cost: $0.012971

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | yes | 9569 | $0.003666 | 6 | 9 | 12218 |
| A1 | A | A | 1 | yes | 17275 | $0.006189 | 9 | 13 | 12649 |
| A1 | A | A | 2 | yes | 9579 | $0.003667 | 6 | 9 | 8742 |
| A1 | A | C | 0 | yes | 7252 | $0.001566 | 6 | 6 | 8832 |
| A1 | A | C | 1 | yes | 7631 | $0.001678 | 6 | 8 | 9216 |
| A1 | A | C | 2 | yes | 6315 | $0.001535 | 5 | 5 | 16461 |
| A1 | A | D | 0 | yes | 6289 | $0.001443 | 5 | 6 | 6959 |
| A1 | A | D | 1 | yes | 6211 | $0.001384 | 5 | 5 | 10549 |
| A1 | A | D | 2 | yes | 6221 | $0.001397 | 5 | 6 | 6575 |
| A2 | A | A | 0 | yes | 9741 | $0.003793 | 6 | 9 | 11548 |
| A2 | A | A | 1 | yes | 9663 | $0.003689 | 6 | 9 | 11448 |
| A2 | A | A | 2 | yes | 14606 | $0.005417 | 8 | 12 | 16293 |
| A2 | A | C | 0 | yes | 6305 | $0.001443 | 5 | 6 | 6137 |
| A2 | A | C | 1 | yes | 6321 | $0.001453 | 5 | 6 | 5766 |
| A2 | A | C | 2 | yes | 11773 | $0.003416 | 8 | 9 | 9302 |
| A2 | A | D | 0 | yes | 7321 | $0.001580 | 6 | 6 | 7170 |
| A2 | A | D | 1 | yes | 7317 | $0.001591 | 6 | 6 | 7296 |
| A2 | A | D | 2 | yes | 11776 | $0.003421 | 8 | 9 | 10479 |
| B1 | B | A | 0 | yes | 24274 | $0.009865 | 11 | 18 | 31686 |
| B1 | B | A | 1 | yes | 31243 | $0.011834 | 12 | 21 | 29175 |
| B1 | B | A | 2 | no | 30559 | $0.012901 | 12 | 22 | 159301 |
| B1 | B | C | 0 | yes | 38549 | $0.012971 | 17 | 20 | 32631 |
| B1 | B | C | 1 | yes | 24139 | $0.008338 | 12 | 14 | 32170 |
| B1 | B | C | 2 | yes | 32546 | $0.011136 | 15 | 20 | 31234 |
| B1 | B | D | 0 | yes | 15842 | $0.004753 | 7 | 8 | 22483 |
| B1 | B | D | 1 | yes | 50430 | $0.017297 | 17 | 19 | 62592 |
| B1 | B | D | 2 | yes | 15834 | $0.004823 | 7 | 8 | 19343 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.
- Sample: pilot is 3 tasks x 3 arms; full is 12 tasks x 4 arms. Runs are controlled by --runs or GIDORAH_BENCH_RUNS; temperature is pinned to 0 and recorded in the manifest.
