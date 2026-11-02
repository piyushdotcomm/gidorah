# Gidorah MVP Implementation Plan

**Status:** Draft · **Owner:** Engineering · **Last updated:** 2026-11-03

> **For agentic workers:** Read `docs/00-product/requirements.md`, `docs/01-architecture/system-overview.md`, and `docs/01-architecture/policy-and-security.md` before starting. Execute tasks in order; each ends with a testable deliverable and a commit.

**Goal:** Ship a terminal coding agent that completes real tasks while enforcing Bifrost budgets, confidentiality, failover, approvals, and measured token savings with Tavily.

**Architecture:** TypeScript/Node monorepo. The agent core emits typed events. Bifrost is the only model egress. Tavily Scout is a budgeted, cached, policy-gated research tool. The TUI, flight recorder, and benchmark are event subscribers.

**Tech stack:** Node 22/24 LTS, pnpm, TypeScript strict, Vitest, better-sqlite3, OpenAI-compatible client to Bifrost, `@tavily/core`, adapted `@deepseek-ai/dsh-tui`, Go for the Bifrost plugin.

**Spec:** `docs/00-product/product-brief.md`, `docs/00-product/requirements.md`, `docs/01-architecture/*.md`.

## Global constraints

- One model egress path: Bifrost only. No direct provider SDK or provider key.
- Cloud is DeepSeek Flash/Pro via Bifrost; local is Ollama via a local-only virtual key.
- Confidential mode: zero cloud calls, zero Tavily calls, network shell denied.
- Reads free; writes/shell/git ask; denials honored.
- Budget: Bifrost pre-request authority; 402 never retried; task cap never authorizes overspend.
- Context: cap tool output before compaction; preserve cache-safe prefix; compaction only at pressure or measured benefit.
- All reported tokens/cost come from Bifrost/Tavily usage.
- Every task: failing test first, minimal implementation, verification, commit.
- No secrets in code, tests, logs, or fixtures.

## Review focus

The tests must pin these conditions, not just the happy path:

1. A prompt injection in a repo file cannot change the virtual key or provider.
2. A confidential session makes zero cloud and zero Tavily calls even when the model asks.
3. A 402 budget response does not retry and does not silently fall back to cloud.
4. A 429/503 creates a visible, durable takeover without replaying an executed tool.
5. A denied write/shell/git command never executes.
6. A stable tool-output cap preserves cache hits; compaction does not run by default.
7. A repo-local task makes zero Tavily calls.
8. A Tavily 429/5xx does not block the coding task.
9. `--json`/`--plain` never prompts and writes machine output to stdout only.
10. The demo replays offline with the same visible scenes.

---

## Task 0: Workspace and quality gates

**Files**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `.nvmrc`, `.gitignore`, `.env.example`
- Create: `apps/cli/src/main.ts`, `packages/shared/src/index.ts`
- Test: `apps/cli/test/version.test.ts`

**Interfaces**
- Produces: `GidorahConfig`, `Policy`, `SessionEvent` type roots in `packages/shared`.

- [ ] Step 1: Write a failing test that runs `gidorah --version` and expects the package version on stdout, exit 0.
- [ ] Step 2: Run `pnpm test apps/cli/test/version.test.ts`; expect failure.
- [ ] Step 3: Implement the CLI entrypoint with `commander`, `--version`, `--help`, `--json`, `--plain`, `--no-color`.
- [ ] Step 4: Run the test; expect pass. Run `pnpm build && pnpm lint && pnpm typecheck`.
- [ ] Step 5: Commit `chore: scaffold gidorah workspace`.

**Verification:** `node apps/cli/dist/main.js --version` prints the version; non-TTY output has no ANSI.

---

## Task 1: Bifrost client and mock provider

**Files**
- Create: `packages/bifrost/src/client.ts`, `types.ts`, `headers.ts`, `errors.ts`
- Create: `tests/mock-provider/server.ts`
- Test: `packages/bifrost/test/client.test.ts`

**Interfaces**
- Produces:
  - `createBifrostClient(config): ModelClient`
  - `ModelClient.stream(req: ModelRequest, signal: AbortSignal): AsyncIterable<StreamChunk>`
  - `RoutingInfo { requested, served, fallback, fallbackIndex?, primary? }`
- Consumes: `GidorahConfig`.

- [ ] Step 1: Write failing tests for: parses `x-bifrost-routing-info-*`; returns `RoutingInfo`; maps 402 to `BudgetExceededError`; maps 429/503 to `ProviderError`; streams deltas.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement the client with `openai` SDK plus raw `fetch` for headers/streaming. Add mock provider with modes: ok, 429, 503, 402, timeout.
- [ ] Step 4: Run tests; expect pass. Add a test that a fallback header yields `fallback: true`.
- [ ] Step 5: Commit `feat: add bifrost client and mock provider`.

