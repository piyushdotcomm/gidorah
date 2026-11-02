# Glossary

**Status:** Draft · **Last updated:** 2026-11-03

| Term | Definition |
|---|---|
| **Agent loop** | The control flow that alternates model requests and tool executions until a turn completes. |
| **Approval gate** | The pre-tool check that allows reads and asks/denies writes, shell, and git operations. |
| **Bifrost** | The open-source LLM gateway by Maxim AI used as Gidorah's model plane. |
| **Budget** | A per-user spending limit; LLM spend is enforced by Bifrost virtual keys, research spend by a local credit ledger. |
| **Audit chain** | A hash-linked append-only log; edits/reordering are detectable. |
| **Anchor** | An external or separate record of the chain head that limits retroactive rewriting. |
| **Canary** | A fake secret planted to test whether any exfiltration path leaks it. |
| **Cache hit** | A response served from a cache instead of a provider; reported separately from fresh tokens. |
| **Cache-safe prefix** | A stable system/tool prefix that preserves provider prompt-cache hits; dynamic data stays outside it. |
| **Chaos suite** | Tests that kill Bifrost/Ollama/Tavily/network and verify the guaranteed behavior. |
| **Cloud mode** | A session allowed to use cloud models and (optionally) Tavily. |
| **Code Mode** | Bifrost's programmatic tool-calling surface that can keep large tool results out of the model context; evaluated read-only. |
| **Compaction** | Replacing older history with a summary; can invalidate prompt cache, so it is conditional. |
| **Confidential mode** | A session restricted to local models with zero external research/shell egress. |
| **Context cap** | A stable maximum size for each tool result before it enters model history. |
| **Control plane** | The policy, cost, routing, research, and audit layer around a coding agent; Gidorah's product category. |
| **Cost per solved task** | Total spend across attempts divided by the number of tasks that pass; the primary benchmark metric. |
| **Cost per successful task** | Total cost including retries and cache-write amortization divided by tasks delivered to spec. |
| **DLP** | Data-loss prevention: scanning outbound requests for secrets/API keys and blocking or redacting them. |
| **Docs Guard** | Proactive Tavily verification of external API symbols changed by an edit, before tests. |
| **DSH** | DeepSeek Harness, an open-source agent harness by DeepSeek. |
| **Evidence card** | A compact, cited Tavily research result injected into the model context. |
| **Fallback** | A secondary provider/model attempt after the primary fails. |
| **Flight recorder** | Gidorah's per-call trace of provider, model, tokens, cost, fallback, cache, and research. |
| **Local-first research** | The rule that Gidorah checks the repo and installed docs before calling Tavily. |
| **Patch-first edit** | A find/replace patch instead of a full-file rewrite; lower output tokens. |
| **Repo map** | A bounded outline of files and symbols used to read only relevant ranges. |
| **OWASP LLM Top 10** | The 2025 list of LLM application risks used as Gidorah's security checklist. |
| **Tool-result clearing** | Replacing an old tool result with a short placeholder while keeping the call record. |
| **Model alias** | A Bifrost name (`gidorah-fast`, `gidorah-strong`, `gidorah-local`) mapped to a concrete model. |
| **Model plane** | The layer that routes, budgets, and fails over model requests; owned by Bifrost. |
| **Knowledge plane** | The layer that resolves external uncertainty; owned by Tavily. |
| **Phase** | The agent's current intent: `explore`, `edit`, or `verify`; sent to Bifrost as `x-gidorah-phase`. |
| **Prompt injection** | Untrusted content that attempts to make the model ignore policy or execute unintended actions. |
| **Replay** | Re-running recorded traces offline to reproduce the demo deterministically. |
| **Research credit** | A unit of Tavily usage, budgeted per user/day. |
| **Route change** | A durable event when a different model serves a request. |
| **Scout** | Gidorah's Tavily research sub-agent/tool. |
| **Session** | An append-only event log plus metadata for one conversation. |
| **Step** | One model request plus the tool calls it requests. |
| **Takeover banner** | The user-visible notice that a different model took over after a failure. |
| **Task** | A user-requested coding outcome, possibly spanning many turns/steps. |
| **Tavily** | The AI search/extract API used as Gidorah's knowledge plane. |
| **Tool card** | The TUI rendering of a tool call and result, including diffs and terminal output. |
| **Turn** | A user input and the agent work it triggers. |
| **Virtual key** | A Bifrost credential with provider allowlists, budgets, and rate limits. |
| **Gidorah** | The project: a governed terminal coding agent with a Bifrost model plane and a Tavily knowledge plane. |
