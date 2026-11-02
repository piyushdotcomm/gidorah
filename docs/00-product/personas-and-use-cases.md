# Personas and Use Cases

**Status:** Draft · **Owner:** Product · **Last updated:** 2026-11-03

---

## Personas

### P1 — Priya, platform engineer
Owns the internal developer platform for a 400-person engineering org. Her team is rolling out coding agents. She needs per-developer budgets, provider failover, and a cost dashboard. She is judged on reliability and spend, not on model benchmarks.

**Goals:** predictable cost, one gateway, visibility, no surprise bills.
**Frustrations:** every agent has its own provider config; no per-user limits; outages page her at 2am.

### P2 — Marcus, security and compliance lead
Works at a regulated company. Source code cannot leave the network. He needs proof, not assurances: no cloud calls, no web search, no shell egress, and an audit trail.

**Goals:** local-only inference for confidential repos, immutable audit, approved tool actions.
**Frustrations:** "trust us" policies; model prompts that claim to be safe; plugins that bypass controls.

### P3 — Ana, senior developer
Uses a coding agent daily. She cares about correctness and speed. She will abandon an agent that asks for approval on every file read or hides what it is doing.

**Goals:** read code freely, see diffs before writes, understand which model ran and why.
**Frustrations:** approval fatigue, hallucinated APIs, losing a session to a rate limit.

### P4 — Kenji, engineering manager / finance partner
Owns the AI budget. He needs cost per team, per project, and trends. He cannot approve an agent that can spend without a cap.

**Goals:** per-user and per-team budgets, exportable reports, cost per solved task.
**Frustrations:** token-based estimates, no attribution, no limit behavior.

### P5 — Lena, open-source maintainer
Reviews contributions and answers issues. She wants an agent that can research current docs, cite sources, and run cheaply in CI.

**Goals:** trustworthy citations, low cost, headless mode, reproducible runs.
**Frustrations:** stale API advice, uncited claims, runaway CI spend.

### Anti-personas
- A consumer looking for a general chatbot.
- A team that wants a fully autonomous agent with no approvals.
- A team that wants to self-host a model training pipeline.

---

## Jobs to be done

| ID | Job | Persona |
|---|---|---|
| JTBD-1 | "When I give an agent a task, I want to know the worst-case cost before it starts." | Priya, Kenji |
| JTBD-2 | "When my provider rate-limits me, I want the session to continue and tell me which model took over." | Ana, Priya |
| JTBD-3 | "When I work in a confidential repo, I want a guarantee that no code leaves the machine." | Marcus |
| JTBD-4 | "When the agent is about to change code, I want to approve the exact diff or command." | Ana, Marcus |
| JTBD-5 | "When the agent is unsure about an API, I want it to check current official docs and cite them." | Ana, Lena |
| JTBD-6 | "When the task is done, I want a receipt: tokens, cost, model path, research sources." | All |
| JTBD-7 | "When I run a benchmark, I want reproducible numbers, not marketing estimates." | Priya, Lena |

---

## Use cases

### UC-01 — Normal coding task
**Actor:** Ana. **Preconditions:** non-confidential repo, cloud budget available.
**Flow:** run `gidorah`; ask to fix a failing test; agent reads files without approval; edits with diff approval; runs tests with approval; commits with approval; shows a receipt.
**Success:** tests pass; every write/shell/git action approved; cost and route visible.

### UC-02 — Provider rate limit / outage
**Actor:** Ana. **Preconditions:** primary provider returns 429/503.
**Flow:** request fails; Bifrost retries/falls back; response headers report `is-fallback`, primary and served model; Gidorah shows a takeover banner; session continues.
**Success:** task continues; banner is durable across resume; no duplicate tool side effects.

### UC-03 — Budget warning and limit
**Actor:** Kenji/Priya. **Preconditions:** virtual key at 80% and then 100% of monthly budget.
**Flow:** at 80%, warning; at 100%, Bifrost returns `402 budget_exceeded`; Gidorah switches to local if allowed, otherwise stops with an actionable message.
**Success:** no request bypasses the budget; ledger matches Bifrost; behavior is documented and tested.

### UC-04 — Confidential repository
**Actor:** Marcus. **Preconditions:** repo classified confidential in the global policy.
**Flow:** Gidorah selects the local-only virtual key; all model calls go to Ollama; Tavily is unavailable; network shell commands are denied; a prompt injection in a file attempts to use a cloud model and fails.
**Success:** audit shows zero cloud LLM calls and zero Tavily calls; tests pass with the local model or the agent clearly reports local capability limits.

### UC-05 — Docs-dependent task
**Actor:** Ana/Lena. **Preconditions:** non-confidential repo; task requires a current external API.
**Flow:** local search fails; Scout calls Tavily with version-aware query; returns a cited evidence card; agent implements the API correctly; card is cached.
**Success:** pass rate improves vs no-Tavily arm; fewer failed attempts; card under token cap; sources cited.

### UC-06 — Approval denial
**Actor:** Ana. **Preconditions:** agent requests a shell command the user rejects.
**Flow:** approval prompt shows exact command; user denies; agent receives a structured denial and adapts.
**Success:** command never executes; denial is audited; agent does not loop or retry the same command without change.

### UC-07 — Session resume
**Actor:** Ana. **Preconditions:** process killed mid-task.
**Flow:** restart; `gidorah resume`; session log replays; model route, budget, research cards, and pending approvals are restored.
**Success:** no duplicate tool execution; transcript intact; takeover notices preserved.

### UC-08 — Tavily outage
**Actor:** Ana. **Preconditions:** Tavily returns 429/5xx.
**Flow:** Scout backs off, uses cache if fresh, otherwise reports research unavailable; the agent continues with local knowledge.
**Success:** task is not blocked; user sees a notice; no unbounded retries.

### UC-09 — Headless CI run
**Actor:** Lena. **Preconditions:** sandboxed worktree; benchmark policy auto-approves within the sandbox.
**Flow:** `gidorah run --headless "task"`; budget cap; structured JSON receipt.
**Success:** reproducible; no interactive prompts; non-zero exit on failure.

### UC-10 — Flight recorder review
**Actor:** Priya. **Preconditions:** completed task.
**Flow:** `gidorah trace --last`; table shows each model and research call, provider, fallback, cache hit, tokens, cost, budget.
**Success:** every number matches Bifrost/Tavily logs; exportable to Markdown/JSON.

---

## Competitive landscape

| Product | Strength | Gap Gidorah exploits |
|---|---|---|
| OpenCode | Polished terminal agent, broad tooling | No dual-plane governance or measured cost per solved task |
| DeepSeek Harness | Plugin-first, strong session model | Web-first; not Bifrost/Tavily-native; no budget/confidentiality control plane |
| Claude Code / Codex | Strong models, mature UX | Provider-locked; limited per-user budget/confidential policy |
| LiteLLM / gateways | Routing and cost | No agent-level approvals, repo policy, or research evidence |
| Plain Tavily tool | Good web search | No policy gating, token budget, cache, or measurement |

**Gidorah's position:** the agent layer that makes Bifrost and Tavily operational for real teams — not another model wrapper.

---

## Assumptions

- A single developer machine is the deployment target for v1.
- "User" means an OS user or a configured profile, not a multi-tenant SaaS account.
- Ollama is available locally for confidential mode; a 3B–4B quantized coding model is acceptable for the demo.
- DeepSeek models are available through Bifrost.
- Tavily API access is available for the benchmark and demo.