**Verification:** Mock 429 produces a structured `ProviderError`; no retry inside the client.

---

## Task 2: Session store and resume

**Files**
- Create: `packages/core/src/session/events.ts`, `store.ts`, `resume.ts`
- Test: `packages/core/test/session.test.ts`

**Interfaces**
- Produces:
  - `SessionStore.create(header): Session`
  - `Session.append(type, data): SessionEvent`
  - `Session.load(id): Promise<Session>`
  - `Session.deriveMessages(): Message[]`
  - `Session.closeOpenBoundaries(): void`
- Event types: `session/start`, `turn/start`, `step/start`, `user/message`, `assistant/message`, `tool/call`, `tool/result`, `approval/request`, `approval/decision`, `route/changed`, `budget/updated`, `research/request`, `research/result`, `docs/check`, `dlp/blocked`, `compaction/summary`, `session/error`, `turn/end`, `session/end`.

- [ ] Step 1: Write failing tests for append-only seq, JSON round-trip, resume after a simulated crash, and open turn closure.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement JSONL append/read with Zod validation. Write a temp-dir fixture.
- [ ] Step 4: Run tests; expect pass. Verify a 100-turn session loads under 2 s.
- [ ] Step 5: Commit `feat: add append-only session store`.

**Verification:** Corrupt line fails loudly; resume closes an open turn with `interrupted`.

---

## Task 3: Policy engine and virtual key selection

**Files**
- Create: `packages/policy/src/policy.ts`, `repo.ts`, `virtual-keys.ts`, `schema.ts`
- Test: `packages/policy/test/policy.test.ts`

**Interfaces**
- Produces:
  - `loadPolicy(path): Policy`
  - `classifyRepo(policy, cwd, remote): RepoClass`
  - `selectVirtualKey(policy, repoClass, budgetState): VirtualKey`
  - `PolicyError`
- Consumes: `GidorahConfig`.

- [ ] Step 1: Write failing tests for path/remote classification, first-match precedence, symlink canonicalization, invalid policy fail-closed, confidential→local key, budget-exhausted→local/stop.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement Zod-validated YAML policy; no repo-provided override.
- [ ] Step 4: Run tests; expect pass. Add a test that a repo file claiming “confidential: false” changes nothing.
- [ ] Step 5: Commit `feat: add repo policy and key selection`.

**Verification:** Invalid policy yields reads-only local mode, never cloud.

---

## Task 4: Tool registry and approvals

**Files**
- Create: `packages/core/src/tools/registry.ts`, `read.ts`, `repo-map.ts`, `write.ts`, `edit.ts`, `bash.ts`, `git.ts`, `search.ts`
- Create: `packages/policy/src/approval.ts`, `shell-classifier.ts`
- Test: `packages/core/test/tools.test.ts`, `packages/policy/test/approval.test.ts`

**Interfaces**
- Produces:
  - `Tool { name, schema, execute(args, ctx): Promise<ToolResult> }`
  - `ToolRegistry.register(tool)`
  - `classifyToolCall(call, policy): ApprovalDecision`
  - `ApprovalService.ask(request): Promise<"allow" | "deny">`
  - `buildRepoMap(cwd): RepoMap`
  - `edit` accepts a find/replace patch and rejects ambiguous matches.
- Tool result: `{ callId, ok, content, artifactPath?, error? }`.

- [ ] Step 1: Write failing tests for: read/glob/grep allow; repo_map returns symbols; write/edit ask; edit applies a unique find/replace; ambiguous edit fails; bash ask; git status allow; git commit ask; path escape denied; `curl` denied in confidential; `git -c` ask; denial prevents execution.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement tools with path canonicalization, a simple TS/JS symbol extractor, real shell lexer, output caps, and `AbortSignal`.
- [ ] Step 4: Run tests; expect pass. Add a test for parallel read-only calls and a full-file rewrite flag.
- [ ] Step 5: Commit `feat: add tools and approval classifier`.

**Verification:** A denied command never spawns a process (mock `execa`).

---

## Task 5: Tavily Scout, evidence cards, cache

**Files**
- Create: `packages/tavily/src/scout.ts`, `query.ts`, `card.ts`, `cache.ts`, `budget.ts`
- Test: `packages/tavily/test/scout.test.ts`

**Interfaces**
- Produces:
  - `research(input: ResearchInput, ctx): Promise<EvidenceCard>`
  - `buildQuery(input): ResearchQuery`
  - `compressToCard(results): EvidenceCard`
  - `ResearchCache.get/put`
- Card fields: id, question, answer, facts[], sources[], confidence, package, tokenEstimate, cached.

