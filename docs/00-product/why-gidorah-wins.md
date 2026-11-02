# Why Gidorah Wins

**Status:** Draft · **Owner:** Product / Delivery · **Last updated:** 2026-11-03

This document is the competitive thesis and the 10/10 checklist. It exists to keep the team honest: features that do not appear in the demo or the benchmark are not winning features.

---

## 1. The one-sentence claim

> **Gidorah is the first terminal coding agent with a control plane: Bifrost enforces the model budget, routing, and failover; Tavily verifies the outside world; and every task ends with a receipt.**

The claim is deliberately narrow. It is not “the best coding agent.” It is the agent that can be **deployed** because it cannot overspend, cannot leak a confidential repo, cannot be stopped by a provider outage, and does not guess at current APIs.

---

## 2. Why most teams will lose

Most hackathon submissions in this track will be one of:

1. **A thin CLI wrapper** around one model with a `web_search` tool bolted on.
2. **A Bifrost proxy demo** that shows routing but has no agent-level policy or evidence.
3. **A Tavily research demo** with no budget, no confidentiality, and no coding workflow.
4. **A feature-heavy agent** that demos five things shallowly and proves nothing.

Gidorah wins by being the opposite: a small, complete agent where every required behavior is enforced, demonstrated, and measured.

---

## 3. Competitive matrix

| Capability | Generic CLI agent | OpenCode / DSH | Bifrost proxy only | Tavily tool only | **Gidorah** |
|---|---|---|---|---|---|
| Real coding loop | Yes | Yes | No | No | **Yes** |
| Per-user pre-request budget | No | No | Partial | No | **Yes (Bifrost VK)** |
| Confidential local-only policy | No | Partial | Partial | No | **Yes (local key + egress guard)** |
| Cross-provider failover + notice | Partial | Partial | Yes | No | **Yes + durable banner** |
| Approvals with diffs | Partial | Yes | No | No | **Yes** |
| On-demand cited research | No | Partial | No | Yes | **Yes (Tavily Scout)** |
| Research budget + cache | No | No | No | Partial | **Yes** |
| Policy below the prompt | No | No | Partial | No | **Yes** |
| Flight recorder / receipt | No | Partial | Logs | No | **Yes (both planes)** |
| Measured cost per solved task | No | No | No | No | **Yes** |
| Open-source contribution | Varies | Yes | N/A | N/A | **Bifrost plugin + benchmark** |

---

## 4. Judging rubric mapping (assumed)

| Criterion | What judges look for | Gidorah evidence |
|---|---|---|
| Working demo | It actually runs and completes a task | Three deterministic scenes + replay mode |
| Hackathon requirements | All four behaviors | Conformance suite CT-01..CT-40 + demo |
| Bifrost use | Deep, not decorative | Virtual keys, budgets, routing, fallbacks, cache, logs, aliases, plugin |
| Tavily use | Deep, not decorative | Local-first triggers, version-aware queries, evidence cards, cache, credit budget, Docs Guard |
| Token efficiency | Measured, not estimated | 16–20 tasks, 5 runs, 4 arms, cost per solved task, raw logs |
| Innovation | A new idea, not a wrapper | Agent-aware gateway policy + gateway DLP + Docs Guard |
| Security | Provable guarantees | Zero-egress confidential mode, injection corpus, DLP plugin |
| Engineering quality | Tests, docs, reproducibility | Conformance suite, ADRs, replay, container |
| Business potential | A real product | Control-plane positioning + productization plan |
| Open source | Contribution back | Bifrost plugin, benchmark tasks, agent |

---

## 5. The 10/10 checklist

A 10/10 submission has all of these:

- [ ] A one-sentence pitch a judge can repeat.
- [ ] All four requirements demonstrated live, not just described.
- [ ] Two or three jaw-drop moments: blocked injection, visible failover, Tavily side-by-side.
- [ ] A benchmark with raw artifacts and a credible baseline.
- [ ] Cost per solved task and cost per successful task, not token estimates.
- [ ] Context economics: cap-first, cache-aware, compaction only when it pays.
- [ ] Patch-first edits and repo-map reads measured.
- [ ] Bifrost used structurally: keys, budgets, routing, fallbacks, cache, logs, plugin.
- [ ] Tavily used structurally: triggers, cards, cache, budget, policy gating, measurement.
- [ ] Policy enforced below the prompt, with tests.
- [ ] Tamper-evident audit chain verifies; red-team canary egress is zero.
- [ ] A deterministic demo that runs three times without repair.
- [ ] A replay mode that works offline.
- [ ] A CLI contract that works in scripts and CI.
- [ ] Licenses and notices complete.
- [ ] A productization story beyond the hackathon.
- [ ] Honest limitations and negative results.

