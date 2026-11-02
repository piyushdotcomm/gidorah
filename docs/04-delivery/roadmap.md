# Roadmap

**Status:** Draft · **Owner:** Delivery · **Last updated:** 2026-11-03

The plan is milestone-based, not date-based. Each milestone has a gate; do not start the next milestone until the gate passes. The critical path is **Bifrost/Tavily integration → agent spine → policy → evidence → demo**.

---

## 1. Workstreams

| Workstream | Owner | Scope |
|---|---|---|
| Product/docs | Product | Vision, requirements, scope, demo narrative |
| Agent core | Engineering | Loop, tools, sessions, context, approvals |
| Bifrost | Engineering | Providers, virtual keys, routing, fallbacks, logs, plugin |
| Tavily | Engineering | Scout, queries, cards, cache, budget, policy gating |
| TUI | Frontend | Vendor/adapt DSH TUI, panels, plain mode |
| Evaluation | Evaluation | Tasks, mock provider, benchmark, report |
| Security | Security | Threat model, conformance, secret scan |
| Delivery | Delivery | Milestones, demo, submission, licensing |

A solo developer wears all hats; the gates still apply.

---

## 2. Milestones

### M0 — Planning and groundwork
**Deliverables**
- Docs v0.4 (this set), including implementation plan and CLI contract.
- Stack and repo decisions (ADR-0005).
- License review for DSH TUI, Bifrost, Tavily, pi-tui.
- Benchmark task list and repository chosen.
- Bifrost + Tavily + Ollama accounts/keys available.
- Skills installed and project skill available.
- DLP hook body-access spike completed.

**Gate**
- [ ] Docs reviewed; open questions triaged.
- [ ] Licenses recorded; NOTICE plan ready.
- [ ] A 30-minute spike proves Bifrost forwards to DeepSeek and Ollama.
- [ ] A 15-minute spike proves Tavily search/extract works.
- [ ] Bifrost plugin can read the request body without breaking streaming, or the DLP claim is downgraded.
- [ ] `docs/02-engineering/implementation-plan.md` approved.

---

### M1 — Backbone
**Deliverables**
- pnpm workspace, TypeScript build, lint/test.
- Bifrost client: headers, streaming, 402/fallback parsing.
- Tavily client wrapper: search/extract, usage.
- SQLite cache/ledger skeleton.
- CLI `gidorah doctor` checks all dependencies.
- Session JSONL write/read.
- Mock provider with 429/503/402.

**Gate**
- [ ] `gidorah doctor` green.
- [ ] A scripted prompt streams from Bifrost.
- [ ] A Tavily query returns a result and credits.
- [ ] Mock provider triggers a fallback.

---

### M2 — Agent spine
**Deliverables**
- Agent loop: turn/step, tool calls, cancellation.
- Tools: read, glob, grep, list, write, edit, bash, git.
- Approval gate and diff/command preview.
- Session resume and crash recovery.
- Basic TUI or plain renderer.
- End-to-end task on the auth fixture.

**Gate**
- [ ] Fix the failing auth test end-to-end.
- [ ] Reads free; writes/shell/git prompt; denial honored.
- [ ] Resume after kill restores the session.
- [ ] No DSH LLM adapter or direct provider path.

---

### M3 — Policy and dual plane
**Deliverables**
- Repo classifier and policy file.
- Virtual key selection (cloud/local).
- Budget warnings and 402 handling.
- Confidential mode: local-only, Tavily disabled, network shell denied.
- Phase-based routing headers, Bifrost rules, and model aliases (`gidorah-fast/strong/local`).
- Scout: triggers, version-aware queries, evidence cards, cache, credit budget, search-depth ladder.
- Patch-first `edit` tool and repo-map/symbol reads (basic).
- Conformance suite CT-01..CT-40.

**Gate**
- [ ] Confidential injection test passes with zero cloud/Tavily calls.
- [ ] Budget race test passes.
- [ ] 429/503 fallback test passes with a durable banner.
- [ ] Docs-dependent fixture passes with one research call.
- [ ] Repo-local fixture makes zero research calls.

---

