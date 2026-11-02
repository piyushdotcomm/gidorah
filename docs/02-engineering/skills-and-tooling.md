# Skills and Tooling

**Status:** Draft · **Owner:** Engineering · **Last updated:** 2026-11-03

This document records the agent skills installed for the project, how they map to phases, and the concrete changes they made to the plan. Skills are procedural knowledge, not product dependencies. Review a skill before following it; several are third-party and carry their own assumptions.

See [research-findings.md](research-findings.md) for the external sources behind the plan changes.

---

## 1. Installed globally

| Skill | Source | Use in Gidorah | Phase |
|---|---|---|---|
| `find-skills` | vercel-labs/skills | Discover/install additional skills | All |
| `grill-me` | mattpocock/skills | Stress-test the plan and architecture | Planning |
| `grilling` | mattpocock/skills | Relentless plan interrogation | Planning |
| `to-spec` | mattpocock/skills | Turn decisions into a spec | Planning |
| `to-tickets` | mattpocock/skills | Break the plan into tracer-bullet tickets | Planning |
| `writing-plans` | obra/superpowers | Detailed implementation plans with TDD steps | Planning |
| `brainstorming` | obra/superpowers | Explore alternatives before committing | Planning |
| `improve-codebase-architecture` | mattpocock/skills | Deep-module/seam review | Architecture |
| `codebase-design` | mattpocock/skills | Module/interface vocabulary | Architecture |
| `domain-modeling` | mattpocock/skills | Glossary and ADR discipline | Architecture |
| `setup-ts-deep-modules` | mattpocock/skills | TypeScript module boundaries | Architecture |
| `typescript-advanced-types` | wshobson/agents | Advanced type patterns | Implementation |
| `tdd` | mattpocock/skills | Red-green-refactor | Implementation |
| `systematic-debugging` | obra/superpowers | Diagnose failures before fixing | Implementation |
| `diagnosing-bugs` | mattpocock/skills | Hard bug/perf diagnosis | Implementation |
| `verification-before-completion` | obra/superpowers | Run evidence before claiming done | Implementation |
| `code-review` | mattpocock/skills | Standards + spec review | Review |
| `using-git-worktrees` | obra/superpowers | Isolated benchmark/feature work | Implementation |
| `security-best-practices` | openai/skills | Secure-by-default JS/TS review | Security |
| `security-and-hardening` | addyosmani/agent-skills | Threat model, OWASP, supply chain, LLM output | Security |
| `llm-security` | semgrep/skills | OWASP LLM Top 10 controls | Security |
| `arize-compliance-audit` | arize-ai/arize-skills | Audit-trail and compliance gap checklist | Security / compliance |
| `cli-developer` | jeffallan/claude-skills | CLI UX, TTY, signals, completions | UX |
| `cli-creator` | openai/skills | Composable CLI, stable JSON, auth | UX |
| `mlflow-evaluation` | mlflow/skills | Eval design, pilots, scorers, traces | Evaluation |
| `doc-coauthoring` | anthropics/skills | Structured documentation workflow | Docs |
| `technical-writing` | riekelt/technical-writer | Conclusion-first, traceable prose | Docs |
| `skill-creator` | anthropics/skills | Build the project-specific skill | Tooling |
| `node` | mcollina/skills | Node.js 22+ patterns, errors, tests | Engineering |

Installed manually because the repository clone exceeded the CLI timeout; the `SKILL.md` and `references/details.md` are vendored under `~/.agents/skills/typescript-advanced-types`. The project skill is also copied there as `gidorah`.

---

## 2. Lessons that changed the plan

### 2.1 Cap tool output before compacting

The 2026 context-engineering research is consistent on one point: **stable tool-output caps are cheap; summarization rewrites the prefix and can invalidate prompt cache.** In one controlled study, capping cut cost per turn by 38% while memory accuracy stayed flat; compaction cost more because each summary invalidated the cached prefix.

Plan changes:

- Tool-result cap is the primary context control (default 4k tokens, stable).
- Clearing old tool results (keeping the call record) is the second lever.
- Compaction is **not** the default. It runs only at true context pressure or when the benchmark shows it lowers cost per solved task.
- Measure cache read tokens and prefix hash; a smaller context that breaks cache can cost more.
- New ADR-0009 and FR-61/62.

### 2.2 Measure cost per successful task, not tokens

The evaluation ecosystem is converging on **cost per successful task**: total input/output/tool/retry/cache cost divided by tasks delivered to spec. Price per token hides retries and cache write costs.

