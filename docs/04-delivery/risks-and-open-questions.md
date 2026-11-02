# Risks and Open Questions

**Status:** Draft · **Owner:** Delivery · **Last updated:** 2026-11-03

---

## 1. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| RSK-01 | DSH TUI is too coupled to DSH services to adapt in time | High | High | Timebox A1; stub services; fall back to plain renderer; copy layout/components, not the whole app | Frontend |
| RSK-02 | Bifrost API/version drift (preview) | Medium | High | Pin version; record in manifest; integration tests; docker image | Bifrost |
| RSK-03 | Tavily rate/credit limits during benchmark | Medium | Medium | Budget, cache, mock for tests, run benchmark in batches | Eval |
| RSK-04 | Local model too weak/slow on 6 GB VRAM | High | Medium | Use 3B Q4; keep confidential demo task small; report limitation; do not use local for headline pass-rate | Engineering |
| RSK-05 | Windows terminal issues | Medium | High | Test Windows Terminal early; `--plain` fallback; record demo on the known-good terminal | Frontend |
| RSK-06 | Direct provider path bypasses Bifrost | Medium | Critical | Dependency/network tests; no provider SDKs; single client; CT-12 | Security |
| RSK-07 | Prompt injection changes behavior | Medium | Critical | Structural enforcement; injection corpus; CT-07/08/10/18 | Security |
| RSK-08 | Benchmark contamination / cherry-picking | Medium | High | Recent-commit tasks; preregister tasks; raw artifacts; per-task results | Eval |
| RSK-09 | Scope creep (web UI, plugins, multi-agent) | High | High | Non-goals; cut list; milestone gates | Delivery |
| RSK-10 | Tavily integration feels decorative | Medium | High | Make it budgeted, cached, policy-gated, measured; Class B tasks; demo scene | Product |
| RSK-11 | Bifrost plugin not upstreamable | Low | Low | Keep it small, Apache-2.0, documented; it is a contribution even if not merged | Engineering |
| RSK-12 | License/attribution missed | Low | High | LICENSE/NOTICE/SPDX; legal review; third-party register | Legal |
| RSK-13 | Secrets in logs/demo | Low | Critical | Redaction, secret scan, no content logging in confidential, demo checklist | Security |
| RSK-14 | Benchmark takes too long | High | Medium | 16 tasks, 5 runs, parallel worktrees, mock dry runs; reduce to 12 if needed | Eval |
| RSK-15 | Demo depends on a live outage | Medium | High | Mock provider; recorded backup; no live provider failure | Delivery |
| RSK-16 | TUI license obligations misunderstood | Low | High | Read package LICENSE; SPDX; NOTICE; legal review | Legal |
| RSK-17 | Time lost to productization planning | Medium | Medium | Docs timeboxed; hackathon first; product roadmap after | Delivery |
| RSK-18 | DLP false positives block normal work | Medium | High | Pattern corpus, allowlist, visible block reason, block only high-confidence secrets | Security |
| RSK-19 | Docs Guard parsing is too complex | Medium | Medium | Start with imports/member calls; cap one lookup; ship as stretch | Engineering |
| RSK-20 | Replay traces drift from the live demo | Low | High | Schema/version check; replay test in CI; fail loudly on drift | Engineering |
| RSK-21 | Upstream Bifrost plugin not accepted | Low | Low | Publish as an external plugin; document the integration | Engineering |
| RSK-22 | Too many winning upgrades dilute the core | Medium | High | M4.5 only after M4 gate; every upgrade needs a demo or metric | Delivery |
| RSK-23 | Bifrost hook cannot inspect request body safely | Medium | High | Spike early; fall back to agent-side DLP + confidential header guard; do not claim gateway DLP if unavailable | Engineering |
| RSK-24 | Benchmark budget exceeds available credits | Medium | High | Pilot first; dedicated capped keys; reduce tasks/runs; document | Eval |
| RSK-25 | Compaction increases cost by breaking cache | Medium | High | Cap first; compaction only at pressure/measured benefit; report net cost; disable if positive | Engineering |
| RSK-26 | Code Mode bypasses approval or adds complexity | Medium | High | Read-only tools only; writes/shell/git native; benchmark arm; cut if it does not win | Engineering |
| RSK-27 | CLI startup exceeds the target with heavy imports | Medium | Medium | Lazy-load TUI/SQLite/SDKs; measure cold/warm; relax target with evidence | Engineering |
| RSK-28 | Audit chain overclaimed as “proof” | Medium | High | Say tamper-evident; anchor head; document operator limitation | Security |
| RSK-29 | Red-team corpus is too weak | Medium | High | Add indirect/tool/web attacks; canary scan; add any bypass to corpus | Security |
| RSK-30 | Patch-first edits fail on ambiguity | Medium | Medium | Unique-match validation; fall back to range read or full write with reason | Engineering |
| RSK-31 | Repo map is inaccurate or stale | Medium | Medium | Cache by commit + hash; invalidate changed files; fall back to grep/read | Engineering |

