# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 3 evaluated, 3 solved, 0 errored/timeout, 0 missing, pass@1: 100.0%
- Cost per solved task: $0.004962 (cost per successful task is undefined until retries are tracked)
- Total tokens: 35006, model requests: 19
- p50 row cost: $0.004874, p95 row cost: $0.006012

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| B1 | B | A | 0 | yes | 15022 | $0.006012 | 8 | 10 | 15320 |
| B1 | B | A | 1 | yes | 10993 | $0.004874 | 6 | 8 | 14139 |
| B1 | B | A | 2 | yes | 8991 | $0.003999 | 5 | 8 | 12064 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Errored/timeout rows are counted in the header and are not treated as test failures.
- Sample: pilot is 3 tasks x 3 arms; full is 12 tasks x 4 arms. Runs, maxSteps, temperature, task/client timeouts, and filters are recorded in manifest.json.
