# Requirements

**Status:** Draft · **Owner:** Product / Engineering · **Last updated:** 2026-11-03

This document defines what Gidorah must do. It is the contract for implementation, testing, and the demo. **MUST** items are required for the hackathon or safety; **SHOULD** items are expected; **MAY** items are stretch.

---

## 1. Functional requirements

### 1.1 Session continuity and reliability

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-01 | A session MUST survive a provider outage or rate limit without losing history. | MUST | After a simulated 429/503, the next request succeeds through a fallback and the session log contains the complete prior history. |
| FR-02 | The agent MUST tell the user when a different model serves a request. | MUST | A durable, visible notice includes from-model, to-model, reason, fallback index, and timestamp; it survives resume. |
| FR-03 | Failover MUST NOT replay tool calls that already executed. | MUST | A failure after a tool result does not re-run the tool; the session log shows one result per call. |
| FR-04 | The agent MUST preserve a resumable session across process restart. | MUST | `gidorah resume` restores transcript, route, budget state, research cards, and pending approvals. |
| FR-05 | The agent MUST surface a clear terminal error when all providers fail. | MUST | No silent hang; error names attempted providers and suggests retry/route change. |

### 1.2 Budget

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-06 | A per-user budget MUST be enforced before each model request. | MUST | Bifrost virtual key budget rejects over-budget requests with 402; Gidorah never sends an unreserved request. |
| FR-07 | The agent MUST warn at a configurable soft threshold (default 80%). | MUST | Exactly one warning per threshold crossing per session. |
| FR-08 | At 100%, the agent MUST follow a defined policy. | MUST | Configured behavior: degrade to local (if allowed), or stop with an actionable message; no request bypasses the cap. |
| FR-09 | Budget accounting MUST reconcile with provider usage. | MUST | Ledger matches Bifrost logs within a documented rounding tolerance. |
| FR-10 | Concurrent sessions MUST NOT overspend. | MUST | A race test with N parallel requests never exceeds the cap. |
| FR-11 | Research credits MUST have a per-user budget. | SHOULD | Tavily calls blocked at the configured credit limit; cached cards may still be used. |
| FR-12 | The user MUST be able to inspect remaining budget and spend. | MUST | `gidorah budget` and the TUI status line show LLM dollars and research credits. |

### 1.3 Confidentiality

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-13 | A repository MUST be classifiable as confidential by path, git remote, or explicit marker. | MUST | Global policy file outside the repo is the root of trust; classification is logged. |
| FR-14 | Confidential sessions MUST use only local models. | MUST | Bifrost local-only virtual key allows only `ollama/*`; cloud requests are rejected. |
| FR-15 | A prompt MUST NOT be able to change provider policy. | MUST | Injection prompts (file content, user message, tool output) cannot change the virtual key or provider allowlist. |
| FR-16 | Confidential sessions MUST have zero external research egress. | MUST | Tavily is disabled, cached cards are not used, and network shell commands are denied. |
| FR-17 | Confidential mode MUST be visible. | MUST | TUI shows a persistent badge and the flight recorder records `mode=confidential`. |
| FR-18 | The agent MUST block or deny network-capable shell commands in confidential mode. | MUST | `curl`, `wget`, `ssh`, `nc`, `git push`, package publish, and similar are denied, not merely asked. |

### 1.4 Approvals

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-19 | Ordinary reads MUST run without approval. | MUST | `read`, `glob`, `grep`, `list`, and `research` (non-confidential) do not prompt. |
| FR-20 | Writes MUST require approval. | MUST | `write`, `edit`, `apply_patch` prompt with a diff preview; denial prevents mutation. |
| FR-21 | Shell commands MUST require approval. | MUST | Exact command and cwd shown; read-only allowlist may auto-allow; unknown commands ask. |
| FR-22 | Git mutations MUST require approval. | MUST | `commit`, `push`, `reset`, `checkout`, `merge`, `rebase`, `clean` ask; `status`, `diff`, `log`, `show` may allow. |
| FR-23 | Approval decisions MUST be audited. | MUST | Session event records tool, args, decision, reason, timestamp, and policy version. |
| FR-24 | Approval MUST NOT be bypassable by a prompt. | MUST | A model request to skip approval still hits the pre-tool gate. |
| FR-25 | Approval fatigue MUST be controlled. | SHOULD | Batch previews for multi-file edits; no session-wide blanket approve by default. |

