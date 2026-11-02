# Benchmark Plan

**Status:** Draft · **Owner:** Evaluation · **Last updated:** 2026-11-03

The benchmark is the proof. It must show that Gidorah completes real coding tasks while spending fewer tokens and dollars, and that Bifrost and Tavily each contribute. No estimates.

---

## 1. Hypotheses

| ID | Hypothesis | Falsified if |
|---|---|---|
| H1 | Phase-aware routing + context discipline lowers cost per solved task vs always-Pro. | Cost is equal/higher at equal pass rate. |
| H2 | Bifrost complexity/router + fallbacks improve reliability without increasing cost. | No reliability gain or cost increases materially. |
| H3 | Tavily improves pass rate on docs-dependent tasks and reduces tokens per solved task by preventing failed iterations. | No pass-rate gain or tokens are higher. |
| H4 | Tavily makes zero calls on repo-local tasks. | Any unnecessary call appears. |
| H5 | Confidential mode has zero cloud/Tavily egress. | Any external call is observed. |

---

## 2. Task classes

### Class A — Repo-local (8–10 tasks)
- Bug fixes, refactors, tests, small features within one repo.
- All required knowledge is in the repo, lockfile, or installed package docs.
- **Tavily must make zero calls.**
- Examples: fix failing auth test; add validation; refactor a module; add a CLI flag.

### Class B — Docs-dependent (8–10 tasks)
- The task depends on a current external API, a changed library version, or an exact error fix.
- The model’s training data is likely stale or insufficient.
- Local docs are absent or version-mismatched.
- Tavily is expected to be used (≤2 calls).
- Examples: integrate a library API that changed in 2026; fix a version-specific error; use a new SDK method.

### Task selection criteria
- Real repository with a test suite.
- Deterministic tests; no network at test time.
- Clear pass/fail; no subjective review for the headline metric.
- Small enough to run 5× within the budget.
- Contamination-resistant: tasks from recent commits or synthetic fixtures written for the benchmark.
- Store the task spec, base commit, tests, and expected behavior in `tests/bench/tasks/`.

### Suggested repositories
- One TypeScript repo with Vitest/Jest (matches the stack).
- One Python repo only if time permits; do not mix languages in v1.
- Avoid giant monorepos; setup time dominates.

See [task-catalog.md](task-catalog.md) for candidate tasks and the spec template.

---

## 3. Arms

| Arm | Model plane | Context | Knowledge plane | Purpose |
|---|---|---|---|---|
| A | Always Pro | Full | None | Quality/cost ceiling |
| B | Bifrost complexity router | Full | None | Bifrost-only value |
| C | Gidorah phase cascade | Pruned + compacted | None | Agent-level savings |
| D | Gidorah phase cascade | Pruned + compacted | Tavily Scout | Full dual-plane |

Optional arms:
- E: Gidorah cascade + exact cache, no Tavily (isolate cache).
- F: Always Flash (cost floor, quality check).
- G: Gidorah cascade + Tavily Docs Guard (Class B subset; isolate proactive verification).
- H: Bifrost MCP Gateway + Code Mode for read-only tools (stretch; isolate tool-plane token savings).
- I: Patch-first edits only (find/replace; full-file rewrites disabled).
- J: Repo map + symbol/range reads (no full-file reads unless justified).

Context-economics sub-arms (run on a subset):
- C1: full history, no cap.
- C2: stable tool-output cap only.
- C3: cap + clear old tool results.
- C4: cap + compaction.
Hypothesis: C2 wins cost with equal pass rate; C4 can lose because summarization rewrites the cached prefix. Report the result even if it contradicts the plan.

All arms use the same tasks, prompts, base commit, tool set, and approval policy (benchmark auto-approve in a disposable worktree). Only the variable under test changes.

---

## 4. Metrics

### Primary
- **Cost per solved task** = total LLM cost + research credits valued in USD / number of tasks passed.
- **Cost per successful task** = total cost (input, output, cache write amortization, retries, tool/research credits) / tasks delivered to spec.
- **Pass@1** = passed tasks / attempted tasks.
- **Cost per attempt** = total cost / attempts.

### Secondary
- Input, cache-read, cache-write, output, total tokens (per solved task).
- Model requests per solved task (round trips).
- Tool calls per model request (batching efficiency).
- Output tokens per edit and patch size (patch-first arm).
- Full-file reads per task and input tokens from file bodies (repo-map arm).
- Turns and steps per solved task.
- Tool calls per solved task.
- Research calls per solved task; credits per solved task.
- Unnecessary research rate (Class A tasks with any Tavily call).
- Tavily cache hit rate.
- Docs Guard lookups per edit and prevented failed iterations (arm G).
- Bifrost fallback count and recovery success.
- Approval prompts per task.
- Wall-clock time.
- Cache hit rate and prefix-hash changes (context economics).
- Compaction net cost: summary cost + cache-loss cost vs token reduction.
- Missing/errored/skipped rows (never hidden in the denominator).
- Price-per-task variance (p50/p95, not only the mean).

### Cost decomposition

Report separately:
- uncached input, cache-read input, cache-write input;
- output/reasoning tokens;
- retry cost;
- Tavily credits;
- cache-write amortization;
- (optional) human approval time, not included in the headline cost.

A lower token count with a higher bill is not a win. Cache-aware cost is the headline.