- [ ] Step 1: Write failing tests for: local-first returns `LOCAL_ANSWER_FOUND`; repo-local task makes zero API calls; docs task returns a card; card ≤ cap; sources present; cache hit avoids a call; confidential returns `RESEARCH_DENIED`; 429 returns cache/skip.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement the Tavily SDK wrapper with `search_depth: "basic"`, `max_results: 3`, `chunks_per_source: 2`, `include_raw_content: false`; extract only for top URLs when needed.
- [ ] Step 4: Run tests; expect pass. Add a test for version-aware query.
- [ ] Step 5: Commit `feat: add tavily scout and evidence cache`.

**Verification:** No Tavily client is constructed in confidential mode.

---

## Task 6: Budget ledger and task cap

**Files**
- Create: `packages/core/src/budget/ledger.ts`, `packages/policy/src/budget.ts`
- Test: `packages/core/test/budget.test.ts`

**Interfaces**
- Produces:
  - `BudgetService.precheck(user, kind): BudgetDecision`
  - `BudgetService.record(usage): void`
  - `BudgetService.warnAt(threshold): void`
  - `TaskBudget.start(capUsd)`, `TaskBudget.note(cost)`, `TaskBudget.exceeded()`
- Consumes: Bifrost `RoutingInfo`, `TokenUsage`.

- [ ] Step 1: Write failing tests for: 80% warning once; 402 leads to local/stop; concurrent requests do not overspend; task cap stops/asks; local cost zero.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement SQLite WAL with atomic reservation for local cache; Bifrost remains authority. Record only after usage.
- [ ] Step 4: Run tests; expect pass.
- [ ] Step 5: Commit `feat: add budget ledger and task cap`.

**Verification:** A simulated 402 never triggers a cloud retry.

---

## Task 7: Context economics

**Files**
- Create: `packages/core/src/context/assembler.ts`, `cap.ts`, `clear.ts`, `compact.ts`, `prefix.ts`
- Test: `packages/core/test/context.test.ts`

**Interfaces**
- Produces:
  - `buildContext(session, options): ModelRequest`
  - `capToolResult(result, maxTokens): ToolResult`
  - `clearOldToolResults(messages, keepRecent): Message[]`
  - `maybeCompact(session, pressure): CompactionResult | null`
  - `prefixHash(messages): string`
- Policy: cap first; clear second; compact only at pressure/measured benefit.

- [ ] Step 1: Write failing tests for: stable prefix hash across turns; cap preserves head/tail/errors; full output artifact; clear keeps call record; compaction skipped below pressure; compaction at overflow; cache-hit metric recorded.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement the cap (default 4k tokens, 60/40 head/tail, error lines preserved), clearing older than N tool results, and compaction only at 90% pressure.
- [ ] Step 4: Run tests; expect pass. Add a test that dynamic budget text is not in the prefix.
- [ ] Step 5: Commit `feat: add cache-aware context economics`.

**Verification:** Prefix hash changes only when the stable prompt/tool order changes.

---

## Task 8: Flight recorder, receipt, and CLI contract

**Files**
- Create: `packages/core/src/trace/recorder.ts`, `packages/core/src/trace/receipt.ts`
- Create: `apps/cli/src/commands/run.ts`, `resume.ts`, `doctor.ts`, `budget.ts`, `trace.ts`, `demo.ts`, `bench.ts`, `conformance.ts`, `chaos.ts`
- Test: `apps/cli/test/commands.test.ts`

**Interfaces**
- Produces:
  - `TraceRecord` with requested/served/fallback/cache/tokens/cost/budget/research/dlp/docsGuard.
  - `Receipt` with totals and budget remaining.
  - CLI flags: `--json`, `--plain`, `--no-color`, `--user`, `--task-budget`, `--yes`.

- [ ] Step 1: Write failing tests for: `--json` writes only JSON to stdout; logs to stderr; `--plain` no ANSI; `--help`/`--version`; SIGINT exit 130; `doctor` reports missing Bifrost/Tavily/Ollama.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement commands and trace/receipt.
- [ ] Step 4: Run tests; expect pass. Run `pnpm gidorah doctor`.
- [ ] Step 5: Commit `feat: add cli commands and flight recorder`.

**Verification:** A piped `--json` run has no prompts and no ANSI.

---

## Task 9: TUI adapter

**Files**
- Create: `apps/tui/` (vendored DSH TUI), `apps/tui/src/adapter.ts`, `apps/tui/src/panels/*`
- Test: `apps/tui/test/adapter.test.ts`

**Interfaces**
- Produces: `TuiEvent` union; `renderEvent(event)`; panels: status, transcript, approval, takeover, research, docs guard, DLP, trace, receipt.
- Consumes: event bus only; never Bifrost/Tavily directly.

- [ ] Step 1: Write failing tests for: assistant delta renders; tool card; approval modal blocks; route banner persists; DLP notice hides secret; `--plain` fallback.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Vendor the TUI with LICENSE/NOTICE; stub DSH services; wire the event bus.
- [ ] Step 4: Run tests; expect pass. Launch on Windows Terminal and verify resize.
- [ ] Step 5: Commit `feat: adapt dsh tui shell`.

