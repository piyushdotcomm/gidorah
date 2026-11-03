# Gidorah benchmark report (REAL models)

> Real Bifrost gateway, real Fireworks-hosted models, real token usage, real test outcomes. Cost is usage x published Fireworks Standard serverless rates. This is a small-sample pilot unless mode says full.

- Strong model: accounts/fireworks/models/deepseek-v4p1-flash
- Cheap model: accounts/fireworks/models/glm-5p3-flash
- Price source: https://fireworks.ai/pricing (Standard serverless, captured 2026-11-03)
- Rows: 48 evaluated, 45 solved, 0 errored/timeout, 0 missing, pass@1: 93.8%
- Cost per solved task: $0.004446
- Cost per successful task: $0.004446
- Total tokens: 628361, model requests: 360
- p50 row cost: $0.003195, p95 row cost: $0.011344

## Rows

| Task | Class | Arm | Run | Passed | Tokens | Cost USD | Model requests | Tool calls | Wall ms |
|---|---|---|---|---|---|---|---|---|---|
| A1 | A | A | 0 | yes | 15603 | $0.005857 | 8 | 12 | 14112 |
| A1 | A | C | 0 | yes | 6384 | $0.001500 | 5 | 5 | 8562 |
| A1 | A | D | 0 | yes | 6493 | $0.001614 | 5 | 6 | 7430 |
| A1 | A | F | 0 | yes | 5934 | $0.001023 | 5 | 5 | 15775 |
| A2 | A | A | 0 | yes | 10009 | $0.004042 | 6 | 9 | 11172 |
| A2 | A | C | 0 | yes | 8623 | $0.001858 | 7 | 7 | 8502 |
| A2 | A | D | 0 | yes | 9610 | $0.001980 | 8 | 7 | 8117 |
| A2 | A | F | 0 | yes | 6316 | $0.001162 | 5 | 6 | 120871 |
| A3 | A | A | 0 | yes | 20895 | $0.007359 | 10 | 14 | 17740 |
| A3 | A | C | 0 | yes | 6199 | $0.001388 | 5 | 5 | 7179 |
| A3 | A | D | 0 | yes | 7370 | $0.001631 | 6 | 6 | 7355 |
| A3 | A | F | 0 | yes | 7438 | $0.001268 | 6 | 7 | 6996 |
| A4 | A | A | 0 | yes | 16615 | $0.006405 | 9 | 13 | 20581 |
| A4 | A | C | 0 | yes | 6736 | $0.001647 | 5 | 6 | 7992 |
| A4 | A | D | 0 | yes | 6557 | $0.001554 | 5 | 6 | 7450 |
| A4 | A | F | 0 | yes | 6109 | $0.001061 | 5 | 6 | 5764 |
| A5 | A | A | 0 | yes | 10714 | $0.004434 | 6 | 10 | 13199 |
| A5 | A | C | 0 | yes | 16789 | $0.005268 | 10 | 12 | 15340 |
| A5 | A | D | 0 | yes | 7300 | $0.002026 | 5 | 6 | 10080 |
| A5 | A | F | 0 | yes | 6653 | $0.001224 | 5 | 6 | 8567 |
| A6 | A | A | 0 | yes | 8028 | $0.003195 | 5 | 6 | 9919 |
| A6 | A | C | 0 | yes | 15040 | $0.004669 | 9 | 12 | 12905 |
| A6 | A | D | 0 | yes | 9995 | $0.002132 | 8 | 7 | 9639 |
| A6 | A | F | 0 | yes | 7188 | $0.001260 | 6 | 6 | 8819 |
| B1 | B | A | 0 | no | 26620 | $0.010371 | 12 | 22 | 26357 |
| B1 | B | C | 0 | no | 31115 | $0.012328 | 12 | 23 | 38764 |
| B1 | B | D | 0 | yes | 20669 | $0.007387 | 9 | 10 | 26340 |
| B1 | B | F | 0 | yes | 19922 | $0.003869 | 12 | 17 | 24140 |
| B2 | B | A | 0 | yes | 28639 | $0.011344 | 12 | 17 | 29647 |
| B2 | B | C | 0 | yes | 12782 | $0.004572 | 7 | 9 | 23508 |
| B2 | B | D | 0 | yes | 11129 | $0.003573 | 6 | 7 | 16563 |
| B2 | B | F | 0 | yes | 8314 | $0.001547 | 6 | 8 | 8842 |
| B3 | B | A | 0 | no | 26928 | $0.011345 | 12 | 26 | 36877 |
| B3 | B | C | 0 | yes | 14235 | $0.005630 | 8 | 10 | 22233 |
| B3 | B | D | 0 | yes | 30832 | $0.010774 | 12 | 16 | 37628 |
| B3 | B | F | 0 | yes | 12021 | $0.002511 | 8 | 9 | 17747 |
| B4 | B | A | 0 | yes | 15966 | $0.006018 | 9 | 12 | 17538 |
| B4 | B | C | 0 | yes | 10833 | $0.003600 | 7 | 8 | 11597 |
| B4 | B | D | 0 | yes | 26366 | $0.008177 | 12 | 13 | 25444 |
| B4 | B | F | 0 | yes | 10755 | $0.001969 | 8 | 9 | 13501 |
| B5 | B | A | 0 | yes | 17247 | $0.007089 | 9 | 14 | 20358 |
| B5 | B | C | 0 | yes | 8362 | $0.001916 | 6 | 8 | 9433 |
| B5 | B | D | 0 | yes | 10090 | $0.002389 | 6 | 8 | 15249 |
| B5 | B | F | 0 | yes | 13310 | $0.002479 | 9 | 11 | 13851 |
| B6 | B | A | 0 | yes | 16624 | $0.008118 | 8 | 11 | 34731 |
| B6 | B | C | 0 | yes | 7449 | $0.002155 | 5 | 6 | 11617 |
| B6 | B | D | 0 | yes | 11963 | $0.003634 | 6 | 9 | 21930 |
| B6 | B | F | 0 | yes | 7592 | $0.001695 | 5 | 6 | 12865 |

## Notes

- Pricing: DeepSeek V4.1 Flash $0.30 in / $0.006 cached / $1.20 out per 1M; GLM 5.3 Flash $0.15 / $0.03 / $0.50 per 1M.
- Missing/errored/skipped rows: 0 for evaluated rows; a task that fails its test is a real failure, not missing data.
- Small sample: pilot is 3 tasks x 4 arms x 1 run. Full mode is 16 tasks x arms x runs.
