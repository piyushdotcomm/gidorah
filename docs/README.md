# Gidorah — Documentation

**Status:** Draft v0.6 · **Last updated:** 2026-11-03 · **Owner:** Founding team

This folder is the source of truth for product, architecture, engineering, evaluation, delivery, and legal decisions before implementation. Code may lag the docs during planning; when code and docs disagree, open a PR and update both.

---

## Reading paths

### For judges and reviewers
1. [Product brief](00-product/product-brief.md)
2. [Why Gidorah wins](00-product/why-gidorah-wins.md)
3. [Vision](00-product/vision.md)
4. [Requirements](00-product/requirements.md)
5. [System overview](01-architecture/system-overview.md)
6. [Bifrost model plane](01-architecture/bifrost-model-plane.md)
7. [Tavily knowledge plane](01-architecture/tavily-knowledge-plane.md)
8. [Audit and red team](01-architecture/audit-and-redteam.md)
9. [Benchmark plan](03-evaluation/benchmark-plan.md)
10. [Demo and submission](04-delivery/demo-and-submission.md)

### For engineers
1. [System overview](01-architecture/system-overview.md)
2. [Agent runtime](01-architecture/agent-runtime.md)
3. [Policy and security](01-architecture/policy-and-security.md)
4. [Audit and red team](01-architecture/audit-and-redteam.md)
5. [Data and events](01-architecture/data-and-events.md)
6. [TUI adaptation](01-architecture/tui-adaptation.md)
7. [Tech stack and repo](02-engineering/tech-stack-and-repo.md)
8. [Development and testing](02-engineering/development-and-testing.md)
9. [Implementation plan](02-engineering/implementation-plan.md)
10. [CLI contract](02-engineering/cli-contract.md)
11. [Skills and tooling](02-engineering/skills-and-tooling.md)

### For product and delivery
1. [Personas and use cases](00-product/personas-and-use-cases.md)
2. [Scope and success](00-product/scope-and-success.md)
3. [Roadmap](04-delivery/roadmap.md)
4. [Pre-mortem](04-delivery/pre-mortem.md)
5. [Productization](04-delivery/productization.md)
6. [Risks and open questions](04-delivery/risks-and-open-questions.md)

---

## Document map

| Document | Purpose | Audience | Status |
|---|---|---|---|
| [00-product/product-brief.md](00-product/product-brief.md) | One-page executive summary | All | Draft |
| [00-product/why-gidorah-wins.md](00-product/why-gidorah-wins.md) | Competitive thesis, 10/10 checklist, winning upgrades | All | Draft |
| [00-product/vision.md](00-product/vision.md) | Product thesis, principles, differentiators | All | Draft |
| [00-product/personas-and-use-cases.md](00-product/personas-and-use-cases.md) | Users, jobs, scenarios, competition | Product | Draft |
| [00-product/requirements.md](00-product/requirements.md) | Functional and non-functional requirements | All | Draft |
| [00-product/scope-and-success.md](00-product/scope-and-success.md) | MVP scope, non-goals, success metrics | All | Draft |
| [01-architecture/system-overview.md](01-architecture/system-overview.md) | Context, components, flows, deployment | Engineering | Draft |
| [01-architecture/agent-runtime.md](01-architecture/agent-runtime.md) | Loop, tools, approvals, context, sessions | Engineering | Draft |
| [01-architecture/bifrost-model-plane.md](01-architecture/bifrost-model-plane.md) | Virtual keys, budgets, routing, fallbacks, logs | Engineering | Draft |
| [01-architecture/tavily-knowledge-plane.md](01-architecture/tavily-knowledge-plane.md) | Research triggers, evidence cards, cache, policy | Engineering | Draft |
| [01-architecture/policy-and-security.md](01-architecture/policy-and-security.md) | Threat model and enforcement points | Engineering / security | Draft |
| [01-architecture/audit-and-redteam.md](01-architecture/audit-and-redteam.md) | Hash-chain audit, compliance export, red-team canary | Engineering / security | Draft |
| [01-architecture/data-and-events.md](01-architecture/data-and-events.md) | Event schema, SQLite schemas, retention | Engineering | Draft |
| [01-architecture/tui-adaptation.md](01-architecture/tui-adaptation.md) | What we copy from DSH TUI and how we adapt it | Engineering | Draft |
| [02-engineering/tech-stack-and-repo.md](02-engineering/tech-stack-and-repo.md) | Language, libraries, repo layout, standards | Engineering | Draft |
| [02-engineering/development-and-testing.md](02-engineering/development-and-testing.md) | Local setup, test pyramid, CI, conformance | Engineering | Draft |
| [02-engineering/implementation-plan.md](02-engineering/implementation-plan.md) | Task-by-task TDD build plan | Engineering | Draft |
| [02-engineering/cli-contract.md](02-engineering/cli-contract.md) | Commands, flags, exit codes, output streams | Engineering / UX | Draft |
| [02-engineering/skills-and-tooling.md](02-engineering/skills-and-tooling.md) | Installed skills and plan changes | Engineering | Draft |
| [02-engineering/research-findings.md](02-engineering/research-findings.md) | External research, sources, and adopted changes | All | Draft |
| [02-engineering/observability-and-release.md](02-engineering/observability-and-release.md) | Flight recorder, logs, packaging, releases | Engineering | Draft |
| [03-evaluation/benchmark-plan.md](03-evaluation/benchmark-plan.md) | Tasks, arms, metrics, protocol, validity | All | Draft |
| [03-evaluation/task-catalog.md](03-evaluation/task-catalog.md) | Candidate Class A/B tasks and spec template | Evaluation | Draft |
| [04-delivery/roadmap.md](04-delivery/roadmap.md) | Workstreams, milestones, gates | All | Draft |
| [04-delivery/pre-mortem.md](04-delivery/pre-mortem.md) | If this fails, why; early warnings and mitigations | All | Draft |
| [04-delivery/productization.md](04-delivery/productization.md) | Buyer, open-core model, post-hackathon roadmap | Product | Draft |
| [04-delivery/demo-and-submission.md](04-delivery/demo-and-submission.md) | 3-minute demo, fixtures, checklist, Q&A | All | Draft |
| [04-delivery/risks-and-open-questions.md](04-delivery/risks-and-open-questions.md) | Risk register, assumptions, open decisions | All | Draft |
| [05-decisions/README.md](05-decisions/README.md) | Architecture decision records | Engineering | Draft |
| [06-legal/licensing-and-attribution.md](06-legal/licensing-and-attribution.md) | Licenses, notices, trademark, distribution | All | Draft |
| [glossary.md](glossary.md) | Shared vocabulary | All | Draft |

