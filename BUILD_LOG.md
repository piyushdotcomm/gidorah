# Build log

Chronology only. Current state lives in `README.md`, `BUILD_REPORT.md`, and
`FINAL_STATE.md`. Numbers here are historical; where a run was superseded it is
labelled so.

## 2026-11-03

1. **Docs read and workspace scaffolded.** 34 docs, pnpm/TS plan, no code.
2. **Offline build (mock-first).** Shared, policy, Bifrost mock gateway, Tavily
   mock, core runtime, tools, audit chain, red team, replay, benchmark harness,
   CLI, conformance CT-01..CT-40, chaos, TUI plain renderer. 104 tests.
   This is the "offline evidence" state, still valid for the mock path.
3. **Toolchains installed.** Go 1.27.3 (plugin vet/test), pnpm standalone,
   TypeScript 7.0.2; typecheck real.
4. **Real Bifrost built from source** (npm CDN was throttled), real Ollama 0.40.13
   installed, 0.5B model, then a 3B GGUF imported from HuggingFace.
5. **Real providers wired.** Fireworks AI replaced DeepSeek (native Bifrost
   provider); Tavily HTTP client; real CLI session; real coding task
   (failing test fixed via tools).
6. **Benchmark v1 (superseded).** `bench/real_mw0etfge` pilot and
   `bench/real_mw0ffoii` full run used the synthetic math task set; the "C arm"
   actually sent one model alias for every phase. Both are kept as history and
   labelled superseded.
7. **Benchmark v2 (current).** Task set replaced with 6 Class A plus 6
   runtime-docs-dependent Class B tasks, validated by a fail-before/pass-after
   test; per-phase cascade wired and tested; arms A, C, D, F; metrics derived
   from session events; hard per-task timeout.
8. **Docs audit loop.** CLI contract closed, Docs Guard wired into edits, real
   Tavily wired into `gidorah run`, TUI adapter panels, real-service chaos, CI,
   Docker, devcontainer, measurements, and doc-status drift fixed.

## Superseded evidence

| Run | Why superseded |
|---|---|
| `bench/real_mw0etfge` | synthetic math tasks, 3-task pilot |
| `bench/real_mw0f94jv` | uncapped run hung after 11 rows |
| `bench/real_mw0ffoii` | 16 synthetic math tasks; arm C was always-cheap, not a cascade |
| `bench/real_mw0g3w0s` | corrected pilot before the docs-first research trigger |

- **Correction pass (current).** Real cascade wired and tested; synthetic math tasks replaced with 6 Class A + 6 runtime-docs Class B tasks; arms reduced to A/C/D/F; metrics derived from events; deterministic docs-first Tavily in arm D; Class B run 18 rows / 16 solved. Partial A-class run real_mw0g7hvx is superseded and not used as the headline.

- **Evidence-integrity fix.** failureCategory/failureDetail/step-limit and split Tavily accounting now reach raw rows (verified in real_mw0k7ayt); the current post-fix evidence is `real_mw0nvfe6` (full) and `real_mw0ksdno` (pilot); full runs before the fix are superseded for those fields. Arm F is reported as the best arm on the current task set; cascade/Tavily savings are not claimed.

- **Post-fix full run.** 12 tasks x A/C/D/F, 1 run, 48 rows, 47 solved, 97.9%, $0.004475/solved; manifest records runs 1, maxSteps 20, temperature 0, timeouts, filters. Current evidence: real_mw0nvfe6.

- **Nudge full run.** 12 tasks x A/C/D/F with promptVersion edit-nudge-v1: recorded under eal_mw0or6tw; manifest carries promptVersion/editNudge.
