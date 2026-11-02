# Bifrost — Model Plane

**Status:** Draft · **Owner:** Architecture · **Last updated:** 2026-11-03

Bifrost is the **only** path from Gidorah to a language model. It enforces provider access, budgets, routing, fallbacks, caching, and logging. Gidorah does not contain a direct provider adapter.

---

## 1. Responsibilities

| Responsibility | Owner |
|---|---|
| Provider credentials and connections | Bifrost |
| Per-user budgets and rate limits | Bifrost virtual keys |
| Provider allowlist for confidential mode | Bifrost local-only virtual key |
| Phase/complexity/budget routing | Bifrost routing rules |
| Retries and cross-provider fallbacks | Bifrost |
| Exact/semantic cache | Bifrost |
| Request logs, tokens, cost, latency | Bifrost |
| Repo classification and key selection | Gidorah policy engine |
| Takeover notice and session events | Gidorah |
| Approval gate | Gidorah |

---

## 2. Topology

```text
Gidorah ──HTTP/OpenAI──► Bifrost :8080 ──► DeepSeek (cloud)
                                      ├─► Ollama (local)
                                      └─► fallback provider(s)
```

- Base URL: `http://127.0.0.1:8080/openai` (or `/v1`).
- Auth: Bifrost virtual key via `Authorization: Bearer` or `x-bf-vk`.
- Protocol: OpenAI Chat Completions (streaming).
- Version: pin the Bifrost release used for the submission; record it in the README.

---

## 3. Providers

| Provider ID | Model | Role | Notes |
|---|---|---|---|
| `deepseek` | `deepseek-flash` | Default explore/edit | Cheap, fast |
| `deepseek` | `deepseek-pro` | Verify/escalation | Stronger, more expensive |
| `ollama` | `qwen2.5-coder:3b` (or chosen local) | Confidential/local fallback | 3B–4B Q4 for 6 GB VRAM |

Rules:

- DeepSeek API keys live in Bifrost configuration or environment; never in Gidorah session logs.
- Ollama requires no key; set `ollama_key_config.url` to the local endpoint.
- No other providers in v1. Three models are enough for the benchmark.

---

## 4. Virtual keys

Two keys per user:

| Key | Providers allowed | Budget | Purpose |
|---|---|---|---|
| `gidorah-<user>-cloud` | `deepseek/*` | Monthly dollar budget | Normal work |
| `gidorah-<user>-local` | `ollama/*` only | No dollar budget (local cost 0) | Confidential work, budget-exhausted fallback |

Optional third key:

| `gidorah-<user>-readonly` | `deepseek-flash` only | Small budget | Cheap exploration / CI |

### Key selection (code, not prompt)

```text
if repo.confidential:
    key = local_key
    research = disabled
elif budget.remaining <= 0:
    key = local_key if allow_local_fallback else deny
else:
    key = cloud_key
```

- The model never receives the key.
- A prompt cannot change the key.
- A misconfigured model request still hits the key's provider allowlist.

### Budget behavior

Bifrost checks budgets **before** forwarding the request. If any applicable budget is exhausted, it returns HTTP **402** with `type: budget_exceeded` and the holder/tier in the message.

Gidorah behavior:

| State | Behavior |
|---|---|
| < 80% | Normal |
| ≥ 80% | One warning; TUI amber; optional routing rule to cheaper model |
| ≥ 100% | Cloud key returns 402; Gidorah switches to local if allowed, else stops with top-up guidance |
| Hard cap | Never bypassed, including user insistence or prompt injection |

Gidorah may cache budget status for the status line, but the pre-request authority is Bifrost. Do not claim a request is affordable based on a local estimate.

### Example: create a virtual key

> Illustrative shape; verify field names against the pinned Bifrost version.

```bash
curl -X POST http://localhost:8080/api/governance/virtual-keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gidorah-alice-cloud",
    "provider_configs": [
      {
        "provider": "deepseek",
        "weight": 1.0,
        "allowed_models": ["deepseek-flash", "deepseek-pro"],
        "key_ids": ["*"]
      }
    ],
    "budgets": [{ "max_limit": 50.00, "reset_duration": "1M" }],
    "rate_limit": {
      "request_max_limit": 120,
      "request_reset_duration": "1h"
    },
    "is_active": true
  }'
```

Local-only key:

```bash
curl -X POST http://localhost:8080/api/governance/virtual-keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gidorah-alice-local",
    "provider_configs": [
      {
        "provider": "ollama",
        "weight": 1.0,
        "allowed_models": ["qwen2.5-coder:3b"],
        "key_ids": ["*"]
      }
    ],
    "is_active": true
  }'
```