---

## 6. Core token-efficiency levers

These are the levers the benchmark must isolate:

1. **Phase routing** — cheap model for explore/edit, strong for verify, local for confidential/budget.
2. **Parallel/batched tool calls** — multiple reads/searches in one model step; fewer round trips.
3. **Patch-first edits** — find/replace patches instead of full-file rewrites; lower output tokens.
4. **Repo map and symbol reads** — outlines and ranges instead of full files; lower input tokens.
5. **Stable tool-output cap** — head/tail caps with full output spilled to artifacts. This is the primary context lever.
6. **Tool-result clearing** — replace old, re-fetchable results with a placeholder; keep the call record.
7. **Compaction only when it pays** — summarization can invalidate prompt cache; measure net cost and disable if positive.
8. **Exact cache** — deterministic sub-calls (summaries, triage, commit messages).
9. **Tavily evidence** — one cited card instead of trial-and-error; Docs Guard before tests.
10. **Prompt-cache-safe prefix** — stable system prompt/tool order; dynamic status outside the prefix.
11. **Bifrost Code Mode (stretch)** — read-only tool batching to keep large results out of context; measure it.

The 2026 context-engineering evidence is clear enough to make this a design principle: **a smaller context that breaks the cache can cost more than a larger one that stays cached.** Capping is cheap; compaction is a last resort, not a default.

If a lever does not appear in the ablation, it is not part of the claim.

---

## 7. The winning upgrades (beyond the baseline plan)

These are the improvements that move the project from “strong” to “best in class.” Each one increases Bifrost/Tavily depth or proof quality.

> **Full use is structural, not endpoint bingo.** Using Bifrost for keys, budgets, routing, fallbacks, cache, logs, and DLP is deeper than calling every endpoint. Using Tavily for triggers, cited cards, cache, credit budget, policy gating, and Docs Guard is deeper than calling Map/Crawl for show. Stretch features ship only if they improve a demo or a metric.

### U1 — Gateway DLP and policy plugin (must)
A Bifrost Go plugin that:
- Rejects non-local providers when `x-gidorah-confidential: true`.
- Scans requests for secrets/API keys/private keys and blocks or redacts before cloud egress.
- Adds `x-gidorah-policy` and `x-gidorah-dlp` response headers.
- Emits an audit event.

Why it wins: it turns Bifrost from a router into a **security enforcement plane** and is a real upstream contribution. It also gives the confidentiality demo a second, independent layer.

### U2 — Model aliases (must)
Bifrost aliases `gidorah-fast`, `gidorah-strong`, `gidorah-local` map to concrete models. The agent requests an alias; Bifrost owns the mapping. This decouples the agent from model names and makes routing configurable.

Why it wins: it demonstrates Bifrost configuration depth and makes the routing story cleaner.

### U3 — Complexity Router arm (should)
Use Bifrost’s built-in Simple/Medium/Complex classifier as an optional routing layer and a benchmark arm.

Why it wins: it shows you used a native Bifrost feature many teams will miss, and it produces a real comparison.

### U4 — Tavily Docs Guard (should)
After an edit that touches external APIs, verify the new/changed symbols against a cached docs fact sheet; if unknown or deprecated, trigger one targeted Tavily lookup before running tests.

Why it wins: it moves Tavily from “search when stuck” to **proactive correctness**, which is a stronger, more novel use. It should reduce failed test iterations.

### U5 — Replayable demo and benchmark container (must)
`gidorah demo --replay` replays recorded traces with no network. A Devcontainer/Docker setup runs Bifrost, Ollama, the mock provider, and the fixtures.

Why it wins: judges can reproduce the demo offline; the live demo cannot fail because of a provider outage.

### U6 — Chaos suite (must)
Kill Bifrost, Ollama, Tavily, and the network; verify the guaranteed behavior.

