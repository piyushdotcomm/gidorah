# Research Findings

**Status:** Draft · **Owner:** Product / Engineering · **Last updated:** 2026-11-03

This document records the external research used to revise the plan. Claims are linked to their sources; numbers are not invented. Verify any source before quoting it in a submission.

---

## 1. Context economics

**Finding:** Stable tool-output caps are cheaper than default compaction. Compaction rewrites the prompt prefix, which can invalidate provider cache; a smaller context can cost more.

Evidence:

- Anthropic's context-engineering cookbook distinguishes compaction, tool-result clearing, and memory. Clearing old tool results is the lightest-touch way to recover space; compaction costs inference and loses verbatim detail.
- A 2026 context-engineering study reports capping each tool output cut cost per turn by 38% in a paired comparison, won 14 of 15 trajectories, and left memory-probe accuracy unchanged. Compaction presets sent fewer tokens but cost roughly twice as much because they rewrote the cached prefix.
- The same study warns that a blind judge rated answers “good” even when planted facts were lost; overall quality scores can hide memory failures.

Plan changes:

- ADR-0009: cap → clear → compact.
- Compaction only at 90% pressure or when measured net cost is negative.
- Report cache hit rate, prefix-hash changes, and compaction net cost.
- Benchmark context sub-arms: full, cap-only, cap+clear, cap+compaction.

Sources:
- https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools
- https://www.louisbouchard.ai/context-engineering-2026/
- https://newsletter.victordibia.com/p/context-engineering-101-how-agents

---

## 2. Evaluation methodology

**Finding:** The market is moving from price-per-token to **cost per successful task**, with pass@1 across multiple runs and price-per-task variance.

Evidence:

- Artificial Analysis' Coding Agent Index reports cost to run per task based on provider pricing and model/harness stacks, not just token prices.
- Databricks found a cheaper-per-token model can cost more per task while scoring lower; task completion and cost must be read together.
- Digital Applied defines cost-per-successful-task as total cost (input, output, tool, retry, cache write) divided by tasks delivered to spec.
- The 2026 Coding Agent Index uses pass@1 as the headline and recommends decomposing cost.

Plan changes:

- Headline metrics: cost per solved task, cost per successful task, pass@1.
- Report price-per-task variance (p50/p95), retries, cache-write amortization, and Tavily credits.
- Pilot 3 tasks; report missing/errored rows separately; state small-sample limits.
- No LLM judge for security gates; deterministic tests only.

Sources:
- https://artificialanalysis.ai/methodology/coding-agents-benchmarking
- https://www.databricks.com/blog/benchmarking-coding-agents-databricks-multi-million-line-codebase
- https://www.digitalapplied.com/blog/cost-per-successful-task-new-ai-evaluation-metric
- https://medium.com/@wasowski.jarek/coding-agent-index-2026-benchmarking-full-agent-stacks-model-harness-4183305e4b90

---

## 3. Bifrost capabilities

**Finding:** Bifrost is more than an LLM router: it has a native MCP gateway and Code Mode, plus enterprise guardrails. Code Mode is reported to cut token usage substantially by keeping tool results out of the model context.

Evidence:

- Bifrost's repository describes LLM gateway, MCP gateway, and agent gateway in one Go binary, with plugins for governance, logging, semantic cache, and telemetry.
- Maxim's MCP gateway article describes Code Mode as a token-reduction surface and reports up to 50% token reduction; treat the number as a vendor claim to measure.
- Bifrost enterprise guardrails include Presidio-based PII redaction, prompt-injection detection, and external guardrail integrations. These are paid-tier features; do not claim them for the OSS build.
- A comparison notes virtual-key governance and MCP tool allowlists are open source; SSO/RBAC/signed audit are enterprise.

Plan changes:

- ADR-0010: evaluate Bifrost MCP Gateway + Code Mode for read-only tools only.
- Writes/shell/git stay native for approval integrity.
- Keep the OSS DLP/policy plugin; mention enterprise guardrails only as a future/complement.
- Add Arm H (read-only Code Mode) and mark it stretch.

Sources:
- https://github.com/maximhq/bifrost
- https://www.getmaxim.ai/articles/best-mcp-gateway-in-2026-how-bifrost-cuts-token-usage-by-50/
- https://www.speakeasy.com/blog/bifrost-alternatives
- https://innfactory.ai/en/services/ai-gateway/vs/bifrost/

---

## 4. Tavily capabilities

**Finding:** Tavily offers a search-depth ladder, query-focused extraction, a Research API with significant credit cost, and PII/prompt-injection screening. Use the cheap depths first and cap deep research.

Evidence:

- Tavily search depths: `ultra-fast` (0.5 credit), `fast`/`basic` (1), `advanced` (2). `chunks_per_source` controls returned content; `include_raw_content` is off by default.
- Extract with `query` and `chunks_per_source` reranks chunks, which is the token-efficient way to read docs.
- Research API supports streaming/async and can consume up to ~250 credits for a pro call; it is not a hot-loop tool.
- Independent comparisons note Tavily's built-in PII/prompt-injection screening; still treat web content as untrusted.
- Tavily's own research describes context engineering on the tool side to return only relevant data, reducing tokens substantially.

Plan changes:

- Search-depth ladder: ultra-fast → basic → advanced; log depth and credits.
- Extract only top 1–2 URLs with query reranking.
- Research API only for explicit deep investigations with a separate budget.
- Treat screening as defense-in-depth; keep the injection corpus and output escaping.

