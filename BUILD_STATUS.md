# BUILD STATUS

**Project:** Gidorah, the governed coding agent.
**Brief:** autonomous build from the docs in `docs/` (Draft v0.6).
**Started:** 2026-11-03T03:23+05:30 (Asia/Calcutta).
**Last updated:** 2026-11-03, phase M0.

This file is the live state of the build. It is updated after every task.

---

## 1. Environment (verified on this machine)

| Item | Found | Brief requires | Impact |
|---|---|---|---|
| Node | v26.13.0 | 22/24 LTS | Uses native type stripping; ADR-0013 |
| npm | 11.20.0 | n/a | Registry unreachable |
| pnpm | 11.28.5 via DSH bundled runtime | 9+ | Usable offline (workspace has no registry deps) |
| TypeScript compiler | not installed | for typecheck | PENDING, see ADR-0013 |
| Go | not installed | for Bifrost DLP plugin | Plugin source shipped; build/test PENDING |
| Git | 2.56.0 | 2.40+ | OK |
| Network / registry | unreachable (TLS 0x8009030e) | registry for deps | Zero-dependency build |
| Bifrost gateway | not running | model plane | Mock gateway implemented; real PENDING |
| Ollama | not installed | local model | Mock local model; real PENDING |
| Real provider keys | none | DEEPSEEK_API_KEY, TAVILY_API_KEY | All real results PENDING |

Consequence: the build is **mock-first**. Every real-provider, real-Bifrost,
real-Ollama, Go-plugin, and tsc result is labeled PENDING, never fabricated.

---

## 2. Milestone state

| Milestone | State | Notes |
|---|---|---|
| M0 Groundwork | in progress | Env audited, licenses plan recorded, build scaffolded |
| M1 Backbone | pending | workspace, Bifrost client, mock provider, Tavily mock, session, doctor |
| M2 Agent spine | pending | loop, tools, approvals, resume, plain renderer |
| M3 Policy + dual plane | pending | classifier, keys, budget, confidential, Scout, conformance |
| M4 Evidence and security | pending | recorder, benchmark, DLP, audit, redteam, context, CLI, TUI panels |
| M4.5 Upgrades | pending | complexity router arm, Code Mode arm (stretch) |
| M5 Demo and submission | pending | replay, chaos, demo, LICENSE/NOTICE, final scan |

---

## 3. Decisions and deviations from docs (each gets an ADR)

- **ADR-0013 (to write):** offline, dependency-free runtime: Node 26 type
  stripping, `node:test`, `node:sqlite`; no Zod/Commander/Vitest/Biome. Custom
  `scripts/lint.ts`, `scripts/typecheck.ts`, `scripts/build.ts`.
- **ADR-0014 (to write):** TUI: ship the mandated plain renderer now; vendoring
  the DSH TUI is PENDING because its package cannot be fetched offline. The
  docs already allow a line-based CLI fallback.
- **ADR-0015 (to write):** real-provider evidence PENDING; mock Bifrost/OpenAI/
  Tavily/Ollama used for every automated gate. Go DLP plugin written but not
  compiled (no Go toolchain).

---

## 4. Commands run (newest first)

```
git init                                    ok
node --version                              v26.13.0
node -e require('node:sqlite')              ok
npm registry ping                           FAILED (network unreachable)
pnpm add -D typescript --offline            FAILED (no offline metadata)
```

---

## 5. Open blockers / PENDING

| Item | Why | What would unblock it |
|---|---|---|
| `pnpm typecheck` real types | tsc not installable offline | registry access, `pnpm add -D typescript @types/node` |
| Go plugin build/test | Go not installed | Go 1.22+ toolchain |
| Real Bifrost budget/fallback/logs | gateway not running, no VK | Bifrost release + virtual keys |
| Real Ollama confidential model | Ollama not installed | Ollama + 3B model |
| Real Tavily evidence | no API key | TAVILY_API_KEY |
| Real benchmark numbers | no providers | keys per MORNING_RUNBOOK.md |

---

## 6. Next actions

1. Shared types, config, errors, redaction, canonical JSON (packages/shared).
2. Bifrost client, mock provider, mock gateway with budgets/routing/DLP.
3. Policy engine, approvals, shell lexer.
4. Tavily Scout, evidence cards, cache, credit budget.
5. Agent runtime, tools, session/audit chain, context economics.
6. CLI, conformance CT-01..CT-40, chaos, redteam, replay/demo, pilot benchmark.
7. Docs sync, ADRs, LICENSE/NOTICE, BUILD_REPORT.md, MORNING_RUNBOOK.md.
