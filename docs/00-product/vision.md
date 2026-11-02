# Vision

**Status:** Draft · **Owner:** Product · **Last updated:** 2026-11-03

---

## Vision statement

> Make autonomous coding affordable, confidential, and reliable enough to deploy — and prove it with receipts.

Gidorah is a terminal coding agent whose value is not that it can edit code, but that it can be **trusted with a budget, a confidential repository, and a flaky provider**. It routes the model through Bifrost and routes uncertainty through Tavily, then shows exactly what happened.

---

## The problem

Coding agents are becoming capable, but three things stop teams from deploying them widely:

### 1. Cost is unpredictable
A single agent run can burn tens of thousands of tokens on exploration, failed edits, and repeated test output. Teams cannot answer: *What will this task cost? What is the per-developer budget? What happens at the limit?* Most agents have no pre-request budget enforcement, no per-user ledger, and no defined behavior when the money runs out.

### 2. Confidential code leaks by default
Coding agents send repository context to cloud models. Regulated teams cannot allow that. "Use a local model" is a setting, not a policy: a prompt, a plugin, or a misconfigured tool can route around it. The policy must be enforced **below the prompt**, at the model boundary.

### 3. Providers fail
Rate limits, outages, and quota errors stop a session mid-task. Retrying the same provider is not continuity. A real agent switches models, tells the user, preserves the session, and resumes.

A fourth, quieter problem drives token waste: **the agent guesses at external APIs it does not know.** It writes code against stale documentation, fails tests, and burns tokens iterating. The fix is not a bigger model; it is a targeted, compressed, cited research step.

---

## The insight

Two planes, not one:

| Plane | Question it answers | Technology |
|---|---|---|
| **Model plane** | Which model should run this step, can we afford it, is it allowed, and what happens if it fails? | **Bifrost** |
| **Knowledge plane** | What does the outside world actually say about this API, version, or error? | **Tavily** |

Most coding agents treat both as incidental. Gidorah makes them first-class, policy-governed, and measurable.

**Policy below the prompt.** The model never chooses its provider, budget, confidentiality mode, or whether web research is allowed. Those are decided by code and gateway configuration. A prompt injection can ask; it cannot change the answer.

---

## Product definition

**Gidorah** is a terminal coding agent with:

- A real agent loop: read, edit, run, test, git, search.
- Bifrost virtual keys per user, with budgets and a local-only key for confidential repos.
- Phase-aware routing (`explore`, `edit`, `verify`) through Bifrost routing rules.
- Cross-provider fallbacks with a visible, durable takeover notice.
- Tavily Scout: on-demand, version-aware documentation and error research, compressed into cited evidence cards.
- Approval gates for writes, shell, and git; ordinary reads run free.
- A flight recorder that shows every model call and research call with tokens, cost, cache status, fallback, and budget remaining.
- A reproducible benchmark measured in **cost per solved task**.

---

## Differentiators

1. **Dual-plane governance.** Bifrost and Tavily are structural, not decorative.
2. **Enforcement below the prompt.** Confidentiality and budgets cannot be talked around.
3. **Gateway DLP.** Bifrost blocks secrets before cloud egress, not just confidential repos.
4. **Evidence over estimates.** Provider usage and Bifrost logs, not token guesses.
5. **Research that saves tokens.** Tavily prevents hallucinated APIs and failed iterations; it is capped, cached, cited, and disabled for confidential work.
6. **Proactive verification.** Docs Guard checks changed external APIs before tests, not after failure.
7. **Proof-carrying audit.** Hash-chained evidence and a red-team canary suite, with honest limitations.
8. **Token-efficient editing.** Patch-first edits and symbol/range reads instead of full files.
9. **Auditability.** Every decision is an event; every model call has a receipt.
10. **Replayable proof.** The demo and benchmark run offline from recorded traces.
11. **Open-source contribution.** A reusable Bifrost plugin and an open benchmark.

---

## Product principles

1. **Local first, web second.** Search the repo and installed packages before Tavily.
2. **One egress path.** All model traffic goes through Bifrost; no direct provider adapters.
3. **Least privilege.** Reads are free; writes, shell, and git ask; confidential mode has no external egress.
4. **Deterministic over clever.** A rule-based policy is easier to audit than a model-based one.
5. **Measure the whole task.** Cost per solved task and cost per successful task beat tokens per run.
6. **Show the work.** The user sees the route, the cost, the fallback, and the sources.
7. **Boring reliability.** Session persistence, retries, and clear errors matter more than a flashy demo.
8. **No silent degradation.** If a model, provider, or research path changes, the user is told.
9. **Prove it offline.** If the demo cannot be replayed without a network, it is not ready.
10. **Cap before compact.** A smaller context that breaks cache can cost more; optimize the bill, not the token count.

---

## Target outcomes

| Outcome | Measure |
|---|---|
| Lower cost per solved task | ≥30% reduction vs always-Pro baseline at equal or better pass rate (target; confirm in pilot) |
| Lower cost per successful task | Includes retries and cache write; same baseline |
| No budget surprises | Zero budget violations under concurrent sessions; defined 80/100% behavior |
| Context stays cache-efficient | Cap-first; compaction only if net cost is negative |
| Editing stays token-efficient | Patch-first edits; symbol/range reads |
| Security is inspectable | Audit chain verifies; canary egress 0 under red team |
| Confidential repos stay local | Zero cloud LLM calls and zero Tavily calls in confidential mode |
| Outages do not stop work | Fallback succeeds and the takeover is visible; session resumes |
| Less guessing | Docs-dependent pass rate improves; unnecessary research on repo-local tasks is zero |
| Trustworthy claims | Every number traceable to raw logs |

---

## Non-goals

- Replacing OpenCode, Claude Code, or DeepSeek Harness as a general-purpose agent.
- A web UI, desktop app, IDE extension, or plugin marketplace in v1.
- A custom gateway, budget ledger, or failover engine. Bifrost owns the model plane.
- A custom search engine. Tavily owns the knowledge plane.
- A custom model, vector database, or multi-agent swarm.
- Multi-tenant SaaS in v1.

---

## Hackathon alignment

Track A asks for a coding agent with minimal token usage that:

1. Continues through outages/rate limits and announces model takeover.
2. Enforces a per-user budget before requests and defines limit behavior.
3. Keeps confidential repos on local models only, immune to prompt override.
4. Requires approval for writes, shell, and git; reads run free.

It also requires **meaningful use of both Bifrost and Tavily**, and savings demonstrated with measured tasks.

Gidorah addresses each requirement in a dedicated design document, a conformance test, and a demo scene. See the traceability matrix in [requirements.md](requirements.md).
