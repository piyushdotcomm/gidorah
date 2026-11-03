# Product Brief

**Status:** Draft · **Owner:** Product · **Last updated:** 2026-11-03

## One-liner

> **Gidorah** is the governed terminal coding agent: Bifrost for the model plane, Tavily for the knowledge plane. **Less spend. Fewer guesses.**

## Track

HackCulture AI Global Hackathon — **Track A: Coding agent with minimal token usage** (Bifrost by Maxim AI). Every submission must meaningfully integrate **both Bifrost and Tavily**.

## Problem

Coding agents are capable but hard to deploy:

- They burn tokens unpredictably and have no per-user budget enforcement.
- They send confidential code to cloud models unless policy is enforced below the prompt.
- They stop when a provider rate-limits or fails.
- They guess at current APIs, then burn tokens iterating on wrong code.

## Insight

Two planes, both governed:

| Plane | Question | Technology |
|---|---|---|
| Model | Which model, can we afford it, is it allowed, what if it fails? | **Bifrost** |
| Knowledge | What does the outside world actually say about this API/version/error? | **Tavily** |

The model never chooses its provider, budget, confidentiality mode, or research access. Those are decided by code and gateway configuration, **below the prompt**.

## What we are building

A terminal coding agent with:

1. **Agent loop** — read, edit, run, test, git, search.
2. **Bifrost model plane** — per-user virtual keys, budgets, 402 handling, phase routing, model aliases, fallbacks, exact cache, logs, and a DLP/policy plugin.
3. **Confidential mode** — local-only key → Ollama; Tavily disabled; network shell denied; zero external egress.
4. **Approval gate** — reads free; writes/shell/git ask with diff/command preview; audit.
5. **Tavily Scout** — local-first, version-aware research; cited evidence cards; cache; research-credit budget; proactive Docs Guard verification.
6. **Flight recorder** — every model/research call with provider, fallback, cache, tokens, cost, budget.
7. **Context economics** — stable tool caps and cache-safe prefixes first; compaction only when it pays.
8. **Patch-first edits + repo map** — minimal patches and symbol/range reads instead of full-file rewrites.
9. **Tamper-evident audit + red team** — hash-chained evidence and a canary injection suite.
10. **CLI contract** — `--json`, `--plain`, `--help`, `--version`, non-interactive, completions.
11. **Benchmark + replay** — 16–20 tasks, 5 runs, 4 arms, **cost per solved task**, raw artifacts, and an offline demo replay.

Plus a **Bifrost plugin** for confidential routing enforcement, secret/DLP checks, and policy headers — an upstreamable open-source contribution.

## Architecture

```text
CLI/TUI ──► Gidorah core ──► Bifrost ──► DeepSeek Flash/Pro
                 │                      └─► Ollama (local-only)
                 ├─► Tavily Scout (search/extract → evidence card)
                 ├─► Approval gate (read/write/shell/git)
                 ├─► Session JSONL + resume
                 └─► Flight recorder + benchmark
```

## Build vs. use

| Use | Build |
|---|---|
| Bifrost: providers, budgets, routing, fallbacks, cache, logs | CLI/TUI adaptation |
| Tavily: search/extract | Repo classifier + policy |
| DSH TUI visual shell (MIT AND BSD-3-Clause) | Agent loop + tools + approvals |
| Ollama runtime | Scout triggers, cards, cache, research budget |
| DeepSeek models | Flight recorder + benchmark |

## Winning upgrades

The baseline plan is complete. These upgrades make it best in class:

| Upgrade | Why it matters |
|---|---|
| Gateway DLP + policy plugin | Bifrost blocks secrets and non-local providers before egress; upstream contribution |
| Model aliases + complexity router | Bifrost owns model mapping; agent requests intent, not model names |
| Tavily Docs Guard | Verifies changed external API usage before tests; proactive correctness |
| Replayable demo + chaos suite | Offline reproducible demo; killed dependencies prove the guarantees |
| Context economics | Cap tool output before compacting; measure cache impact; compaction is conditional |
| Patch-first + repo map | Fewer output tokens per edit; fewer input tokens per file |
| Tamper-evident audit + red team | Verifiable chain and zero canary egress under an injection corpus |
| Bifrost Code Mode read-only arm | Potential large token savings; writes/shell/git stay native for approvals |
| Per-task budget | Prevents a single runaway task on top of the per-user budget |
| Productization plan | Shows the path from hackathon to a control-plane product |

See [Why Gidorah wins](why-gidorah-wins.md) and [Productization](../04-delivery/productization.md).

## Hackathon requirement mapping

| Requirement | Implementation | Proof |
|---|---|---|
| Continue through outages/rate limits; announce takeover | Bifrost fallbacks + response headers; durable `route/changed` | CT-01..03, demo |
| Per-user budget before requests; limit behavior | Virtual keys + 402; 80% warn; local/stop at 100% | CT-04..06 |
| Confidential local-only; prompt cannot override | Local-only key; Tavily off; egress guard | CT-07..09 |
| Approval for writes/shell/git; reads free | Pre-tool classifier + approval modal | CT-10..12 |
| Minimal tokens; measured | Phase routing, pruning, compaction, exact cache, Tavily evidence | Benchmark |
| Both technologies meaningful | Dual-plane architecture, budgets, policy, trace | Architecture + benchmark |

## Success

- All four requirements pass conformance.
- Zero cloud/Tavily calls in confidential mode.
- Zero budget violations.
- Fallback succeeds and is visible.
- Docs-dependent pass rate improves with Tavily; zero unnecessary research on repo-local tasks.
- **Cost per solved task** improves vs. always-Pro baseline at equal or better pass rate.
- DLP blocks a secret fixture before cloud egress; confidential mode remains zero-egress.
- Demo runs in 3 minutes, deterministically, three times in a row; `gidorah demo --replay` works offline.
- Chaos tests kill Bifrost, Ollama, Tavily, and the network without violating guarantees.

## Non-goals

- Web UI, desktop app, IDE extension, plugin marketplace.
- Custom gateway, budget ledger, or failover engine.
- Multi-tenant SaaS.
- Custom model or vector database.

## Status

Implementation complete for the offline and real-provider paths: see the root README, BUILD_REPORT.md, and BUILD_STATUS.md for verified commands and evidence. Next: M0 gates — license review, Bifrost/Tavily spikes, DLP body-access spike, benchmark repo selection.