Sources:
- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://docs.tavily.com/documentation/api-reference/endpoint/extract
- https://www.tavily.com/blog/research-en
- https://www.firecrawl.dev/blog/best-search-tools-for-agents
- https://www.scalekit.com/blog/tavily-mcp-vs-api

---

## 5. Security

**Finding:** OWASP LLM Top 10 (2025) is the right checklist for a tool-using coding agent. The highest-priority categories are prompt injection, sensitive disclosure, excessive agency, and unbounded consumption.

Plan changes:

- Add the OWASP mapping table to `policy-and-security.md`.
- Keep structural controls: local-only key, DLP, approvals, budgets, output escaping.
- No secrets in prompts; no model control over provider/key.
- Report security gates as deterministic tests, not LLM judgments.

Sources:
- OWASP Top 10 for LLM Applications 2025: https://genai.owasp.org/llm-top-10/
- MITRE ATLAS: https://atlas.mitre.org/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework

---

## 6. CLI and documentation

**Finding:** CLI quality is a product requirement, and documentation must be conclusion-first and traceable.

Plan changes:

- `--help`, `--version`, `--json`, `--plain`, `--no-color`, SIGINT, non-interactive mode, shell completions, stdout/stderr separation, cold/warm startup measurement.
- Documentation: claims traceable to code/tests/sources; assumptions labeled; limitations stated; no invented numbers.

Sources:
- `cli-developer` skill (Jeffallan)
- `technical-writing` skill (Riekelt)
- `writing-plans` skill (Obra Superpowers)
- `mlflow-evaluation` skill (MLflow)

---

## 7. Audit integrity

**Finding:** A hash chain makes edits detectable, but it is not proof by itself. The recorder must sit outside the actor's control path, and the chain head must be anchored externally.

Plan changes:

- Hash-chain every event (`prevHash` + canonical body).
- `gidorah audit verify` recomputes the chain; tampered/reordered events fail.
- Anchor the chain head at turn boundaries and optionally in CI artifacts.
- Export a redacted bundle with verification result and anchor head.
- Say “tamper-evident,” not “tamper-proof.”

Sources:
- https://nhimg.org/articles/tamper-evident-audit-logs-for-ai-agents-still-need-trust-boundaries/
- https://www.digitalapplied.com/blog/agent-audit-trail-design-7-best-practices-2026
- https://datatracker.ietf.org/doc/draft-sharif-agent-audit-trail/
- https://www.armosec.io/blog/minimum-viable-audit-trail/

---

## 8. Red teaming and canary exfiltration

**Finding:** Agent red teaming must include indirect injection through files, tools, and web content, plus an exfiltration canary. A passing happy-path test proves nothing.

Plan changes:

- `gidorah redteam` corpus: direct, file, tool output, web result, budget/approval bypass, path escape, provider override.
- Plant a fake canary secret; scan every outbound model/Tavily request; must be 0.
- Report PASS/FAIL and canary egress; add bypasses to the corpus.
- Do not claim “unhackable.”

Sources:
- https://www.nist.gov/blogs/caissi-research-blog/insights-ai-agent-security-large-scale-red-teaming-competition
- https://galileo.ai/blog/llm-red-teaming-strategies
- https://github.com/LLMSecurity/awesome-agent-skills-security

---

## 9. Patch-first editing

**Finding:** Editing by find/replace reduces output tokens and can improve resolve rate versus full-file rewrites. SWE-Edit reports 17.9% lower inference cost and 2.1% higher resolved rate.

Plan changes:

- `edit` emits a unique find/replace patch; ambiguity fails.
- `write` requires a reason; full-file rewrites are flagged.
- Benchmark arm I measures output tokens per edit and patch size.

Source:
- https://arxiv.org/html/2604.26102v1

---

## 10. Repo map and symbol reads

**Finding:** Reading whole files wastes input tokens. A repository graph or symbol index lets the agent read only the relevant ranges; RepoGraph reports a 32.8% relative improvement on SWE-bench.

Plan changes:

- `repo_map` returns a bounded file/symbol outline.
- `read` accepts a symbol or line range; full-file reads are measured.
- Benchmark arm J compares repo-map reads vs full-file reads.

Sources:
- https://arxiv.org/html/2603.27277v1
- https://dev.to/deusdata/how-i-cut-my-ai-coding-agents-token-usage-by-120x-with-a-code-knowledge-graph-4a3d
- https://virtuslab.com/blog/ai/code-munch-mcp-your-agent-starts-navigating

---

## 11. What we deliberately did not adopt

- **Compaction by default:** contradicted by cost evidence; kept conditional.
- **Code Mode for all tools:** bypasses approvals; read-only arm only.
- **Enterprise guardrails as a claim:** paid tier; our OSS plugin is the implemented layer.
- **Tavily Research API in the hot loop:** credit cost too high; deep mode only.
- **LLM-as-judge for pass/fail:** too noisy and gameable; deterministic tests for gates.
- **A web UI or IDE extension:** no score impact; CLI is the proof vehicle.

---

## 12. Open verification items

- [ ] Re-run the context-economics numbers on our models and tasks; do not quote the 38% as ours.
- [ ] Verify Bifrost Code Mode's actual token reduction and approval boundary.
- [ ] Verify Tavily screening coverage and credit costs on the pinned API version.
- [ ] Verify the Coding Agent Index methodology details before citing it.
- [ ] Check every source date; the field moves quickly.
