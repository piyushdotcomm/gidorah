# Data and Events

**Status:** Draft · **Owner:** Engineering · **Last updated:** 2026-11-03

Gidorah is event-sourced. The session log is the source of truth for the conversation; SQLite stores derived/cache data; Bifrost and Tavily remain the authorities for their own usage.

---

## 1. Storage layout

```text
~/.gidorah/
├─ policy.yml                 # global policy (root of trust)
├─ config.yml                 # user config (non-secret)
├─ sessions/
│  └─ <session-id>/
│     ├─ session.jsonl        # append-only events
│     ├─ session.meta.json    # header: cwd, user, policy version, created
│     └─ artifacts/           # full tool outputs, spilled
├─ cache/
│  ├─ research.db             # SQLite: research cards, credits
│  └─ budget.db               # SQLite: cached budget status, warnings
├─ traces/
│  └─ <run-id>.jsonl          # flight recorder export
└─ logs/
   └─ gidorah.log              # redacted operational log
```

- Session logs are append-only; no in-place mutation.
- Artifacts are content-addressed or call-id-named.
- SQLite uses WAL mode; budget checks fail closed.
- Secrets never enter this tree.

---

## 2. Session event envelope

```ts
interface SessionEvent<T extends string = string> {
  seq: number;            // contiguous, starts at 0
  time: number;           // epoch ms
  type: T;                // discriminated union key
  data: unknown;          // event-specific payload
  schemaVersion: 1;
  prevHash: string;       // hash of the previous event, or GENESIS
  hash: string;           // sha256(canonical(event without hash) + prevHash)
  chainVersion: 1;
}
```

Rules:

- `seq` is contiguous; a gap is corruption.
- Events are JSON-serializable; no `undefined`, `BigInt`, `Date`, `Map`, `Set`.
- An open turn/step/tool at crash time is closed with an `interrupted` marker on resume.
- Unknown event types are ignored if marked `ignorable: true`; otherwise resume fails safe.
- `hash` covers the event body and `prevHash`; editing or reordering breaks the chain.
- The chain head is anchored at turn boundaries to `audit-anchor.log`.
- A hash chain alone is not proof against an operator with write access; see [audit-and-redteam.md](audit-and-redteam.md).

---

## 3. Event types

| Type | Data | Purpose |
|---|---|---|
| `session/start` | `{ sessionId, cwd, user, policyVersion, mode }` | Header/first event |
| `turn/start` | `{ turn }` | Turn boundary |
| `turn/end` | `{ turn, reason }` | Turn outcome |
| `step/start` | `{ turn, step, phase, modelSelection }` | Model step |
| `step/end` | `{ turn, step, reason }` | Step outcome |
| `user/message` | `{ id, content, source }` | User or injected context |
| `system/message` | `{ content }` | Rendered system prompt |
| `assistant/message` | `{ id, content, provider, model, usage, stream? }` | Model output |
| `assistant/attempt` | `{ provider, model, error, usage? }` | Failed/retried attempt |
| `tool/call` | `{ callId, name, arguments }` | Tool request |
| `tool/result` | `{ callId, ok, content, artifactPath?, error? }` | Tool outcome |
| `approval/request` | `{ approvalId, callId, tool, risk, preview }` | Approval prompt |
| `approval/decision` | `{ approvalId, decision, reason, decidedAt }` | Human decision |
| `route/changed` | `{ from, to, reason, fallbackIndex, requested, served }` | Model takeover |
| `budget/updated` | `{ kind: "llm" \| "research", used, limit, currency, threshold? }` | Spend update |
| `budget/task` | `{ taskId, usedUsd, capUsd, action }` | Per-task cap |
| `research/request` | `{ queryId, queryHash, package?, version? }` | Tavily call |
| `research/result` | `{ queryId, card, credits, cached, sources }` | Evidence card |
| `research/denied` | `{ queryId, reason }` | Policy/cap/budget denial |
| `docs/check` | `{ package, version, symbols, result, sources? }` | Docs Guard verification |
| `dlp/blocked` | `{ class, hash, action, provider }` | Gateway DLP decision |
| `context/metrics` | `{ prefixHash, capTokens, cleared, compactionNetCostUsd? }` | Context economics |
| `audit/anchor` | `{ chainHead, anchorPath, at }` | Chain anchor |
| `redteam/result` | `{ suite, attacks, blocked, bypassed, canaryEgress }` | Adversarial proof |
| `compaction/summary` | `{ range, summary, tokenEstimate }` | Context reduction |
| `session/error` | `{ code, message, retryable }` | Structured failure |
| `session/end` | `{ reason }` | Clean shutdown |

