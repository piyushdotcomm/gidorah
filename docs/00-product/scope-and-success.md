# Scope and Success

**Status:** Draft · **Owner:** Product · **Last updated:** 2026-11-03

---

## 1. MVP scope

### Must have (hackathon gates)

| Area | Deliverable |
|---|---|
| Agent | Terminal coding agent: read, write, edit, bash, git, search, research |
| Session | Append-only JSONL log, resume, crash recovery |
| Bifrost | Per-user virtual keys, budgets, 402 handling, routing rules, model aliases, fallbacks, response headers |
| Confidentiality | Repo classification, local-only virtual key, Tavily disabled, network shell denial |
| Approvals | Read allow; write/shell/git ask with diff/command preview; audit |
| Tavily | Scout with local-first trigger, version-aware query, evidence card, cache, credit budget |
| Gateway security | Bifrost DLP/policy plugin: secret scan, confidential guard, audit headers |
| Evidence | Flight recorder, task receipt, benchmark report |
| Audit | Hash-chained session log, `audit verify`, redacted `audit export` |
| Red team | Injection corpus + canary exfiltration, zero egress |
| Context economics | Stable tool cap, tool-result clearing, compaction only at pressure/measured benefit |
| CLI contract | `--help/--version/--json/--plain`, SIGINT, non-interactive, completions |
| TUI | Adapted DSH TUI shell with status line, takeover banner, approval modal, research card |
| Demo | Deterministic 3-minute demo with mock outage, injection block, docs-dependent task, offline replay |
| Reliability | Chaos suite: kill Bifrost/Ollama/Tavily/network; guarantees hold |

### Should have

- Exact cache for deterministic sub-calls.
- Budget-aware routing rule (`budget_used > 85` → cheaper model).
- Per-task research cap and research cache hit reporting.
- Per-task LLM budget cap.
- Tavily Docs Guard for changed external API usage.
- Tavily search-depth ladder (ultra-fast → basic → advanced).
- Bifrost MCP Gateway + Code Mode read-only arm.
- Patch-first edits and repo-map/symbol reads.
- Ed25519 signing / external anchoring for the audit chain.
- Markdown/JSON export of session and trace.
- Bifrost complexity router benchmark arm.

### Could have

- Read-once cache for unchanged files.
- Multi-file approval batching.
- Tavily dependency docs index (Map/Extract).
- Bifrost `gidorah` launcher/profile integration.
- Team/customer budget hierarchy demo.
- Server/headless API mode.
- Second local model profile.

### Won't have (v1)

- Web UI, desktop app, IDE extension.
- Plugin marketplace, Cordis kernel.
- Multi-tenant auth/SSO.
- Custom gateway/ledger/failover.
- Custom model or vector database.
- Multi-agent swarm.

---

## 2. Success metrics

### 2.1 Hackathon gates

| Gate | Target | Evidence |
|---|---|---|
| G1 Session continuity | Fallback works under 429/503; takeover notice durable | CT-01..03, demo scene 3 |
| G2 Budget | Zero overspend; 80% warning; 100% policy | CT-04..06, ledger |
| G3 Confidentiality | 0 cloud LLM calls, 0 Tavily calls in confidential mode | CT-07..09, audit log, network check |
| G4 Approvals | Reads free; writes/shell/git prompt; denial honored | CT-10..12, demo scene 1 |
| G5 Token efficiency | Measured improvement; cost per solved task | Benchmark report |
| G6 Dual technology | Bifrost is the only model path; Tavily is policy-gated and measured | Architecture + benchmark arms |
| G7 Demo | 3 minutes, deterministic, all scenes pass | Recorded run + checklist |
| G8 Gateway security | DLP blocks secret fixture; confidential guard rejects cloud | CT-25..CT-28 |
| G9 Replay | Offline replay reproduces all demo scenes | `gidorah demo --replay` |
| G10 Chaos | Dependency kills produce documented behavior | Chaos suite report |
| G11 CLI | `--json/--plain/--help/--version`, no prompts in pipes, completions | CLI contract tests |
| G12 Context | Cap preserves cache; compaction net cost reported; no default compaction | CT-34, benchmark sub-arms |
| G13 Audit | Chain verifies; tamper detected; export redacted | CT-35/36/39/40 |
| G14 Red team | 20/20 corpus blocked; canary egress 0 | CT-37/38 |

### 2.2 Product metrics (directional, confirm in pilot)