Plan changes:

- Report cost per task and cost per successful task.
- Include retry cost, cache-write amortization, and Tavily credits.
- Report price-per-task variance, not only the mean.
- New benchmark metrics and report sections.

### 2.3 OWASP LLM Top 10 is the security checklist

The `llm-security` skill maps agent risks to OWASP LLM 2025. Gidorah already addresses most; the plan now makes the mapping explicit: prompt injection, sensitive disclosure, supply chain, data poisoning, output handling, excessive agency, system prompt leakage, vector/embedding (N/A), misinformation, unbounded consumption.

Plan changes:

- New OWASP mapping table in `policy-and-security.md`.
- Conformance tests named against the relevant category.
- No secrets in prompts; policy lives outside the prompt.

### 2.4 CLI quality is a product requirement

The CLI skill adds hard requirements: `--help`/`--version`, TTY-aware color, SIGINT handling, non-interactive mode, stdout/stderr separation, shell completions, cross-platform smoke tests, and a startup target.

Plan changes:

- New `cli-contract.md`.
- New FR/NFR for CLI behavior and startup.
- Benchmark/CI runs use `--json --plain` and never prompt.

### 2.5 Evaluation needs a pilot and missing-data accounting

The MLflow evaluation skill recommends a small pilot before a full run, row-level inspection, and reporting evaluated/failed/missing/errored counts. A pass rate that hides missing rows is not evidence.

Plan changes:

- Pilot 3 tasks before the full benchmark.
- Keep pilot IDs and raw outputs.
- Report missing/errored rows separately.
- Use deterministic tests for pass/fail; LLM judges only for qualitative notes.
- State small-sample limits.

### 2.6 Bifrost Code Mode is a real token lever

Bifrost's MCP gateway and Code Mode can keep large tool results out of the model context and have been reported to cut token usage substantially. This is a deeper Bifrost use than routing alone.

Plan changes:

- Add a read-only Code Mode/MCP arm as a stretch (ADR-0010).
- Writes/shell/git stay native for approval integrity.
- Benchmark it; adopt only if cost per solved task improves.

### 2.7 Tavily screens results, but do not trust them

Tavily applies PII/prompt-injection screening before returning results. That is a useful layer, not a guarantee. Gidorah still treats web content as untrusted and never executes instructions found in it.

Plan changes:

- Note the screening layer in the Tavily doc and security model.
- Keep the injection corpus and output escaping.
- Add a search-depth ladder to control credits/tokens.

### 2.8 Audit evidence needs a boundary

The compliance-audit skill and the tamper-evident audit research agree: a hash chain is useful, but it is not proof on its own. The recorder must sit outside the actor's control path, and the head must be anchored.

Plan changes:

- Hash-chain every event; `audit verify` and redacted `audit export`.
- Anchor the head at turn boundaries; document the limitation.
- Map the export to NIST AI RMF / EU AI Act Art. 12 / ISO 42001 technical controls, without claiming certification.

### 2.9 Red team with a canary, not just prompts

The security skill emphasizes indirect injection through files, tools, and web content; NIST red-team research shows agents are attacked through ingested data. A canary secret turns “we block injections” into a measurable claim.

Plan changes:

- `gidorah redteam` corpus with direct/indirect/tool/web/budget/approval/path/provider attacks.
- Plant a fake canary; scan every outbound byte; require 0.
- Report PASS/FAIL; add bypasses to the corpus.

### 2.10 Patch-first and repo map

SWE-Edit reports 17.9% lower inference cost and 2.1% higher resolved rate from find/replace edits. Repository-graph work reports large context reductions from symbol-level retrieval.

Plan changes:

- `edit` uses unique find/replace patches; `write` requires a reason.
- `repo_map` returns file/symbol outlines; `read` accepts symbol/range.
- Benchmark arms I/J measure both.

---

## 3. Project-specific skill

`skills/gidorah/SKILL.md` teaches any coding agent how to work on this repo: non-negotiables, commands, repo map, policy rules, benchmark protocol, and definition of done. Read it before implementation.

---

## 4. How to use skills without outsourcing judgment

1. Load the skill for the phase, not every skill at once.
2. Treat skill text as advice; the project docs and tests are the contract.
3. Check third-party skill security assessments; `cli-developer` was flagged Critical by one scanner and Low by two others. Review before executing any bundled script.
4. Never let a skill override the confidentiality, budget, or approval rules.
5. If a skill suggests a change to the plan, record it in an ADR or this document.