### Reporting
- Median and IQR across 5 runs.
- Per-task win/loss/tie vs baseline.
- Bootstrap 95% confidence interval for cost per solved task.
- Token breakdown by source (system, tools, history, tool results, research card, output).
- Cold vs warm cache reported separately.
- Credit costs reported separately from USD; combined only with an explicit conversion.
- Missing/errored/skipped counts reported separately from failures.
- Small-sample caveat stated explicitly; no claim of statistical significance beyond the CI.

---

## 5. Protocol

0. Run a **3-task pilot** first (one per difficulty band). Inspect every row: predictor finished, tool calls executed, scorer returned a valid result, output persisted. Fix the harness before the full run. Keep pilot IDs.
1. Freeze the base commit, model versions, Bifrost version, prompt version, and tool set.
2. Create a fresh git worktree per task/run.
3. Start a fresh session; no cross-task cache unless the arm explicitly tests cache.
4. Set `x-bf-session-id` to a run/task id for Bifrost log grouping.
5. Run the task with a hard time, token, and task-budget cap.
6. Apply the patch; run the task’s tests.
7. Record pass/fail and capture Bifrost/Tavily usage.
8. Repeat 5× per arm/task; randomize arm order to reduce drift.
9. Export raw JSONL and generate `report.md` + charts.
10. Report evaluated, failed, missing, skipped, and errored rows separately.
11. Publish the command and artifacts with the submission.
12. Run `gidorah demo --replay` from the recorded traces to prove offline reproducibility.

### Approval in benchmarks
Benchmarks run in a disposable worktree with a `benchmark` policy that auto-approves writes/shell/git **inside that worktree**. This is a documented sandbox exception; the default user policy still asks. The conformance suite tests the real approval behavior separately.

### Pilot and budget

- **Pilot:** 3 tasks × 1 run × 4 arms, row-level inspection. Validate the harness, metrics, and cost.
- **Context sub-arms:** 4 tasks × 2 runs, cap-only vs cap+clear vs cap+compaction.
- **Full:** 16–20 tasks × 5 runs × 4 arms.
- Use a dedicated Bifrost benchmark virtual key with a hard budget and a Tavily credit cap.
- Record spend per arm; if the budget is tight, reduce Class B to 6 and runs to 3, and document the limitation.
- Never let the benchmark run without a cap; a runaway benchmark is a failed benchmark.

---

## 6. Statistics and validity

- Use paired comparisons (same task, same run conditions) and report per-task deltas.
- 5 runs is a hackathon sample; avoid claiming statistical significance beyond a bootstrap CI. State the limitation.
- Control for prompt/model changes; one variable at a time.
- Cold vs warm cache: provider caches persist across runs; report both and never attribute provider cache savings to Gidorah.
- Compaction: report the full cost (summarizer + cache invalidation) and never assume a smaller context is cheaper.
- Contamination: prefer tasks from recent commits; document the risk.
- Task difficulty skew: report Class A and Class B separately.
- Failure analysis: categorize failures (wrong API, incomplete patch, test environment, model refusal, budget/time).
- Missing data: a row that did not run is not a failure; report it separately and do not hide it in the denominator.
- Judge alignment: if an LLM judge is used for qualitative notes, align it against a small human-labeled set; never use it for the security gates.
- If Tavily or compaction hurts, report it. A negative result with an explanation is stronger than a fabricated win.

---

## 7. Artifacts

```text
bench/
  <run-id>/
    manifest.json        # versions, commits, arms, seeds
    raw.jsonl            # one record per task/run
    report.md            # human-readable
    charts/
      cost-per-solved.png
      pass-rate.png
      token-breakdown.png
      tavily-impact.png
      docs-guard.png
      context-economics.png
      cost-decomposition.png
    traces/              # per-task flight recorder
```

`manifest.json` includes:
- Gidorah version/commit
- Bifrost version
- Model ids and versions
- Tavily SDK/API version
- Node version
- Task set hash
- Prompt version
- Run timestamps
- Policy version

---

## 8. Acceptance criteria

- [ ] 16–20 tasks across Class A and Class B.
- [ ] 5 runs per arm/task (or a documented reduction with justification).
- [ ] Raw artifacts + report generated by one command.
- [ ] Cost per solved task and pass@1 reported with CIs.
- [ ] Class A: zero Tavily calls.
- [ ] Confidential mode: zero cloud/Tavily calls.
- [ ] Every claim traceable to a trace record.
- [ ] Negative or neutral results reported honestly.
- [ ] `gidorah demo --replay` reproduces the demo offline.
- [ ] Task-level budget cap enforced and reported.
- [ ] Patch-first (arm I) and repo-map (arm J) ablations reported.

---

## 9. Open items

- [ ] Choose the benchmark repository/repositories.
- [ ] Write 16–20 task specs with tests.
- [ ] Decide how to price Tavily credits in USD (or keep separate).
- [ ] Build the mock provider and fault injection.
- [ ] Define the benchmark approval policy and sandbox boundary.
- [ ] Decide whether to include a second language.
- [ ] Set the target improvement after the pilot; do not pre-announce a number.
- [ ] Decide whether arm G (Docs Guard) runs on all Class B tasks or a subset.
- [ ] Define the task-budget cap per task class.
- [ ] Record and commit replay traces (no secrets).
- [ ] Run the context sub-arms (cap-only vs cap+clear vs cap+compaction) before the full benchmark.
- [ ] Spike Bifrost MCP Gateway + Code Mode for read-only tools (arm H); document approval boundaries.
- [ ] Run patch-first (arm I) and repo-map (arm J) ablations.
- [ ] Decide whether to include price-per-task variance in the headline chart.