### 1.5 Token efficiency

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-26 | The agent MUST use a stable, cache-friendly prompt prefix. | MUST | System prompt and tool order are stable within a session; no timestamps/IDs in the prefix. |
| FR-27 | Tool results MUST be pruned to a configurable budget. | MUST | Large outputs are head/tail pruned with an error-preserving rule; original retained in an artifact. |
| FR-28 | History MUST be compacted at a configurable threshold. | SHOULD | Compaction preserves task state, open tool pairs, and recent turns. |
| FR-29 | The agent MUST route by task phase. | MUST | `explore`, `edit`, `verify` map to configured models through Bifrost routing rules. |
| FR-30 | Deterministic sub-calls MUST use exact caching. | SHOULD | File summaries, test triage, and commit messages use `x-bf-cache-key`; cache hits reported. |
| FR-31 | Redundant file reads MUST be avoided. | SHOULD | A read of an unchanged file may return a compact “unchanged since seq N” result. |
| FR-32 | Token usage MUST be measured, not estimated. | MUST | All reported tokens come from provider usage/Bifrost logs. |
| FR-59 | The agent MUST support multiple tool calls per model step and execute read-only calls in parallel. | MUST | One step reads three files in one request; results return as one batch; no ordering dependency. |
| FR-60 | The benchmark MUST report model requests per solved task, not only tokens. | SHOULD | Round-trip reduction is visible in the report. |
| FR-61 | Tool results MUST be capped to a stable size before they enter model history. | MUST | Cap is stable across turns; full output spilled to an artifact; errors preserved. |
| FR-62 | Compaction MUST NOT run by default; it runs only at high pressure or when measured to lower cost per solved task. | MUST | Below 90% pressure, no compaction; net cost recorded; can be disabled per session. |
| FR-63 | The CLI MUST provide `--help`, `--version`, `--json`, `--plain`, `--no-color`, non-interactive mode, SIGINT handling, and shell completions. | MUST | CLI contract tests pass; `--json` never prompts; piped output has no ANSI. |
| FR-64 | Bifrost MCP Gateway + Code Mode MAY be evaluated for read-only tools only. | SHOULD | Arm H runs; writes/shell/git remain native; approval gate unchanged. |
| FR-65 | The session log MUST be hash-chained and verifiable. | MUST | `gidorah audit verify` recomputes the chain; an edited/reordered event fails with the first bad link. |
| FR-66 | The agent MUST provide a red-team suite with a canary secret. | MUST | `gidorah redteam` runs the committed corpus; canary egress count is 0; report is redacted. |
| FR-67 | Edits MUST prefer minimal find/replace patches over full-file rewrites. | MUST | `edit` applies a patch; full-file write only with a reason; output tokens tracked. |
| FR-68 | The agent SHOULD build a repo map and read by symbol/range before full files. | SHOULD | `repo_map` returns file/symbol outlines; read can target a symbol; input tokens tracked. |
| FR-69 | The audit export MUST be redacted by default and include chain verification and anchor head. | MUST | Export contains no secrets/prompts; verification result and anchor included. |
| FR-70 | Patch-first and repo-map arms MUST be measured in the benchmark. | SHOULD | Arms I/J report cost, pass rate, and token delta. |

### 1.6 Tavily knowledge plane

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-33 | Tavily MUST be used only when local knowledge is insufficient. | MUST | Repo-local tasks make zero Tavily calls; trigger requires local miss or explicit research request. |
| FR-34 | Queries MUST be version-aware and scoped. | MUST | Query includes package name/version and error text; official docs domains preferred. |
| FR-35 | Results MUST be compressed into a cited evidence card. | MUST | Card ≤ configured token cap, includes answer, facts, sources, confidence. |
| FR-36 | Research MUST be capped per task. | MUST | Default max 2 calls per task; further calls require user action or a new task. |
| FR-37 | Research results MUST be cached with TTL. | MUST | Cache key includes normalized query, package/version, and prompt version; hits reported. |
| FR-38 | Tavily failure MUST degrade gracefully. | MUST | 429/5xx uses fresh cache or disables research with a notice; task continues. |
| FR-39 | Web content MUST be treated as untrusted. | MUST | No instruction in a source can change policy; content is data, never a command. |
| FR-40 | Sources MUST be cited in the final answer when research was used. | MUST | Citations map to card sources. |

