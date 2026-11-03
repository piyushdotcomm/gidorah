# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 3 evaluated, 2 solved, 0 errored/timeout, 0 missing, pass@1: 66.7%
- Cost per solved task: $0.010379 (cost per successful task is undefined until retries are tracked)
- Total tokens: 62712, model requests: 25
- p50 row cost: $0.004774, p95 row cost: $0.013473

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| B1 | B | A | 0 | no | 6041 | $0.002511 | 4 | 9 | 128340 |
| B1 | B | C | 0 | yes | 38339 | $0.013473 | 13 | 21 | 36285 |
| B1 | B | D | 0 | yes | 18332 | $0.004774 | 8 | 9 | 20882 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.
- Sample: pilot is 3 tasks x 3 arms; full is 12 tasks x 4 arms. Runs are controlled by --runs or GIDORAH_BENCH_RUNS; temperature is pinned to 0 and recorded in the manifest.