---

## 4. Example session log

```jsonl
{"seq":0,"time":1762200000000,"type":"session/start","schemaVersion":1,"data":{"sessionId":"ses_01","cwd":"C:/work/app","user":"alice","policyVersion":"1","mode":"cloud"}}
{"seq":1,"time":1762200000100,"type":"turn/start","schemaVersion":1,"data":{"turn":1}}
{"seq":2,"time":1762200000101,"type":"step/start","schemaVersion":1,"data":{"turn":1,"step":1,"phase":"explore","modelSelection":{"provider":"deepseek","model":"deepseek-flash"}}}
{"seq":3,"time":1762200000900,"type":"assistant/message","schemaVersion":1,"data":{"id":"msg_01","content":[{"type":"text","text":"I'll inspect the failing test."}],"provider":"deepseek","model":"deepseek-flash","usage":{"inputTokens":1200,"outputTokens":80,"cacheReadTokens":0}}}
{"seq":4,"time":1762200001000,"type":"tool/call","schemaVersion":1,"data":{"callId":"call_01","name":"read","arguments":{"path":"src/auth.ts"}}}
{"seq":5,"time":1762200001050,"type":"tool/result","schemaVersion":1,"data":{"callId":"call_01","ok":true,"content":[{"type":"text","text":"..."}]}}
{"seq":6,"time":1762200002000,"type":"route/changed","schemaVersion":1,"data":{"from":{"provider":"deepseek","model":"deepseek-pro"},"to":{"provider":"deepseek","model":"deepseek-flash"},"reason":"429","fallbackIndex":1,"requested":{"provider":"deepseek","model":"deepseek-pro"},"served":{"provider":"deepseek","model":"deepseek-flash"}}}
```

---

## 5. Research cache (SQLite)

```sql
CREATE TABLE research_cache (
  key             TEXT PRIMARY KEY,
  question        TEXT NOT NULL,
  card_json       TEXT NOT NULL,
  sources_json    TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  hit_count       INTEGER NOT NULL DEFAULT 0,
  credits         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE research_usage (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL,
  day             TEXT NOT NULL,          -- YYYY-MM-DD (UTC)
  credits         INTEGER NOT NULL DEFAULT 0,
  calls           INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, day)
);
```

- `key = sha256(normalized_query + package_version + prompt_version)`.
- TTL enforced on read; expired rows are deleted lazily.
- Cache is never read in confidential mode.
- Credits are incremented from Tavily `usage` when present, else per-call estimate with a clear label.

---

## 6. Budget cache (SQLite)

```sql
CREATE TABLE budget_state (
  key             TEXT PRIMARY KEY,       -- user_id + ':llm' | user_id + ':research'
  used            REAL NOT NULL DEFAULT 0,
  limit_value     REAL NOT NULL,
  currency        TEXT NOT NULL,          -- USD or credits
  period_start    INTEGER NOT NULL,
  period_end      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  source          TEXT NOT NULL           -- 'bifrost' | 'local'
);

CREATE TABLE budget_warnings (
  key             TEXT NOT NULL,
  threshold       REAL NOT NULL,
  fired_at        INTEGER NOT NULL,
  PRIMARY KEY (key, threshold)
);
```

- This table is a **cache/UX aid**, not the authority for LLM spend.
- LLM spend is refreshed from Bifrost usage/logs; a mismatch is logged and Bifrost wins.
- Research credits are authoritative here because Tavily does not provide a per-user ledger.

---

## 7. Policy schema

`~/.gidorah/policy.yml`:

