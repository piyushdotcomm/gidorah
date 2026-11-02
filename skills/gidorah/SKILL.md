---
name: gidorah
description: "Use when working on the Gidorah project: building, testing, reviewing, benchmarking, or changing the governed coding agent. Encodes the non-negotiables, repo map, commands, and definition of done."
---

# Gidorah Project Skill

## What this project is

Gidorah is a terminal coding agent with a dual-plane control plane:

- **Bifrost** is the model plane: the only path to a model, with virtual keys, budgets, routing, fallbacks, cache, logs, and a DLP/policy plugin.
- **Tavily** is the knowledge plane: local-first, version-aware research compressed into cited evidence cards, budgeted, cached, and disabled in confidential mode.
- **Gidorah** owns the agent loop, tools, approvals, context economics, flight recorder, and benchmark.

The hackathon track requires both Bifrost and Tavily to be meaningful, not decorative.

## Read first

1. `docs/00-product/product-brief.md`
2. `docs/00-product/requirements.md`
3. `docs/01-architecture/system-overview.md`
4. `docs/01-architecture/policy-and-security.md`
5. `docs/03-evaluation/benchmark-plan.md`
6. `docs/02-engineering/implementation-plan.md`

## Non-negotiables

- **One model egress path.** All model calls go through Bifrost. No direct provider SDK, no provider key in the agent.
- **No secrets in prompts or logs.** DLP scans outbound requests; redact logs; never commit `.env`.
- **Confidential mode has zero external egress.** Local-only virtual key, Tavily disabled, network shell commands denied.
- **Policy below the prompt.** The model cannot choose provider, key, budget, confidentiality, or research access.
- **Reads are free; writes/shell/git require approval.** Denials are honored and audited.
- **Budget before request.** Bifrost is the authority; 402 is not retried; task caps never authorize overspend.
- **Measure, don't estimate.** Tokens/cost come from Bifrost and Tavily usage.
- **Cap tool output before compacting.** Compaction is conditional; it must beat the cache cost.
- **No feature without a demo or metric.** If it cannot be shown or measured, cut it.

## Repo map

```text
apps/cli          command entrypoint, headless mode
apps/tui          adapted DSH TUI shell
packages/core     agent loop, events, sessions, context
packages/policy   repo classification, budgets, approvals
packages/bifrost  gateway client, headers, logs, 402/fallback
packages/tavily   Scout, query builder, evidence cards, cache
packages/benchmark task runner, arms, metrics, report
packages/shared   types, config, errors, redaction
plugins/bifrost-dlp Go plugin: confidential guard + DLP
tests/conformance CT-01..CT-40
tests/chaos       dependency-kill tests
tests/replay      recorded demo traces
docs/             product, architecture, engineering, eval, delivery
```

## Commands

```bash
pnpm install
pnpm build
pnpm test
pnpm lint && pnpm typecheck
pnpm gidorah doctor
pnpm gidorah demo --replay
pnpm bench
pnpm conformance
pnpm chaos
```

## Policy rules to preserve

- Confidential classification comes from `~/.gidorah/policy.yml`, not the repo.
- Cloud and local virtual keys are separate; the agent selects by policy.
- Bifrost plugin rejects cloud providers when `x-gidorah-confidential: true`.
- Tavily is unavailable in confidential mode; cached cards are not read.
- Shell parsing uses a real lexer; unknown or dynamic commands force `ask`.
- Git read-only subcommands may auto-allow; mutations ask.

## Benchmark protocol

- 16-20 tasks, Class A (repo-local) and Class B (docs-dependent).
- Arms: always Pro, Bifrost complexity router, Gidorah cascade, full dual-plane; optional cache/docs-guard arms.
- 5 runs per task/arm; pilot 3 tasks first.
- Metrics: cost per solved task, cost per successful task, pass@1, tokens, model requests, research calls, cache hit, fallback, missing/errored rows.
- Raw artifacts and a reproducible command are required.

## Definition of done

- [ ] Requirement has a test or a demo scene.
- [ ] Policy/security change has a conformance test.
- [ ] Docs updated.
- [ ] No secrets, no direct provider path.
- [ ] Benchmark impact considered.
- [ ] License/NOTICE updated if code or dependency changed.

## Common mistakes

- Building a generic agent instead of the control plane.
- Adding features that are not demoed or measured.
- Letting compaction rewrite the cached prefix and increase cost.
- Treating Tavily as a search toy instead of a budgeted, cited correctness layer.
- Claiming gateway DLP if the plugin only adds headers.
- Forgetting that the demo must run offline from replay.
