# Observability and Release

**Status:** Draft · **Owner:** Engineering · **Last updated:** 2026-11-03

---

## 1. Flight recorder

The flight recorder is Gidorah's primary observability surface and demo centerpiece. It answers: *which model ran, why, what did it cost, and what did research contribute?*

### Per-call fields

| Field | Source |
|---|---|
| request id | Bifrost |
| session id | Gidorah |
| task id | Gidorah |
| phase | Gidorah (`explore`/`edit`/`verify`) |
| requested provider/model | Request |
| served provider/model | Bifrost headers/logs |
| fallback + index | Bifrost headers |
| cache hit | Bifrost logs/headers |
| input/cache-read/cache-write/output tokens | Bifrost usage |
| cost USD | Bifrost logs |
| latency | Bifrost headers/logs |
| research query hash | Gidorah |
| research credits | Tavily usage/local ledger |
| research sources/card tokens | Gidorah |
| DLP action | Bifrost plugin (`clean`/`blocked:<class>`) |
| Docs Guard result | Gidorah (`verified`/`unknown`/`deprecated`) |
| cache read/write tokens | Bifrost |
| prefix hash change | Gidorah |
| compaction net cost | Gidorah |
| budget after | Bifrost + research ledger |

### CLI

```bash
gidorah trace --last
gidorah trace --session ses_01 --json
gidorah receipt --last
gidorah demo --replay
```

The Bifrost dashboard at `/logs` is shown during the demo for provider/cost evidence; `gidorah trace` is the portable receipt.

Rendered table:

```text
#  Phase     Requested       Served          Fallback  Cache  Tokens  Cost     Budget
1  explore   deepseek/pro    deepseek/flash  yes #1    no     12,340  $0.004   $0.46
2  research  —               tavily          —         no     0       $0.002*  —
3  edit      deepseek/flash  deepseek/flash  no        yes    8,120   $0.001   $0.459
4  verify    deepseek/pro    ollama/qwen3b   yes #2    no     6,400   $0.000   $0.459
```

`*` research credits shown separately from LLM dollars.

---

## 2. Logs, metrics, traces

### Logs
- Structured JSON, redacted.
- Levels: error, warn, info, debug.
- Fields: timestamp, level, sessionId, requestId, event, message, durationMs.
- No prompt content in confidential mode.
- Rotation: 14 days default.

### Metrics (local)
- Requests, tokens, cost by provider/model/phase.
- Fallback count, cache hit rate, 402 count.
- Research calls, credits, cache hit rate, unnecessary research.
- Approval prompts/denials.
- Session resume success.
- Cache read/write ratio, prefix-hash changes, compaction net cost.
- Cost per solved task and cost per successful task.

Export as JSON/Markdown for the benchmark; a Prometheus endpoint is out of scope for v1.

### Traces
- Bifrost logs are the LLM trace authority.
- Gidorah trace JSONL links session events to Bifrost request IDs.
- Research trace stores query hash, sources, credits, card size.

---

## 3. Privacy

| Data | Cloud mode | Confidential mode |
|---|---|---|
| Prompt/content in logs | Optional, off by default | Never |
| Bifrost content logging | Configurable | Disabled |
| Tool output artifacts | Retained 7 days | Retained 7 days, local only |
| Research queries | Stored hashed + sources | Not created |
| Trace metadata | 30 days | 30 days, no content |
| Audit chain | Hash + redacted metadata | Hash + redacted metadata |
| Secrets | Never | Never |

`gidorah export` produces a redacted bundle; `gidorah purge` deletes local data. `gidorah audit export` includes chain verification and the anchor head, not raw prompts.

### Audit verification

- `gidorah audit verify` recomputes the hash chain and reports the first broken link.
- The head is anchored at turn boundaries; a tampered fixture must fail.
- A hash chain is tamper-evident, not tamper-proof; state the limitation.
- `gidorah redteam` scans for canary egress and reports 0/20 bypasses.

---

## 4. Release process

### Versioning
- `0.x.y` during the hackathon.
- Semver after v1.0.
- Every release notes Bifrost, Tavily SDK, pi-tui, Node, and model versions.
- Benchmark results are tied to a release/commit.

### Checklist
- [ ] Tests, conformance, lint, typecheck pass.
- [ ] Docs updated (requirements, schema, policy, CLI help).
- [ ] `LICENSE`, `NOTICE`, third-party register updated.
- [ ] Secret scan clean.
- [ ] `gidorah --version` and `gidorah doctor` work.
- [ ] Demo runs 3× without repair.
- [ ] Benchmark artifact attached.

### Packaging
- `npm pack` tarball; install in a clean directory.
- Native SQLite prebuild verified on Windows/macOS/Linux.
- `gidorah doctor` checks Bifrost, Ollama, Tavily, keys, policy, and disk.

### Rollback
- Keep the previous tarball and config; `gidorah doctor --fix` and `gidorah config migrate` are reversible.
- Session schema migrations write a backup before changing.

---

## 5. Telemetry

- Opt-in only. Default off.
- If enabled: anonymous counters (commands, errors, model route, token totals) — no prompts, no code, no paths.
- A visible setting and a docs page.
- For the hackathon, ship telemetry off.

---

## 6. Acceptance criteria

- [ ] Every benchmark claim maps to a trace record.
- [ ] `gidorah trace` shows requested vs served, fallback, cache, tokens, cost.
- [ ] No secrets or prompt content in confidential logs.
- [ ] Logs rotate and can be purged.
- [ ] A release can be installed from a tarball and passes `gidorah doctor`.
- [ ] Version metadata is recorded in the release notes.