---

## 2. Open questions

| ID | Question | Options | Decision owner | Needed by |
|---|---|---|---|---|
| OQ-01 | Final product name | **Resolved: Gidorah** | Product | Done |
| OQ-02 | Node 22 vs 24 | 22 LTS / 24 LTS | Engineering | M1 |
| OQ-03 | TUI adaptation depth | Full shell / components only / plain | Frontend | M2 |
| OQ-04 | Bifrost deployment | npx / Docker / binary | Engineering | M1 |
| OQ-05 | Local model | Qwen2.5-Coder 3B / 7B / other | Engineering | M1 |
| OQ-06 | Benchmark repo(s) | TypeScript repo / synthetic | Eval | M0 |
| OQ-07 | Tavily credit pricing in report | Separate credits / convert to USD | Eval | M4 |
| OQ-08 | Research card compressor | Heuristic / cheap LLM | Engineering | M3 |
| OQ-09 | Cache TTLs | 1d error / 7d docs | Engineering | M3 |
| OQ-10 | Multi-user scope | OS profile / server | Product | Post-hackathon |
| OQ-11 | Bifrost plugin scope | Header-only / guard + header | Engineering | M4 |
| OQ-12 | Product license | Apache-2.0 / MIT | Legal | M0 |
| OQ-13 | Benchmark approval policy | Auto-approve worktree / manual | Eval/Security | M3 |
| OQ-14 | Whether to include a second language | Yes / no | Eval | M0 |
| OQ-15 | Docs Guard in v1 or stretch | v1 / stretch | Product | M4 |
| OQ-16 | DLP default action | Block / redact | Security | M4 |
| OQ-17 | Bifrost plugin upstream target | In-tree / external | Engineering | M4 |
| OQ-18 | `bifrost gidorah` integration | Launcher / profile / none | Engineering | M4.5 |
| OQ-19 | Team budget demo | Yes / stretch / no | Product | M4.5 |
| OQ-20 | Replay trace format | JSONL / event log + metadata | Engineering | M5 |
| OQ-21 | Bifrost Code Mode/MCP arm | Yes / stretch / no | Engineering | M4.5 |
| OQ-22 | Compaction default | Off / pressure-only / measured | Engineering | M3 |
| OQ-23 | CLI startup target | 50 ms / 150 ms / measure | Engineering | M4 |

---

## 3. Assumptions

- The hackathon permits open-source reuse and requires both Bifrost and Tavily.
- Bifrost can be run locally and supports the provider/routing/budget features documented.
- Tavily API access is available at the required volume.
- Ollama can run a 3B–4B quantized model on the demo machine.
- DeepSeek Flash/Pro are available through Bifrost.
- The demo machine has a stable terminal and screen recording.
- A single-user local deployment is acceptable for v1.
- The team can spend the time required for a 16-task, 5-run benchmark.

If an assumption fails, update the docs and the plan before proceeding.

---

## 4. Decision log

| ADR | Decision |
|---|---|
| [ADR-0001](../05-decisions/README.md#adr-0001--bifrost-is-the-model-plane) | Bifrost is the model plane |
| [ADR-0002](../05-decisions/README.md#adr-0002--tavily-is-the-knowledge-plane) | Tavily is the knowledge plane |
| [ADR-0003](../05-decisions/README.md#adr-0003--copy-the-dsh-tui-not-the-harness) | Copy the DSH TUI, not the harness |
| [ADR-0004](../05-decisions/README.md#adr-0004--single-model-egress-path) | Single model egress path |
| [ADR-0005](../05-decisions/README.md#adr-0005--typescriptnode-and-event-driven-ui) | TypeScript/Node + event-driven UI |
| [ADR-0006](../05-decisions/README.md#adr-0006--policy-below-the-prompt) | Policy below the prompt |
| [ADR-0007](../05-decisions/README.md#adr-0007--gateway-enforced-dlp) | Gateway-enforced DLP |
| [ADR-0008](../05-decisions/README.md#adr-0008--tavily-docs-guard-as-proactive-verification) | Tavily Docs Guard as proactive verification |
| [ADR-0009](../05-decisions/README.md#adr-0009--cap-tool-output-before-compacting) | Cap tool output before compacting |
| [ADR-0010](../05-decisions/README.md#adr-0010--bifrost-code-mode-for-read-only-tools-only) | Bifrost Code Mode for read-only tools only |
| [ADR-0011](../05-decisions/README.md#adr-0011--tamper-evident-audit-chain) | Tamper-evident audit chain |
| [ADR-0012](../05-decisions/README.md#adr-0012--patch-first-edits-and-symbol-indexed-reads) | Patch-first edits and symbol-indexed reads |

---

## 5. Review cadence

- Weekly risk review; update likelihood/impact.
- Every milestone gate re-checks the top 5 risks.
- A risk that becomes an incident gets a blameless note and a conformance test.
