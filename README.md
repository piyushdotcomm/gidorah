# Gidorah

**The governed coding agent.** Less spend. Fewer guesses.

> Gidorah is a terminal coding agent built for the HackCulture AI Global Hackathon, Track A (Bifrost by Maxim AI). It must meaningfully integrate both **Bifrost** and **Tavily**.

---

## What is Gidorah?

Gidorah is a terminal coding agent that reads repositories, edits files, runs commands, and completes real coding tasks — while enforcing the four governance requirements the hackathon asks for:

1. Sessions survive provider outages and rate limits, and the user is told when a model takes over.
2. A per-user spending budget is enforced before every request, with defined behavior at the limit.
3. Confidential repositories are served only by local models; prompts cannot override this.
4. Writes, shell commands, and git operations require approval; ordinary reads do not.

Its differentiator is a **dual-plane architecture**:

- **Bifrost — the model plane.** Per-user virtual keys and budgets, phase-aware routing, provider fallbacks, exact caching, local-only keys for confidential repos, and request-level logs.
- **Tavily — the knowledge plane.** On-demand, version-aware documentation and error research, compressed into cited evidence cards, cached, budgeted, and disabled entirely for confidential repositories.

Everything is visible in a **flight recorder** and proven with a reproducible benchmark measured in **cost per solved task**, not estimates.

---

## Why this wins

- **Both sponsors are structurally involved.** Bifrost is the only model egress path; Tavily is the only external knowledge path.
- **Policy is enforced below the prompt.** Provider selection, budgets, confidentiality, and research access are decided by code and gateway configuration, not by model instructions.
- **The gateway is a security plane, not just a router.** A Bifrost plugin enforces confidential routing and scans for secrets before cloud egress.
- **Tavily is a correctness plane, not just search.** Local-first research, cited evidence cards, a credit budget, and proactive Docs Guard verification.
- **The evidence is measured.** Sixteen to twenty real tasks, five runs, four ablation arms, raw Bifrost and Tavily usage logs.
- **Context economics are measured.** Stable tool-output caps and cache-safe prefixes first; compaction only when it pays.
- **The demo is deterministic and replayable.** A mock provider triggers failover, a fixture repo triggers confidentiality, a docs-dependent task shows Tavily's value side by side, and `gidorah demo --replay` works offline.
- **The scope is honest.** A focused CLI, seven tools, three models, one local model. No 200k-line clone.

---

## Planned architecture

```text
CLI / TUI (Gidorah)
  ├─ Repo classifier ─────────────► confidential mode
  ├─ Task-phase router ───────────► x-gidorah-phase: explore | edit | verify
  ├─ Scout (Tavily) ──────────────► evidence card + citations
  ├─ Tool loop + approval gate ───► read / write / edit / bash / git / search / research
  ├─ Context manager ─────────────► pruning, compaction, task state
  └─ OpenAI-compatible client ────► Bifrost gateway

Bifrost (model plane)                 Tavily (knowledge plane)
  ├─ per-user virtual keys             ├─ search + extract
  ├─ budgets and 402 limits            ├─ evidence cards
  ├─ routing rules, aliases, fallbacks ├─ cache + credit budget
  ├─ exact cache                       ├─ Docs Guard verification
  ├─ local-only key → Ollama           └─ disabled in confidential mode
  ├─ DLP/policy plugin
  └─ /api/logs → flight recorder
```

---

## Winning upgrades

Beyond the four required behaviors, Gidorah adds depth that is hard to fake:

- **Gateway DLP + policy plugin** — rejects cloud providers in confidential mode and blocks secrets before egress.
- **Model aliases + complexity router** — Bifrost owns the model mapping; the agent requests intent, not model names.
- **Tavily Docs Guard** — verifies changed external API usage against current docs before tests, not after failure.
- **Context economics** — stable caps and cache-safe prefixes first; compaction only when it lowers cost per solved task.
- **Replayable demo + chaos suite** — `gidorah demo --replay` works offline; killing Bifrost/Ollama/Tavily proves the guarantees.

See [Why Gidorah wins](docs/00-product/why-gidorah-wins.md) for the competitive thesis and 10/10 checklist.

---

## Project status

| Area | Status |
|---|---|
| Product and architecture docs | Draft v0.6 |
| Implementation | Not started |
| Hackathon track | Track A — Bifrost by Maxim AI |
| Required technologies | Bifrost + Tavily (both mandatory) |
| Planned stack | TypeScript / Node.js |
| Planned TUI | Adapted from `@deepseek-ai/dsh-tui` (MIT AND BSD-3-Clause) |

---

## Documentation

Start with:

- [Documentation index](docs/README.md)
- [Product brief](docs/00-product/product-brief.md)
- [Why Gidorah wins](docs/00-product/why-gidorah-wins.md)
- [Vision](docs/00-product/vision.md)
- [Requirements](docs/00-product/requirements.md)
- [System overview](docs/01-architecture/system-overview.md)
- [Bifrost model plane](docs/01-architecture/bifrost-model-plane.md)
- [Tavily knowledge plane](docs/01-architecture/tavily-knowledge-plane.md)
- [Audit and red team](docs/01-architecture/audit-and-redteam.md)
- [Benchmark plan](docs/03-evaluation/benchmark-plan.md)
- [Task catalog](docs/03-evaluation/task-catalog.md)
- [Roadmap](docs/04-delivery/roadmap.md)
- [Pre-mortem](docs/04-delivery/pre-mortem.md)
- [Productization](docs/04-delivery/productization.md)
- [Implementation plan](docs/02-engineering/implementation-plan.md)
- [CLI contract](docs/02-engineering/cli-contract.md)
- [Skills and tooling](docs/02-engineering/skills-and-tooling.md)
- [Research findings](docs/02-engineering/research-findings.md)
- [Demo and submission](docs/04-delivery/demo-and-submission.md)

---

## Repository layout (planned)

```text
apps/
  cli/                 # command entrypoint, headless mode
  tui/                 # adapted DSH TUI shell
packages/
  core/                # agent loop, events, sessions
  policy/              # repo classification, budgets, approvals
  bifrost/             # gateway client, headers, logs
  tavily/              # Scout, evidence cards, cache
  benchmark/           # task runner and report generator
  shared/              # types, config, utilities
config/
  policy.example.yml
  bifrost/
docs/
```

---

## Non-goals

- A general-purpose replacement for OpenCode, Claude Code, or DeepSeek Harness.
- A web UI, desktop app, plugin marketplace, or IDE extension in v1.
- A custom LLM gateway, budget ledger, or failover engine. Bifrost owns that.
- A custom model or a vector database.
- Multi-tenant SaaS. The v1 "user" is an OS user or configured profile.

---

## Licensing

Gidorah is planned as Apache-2.0. Reused components keep their original licenses and notices. See [licensing and attribution](docs/06-legal/licensing-and-attribution.md).

Bifrost is a separate open-source project by Maxim AI. DeepSeek Harness and its TUI are separate projects by DeepSeek; the TUI is reused under its recorded license. Gidorah is not affiliated with or endorsed by DeepSeek.
