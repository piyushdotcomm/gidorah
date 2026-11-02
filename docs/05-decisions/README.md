# Architecture Decision Records

**Status:** Draft · **Last updated:** 2026-11-03

An ADR records a significant decision, its context, and its consequences. Add a new ADR for any decision that changes architecture, a public contract, a security boundary, or a license.

---

## Index

| ADR | Decision | Status |
|---|---|---|
| [ADR-0001](#adr-0001--bifrost-is-the-model-plane) | Bifrost is the model plane | Accepted |
| [ADR-0002](#adr-0002--tavily-is-the-knowledge-plane) | Tavily is the knowledge plane | Accepted |
| [ADR-0003](#adr-0003--copy-the-dsh-tui-not-the-harness) | Copy the DSH TUI, not the harness | Accepted |
| [ADR-0004](#adr-0004--single-model-egress-path) | Single model egress path | Accepted |
| [ADR-0005](#adr-0005--typescriptnode-and-event-driven-ui) | TypeScript/Node + event-driven UI | Accepted |
| [ADR-0006](#adr-0006--policy-below-the-prompt) | Policy below the prompt | Accepted |
| [ADR-0007](#adr-0007--gateway-enforced-dlp) | Gateway-enforced DLP | Accepted |
| [ADR-0008](#adr-0008--tavily-docs-guard-as-proactive-verification) | Tavily Docs Guard as proactive verification | Accepted |
| [ADR-0009](#adr-0009--cap-tool-output-before-compacting) | Cap tool output before compacting | Accepted |
| [ADR-0010](#adr-0010--bifrost-code-mode-for-read-only-tools-only) | Bifrost Code Mode for read-only tools only | Proposed |
| [ADR-0011](#adr-0011--tamper-evident-audit-chain) | Tamper-evident audit chain | Accepted |
| [ADR-0012](#adr-0012--patch-first-edits-and-symbol-indexed-reads) | Patch-first edits and symbol-indexed reads | Accepted |

---

## Template

```markdown
# ADR-XXXX — Title

- **Status:** Proposed | Accepted | Superseded
- **Date:** YYYY-MM-DD
- **Deciders:** ...
- **Supersedes:** ...

## Context
What problem are we solving? What constraints apply?

## Decision
What are we doing?

## Consequences
What becomes easier, harder, or impossible? What risks do we accept?

## Alternatives considered
What else did we evaluate, and why not?

## References
Links to docs, issues, or prior art.
```

---

<a id="adr-0001--bifrost-is-the-model-plane"></a>
## ADR-0001 — Bifrost is the model plane

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Architecture, Engineering
- **Supersedes:** None

### Context
The hackathon requires per-user budgets, provider failover, routing, and measured token/cost data. Building these ourselves duplicates a mature gateway and increases the audit surface. The hackathon also requires meaningful Bifrost use.

### Decision
All model traffic goes through Bifrost. Bifrost owns provider connections, virtual keys, budgets, rate limits, routing rules, fallbacks, cache, and request logs. Gidorah owns repo classification, key selection, routing-phase headers, takeover notices, and the agent loop.

### Consequences
**Positive:** One enforcement point; fewer secrets in the agent; auditable spend; proven fallbacks; sponsor alignment.
**Negative:** Bifrost is a dependency and a potential outage; preview API drift; local gateway operations.
**Mitigation:** Pin a version; run locally; health check in `gidorah doctor`; no direct-provider fallback.

### Alternatives considered
- **Direct provider SDKs:** rejected — duplicates budgets/fallbacks and creates bypass paths.
- **LiteLLM/other gateway:** rejected — Bifrost is the track sponsor and has the required governance features.
- **Custom gateway:** rejected — out of scope and unauditable.

### References
[bifrost-model-plane.md](../01-architecture/bifrost-model-plane.md)

---

<a id="adr-0002--tavily-is-the-knowledge-plane"></a>
## ADR-0002 — Tavily is the knowledge plane

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Architecture, Product
- **Supersedes:** None

### Context
Coding agents waste tokens guessing at current APIs and error fixes. A generic search tool adds noise and can leak repository context. The hackathon requires meaningful Tavily use, not a token integration.

### Decision
Tavily is the only external knowledge path. It is invoked on demand after a local-knowledge miss, with version-aware queries, compact cited evidence cards, a per-user research-credit budget, and a hard disable in confidential mode. It is measured in the benchmark on docs-dependent tasks.

### Consequences
**Positive:** Fewer hallucinated APIs; fewer failed iterations; citations; a real second budget; sponsor alignment.
**Negative:** Tavily latency/credits; untrusted web content; cache staleness; another external dependency.
**Mitigation:** Local-first rule; max 2 calls/task; 700-token cards; TTL cache; treat content as data; disable in confidential mode.

### Alternatives considered
- **No web research:** rejected — costs more tokens on docs-dependent tasks.
- **Generic search scraping:** rejected — token-heavy, unsafe, uncited.
- **Tavily MCP only:** rejected — less control over result size and caching than the SDK.

### References
[tavily-knowledge-plane.md](../01-architecture/tavily-knowledge-plane.md)

---

<a id="adr-0003--copy-the-dsh-tui-not-the-harness"></a>
## ADR-0003 — Copy the DSH TUI, not the harness

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Frontend, Engineering
- **Supersedes:** None

### Context
Building a polished terminal UI is slow. The community DSH CLI has a mature TUI with transcript, markdown, diffs, approvals, status, and resume. The full DSH harness is large and would dilute the Bifrost/Tavily story.

### Decision
Vendor and adapt `packages/ui/tui` from `peiyuwang54/deepseek-harness-cli` (package `@deepseek-ai/dsh-tui`). Keep the visual shell and components; replace its DSH service/data layer with Gidorah's event bus. Do not copy the rest of DSH. Preserve the package's `MIT AND BSD-3-Clause` license and notices.

### Consequences
**Positive:** Faster time to a polished demo; proven terminal behavior; diff/approval components.
**Negative:** Coupling to DSH services; pi-tui version risk; license obligations; unused code.
**Mitigation:** Timebox adaptation; stub layer; trim unused commands; `--plain` fallback; license review.

### Alternatives considered
- **Build a TUI from scratch:** rejected — time sink, lower polish.
- **Use Ink/OpenTUI:** viable fallback, but more work for diffs/approvals.
- **Plain REPL only:** viable fallback; lower demo impact.

### References
[tui-adaptation.md](../01-architecture/tui-adaptation.md), [licensing](../06-legal/licensing-and-attribution.md)

---

<a id="adr-0004--single-model-egress-path"></a>
## ADR-0004 — Single model egress path

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Security, Architecture
- **Supersedes:** None

### Context
Budget and confidentiality guarantees are only credible if no code path can bypass Bifrost. SDKs, plugins, or copied DSH adapters could create hidden egress.

### Decision
Gidorah contains no direct provider adapter and no provider API keys. The only model client is the Bifrost OpenAI-compatible client. Dependency and network tests enforce this. Confidential mode uses a local-only key and no cloud fallback.

### Consequences
**Positive:** Auditable budget and confidentiality; one place to rotate credentials; simpler threat model.
**Negative:** Bifrost is a single point of failure; no emergency direct-provider escape hatch.
**Mitigation:** Local fallback (Ollama) for availability; `gidorah doctor` health check; clear error when Bifrost is down.

### Alternatives considered
- **Direct provider fallback:** rejected — breaks the guarantee.
- **Per-tool provider clients:** rejected — bypass risk.

### References
[policy-and-security.md](../01-architecture/policy-and-security.md), CT-12

---

<a id="adr-0005--typescriptnode-and-event-driven-ui"></a>
## ADR-0005 — TypeScript/Node and event-driven UI

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Engineering
- **Supersedes:** None

### Context
The TUI, Tavily SDK, and Bifrost OpenAI-compatible client are TypeScript-first. The agent must support streaming, cancellation, and multiple renderers (TUI, headless, benchmark).

### Decision
Use TypeScript on Node.js 22/24 LTS with pnpm workspaces. The agent core emits a typed event stream; the TUI, headless renderer, flight recorder, and benchmark are subscribers. The UI never calls providers directly.

### Consequences
**Positive:** One language; strong typing for events/policy; replaceable renderer; easy headless mode.
**Negative:** Native SQLite builds; Node version constraints; TypeScript build complexity.
**Mitigation:** Pin Node LTS; use prebuilt `better-sqlite3`; CI on Windows/Linux; `--plain` mode.

### Alternatives considered
- **Python:** viable for the agent, but weaker fit for the DSH TUI and JS SDKs.
- **Go/Rust:** rejected — TUI/agent integration cost, slower iteration.

### References
[tech-stack-and-repo.md](../02-engineering/tech-stack-and-repo.md), [data-and-events.md](../01-architecture/data-and-events.md)

---

<a id="adr-0006--policy-below-the-prompt"></a>
## ADR-0006 — Policy below the prompt

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Security, Architecture
- **Supersedes:** None

### Context
System-prompt instructions are not a security boundary. A prompt injection, a malicious repo, or a model mistake can ignore them. Confidentiality and budget guarantees must hold regardless of model behavior.

### Decision
Provider selection, budget enforcement, confidentiality, and research access are decided by code and Bifrost configuration before the request. The model has no tool to change them. The system prompt describes policy for UX but is not the enforcement mechanism.

### Consequences
**Positive:** Injection-resistant guarantees; auditable decisions; testable behavior.
**Negative:** Less flexible; policy changes require code/config; some edge cases need explicit rules.
**Mitigation:** Clear policy file, versioned decisions, conformance tests, user-visible mode/status.

### Alternatives considered
- **Prompt-only policy:** rejected — not a security boundary.
- **Model-based classifier:** rejected — probabilistic and bypassable for critical decisions.

### References
[policy-and-security.md](../01-architecture/policy-and-security.md), CT-07/08/10/18

---

<a id="adr-0007--gateway-enforced-dlp"></a>
## ADR-0007 — Gateway-enforced DLP

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Security, Architecture
- **Supersedes:** None

### Context
Confidential mode prevents cloud model calls, but cloud sessions can still accidentally include secrets in prompts (env values, keys, private keys). Agent-side redaction is useful but can be bypassed by a bug or a new tool. The gateway is the last point before egress.

### Decision
Add a Bifrost plugin that scans serialized requests for secret patterns and blocks (default) or redacts before forwarding to a cloud provider. It also enforces the confidential header by rejecting non-local providers. The plugin emits policy/audit headers and never logs the secret.

### Consequences
**Positive:** Defense-in-depth; protects cloud sessions; a real upstream contribution; strong demo.
**Negative:** False positives; request-body buffering/streaming complexity; pattern maintenance.
**Mitigation:** High-confidence patterns, allowlist, clear block reason, false-positive corpus, fail closed on scanner error.

### Alternatives considered
- **Agent-only redaction:** rejected — single layer, bypassable by a bug.
- **No DLP:** rejected — unacceptable for enterprise code.
- **External DLP proxy:** rejected — another hop; Bifrost is already the egress.

### References
[bifrost-model-plane.md](../01-architecture/bifrost-model-plane.md#9-bifrost-plugin-open-source-contribution), [policy-and-security.md](../01-architecture/policy-and-security.md)

---

<a id="adr-0008--tavily-docs-guard-as-proactive-verification"></a>
## ADR-0008 — Tavily Docs Guard as proactive verification

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Product, Engineering
- **Supersedes:** None

### Context
Research-on-error is reactive: the agent writes code against a stale API, runs tests, fails, and burns tokens. A proactive check of changed external symbols against current docs can prevent the failure.

### Decision
Add Docs Guard as a SHOULD/stretch feature: after an edit touching external APIs, extract changed symbols, check a cached API fact sheet, and perform at most one targeted Tavily lookup if needed. It is advisory, not a test blocker, and is disabled in confidential mode.

### Consequences
**Positive:** Proactive correctness; fewer failed iterations; a stronger, more novel Tavily use.
**Negative:** Parsing complexity; false positives; extra research credits.
**Mitigation:** Start with imports/member calls; cap one lookup per edit; cache fact sheets by package/version; ship as stretch if time is short.

### Alternatives considered
- **Research only on failure:** current baseline; kept as fallback.
- **No proactive check:** cheaper but more failed iterations.
- **Full static analysis:** too heavy for v1.

### References
[tavily-knowledge-plane.md](../01-architecture/tavily-knowledge-plane.md#7-docs-guard-and-dependency-docs-index), benchmark arm G

---

<a id="adr-0009--cap-tool-output-before-compacting"></a>
## ADR-0009 — Cap tool output before compacting

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Engineering, Evaluation
- **Supersedes:** None

### Context
Context-engineering research in 2026 found that compaction can increase cost: summarizing rewrites the cached prefix, so the provider cache misses, and the saved tokens can cost more than they save. A stable tool-output cap cut cost per turn substantially in a controlled study while memory accuracy stayed flat.

### Decision
Order the context controls: **cap → clear → compact.**
- Apply a stable per-tool cap before results enter history.
- Clear old, re-fetchable tool results while keeping the call record.
- Compact only at true pressure (default 90%) or when the benchmark shows a lower cost per solved task.
- Record summary cost, cache-loss cost, and net token reduction; disable compaction if net cost is positive.

### Consequences
**Positive:** Cheaper context control; cache stays warm; fewer lossy rewrites; measurable.
**Negative:** Large outputs need artifacts; clearing may require re-fetch; compaction still needed at overflow.
**Mitigation:** Artifact pointers, cap stability tests, cache hit metrics, pressure-only compaction.

### Alternatives considered
- **Compaction by default:** rejected; can increase cost and lose details.
- **No context control:** rejected; context grows without bound.
- **Sliding window only:** viable, but loses task state; cap+clear preserves more.

### References
[agent-runtime.md](../01-architecture/agent-runtime.md#4-context-manager), benchmark context sub-arms

---

<a id="adr-0010--bifrost-code-mode-for-read-only-tools-only"></a>
## ADR-0010 — Bifrost Code Mode for read-only tools only

- **Status:** Proposed
- **Date:** 2026-11-03
- **Deciders:** Engineering, Security
- **Supersedes:** None

### Context
Bifrost's MCP Gateway and Code Mode can keep large tool results out of the model context and have been reported to cut token usage substantially. The approval requirement means writes/shell/git must remain under Gidorah's gate; a gateway-executed mutation could bypass it.

### Decision
Evaluate Bifrost MCP Gateway + Code Mode for **read-only** tools only, as benchmark arm H. Keep writes, shell, and git native. Do not enable MCP auto-execute for mutating tools. Adopt only if cost per solved task improves and the approval boundary is unchanged.

### Consequences
**Positive:** Potential large token savings; deeper Bifrost use; strong sponsor story.
**Negative:** MCP setup complexity; tool duplication; possible latency; approval boundary risk.
**Mitigation:** Read-only allowlist; no mutations; benchmark arm; cut if it does not win; keep native loop as default.

### Alternatives considered
- **All tools through MCP/Code Mode:** rejected; bypasses approvals and audit.
- **No Code Mode:** safe, but leaves a potential token lever untested.
- **Custom code-mode runtime:** rejected; Bifrost already provides one.

### References
[bifrost-model-plane.md](../01-architecture/bifrost-model-plane.md#91-advanced-bifrost-surfaces-stretch), benchmark arm H

---

<a id="adr-0011--tamper-evident-audit-chain"></a>
## ADR-0011 — Tamper-evident audit chain

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Security, Engineering
- **Supersedes:** None

### Context
Security claims need evidence. A plain log can be edited; a hash chain makes edits detectable but is not proof on its own. Regulated buyers need an exportable, redacted trace of model routes, policy decisions, costs, and approvals.

### Decision
Hash-chain every session event (`prevHash` + canonical body). Add `gidorah audit verify` and a redacted `audit export`. Anchor the chain head at turn boundaries to a separate append-only file; optionally sign/anchor externally. State the limitation: tamper-evident, not tamper-proof.

### Consequences
**Positive:** Inspectable evidence; strong demo; compliance-friendly export.
**Negative:** Hashing/verification cost; key/anchor management; overclaim risk.
**Mitigation:** Canonical JSON, fast SHA-256, anchor file, tamper tests, explicit limitation.

### Alternatives considered
- **Plain JSONL:** no integrity evidence.
- **Database audit table:** mutable by operator; not portable.
- **Full ledger/blockchain:** overkill for v1.

### References
[audit-and-redteam.md](../01-architecture/audit-and-redteam.md), CT-35/36/39/40

---

<a id="adr-0012--patch-first-edits-and-symbol-indexed-reads"></a>
## ADR-0012 — Patch-first edits and symbol-indexed reads

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Engineering, Evaluation
- **Supersedes:** None

### Context
Full-file rewrites and full-file reads are the largest avoidable token costs in coding agents. SWE-Edit reports a 17.9% inference-cost reduction and a 2.1% resolved-rate improvement from find/replace edits; repository-graph tools report large context reductions from symbol-level retrieval.

### Decision
- `edit` emits a unique find/replace patch; ambiguous matches fail.
- `write` requires a reason; full-file rewrites are flagged.
- `repo_map` returns a bounded file/symbol outline; `read` accepts a symbol or range.
- Benchmark arms I and J measure both.

### Consequences
**Positive:** Lower output/input tokens; more precise edits; measurable.
**Negative:** Patch ambiguity; symbol extractor limitations; new tooling.
**Mitigation:** Unique-match validation, fallback to range read, simple TS extractor first.

### Alternatives considered
- **Full-file edits only:** simple but token-heavy.
- **Tree-sitter from day one:** more capable but heavier; add only if needed.
- **No repo map:** cheaper to build but reads whole files.

### References
[agent-runtime.md](../01-architecture/agent-runtime.md#2-tools), benchmark arms I/J

---

<a id="adr-0013--dependency-free-offline-runtime"></a>
## ADR-0013 � Dependency-free offline runtime

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Engineering

### Context
The build machine had no registry access at the start and no TypeScript compiler. The docs prescribe pnpm, Vitest, Zod, Commander, better-sqlite3, and a bundler. None could be installed until a later npm probe succeeded through Node's fetch with a local cache.

### Decision
Run TypeScript directly on Node 26 type stripping, use `node:test` with `--test-isolation=none`, use `node:sqlite` instead of better-sqlite3, and keep the runtime dependency-free. Custom `scripts/lint.ts`, `scripts/typecheck.ts`, and `scripts/build.ts` stand in for Biome/tsdown; the typecheck script runs the real `tsc` when the toolchain is present (it now is, installed from a local npm cache). Subprocess output is captured through temp files because the sandbox denies piped child stdio.

### Consequences
The repository runs with zero runtime dependencies and still passes a strict `tsc --noEmit`. Vitest, Zod, Commander, pino, and canonicalize are substituted with small in-repo equivalents (node:test, hand-rolled validators, argv parser, redacted JSONL logging, canonical JSON).

### References
[scripts/typecheck.ts](../../scripts/typecheck.ts), [scripts/run-tests.ts](../../scripts/run-tests.ts), BUILD_STATUS.md

---

<a id="adr-0014--plain-tui-adapter-before-dsh-vendoring"></a>
## ADR-0014 � Plain TUI adapter before DSH vendoring

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Frontend, Delivery

### Context
ADR-0003 plans to vendor `@deepseek-ai/dsh-tui`. The package could not be fetched in this build, and the docs already require a `--plain` renderer and allow a line-based CLI fallback.

### Decision
Ship a line-based renderer behind the full `TuiEvent` contract (status line, transcript, approval, takeover, research card, DLP notice, Docs Guard badge, receipt) and keep the vendoring step PENDING in MORNING_RUNBOOK.md. Untrusted text is stripped of ANSI/control characters before rendering.

### References
[apps/tui/src/index.ts](../../apps/tui/src/index.ts), docs/01-architecture/tui-adaptation.md

---

<a id="adr-0015--mock-first-evidence-and-honest-pending"></a>
## ADR-0015 � Mock-first evidence and honest PENDING labels

- **Status:** Accepted
- **Date:** 2026-11-03
- **Deciders:** Lead, Security

### Context
No real provider keys, Bifrost gateway, Ollama, or Go toolchain existed. The overnight policy requires building, testing, and reporting without fabricating results.

### Decision
Implement a mock Bifrost gateway (auth, provider allowlists, budgets with 402, phase routing, fallbacks with headers, DLP, logs) and mock DeepSeek/Ollama/Tavily upstreams, and run every automated gate against them. Label every affected result PENDING with the exact unblocking step. The benchmark runner executes the real loop, tools, context, and audit with a scripted mock model and says so in its report. Runtime data defaults to a repo-local `.gidorah` directory when `GIDORAH_HOME` is unset because the sandbox cannot write the user home.

### Consequences
Every automated guarantee is testable now; no claim about real providers, real model quality, real invoices, or the Go plugin is made until MORNING_RUNBOOK.md is executed.

### References
BUILD_STATUS.md, MORNING_RUNBOOK.md, BUILD_REPORT.md
