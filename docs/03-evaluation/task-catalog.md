# Benchmark Task Catalog

**Status:** Draft · **Owner:** Evaluation · **Last updated:** 2026-11-03

Candidate tasks for the 16–20 task benchmark. Final specs are written after the repository is chosen; each task must have a failing test or a deterministic acceptance check. This is a menu, not a commitment.

---

## 1. Selection rules

- Real repository with an existing test suite.
- Deterministic tests; no network at test time.
- Clear pass/fail; no subjective "looks good" grading.
- Small enough to run 5× within the budget.
- Contamination-resistant: recent commits or synthetic fixtures.
- Class A must not need external docs; Class B must need current docs.
- Every task has a time, token, and task-budget cap.

---

## 2. Class A — repo-local (8 candidates)

| ID | Task | Skills exercised | Pass criteria |
|---|---|---|---|
| A1 | Fix a failing auth/session test | read, grep, edit, test | Target test passes; no other test regresses |
| A2 | Add input validation to a handler | read, edit, test | Invalid input rejected; valid input preserved |
| A3 | Refactor duplicated logic into a helper | read, edit, test | Behavior unchanged; duplication removed |
| A4 | Add a CLI flag and tests | read, edit, test, shell | Flag works; help text updated; tests pass |
| A5 | Fix a race in an async queue | read, grep, edit, test | Stress test passes 10× |
| A6 | Add pagination to an API client | read, edit, test | Page traversal correct; edge cases covered |
| A7 | Fix a date/time edge case | read, edit, test | DST/timezone cases pass |
| A8 | Remove an N+1 query | read, edit, test | Query count reduced; tests pass |

**Class A requirement:** zero Tavily calls. If the agent calls Tavily, the task is marked `unnecessary_research` and the cost is still counted.

---

## 3. Class B — docs-dependent (8 candidates)

| ID | Task | Docs dependency | Pass criteria |
|---|---|---|---|
| B1 | Stripe webhook signature verification | Raw body requirement, current header name | Signature test passes; invalid signature rejected |
| B2 | Upstash ratelimit v2 integration | Current API shape | Rate limit enforced; tests pass |
| B3 | Prisma relation migration | Current migration syntax | Migration applies; relation query passes |
| B4 | Next.js caching/revalidation change | Current App Router API | Revalidation test passes |
| B5 | Zod v4 migration | Changed error/parse API | Schema tests pass |
| B6 | OpenAI SDK structured outputs | Current response format | Structured output parsed; test passes |
| B7 | Node 22 native TypeScript type stripping | Current flags/limitations | `node --experimental-strip-types` runs; tests pass |
| B8 | Tailwind v4 config migration | New config model | Build passes; visual snapshot or class assertions pass |

**Class B requirement:** at most 2 Tavily calls per task; one cited evidence card; no raw page dumps. Docs Guard may verify one changed symbol (stretch).

---

## 4. Stress tasks (optional, 2–4)

| ID | Task | Purpose |
|---|---|---|
| S1 | Ambiguous bug report with a misleading README | Prompt-injection resistance |
| S2 | Task requiring a file outside the workspace | Path boundary |
| S3 | Task with a failing test that is actually flaky | Diagnosis, no blind edits |
| S4 | Task that exceeds the task budget | Budget stop/ask behavior |

Stress tasks are reported separately; they are not part of the headline cost-per-solved-task unless the arm supports them.

---

## 5. Task spec template

```markdown
# Task <id>: <name>

- Class: A | B | S
- Repo: <url>
- Base commit: <sha>
- Goal: <one sentence>
- Failing test: <path>::<test name>
- Files likely involved: <paths>
- External docs needed: <none | package/version + question>
- Allowed research: <0 | 1 | 2 calls>
- Time cap: <minutes>
- Token cap: <tokens>
- Task budget: <usd>
- Pass criteria: <command + expected>
- Cleanup: <worktree removal>
```

---

## 6. Metrics per task

- Pass/fail and failure category.
- Cost (LLM + research credits), tokens, model requests.
- Research calls, depth, cache hit, unnecessary research.
- Fallback count, approval prompts, wall time.
- Missing/errored rows (reported separately).

---

## 7. Open items

- [ ] Choose the primary TypeScript repository and commit.
- [ ] Write the first 8 Class A specs with failing tests.
- [ ] Write the first 8 Class B specs with docs dependencies.
- [ ] Validate each task with a 3-task pilot.
- [ ] Confirm no task requires network at test time.
- [ ] Confirm the task set is contamination-resistant.
- [ ] Freeze the task set hash before the full run.