---

## 5. Routing rules

### Phase-based routing

Gidorah sends `x-gidorah-phase: explore | edit | verify`. Bifrost CEL rules map the phase to a model:

```json
{
  "id": "gidorah-phase-explore",
  "name": "Gidorah explore → flash",
  "enabled": true,
  "cel_expression": "headers[\"x-gidorah-phase\"] == \"explore\"",
  "targets": [{ "provider": "deepseek", "model": "deepseek-flash", "weight": 1 }],
  "fallbacks": ["deepseek/deepseek-pro", "ollama/qwen2.5-coder:3b"],
  "scope": "global",
  "priority": 10
}
```

```json
{
  "id": "gidorah-phase-verify",
  "name": "Gidorah verify → pro",
  "enabled": true,
  "cel_expression": "headers[\"x-gidorah-phase\"] == \"verify\"",
  "targets": [{ "provider": "deepseek", "model": "deepseek-pro", "weight": 1 }],
  "fallbacks": ["deepseek/deepseek-flash", "ollama/qwen2.5-coder:3b"],
  "scope": "global",
  "priority": 20
}
```

### Budget-aware degradation

```json
{
  "id": "gidorah-budget-degrade",
  "name": "Budget > 85% → flash",
  "enabled": true,
  "cel_expression": "budget_used > 85",
  "targets": [{ "provider": "deepseek", "model": "deepseek-flash", "weight": 1 }],
  "fallbacks": ["ollama/qwen2.5-coder:3b"],
  "scope": "global",
  "priority": 5
}
```

Verify the exact CEL variable names and scope semantics against the pinned Bifrost docs. Lower priority evaluates first; ensure the phase and budget rules do not conflict.

### Confidential mode

Confidential sessions use the local-only virtual key. The key's provider allowlist is the primary enforcement; the routing rules for cloud models are irrelevant because the key cannot use them. Add a Bifrost plugin guard for defense-in-depth (see §9).

---

### Model aliases

Instead of hardcoding model ids in the agent, create Bifrost aliases:

| Alias | Maps to | Used for |
|---|---|---|
| `gidorah-auto` | Default route; Bifrost phase rules decide | Main conversation |
| `gidorah-fast` | `deepseek/deepseek-flash` | explore, routine edits, summaries |
| `gidorah-strong` | `deepseek/deepseek-pro` | verify, hard repairs |
| `gidorah-local` | `ollama/qwen2.5-coder:3b` | confidential, budget fallback |

The agent requests an alias; Bifrost owns the mapping and fallbacks. Changing a model requires no agent code change. The flight recorder still shows the concrete served model.

**Routing composition**

- **Main conversation:** request `gidorah-auto`; Bifrost CEL uses `x-gidorah-phase` to select the concrete model.
- **Deterministic sub-calls:** request `gidorah-fast` or `gidorah-strong` directly; no phase rule needed.
- **Aliases** map to concrete provider/model + fallbacks. Do not combine alias and phase rules in a way that double-routes.
- The `x-gidorah-phase` header is always sent for audit and budget/complexity rules.

### Complexity Router (optional layer)

Bifrost can classify a request as `SIMPLE`, `MEDIUM`, or `COMPLEX` and route by tier. Use it as an optional layer, not a replacement for phase routing:

- Phase routing expresses **agent intent** (`explore` vs `verify`).
- Complexity routing expresses **request difficulty**.
- A combined rule can use phase first, then complexity within the phase.

Benchmark it as a separate arm (E). If it does not improve cost per solved task, document that and keep phase routing.

### Team/customer budgets (stretch)

Bifrost supports budgets at provider, virtual key, team, and customer levels. For a team demo, attach two user keys to a team with a shared monthly budget. This is not required for v1 but strengthens the enterprise story.

---

## 6. Fallbacks and takeover

Bifrost retries and falls back within a request. The response includes:

| Header | Use |
|---|---|
| `x-bifrost-routing-info-provider` | Served provider |
| `x-bifrost-routing-info-model` | Served model |
| `x-bifrost-routing-info-requested-provider/model` | Original request |
| `x-bifrost-routing-info-is-fallback` | `true` if fallback |
| `x-bifrost-routing-info-primary-provider/model` | Primary attempt |
| `x-bifrost-fallback-index` | Fallback number |
| `x-bifrost-upstream-latency-ms` | Upstream time |
| `x-bifrost-request-type` | Chat/stream |

Gidorah behavior:

- If `is-fallback` is present, emit a durable `route/changed` event and show a banner:
  `deepseek-pro → deepseek-flash (fallback #1, 429)`.