### 1.7 Evidence and UX

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-41 | Every model and research call MUST appear in a flight recorder. | MUST | `gidorah trace` shows phase, requested/served model, fallback, cache, tokens, cost, budget. |
| FR-42 | The agent MUST produce a task receipt. | MUST | Receipt includes total tokens, LLM cost, research credits, fallback count, and budget remaining. |
| FR-43 | The CLI MUST support interactive and headless modes. | MUST | `gidorah` and `gidorah run --headless "task"`; headless emits JSON. |
| FR-44 | The TUI MUST show route, budget, mode, and research status. | MUST | Persistent status line; takeover banner; approval modal. |
| FR-45 | The agent MUST export a session and trace. | SHOULD | Markdown/JSON export without secrets. |

### 1.8 Meaningful dual-technology integration

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-46 | Bifrost MUST be the only model egress path. | MUST | No direct provider adapter or API key path exists; network test confirms. |
| FR-47 | Tavily MUST be a policy-gated, measured part of the agent. | MUST | Not a decorative search tool; appears in budget, cache, trace, and benchmark. |
| FR-48 | The project MUST demonstrate measured savings. | MUST | Benchmark report with raw artifacts and cost per solved task. |

### 1.9 Advanced depth (winning upgrades)

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| FR-49 | A Bifrost plugin MUST enforce confidential routing and scan requests for secrets before cloud egress. | MUST | Cloud attempt with `x-gidorah-confidential: true` is rejected; a fake AWS key/private key fixture is blocked or redacted; audit event written. |
| FR-50 | The agent MUST request model aliases, not hardcoded model ids. | SHOULD | `gidorah-fast`, `gidorah-strong`, `gidorah-local` resolve in Bifrost; changing a mapping requires no agent code change. |
| FR-51 | A task-level budget cap MUST be configurable. | SHOULD | At the cap, the agent stops or asks; receipt shows the cap and actual spend. |
| FR-52 | Tavily Docs Guard MUST verify changed external API usage before tests when the change touches a documented SDK. | SHOULD | A deprecated/unknown symbol triggers at most one targeted lookup and is flagged; no lookup for repo-local changes. |
| FR-53 | The demo MUST be replayable offline. | MUST | `gidorah demo --replay` runs from recorded traces with no network and produces the same visible scenes. |
| FR-54 | A chaos suite MUST kill Bifrost, Ollama, Tavily, and the network and verify guarantees. | MUST | Each kill produces the documented behavior; no cloud/Tavily call in confidential mode. |
| FR-55 | The Bifrost complexity router MUST be evaluated as an optional routing layer. | SHOULD | Benchmark arm B reports cost/pass rate; the result is documented even if it loses. |
| FR-56 | A `bifrost gidorah` launcher/profile SHOULD be documented and ideally upstreamed. | MAY | A user can launch Gidorah through Bifrost CLI or a documented equivalent. |
| FR-57 | Team/customer budget hierarchy SHOULD be demonstrated as a stretch. | MAY | A team budget plus per-user keys are shown in a config example; not required for v1. |

---