---

## Conventions

### Requirement keywords
- **MUST** — required for the hackathon or for safety.
- **SHOULD** — expected unless a documented reason prevents it.
- **MAY** — optional or stretch.

### Identifiers
- `FR-###` functional requirement
- `NFR-###` non-functional requirement
- `UC-###` use case
- `ADR-####` architecture decision record
- `RSK-###` risk
- `OQ-###` open question

### Status values
- **Draft** — being written; not approved.
- **Review** — ready for feedback.
- **Approved** — accepted; changes require a PR and, for significant changes, an ADR.
- **Superseded** — replaced; link to the replacement.

### Decision records
Any decision that changes the architecture, a public contract, a security boundary, or a license requires an ADR in [`05-decisions/`](05-decisions/README.md).

---

## Source-of-truth rules

1. **Policy behavior** is defined by code and configuration, not by prompts.
2. **Cost and token numbers** come from Bifrost logs and provider usage, never from estimates in prose.
3. **Tavily evidence** comes from actual API responses, with sources; cached cards retain their source URLs and timestamps.
4. **Benchmark claims** require raw JSONL artifacts committed or linked alongside the report.
5. **Security claims** require a passing conformance test, not a demo alone.

---

## Change log

| Date | Version | Change |
|---|---|---|
| 2026-11-03 | 0.1 | Initial documentation set created |
| 2026-11-03 | 0.2 | Renamed project to Gidorah; added winning upgrades, DLP, Docs Guard, replay/chaos, productization, ADR-0007/0008 |
| 2026-11-03 | 0.3 | Added skills inventory, project skill, implementation plan, CLI contract, pre-mortem, context economics, OWASP mapping, Code Mode arm, ADR-0009/0010 |
| 2026-11-03 | 0.4 | Added external research findings and source-backed plan revisions |
| 2026-11-03 | 0.5 | Added benchmark task catalog and final consistency pass |
| 2026-11-03 | 0.6 | Added tamper-evident audit, red-team canary, patch-first edits, repo map, and new skills |

---

## Implementation status (2026-11-03)

The docs above remain the design source of truth. A working offline implementation now exists: see the repository root `README.md`, `BUILD_REPORT.md`, `BUILD_STATUS.md`, and `MORNING_RUNBOOK.md`. Deviations from the planned toolchain are recorded in ADR-0013 (dependency-free runtime), ADR-0014 (plain TUI first), and ADR-0015 (mock-first evidence and honest PENDING). Real-provider, Go-plugin, DSH-TUI, and bundler items remain PENDING with explicit unblock steps.