- If the served model differs from the requested model without a fallback header (e.g., routing rule), show a subtler “routed to” badge.
- Persist the event so resume shows the takeover.
- Never replay a tool call that already executed.

Fallback chain design:

| Key | Primary | Fallbacks |
|---|---|---|
| Cloud | `deepseek/deepseek-pro` | `deepseek/deepseek-flash`, `ollama/local` |
| Cloud cheap | `deepseek/deepseek-flash` | `ollama/local` |
| Local | `ollama/local` | none (never cloud) |

For confidential mode, the local key has no cloud fallback. If Ollama is down, stop; do not silently go cloud.

---

## 7. Cache

Use Bifrost's cache for **deterministic sub-calls**, not whole agent turns:

| Sub-call | Cache key |
|---|---|
| File summary | `sha256(prompt_version + file_content)` |
| Test failure triage | `sha256(prompt_version + test_output)` |
| Commit message | `sha256(prompt_version + diff)` |
| Diff review | `sha256(prompt_version + diff + checklist)` |

- Prefer **exact/hash mode** (`dimension: 1`) for code-related calls. Semantic cache can return plausible but wrong code advice.
- Send `x-bf-cache-key`.
- Report cache hits in the flight recorder and benchmark.
- Do not cache tool-call responses that would execute side effects.
- Prompt cache is separate from exact cache: keep the prefix stable, cap tool output before compaction, and assume compaction may invalidate the cache. Measure the net cost.

---

## 8. Logs and evidence

- Bifrost logs every request with provider, model, tokens, cost, latency, status, and metadata.
- Gidorah tags requests with `x-bf-session-id` (run/task id) so the benchmark can group them.
- Query `GET /api/logs` with time range, providers, models, status, and metadata filters.
- The benchmark report uses Bifrost stats/total cost, not local estimates.
- The TUI flight recorder uses live response headers for immediate display and Bifrost logs for the final receipt.

**Privacy:** In confidential mode, disable content logging in Bifrost for the local key or globally via `disable_content_logging`. Metadata-only logs are acceptable; no code content.

---

## 9. Bifrost plugin (open-source contribution)

A small Go plugin, Apache-2.0, upstreamable. It turns Bifrost from a router into a **security enforcement plane**.

### `PreLLMHook` — confidential guard
- Read `x-gidorah-confidential: true`.
- If the target provider is not local (`ollama`), reject the attempt with a structured error.
- Defense-in-depth even if a virtual key is misconfigured.

### `PreLLMHook` — DLP / secret scan
- Inspect the serialized request body for:
  - cloud API keys (`sk-`, `AKIA`, `AIza`, `ghp_`, `xoxb-`, etc.);
  - private key blocks (`-----BEGIN ... PRIVATE KEY-----`);
  - `.env`-style assignments with high-entropy values;
  - bearer tokens and JWTs;
  - configurable customer-specific patterns.
- Action: **block** by default; optional redact-and-forward for non-confidential sessions.
- Never log the secret; log only the pattern class, a hash, and the action.
- Fail closed if the scanner errors.

### `HTTPTransportResponseHeadersHook`
- Add `x-gidorah-policy: confidential-local-only` and `x-gidorah-policy-version`.
- Add `x-gidorah-dlp: blocked:<class>` or `x-gidorah-dlp: clean`.
- Add `x-gidorah-budget-state` if available from context (optional).

### Audit
- Emit a structured policy decision event (no prompt content) for the flight recorder export.
- Include policy version, rule id, action, provider, model, and timestamp.

### Why this matters
- It is a real, upstreamable Bifrost contribution, not a header decoration.
- It gives confidential mode a second independent enforcement layer.
- It protects cloud sessions from accidental secret leakage.
- It creates a compelling demo: a fake AWS key is blocked before it leaves the machine.

Keep the plugin small, tested, and documented. Include unit tests for each pattern and a false-positive corpus.

### 9.1 Advanced Bifrost surfaces (stretch)

**MCP Gateway + Code Mode.** Bifrost can aggregate MCP tools behind one endpoint and expose Code Mode to keep large tool results out of the model context. Maxim reports substantial token reduction; treat that as a hypothesis to measure, not a guarantee.

- Use it **only for read-only tools** (read, glob, grep, search, research) in the benchmark arm H.
- Writes, shell, and git stay native Gidorah tools so the approval gate and audit remain authoritative.
- Do not enable MCP auto-execute for mutating tools.
- If Code Mode bypasses the approval boundary or does not improve cost per solved task, document the negative result and keep the native tool loop.