## 2. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-01 | First-token latency overhead added by the agent (excluding provider) | < 150 ms p50 |
| NFR-02 | TUI remains responsive during streaming | Input echo < 50 ms; no blocking render loop |
| NFR-03 | Session resume time for a 100-turn session | < 2 s |
| NFR-04 | Crash safety | No corrupted session log; append-only with recovery |
| NFR-05 | Policy evaluation overhead | < 10 ms per tool call |
| NFR-06 | Secret handling | No API keys in logs, transcripts, or session files |
| NFR-07 | Portability | macOS, Linux, Windows Terminal (best effort) |
| NFR-08 | Observability | Every request has a correlation/session id |
| NFR-09 | Dependency hygiene | Pinned versions; license check in CI |
| NFR-10 | Accessibility | Plain mode; no color-only status; screen-reader-friendly output where feasible |
| NFR-11 | Documentation | Every public command and policy field documented |
| NFR-12 | Test coverage | Core policy/approval/budget modules ≥ 80% line coverage |
| NFR-13 | Reproducibility | Benchmark runs from a clean clone with one command |
| NFR-14 | Data retention | Configurable; default 30 days for traces, 7 days for research cache |
| NFR-15 | Offline behavior | Confidential mode works with no internet; non-confidential degrades gracefully |
| NFR-16 | Gateway DLP overhead | < 20 ms p95 per request |
| NFR-17 | DLP false-positive rate | < 1% on the secret fixture corpus; a blocked request is auditable and explainable |
| NFR-18 | Replay determinism | Same visible scenes and receipt from recorded traces, no network |
| NFR-19 | Chaos recovery | Documented behavior within 5 s of a dependency kill; no silent cloud fallback |
| NFR-20 | CLI cold start | < 150 ms cold, < 50 ms warm on the demo machine |
| NFR-21 | CLI streams | Results/JSON on stdout; logs/progress on stderr; no ANSI when piped |
| NFR-22 | CLI completions | bash, zsh, fish generated and tested |
| NFR-23 | Context cap stability | Cap does not change the cached prefix hash |
| NFR-24 | Audit verify time | < 2 s for a 100-turn session |
| NFR-25 | Red-team runtime | < 60 s offline for the committed corpus |
| NFR-26 | Patch-first output | Output tokens per edit reported; no full-file rewrite unless justified |

---

## 3. Traceability to the hackathon

| Hackathon requirement | Requirements | Design | Conformance tests |
|---|---|---|---|
| Continue through outages/rate limits; announce takeover | FR-01..FR-05 | Bifrost fallbacks + response headers; session events | CT-01, CT-02, CT-03 |
| Per-user budget before requests; define limit behavior | FR-06..FR-12 | Bifrost virtual keys/402; agent policy | CT-04, CT-05, CT-06 |
| Confidential repos local-only; prompts cannot override | FR-13..FR-18 | Local-only VK; policy engine; egress guard | CT-07, CT-08, CT-09 |
| Approval for writes/shell/git; reads free | FR-19..FR-25 | Pre-tool classifier + approval UI | CT-10, CT-11, CT-12 |
| Minimal token usage; measured tasks | FR-26..FR-32, FR-48 | Routing, pruning, compaction, cache; benchmark | CT-13, benchmark |
| Meaningful Bifrost + Tavily use | FR-33..FR-40, FR-46, FR-47 | Dual-plane architecture | CT-14, benchmark arms |
| Gateway security depth | FR-49, FR-54 | DLP/policy plugin; chaos suite | CT-25..CT-28, CT-33 |
| Proactive research | FR-52 | Tavily Docs Guard | CT-29, Class B benchmark |
| Context economics | FR-61, FR-62 | Cap → clear → compact; cache-aware | CT-34, benchmark sub-arms |
| CLI quality | FR-63 | CLI contract | CLI tests |
| Deeper Bifrost tool plane | FR-64 | MCP/Code Mode read-only arm | Arm H |
| Audit integrity | FR-65, FR-69 | Hash chain, anchor, export | CT-35/36/39/40 |
| Adversarial proof | FR-66 | Red-team + canary | CT-37/38 |
| Patch-first / repo map | FR-67, FR-68, FR-70 | Minimal edits, symbol reads | Arms I/J |
| Demo reproducibility | FR-53 | Replay mode | Demo checklist |

---

## 4. Out of scope

- Multi-tenant authentication/SSO.
- Web or desktop UI.
- IDE extension.
- Plugin marketplace.
- Training or fine-tuning models.
- Sandboxing untrusted arbitrary code beyond the documented shell approval and local execution boundaries.
- Automatic PR creation against remote repositories in v1.

---

## 5. Definition of done (requirements)

A requirement is done only when:

1. The implementation is reviewed and merged.
2. An automated test covers the acceptance criteria (or a documented manual demo for UI-only criteria).
3. The user-facing behavior is documented.
4. The event/audit record exists.
5. The claim is reproducible in the demo or benchmark.