| Metric | Baseline | Target |
|---|---|---|
| Cost per solved task | Always-Pro, full context | ≥30% lower at equal or better pass rate |
| Cost per successful task | Same baseline | ≥30% lower; includes retries and cache write amortization |
| Pass@1 on benchmark | Baseline | No regression; improvement preferred |
| Tokens per solved task | Baseline | ≥25% lower |
| Model requests per solved task (round trips) | Baseline | ≥20% lower |
| Compaction net cost | — | ≤0; disable if positive |
| Cache hit rate | — | Reported; no regression from context changes |
| Budget violations | — | 0 |
| Cloud calls in confidential mode | — | 0 |
| Unnecessary Tavily calls on repo-local tasks | — | 0 |
| Tavily cache hit rate | — | ≥30% on repeated docs tasks |
| Fallback recovery success | — | 100% in test matrix |
| Approval false prompts on reads | — | 0 |
| DLP secret fixtures blocked | — | 100% of known key/private-key patterns |
| DLP false positives on normal prompts | — | < 1% |
| Red-team bypasses | — | 0 on the committed corpus |
| Canary egress | — | 0 occurrences |
| Audit chain verification | — | 100% valid; tamper fixture fails |
| Patch-first edits | — | ≥80% of edits are patches; full-file rewrites flagged |
| Repo-map reads | — | ≥50% of file reads are symbol/range |
| Docs Guard flagged deprecated APIs | — | ≥1 in the Class B fixture; 0 on repo-local changes |
| Replay determinism | — | Same visible scenes + receipt, 3/3 runs |
| Chaos recovery | — | Documented behavior within 5 s, 0 silent cloud fallbacks |

Targets are hypotheses. The benchmark decides; do not publish a number before measuring.

### 2.3 Quality metrics

- Core policy/approval/budget test coverage ≥80%.
- Zero secrets in logs/transcripts (automated scan).
- Session resume success ≥99% in fault-injection tests.
- `gidorah bench` reproducible from a clean clone.

---

## 3. Hackathon scoring alignment

| Criterion | How Gidorah addresses it |
|---|---|
| Correctness on real tasks | Real repo tasks, test-based pass/fail, 5 runs |
| Minimal token usage | Phase routing, pruning, compaction, exact cache, Tavily evidence instead of trial-and-error |
| Reliability | Bifrost retries/fallbacks, durable session, visible takeover |
| Security | Policy below prompt, local-only key, zero egress, approvals |
| Use of Bifrost | Structural: budgets, routing, fallbacks, cache, logs, plugin |
| Use of Tavily | Structural: research triggers, evidence cards, cache, budget, policy gating |
| Innovation | Dual-plane governance + flight recorder + agent-aware routing |
| Open-source contribution | Bifrost plugin, agent, benchmark tasks |
| Presentation | Deterministic 3-minute demo with two jaw-drop moments and a measured chart |

---

## 4. Milestone gates

| Milestone | Gate |
|---|---|
| M0 Planning | Docs approved; stack chosen; licenses checked |
| M1 Backbone | Bifrost + Tavily + Ollama reachable; CLI echoes a session |
| M2 Agent | Real task solved end-to-end; approvals work |
| M3 Policy | Confidential, budget, failover, research gating pass conformance |
| M4 Evidence | Benchmark runs; report generated; TUI trace works |
| M5 Demo | Three-minute run is deterministic; submission checklist complete |

---

## 5. Assumptions and constraints

- TypeScript/Node is the implementation language because the TUI and SDKs are TypeScript-first.
- Bifrost runs locally on port 8080; its version is pinned for the submission.
- Tavily API access is available; credits are budgeted.
- Ollama runs a 3B–4B quantized coding model on the demo machine (RTX 3050 6GB, 8GB RAM). Larger models are optional.
- DeepSeek Flash/Pro are available through Bifrost.
- The v1 “user” is an OS user or configured profile, not a multi-tenant SaaS account.
- The hackathon permits open-source reuse; all licenses and notices are preserved.

---

## 6. Definition of done (project)

The project is submission-ready when:

1. All MUST requirements have a passing conformance test.
2. The benchmark report has raw artifacts and a reproducible command.
3. The demo runs three times in a row without manual repair.
4. The README and docs explain Bifrost and Tavily roles without ambiguity.
5. Licenses and notices are complete.
6. No secrets are committed.