### M4 — Evidence and gateway security
**Deliverables**
- Flight recorder and receipt.
- Benchmark runner, 16 tasks, 4 arms, pilot mode.
- Report generator + charts, cost per successful task, cost decomposition.
- Bifrost plugin: confidential guard + DLP secret scan + policy headers.
- TUI panels: status, budget, takeover, research, trace.
- Exact cache for deterministic sub-calls.
- Per-task budget cap.
- Context economics: stable cap, clearing, conditional compaction.
- CLI contract: `--json`, `--plain`, `--help`, `--version`, SIGINT, completions.
- Tamper-evident audit chain + `audit verify/export`.
- Red-team + canary suite.
- Repo-map and patch-first benchmark arms.

**Gate**
- [ ] Benchmark runs 5× per arm/task.
- [ ] Cost per solved task, cost per successful task, and pass@1 reported.
- [ ] Class A: zero Tavily calls.
- [ ] Every claim traceable to raw logs.
- [ ] DLP blocks fake key/private-key fixtures; no secret in logs.
- [ ] Context cap preserves cache; compaction net cost reported.
- [ ] CLI contract tests pass.
- [ ] Audit chain verifies; tamper test fails as expected.
- [ ] Red-team canary egress 0.
- [ ] Patch-first/repo-map arms report a result.
- [ ] TUI shows the full story.

---

### M4.5 — Winning upgrades (only after M4 gate)
**Deliverables**
- Tavily Docs Guard (Class B subset).
- Bifrost complexity router benchmark arm.
- Bifrost MCP Gateway + Code Mode read-only arm (stretch).
- Dependency docs index (stretch).
- Team/customer budget demo (stretch).
- `bifrost gidorah` launcher/profile (stretch; upstream if possible).

**Gate**
- [ ] Each upgrade has a demo or benchmark result; otherwise it is cut.
- [ ] No core regression.
- [ ] Code Mode does not bypass approvals; writes/shell/git stay native.

---

### M5 — Demo and submission
**Deliverables**
- 3-minute demo script and recording.
- `gidorah demo --replay` offline mode.
- Chaos suite (kill Bifrost/Ollama/Tavily/network).
- Submission README/docs, including productization.
- License/NOTICE/third-party register.
- Judge Q&A prep.
- Final secret scan and clean clone test.

**Gate**
- [ ] Demo runs 3× without repair.
- [ ] Replay reproduces all scenes offline.
- [ ] Chaos suite passes.
- [ ] Submission checklist complete.
- [ ] No secrets committed.
- [ ] Bifrost repo starred and contribution documented.

---

## 3. Critical path

```text
Bifrost/Tavily spikes
  -> agent loop + tools
    -> approvals + session
      -> policy (confidential/budget)
        -> Scout + routing + DLP plugin
          -> context economics + CLI contract
            -> benchmark
              -> replay + chaos
                -> demo
```

TUI work is off the critical path until M2. Benchmark tasks can be written in parallel from M0.

---

## 4. Resourcing

Minimum viable team (2–3 people):
- **Agent/backend:** loop, tools, sessions, Bifrost/Tavily clients.
- **Policy/security/eval:** policy, conformance, benchmark, report.
- **Product/TUI/demo:** docs, TUI adaptation, script, slides.

Solo mode: follow the same order; cut Class B tasks to 6 and the TUI to a polished plain renderer if needed. Do not cut the conformance suite or the benchmark.

---

## 5. Buffer and cut list

Reserve 20% of effort for integration surprises (TUI coupling, Bifrost API drift, Windows terminal).

Cut order if behind:
1. Dependency docs index.
2. Team/customer budget demo.
3. `bifrost gidorah` launcher/profile.
4. Docs Guard (keep as stretch; core Tavily still counts).
5. Complexity router arm.
6. Read-once cache / multi-file approval batching.
7. Fancy TUI panes; keep status + approvals + trace.
8. Class B task count (minimum 6).

Do **not** cut:
- Confidential, budget, failover, approvals.
- DLP/policy plugin (gateway security is a differentiator).
- Benchmark with raw artifacts.
- Replay + chaos suite.
- License/NOTICE.
- Demo determinism.

---

## 6. Definition of done (delivery)

- [ ] All M5 gates pass.
- [ ] Docs match implementation.
- [ ] Demo and benchmark reproducible.
- [ ] Submission checklist complete.
