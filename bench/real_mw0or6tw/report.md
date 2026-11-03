# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 48 evaluated, 48 solved, 0 errored/timeout, 0 missing, pass@1: 100.0%
- Cost per solved task: $0.002314 (cost per successful task is undefined until retries are tracked)
- Total tokens: 413908, model requests: 267
- p50 row cost: $0.001805, p95 row cost: $0.004470

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | yes | 7461 | $0.002745 | 5 | 5 | 7787 |
| A1 | A | C | 0 | yes | 5066 | $0.001178 | 4 | 4 | 4561 |
| A1 | A | D | 0 | yes | 6295 | $0.001404 | 5 | 5 | 5357 |
| A1 | A | F | 0 | yes | 5958 | $0.000998 | 5 | 5 | 5536 |
| A2 | A | A | 0 | yes | 9610 | $0.003500 | 6 | 9 | 7924 |
| A2 | A | C | 0 | yes | 6329 | $0.001428 | 5 | 5 | 5412 |
| A2 | A | D | 0 | yes | 6323 | $0.001417 | 5 | 5 | 5912 |
| A2 | A | F | 0 | yes | 5988 | $0.001014 | 5 | 5 | 5909 |
| A3 | A | A | 0 | yes | 9623 | $0.003511 | 6 | 9 | 8935 |
| A3 | A | C | 0 | yes | 6344 | $0.001406 | 5 | 5 | 5727 |
| A3 | A | D | 0 | yes | 6356 | $0.001413 | 5 | 5 | 5981 |
| A3 | A | F | 0 | yes | 6022 | $0.001010 | 5 | 5 | 5146 |
| A4 | A | A | 0 | yes | 9626 | $0.003555 | 6 | 8 | 8659 |
| A4 | A | C | 0 | yes | 6469 | $0.001469 | 5 | 5 | 6092 |
| A4 | A | D | 0 | yes | 6519 | $0.001480 | 5 | 5 | 6815 |
| A4 | A | F | 0 | yes | 6079 | $0.001014 | 5 | 5 | 24808 |
| A5 | A | A | 0 | yes | 11143 | $0.004093 | 6 | 7 | 8312 |
| A5 | A | C | 0 | yes | 6888 | $0.001612 | 5 | 5 | 8389 |
| A5 | A | D | 0 | yes | 6839 | $0.001582 | 5 | 5 | 6351 |
| A5 | A | F | 0 | yes | 6500 | $0.001143 | 5 | 5 | 7175 |
| A6 | A | A | 0 | yes | 7732 | $0.002888 | 5 | 6 | 7089 |
| A6 | A | C | 0 | yes | 6406 | $0.001457 | 5 | 5 | 5790 |
| A6 | A | D | 0 | yes | 6448 | $0.001476 | 5 | 5 | 5795 |
| A6 | A | F | 0 | yes | 6043 | $0.001019 | 5 | 5 | 5554 |
| B1 | B | A | 0 | yes | 20346 | $0.007849 | 10 | 12 | 18434 |
| B1 | B | C | 0 | yes | 7392 | $0.002032 | 5 | 5 | 10696 |
| B1 | B | D | 0 | yes | 38879 | $0.008172 | 14 | 16 | 28948 |
| B1 | B | F | 0 | yes | 9298 | $0.002086 | 6 | 7 | 15854 |
| B2 | B | A | 0 | yes | 8186 | $0.003362 | 5 | 6 | 9122 |
| B2 | B | C | 0 | yes | 9417 | $0.002877 | 6 | 7 | 11867 |
| B2 | B | D | 0 | yes | 8831 | $0.002204 | 5 | 6 | 10311 |
| B2 | B | F | 0 | yes | 6818 | $0.001289 | 5 | 6 | 8233 |
| B3 | B | A | 0 | yes | 11936 | $0.004470 | 7 | 9 | 9947 |
| B3 | B | C | 0 | yes | 10797 | $0.002943 | 7 | 8 | 28974 |
| B3 | B | D | 0 | yes | 10277 | $0.002390 | 6 | 7 | 11612 |
| B3 | B | F | 0 | yes | 9347 | $0.002157 | 6 | 7 | 37490 |
| B4 | B | A | 0 | yes | 8018 | $0.003240 | 5 | 6 | 8792 |
| B4 | B | C | 0 | yes | 6979 | $0.001805 | 5 | 6 | 7575 |
| B4 | B | D | 0 | yes | 11098 | $0.002850 | 6 | 7 | 11145 |
| B4 | B | F | 0 | yes | 6372 | $0.001091 | 5 | 6 | 11773 |
| B5 | B | A | 0 | yes | 7665 | $0.002807 | 5 | 6 | 7251 |
| B5 | B | C | 0 | yes | 6806 | $0.001621 | 5 | 6 | 6665 |
| B5 | B | D | 0 | yes | 8099 | $0.001826 | 5 | 6 | 8195 |
| B5 | B | F | 0 | yes | 6469 | $0.001140 | 5 | 6 | 6644 |
| B6 | B | A | 0 | yes | 8346 | $0.003548 | 5 | 6 | 10763 |
| B6 | B | C | 0 | yes | 7348 | $0.001799 | 5 | 6 | 8269 |
| B6 | B | D | 0 | yes | 10218 | $0.002387 | 6 | 6 | 12268 |
| B6 | B | F | 0 | yes | 6899 | $0.001307 | 5 | 6 | 9268 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Errored/timeout rows are counted in the header and are not treated as test failures.
- Sample: pilot is 3 tasks x 3 arms; full is 12 tasks x 4 arms. Runs, maxSteps, temperature, task/client timeouts, filters, and promptVersion are recorded in manifest.json.