```yaml
version: 1
user: alice

mode:
  default: cloud
  confidential:
    paths:
      - "C:/work/bank-*"
    remotes:
      - "git@github.com:acme/secret-*"
    marker: ".gidorah/confidential"

budgets:
  llm:
    virtual_key_cloud: "gidorah-alice-cloud"
    virtual_key_local: "gidorah-alice-local"
    soft_threshold: 0.80
    at_limit: local_first   # local_first | stop
  research:
    credits_per_day: 50
    calls_per_task: 2
  task:
    default_usd: 0.10
    on_limit: ask           # ask | stop

research:
  enabled: true
  official_domains:
    stripe.com: ["docs.stripe.com"]
    nodejs.org: ["nodejs.org"]
  ttl_seconds: 604800
  card_token_cap: 700

docs_guard:
  enabled: true
  max_lookups_per_edit: 1
  advisory_only: true

context:
  tool_cap_tokens: 4000
  clear_after_tool_results: 8
  compact_at_pressure: 0.90
  compaction: measured       # off | pressure | measured

editing:
  patch_first: true
  require_reason_for_full_write: true

repo_map:
  enabled: true
  max_tokens: 2000

audit:
  enabled: true
  anchor_path: "~/.gidorah/audit-anchor.log"
  sign_head: false

redteam:
  enabled: true
  corpus: "tests/redteam/corpus.ts"
  canary_required: true

dlp:
  enabled: true
  default_action: block     # block | redact
  allowlist: []

approvals:
  reads: allow
  writes: ask
  shell: ask
  git_read: allow
  git_write: ask
  confidential_network: deny

providers:
  aliases:
    gidorah-auto: "deepseek/deepseek-flash"
    gidorah-fast: "deepseek/deepseek-flash"
    gidorah-strong: "deepseek/deepseek-pro"
    gidorah-local: "ollama/qwen2.5-coder:3b"
  cloud: ["deepseek/deepseek-flash", "deepseek/deepseek-pro"]
  local: ["ollama/qwen2.5-coder:3b"]
```

Rules:

- Policy file lives outside the repo; the repo cannot change it.
- `version` is included in every audit event.
- Invalid policy fails closed: no cloud, no research, reads only.

---

## 8. Flight recorder schema

```ts
interface TraceRecord {
  requestId: string;
  sessionId: string;
  taskId: string;
  phase: "explore" | "edit" | "verify" | "research" | "other";
  requested: { provider: string; model: string };
  served: { provider: string; model: string };
  fallback: boolean;
  fallbackIndex?: number;
  cacheHit: boolean;
  tokens: {
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    total: number;
  };
  costUsd: number;
  latencyMs: number;
  research?: {
    queryHash: string;
    credits: number;
    sources: number;
    cardTokens: number;
    cached: boolean;
  } | null;
  dlp?: { action: "clean" | "blocked"; class?: string; hash?: string } | null;
  docsGuard?: { result: "verified" | "unknown" | "deprecated" | "skipped"; symbols?: string[] } | null;
  context?: { prefixHash: string; capTokens: number; cleared: number; compactionNetCostUsd?: number } | null;
  budgetAfter?: { llmUsd: number; researchCredits: number; taskUsd?: number };
}
```

Source:

- LLM fields: Bifrost response headers + `/api/logs`.
- Research fields: Tavily response usage + local cache.
- Budget: Bifrost usage + local research ledger.

---

## 9. Retention and privacy

| Data | Default retention | Notes |
|---|---|---|
| Session JSONL | 30 days | User-configurable; export before delete |
| Artifacts | 7 days | Full tool outputs; may contain code |
| Research cache | 7 days | Public docs; no repo code |
| Traces | 30 days | Metadata + costs; no prompt content in confidential mode |
| Operational logs | 14 days | Redacted |

- Confidential mode: Bifrost content logging disabled; traces store metadata only; no prompt text.
- `gidorah export` writes a redacted Markdown/JSON bundle.
- `gidorah purge` deletes sessions/artifacts/cache with confirmation.

---

## 10. Schema versioning

- `schemaVersion` starts at 1.
- Additive fields are allowed without a bump; readers ignore unknown fields.
- Breaking changes bump the version and ship a migration.
- Migration is one-way; a backup is written before migration.
- A future version is refused rather than partially read.

---

## 11. Acceptance criteria

- [ ] Session log survives crash and replays exactly.
- [ ] `seq` is contiguous; corruption is detected.
- [ ] Resume closes open turn/step/tool markers.
- [ ] Research cache key includes package version; version bump misses.
- [ ] Budget cache never authorizes a request on its own.
- [ ] No secrets in any file under `~/.gidorah`.
- [ ] Trace records reconstruct every claim in the benchmark report.
- [ ] DLP events contain only class/hash, never the secret.
- [ ] Docs Guard events contain package/version/symbols, never file contents.