**Verification:** No DSH service/Cordis import remains; plain mode passes.

---

## Task 10: Bifrost DLP/policy plugin

**Files**
- Create: `plugins/bifrost-dlp/main.go`, `go.mod`, `README.md`, `LICENSE`, `testdata/secrets.txt`
- Test: `plugins/bifrost-dlp/main_test.go`

**Interfaces**
- Hooks: `PreLLMHook`, `HTTPTransportResponseHeadersHook`.
- Reads: `x-gidorah-confidential`, request body; writes: `x-gidorah-policy`, `x-gidorah-dlp`.

- [ ] Step 1: Spike: confirm the pinned Bifrost hook can read the serialized body without breaking streaming. Record the result.
- [ ] Step 2: Write failing tests for: fake AWS key blocked; private key blocked; clean prompt passes; false-positive allowlist; confidential header + cloud provider rejected.
- [ ] Step 3: Implement with high-confidence patterns and fail-closed behavior; log class/hash only.
- [ ] Step 4: Run `go test ./...`; expect pass.
- [ ] Step 5: Commit `feat: add bifrost dlp plugin`.

**Verification:** A request with a fake key never reaches the mock cloud provider.

---

## Task 10.5: Audit chain and red team

**Files**
- Create: `packages/core/src/audit/chain.ts`, `verify.ts`, `export.ts`
- Create: `tests/redteam/corpus.ts`, `tests/redteam/canary.ts`
- Test: `packages/core/test/audit.test.ts`, `tests/redteam/redteam.test.ts`

**Interfaces**
- Produces:
  - `hashEvent(event, prevHash): AuditFields`
  - `verifyChain(events): ChainResult`
  - `exportAudit(session, format): AuditBundle`
  - `runRedTeam(corpus): RedTeamResult`
- Chain fields: `prevHash`, `hash`, `chainVersion`.

- [ ] Step 1: Write failing tests for: valid chain; edited event fails; reordered event fails; export is redacted; canary appears zero times; 20/20 corpus attacks blocked.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement canonical JSON + SHA-256 chain, anchor file, audit export, and the canary scanner.
- [ ] Step 4: Run tests; expect pass. Add a tamper test that reports the first bad link.
- [ ] Step 5: Commit `feat: add audit chain and red team`.

**Verification:** `gidorah audit verify` exits 0 on a valid chain and 3 on a tampered one.

---

## Task 11: Benchmark harness and tasks

**Files**
- Create: `packages/benchmark/src/runner.ts`, `arms.ts`, `metrics.ts`, `report.ts`
- Create: `tests/bench/tasks/` (16-20 task specs), `tests/bench/repos/` fixtures
- Test: `packages/benchmark/test/metrics.test.ts`

**Interfaces**
- Produces: `runTask(task, arm): TaskResult`; `runArm(arm, tasks): ArmResult`; `report(results): Report`.
- Metrics: cost per task, cost per successful task, pass@1, tokens, model requests, tool calls, research calls, cache hit, fallback, missing/errored, patch size, full-file reads, context net cost.

- [ ] Step 1: Write failing tests for metric formulas and missing-row accounting.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement worktree setup, task runner, pilot mode (3 tasks), arms A–J, and report.
- [ ] Step 4: Run a 3-task pilot; inspect every row; fix harness before full run.
- [ ] Step 5: Commit `feat: add benchmark harness`.

**Verification:** `pnpm bench --pilot` produces a report with raw JSONL and no hidden rows.

---

## Task 12: Replay, chaos, and demo

**Files**
- Create: `packages/core/src/replay.ts`, `tests/chaos/`, `scripts/demo.sh`
- Create: `docs/04-delivery/demo-and-submission.md` updates
- Test: `packages/core/test/replay.test.ts`, `tests/chaos/chaos.test.ts`

**Interfaces**
- Produces: `recordReplay(session)`, `replay(path): AsyncIterable<TuiEvent>`, `chaos(mode)`.
- Modes: kill Bifrost, kill Ollama, kill Tavily, drop network, kill process.

- [ ] Step 1: Write failing tests for offline replay and each chaos mode.
- [ ] Step 2: Run tests; expect failure.
- [ ] Step 3: Implement replay from recorded events/traces and chaos harness.
- [ ] Step 4: Run `pnpm demo --replay` with no network; expect all scenes.
- [ ] Step 5: Commit `feat: add replay and chaos`.

**Verification:** Replay reproduces the takeover banner, DLP block, research card, and receipt.

---

## Execution order

```text
0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12
```

Tasks 5, 9, 10, 11 can run in parallel after task 4. Do not start the TUI before task 8. Do not run the full benchmark before the pilot passes. Do not claim completion without the verification command output.