**Enterprise guardrails.** Bifrost's paid tier offers PII redaction, prompt-injection detection, and external guardrail integrations. The hackathon build uses the OSS DLP/policy plugin; do not claim enterprise guardrails as implemented. If the event provides Enterprise access, use it as an additional layer, not a replacement for the local-only key.

**Bifrost CLI.** The Bifrost CLI can launch coding agents and manage virtual keys/usage. A `bifrost gidorah` launcher/profile is a stretch integration; it is an ecosystem contribution, not a core requirement.

---

## 10. Bifrost feature coverage

| Feature | Used? | Where |
|---|---|---|
| Multi-provider routing | Yes | DeepSeek + Ollama |
| Virtual keys | Yes | Per-user cloud/local keys |
| Budgets | Yes | Pre-request 402; 80/100% policy |
| Rate limits | Yes | 429/limit tests |
| Fallbacks | Yes | Cloud → cloud → local |
| Response headers | Yes | Takeover banner, trace |
| Routing rules (CEL) | Yes | Phase + budget |
| Model aliases | Yes | `gidorah-fast/strong/local` |
| Complexity router | Benchmark arm | Optional layer |
| Exact/semantic cache | Yes | Deterministic sub-calls |
| Logs / cost API | Yes | Flight recorder, benchmark |
| Plugin hooks | Yes | DLP + confidential guard + headers |
| Team/customer budgets | Stretch | Enterprise demo |
| MCP gateway + Code Mode | Stretch | Read-only arm H; no mutations |
| Enterprise guardrails | Not claimed | Paid tier; OSS plugin is our layer |
| Bifrost CLI | Stretch | `bifrost gidorah` profile |

---

## 11. Failure matrix

| Scenario | Expected |
|---|---|
| 429 from primary | Retry/backoff, then fallback; banner |
| 503 from primary | Fallback; banner |
| 401/403 from provider | No retry; fallback or fail with credential guidance |
| 402 budget | No retry; Gidorah switches to local or stops |
| All cloud providers fail | Local fallback if allowed; else structured error |
| Ollama down in confidential | Stop; never cloud |
| Bifrost unreachable | Stop; no direct provider path |
| Malformed routing headers | Treat as unknown; do not claim a takeover |
| Cache stale | TTL/invalidations; never cache code edits |
| DLP scanner error | Fail closed; block cloud request; local error event |
| DLP secret match | Block by default; redact only if configured; audit class/hash, not value |
| DLP false positive | User can inspect the matched class; config allowlist; never silently ignore |

---

## 12. Test matrix

- CT-01: 429 → fallback; banner; session continues.
- CT-02: 503 → fallback; banner; resume preserves notice.
- CT-03: all providers fail → structured error; no hang.
- CT-04: 80% budget → one warning.
- CT-05: 100% budget → 402 → local or stop.
- CT-06: concurrent sessions → no overspend.
- CT-07: confidential key rejects cloud model.
- CT-08: confidential plugin rejects cloud attempt even with a forged header.
- CT-09: no Tavily calls in confidential mode.
- CT-10: phase header routes to expected model (mock).
- CT-11: cache key hit returns cached response; hit reported.
- CT-12: Bifrost down → no direct provider call.
- CT-25: DLP blocks a fake AWS key before cloud egress.
- CT-26: DLP blocks a private-key block; no secret in logs.
- CT-27: DLP false-positive corpus passes; allowlist works.
- CT-28: confidential header + cloud provider → plugin rejects even with a valid cloud key.
- CT-33: chaos kill Bifrost/Ollama/network → documented behavior; no silent cloud fallback.

---

## 13. Open items

- [ ] Pin the Bifrost version and record it.
- [ ] Verify virtual-key budget API shape and 402 body against the pinned version.
- [ ] Verify CEL variable names (`budget_used`, `headers`) and rule precedence.
- [ ] Confirm response headers are available on streaming responses in the chosen SDK.
- [ ] Confirm `x-bf-session-id` grouping/filtering in `/api/logs`.
- [ ] Decide whether to enable `disable_content_logging` globally or per key.
- [ ] Decide Bifrost deployment: `npx`, Docker, or binary for the demo machine.
- [ ] Confirm model alias syntax and whether aliases participate in fallback chains.
- [ ] Confirm DLP hook can read the serialized request body without buffering/breaking streaming.
- [ ] Confirm team/customer budget API shape for the stretch demo.
- [ ] Investigate `bifrost gidorah` launcher integration and upstream feasibility.
- [ ] Decide DLP default: block vs redact; document the user override.
- [ ] Spike MCP Gateway + Code Mode for read-only tools; confirm approval boundary and token savings.
- [ ] Verify whether Enterprise guardrails are available for the event; do not claim them otherwise.