Why it wins: reliability claims become evidence, not promises.

### U7 — Per-task budget (should)
A task-level cap on top of the per-user Bifrost budget; at the cap, stop or ask to continue.

Why it wins: it prevents a single runaway task and is a feature real teams ask for.

### U8 — Productization plan (must for pitch)
A clear buyer, open-core model, and post-hackathon roadmap.

Why it wins: national-level judges reward projects that can become products, not just demos.

### U9 — Bifrost CLI integration (stretch)
Add a `bifrost gidorah` launcher/profile or document a supported integration, and upstream it if possible.

Why it wins: it makes Gidorah part of the Bifrost ecosystem, not just a consumer.

### U10 — Team budget hierarchy (stretch)
Use Bifrost team/customer budgets alongside per-user keys.

Why it wins: it strengthens the enterprise story. Not required for the hackathon.

### U11 — Context economics (must)
Cap tool output at a stable size, clear old results, and compact only when the measured net cost is negative. Report cache hit rate and prefix-hash changes.

Why it wins: the 2026 evidence shows compaction can cost more than it saves by invalidating prompt cache. A team that measures this is more credible than one that compacts by default.

### U12 — Bifrost Code Mode read-only arm (stretch)
Evaluate Bifrost MCP Gateway + Code Mode for read-only tools only; keep writes/shell/git native for approvals.

Why it wins: it is a deeper Bifrost integration and a potential large token reduction. If it does not beat the native loop, the negative result is still useful.

### U13 — Patch-first edits and repo map (must)
Find/replace patches instead of full-file rewrites; a symbol outline and range reads instead of full files. Both are measured as separate arms.

Why it wins: they attack the two largest token sources directly (output size and input file bodies). The SWE-Edit 2026 result reports a 17.9% inference-cost reduction from find-replace edits; verify on our tasks.

### U14 — Tamper-evident audit + red team (must)
Hash-chain every session event; `gidorah audit verify` detects tampering; `gidorah redteam` runs an injection/canary suite.

Why it wins: it turns “we are secure” into “here is the chain, here are 20 attacks, and the canary never left.” That is a national-level demo moment.

---

## 8. What would make us lose

| Failure | Prevention |
|---|---|
| TUI rabbit hole | Timebox TUI; plain mode first; M2 gate |
| Benchmark too small or cherry-picked | Preregister tasks; 16–20 tasks; raw artifacts; per-task results |
| Tavily is decorative | Class A zero calls; Class B measured improvement; budget/cache/trace |
| Compaction makes the bill worse | Cap first; cache-aware; compaction only when net cost is negative |
| Code Mode bypasses approvals | Read-only arm only; writes/shell/git native; cut if it does not win |
| Audit chain overclaimed | Say tamper-evident; anchor; document operator limitation |
| Red-team corpus too weak | Indirect/tool/web attacks; canary scan; add bypasses |
| No replay | Build `demo --replay` before polishing the TUI |
| No proof of confidentiality | Network capture + audit + plugin + conformance |
| Adding features that are not demoed | Cut list; every feature maps to a demo scene or metric |
| Overclaiming | Report limitations and negative results |
| Missing licenses | LICENSE/NOTICE/SPDX before submission |

---

## 9. Max-effort allocation

The project is won by **proof**, not breadth. Allocate effort roughly:

| Area | Share | Why |
|---|---|---|
| Benchmark + evidence | 30% | The hackathon explicitly demands measured savings |
| Policy + security + conformance | 25% | The four requirements are gates; confidentiality is the hardest |
| Bifrost integration + plugin | 15% | Sponsor depth and open-source contribution |
| Tavily Scout + Docs Guard | 15% | The second sponsor and the novel correctness lever |
| Agent core + tools | 10% | Table stakes; reuse patterns, don’t over-build |
| TUI + demo polish | 5% | Important, but a multiplier on substance |

If time is short, cut TUI polish and stretch features—not the benchmark or conformance suite.

---

## 10. The winning sentence (fill after measurement)

> “Gidorah cut cost per solved task by **__%** at **__%** pass rate, kept confidential repositories at **zero** external calls, and recovered from **__** provider failures—verified against Bifrost and Tavily logs.”

Do not fill the blanks until the benchmark produces them.
