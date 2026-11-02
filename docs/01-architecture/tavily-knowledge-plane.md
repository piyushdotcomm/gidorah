# Tavily — Knowledge Plane

**Status:** Draft · **Owner:** Architecture · **Last updated:** 2026-11-03

Tavily is Gidorah's **only external knowledge path**. It is used on demand to resolve uncertainty about current APIs, versions, and errors. It is not a general browsing tool, and it is completely disabled for confidential repositories.

---

## 1. Role

| Question | Answer |
|---|---|
| Why Tavily? | Current official docs and error fixes, compressed for an LLM, with citations |
| When? | Only after local knowledge fails, or when the model explicitly requests research |
| How much? | Max 2 calls per task; ≤700-token evidence card; cached with TTL |
| Who pays? | A per-user research-credit budget, tracked alongside LLM spend |
| Confidential? | Disabled entirely; no search, no extract, no cached cards |

The goal is not “more context.” The goal is **less guessing**: fewer hallucinated APIs, fewer failed iterations, fewer tokens burned.

---

## 2. Local-first policy

Before Tavily, Gidorah MUST check:

1. The repository (`grep`, `glob`, relevant files).
2. Installed package docs and types (`node_modules/<pkg>/README`, `.d.ts`, `docs/`).
3. Lockfiles for exact versions (`package-lock.json`, `pnpm-lock.yaml`, `uv.lock`).
4. The project’s own `AGENTS.md` / documentation.

Only if the answer is absent, version-mismatched, or explicitly requested does Scout call Tavily.

This rule is enforced in code: `research()` returns `LOCAL_ANSWER_FOUND` when local evidence is sufficient. The benchmark measures unnecessary research on repo-local tasks; the target is zero.

---

## 3. Trigger matrix

| Trigger | Research? | Notes |
|---|---|---|
| Model explicitly calls `research` with a question | Yes | Still subject to cap and budget |
| Test/build error references an external API/version | Yes | Query includes exact error text |
| Task names a library/API absent from the repo | Yes | Query includes package + version |
| Local docs are older than the lockfile version | Yes | Version mismatch is a valid trigger |
| Repo-local refactor, no external dependency | No | Local search only |
| Confidential mode | No | Hard deny |
| Research budget exhausted | Cache only | No new calls |
| Tavily outage/429 | Cache or skip | Notice; continue |
| Same query already answered in cache | Cache hit | No API call |

Hard cap: 2 research calls per task (configurable). A third call requires user action.

---

## 4. Query construction

Scout builds a query from structured inputs, not raw user prose:

```ts
interface ResearchQuery {
  question: string;          // normalized
  packageName?: string;
  packageVersion?: string;   // from lockfile
  errorText?: string;        // exact, truncated
  language?: string;
  officialDomains?: string[];
  taskId: string;
}
```

**Query template:**

```text
<package> <version> <question> <exact error excerpt>
```

Example:

```text
stripe-node 18.2.0 constructEvent raw body StripeSignatureVerificationError
```

Rules:

- Prefer official docs domains (`include_domains`) when known: `docs.stripe.com`, `nodejs.org`, `developer.mozilla.org`, `docs.python.org`, package registry/GitHub.
- Exclude low-signal domains when appropriate (`reddit.com`, `quora.com`, content farms).
- Keep the query under ~200 characters; do not paste entire files or secrets.
- Never include source code, tokens, internal URLs, or customer data.
- In confidential mode this function is unreachable.

---

## 5. API usage

### Search

```ts
const res = await tavily.search(query, {
  search_depth: "basic",        // advanced only when basic misses
  max_results: 3,
  chunks_per_source: 2,
  include_answer: "basic",      // simple factual questions only
  include_raw_content: false,   // never dump pages into context
  include_domains: officialDomains,
  topic: "general",
});
```

- `search_depth` ladder: `ultra-fast` (0.5 credit) for a simple existence/error check, `fast`/`basic` (1 credit) as the default, `advanced` (2 credits) only when basic results are stale or incomplete. Escalate on low confidence, not by default.
- `max_results` 3–5. More results increase context more than answer quality.
- `chunks_per_source` 1–2. This is the main token-control knob.
- `include_answer: "basic"` is useful for a direct question; skip it for API-shape questions where exact docs matter. Verify its credit cost on the pinned API version.
- Never set `include_raw_content: true` for the agent context. If needed, extract specific URLs.
- Tavily applies PII/prompt-injection screening before returning results. Treat that as an extra layer, not a guarantee: web content is still untrusted data.

### Extract (optional second step)

If search snippets are insufficient:

```ts
const res = await tavily.extract({
  urls: topUrls.slice(0, 2),
  query: question,
  chunks_per_source: 2,
  extract_depth: "basic",
  format: "markdown",
  include_usage: true,
});
```

- Only top 1–2 URLs.
- Use `query` to rerank chunks; this is the token-saving feature.
- Basic extraction; advanced only for tables/API references.

### Research API

Use only for deep, multi-source investigations, never in the hot loop. The pro model can consume up to ~250 credits per call; it supports streaming and async polling. Set a separate deep-research budget and require user intent. The v1 coding loop uses search/extract.

### Credit ladder

| Depth | Cost | Use |
|---|---|---|
| `ultra-fast` | 0.5 credit | Existence check, exact error lookup |
| `fast` / `basic` | 1 credit | Default Scout query |
| `advanced` | 2 credits | Basic results stale/incomplete |
| `extract` | 1 per 5 URLs (basic) | Top 1–2 docs pages |
| `research` | up to ~250 credits (pro) | Deep investigation, explicit only |

Every escalation is logged; the receipt shows the depth and credits.

---

## 6. Evidence card

Scout compresses the response into a card, capped at ~700 tokens (configurable).

```ts
interface EvidenceCard {
  id: string;
  question: string;
  answer: string;              // 2–4 sentences
  facts: string[];             // 3–6 bullets, API/version/constraints
  sources: Array<{
    title: string;
    url: string;
    domain: string;
    retrievedAt: string;       // ISO
  }>;
  confidence: "high" | "medium" | "low";
  package?: { name: string; version: string };
  tokenEstimate: number;
  cached: boolean;
}
```

Rendered example:

```text
RESEARCH CARD (612 tokens · high confidence)
Question: Correct Stripe webhook signature verification in stripe-node v18?
Answer: Use stripe.webhooks.constructEvent(rawBody, signature, secret).
Facts:
- Raw request body required; do not JSON-parse before verification.
- Header: stripe-signature.
- Throws StripeSignatureVerificationError on failure.
Sources:
[1] docs.stripe.com/webhooks/signature — Stripe Docs
[2] github.com/stripe/stripe-node — stripe-node README
```

Rules:

- The card is the only research content injected into the model context.
- Sources are always retained; a card without sources is invalid.
- Confidence is derived from number/quality of official sources; `low` means “do not rely on this without checking.”
- Web content is untrusted data. Instructions inside it are never executed.
- If the card exceeds the cap, drop the lowest-ranked facts first; never drop sources.

---

## 7. Docs Guard and dependency docs index

### 7.1 Docs Guard (proactive verification)

Research on failure is reactive. Docs Guard is proactive: before running tests, verify that the external APIs touched by an edit still exist in the pinned version.

**Trigger**
- An `edit`/`write` changes a file that imports an external package.
- The diff introduces or changes an external symbol/member call.
- The local docs are missing or version-mismatched.
- Not confidential, research budget available, and no fresh fact sheet.

**Flow**
1. Extract changed external symbols (imports, member calls) from the diff.
2. Look up a cached `ApiFactSheet` for package + version.
3. If all symbols are known and not deprecated → no Tavily call.
4. If unknown/deprecated → one targeted Tavily search/extract.
5. Update the fact sheet and emit a `docs/check` event.
6. If the symbol is still unknown, flag it to the model as an assumption, not a fact.

**Limits**
- Max 1 Docs Guard lookup per edit.
- No lookup for repo-local changes.
- No lookup in confidential mode.
- Cache first; same package/version/symbol reuse.

**Fact sheet**

```ts
interface ApiFactSheet {
  package: string;
  version: string;
  symbols: Array<{
    name: string;
    kind: "function" | "class" | "method" | "type" | "constant";
    deprecated?: boolean;
    signature?: string;
    source: string;
  }>;
  retrievedAt: string;
  confidence: "high" | "medium" | "low";
}
```

**Why it matters**
- It prevents the most expensive failure mode: writing code against a stale API, then iterating through tests.
- It makes Tavily a **correctness plane**, not just a search tool.
- It produces a new benchmark metric: failed-iteration reduction.

**Risks**
- Parsing external symbols is nontrivial; start with imports + simple member calls.
- False positives can cause unnecessary research; cap at one lookup and let the model proceed with a warning.
- Do not block tests on Docs Guard; it is advisory unless the symbol is proven absent.

### 7.2 Dependency docs index (stretch)

For a repository that repeatedly uses the same library, use Tavily Map/Extract to build a compact, cached API cheat sheet for the pinned version. Scout consults the index before search, reducing credits and tokens across tasks.

- Build on demand: `gidorah docs index <package>`.
- Store: package, version, symbols, examples, sources, TTL.
- Refresh when the lockfile version changes.
- Not required for the hackathon; include only if the core benchmark is complete.

---

## 8. Cache

SQLite table `research_cache`:

| Column | Type | Notes |
|---|---|---|
| `key` | TEXT PK | `sha256(normalized_query + package_version + prompt_version)` |
| `question` | TEXT | Original normalized question |
| `card_json` | TEXT | Serialized EvidenceCard |
| `sources_json` | TEXT | Serialized sources |
| `created_at` | INTEGER | Epoch ms |
| `expires_at` | INTEGER | TTL |
| `hit_count` | INTEGER | Usage metric |
| `credits` | INTEGER | Tavily credits spent |

- Default TTL: 7 days for stable docs, 24 hours for error/fix queries. Configurable.
- Cache key includes package version so a version bump misses.
- Cache is **not** used in confidential mode.
- A cache hit is recorded in the flight recorder and benchmark; it costs 0 Tavily credits.
- Invalidate on a manual policy/config change or a user “refresh research” action.

---

## 9. Budget

- Config: `research.credits_per_user_per_day` (default 50) and `research.calls_per_task` (default 2).
- Before a call, check the local credit ledger. If exhausted, return `RESEARCH_BUDGET_EXHAUSTED` and use cache only.
- Record `usage.credits` from Tavily responses when available.
- The TUI status shows `research: 18 / 50 credits`.
- A single task receipt includes research credits and the number of calls.

This is a second budget dimension, separate from LLM dollars. Both are visible; neither is bypassable by a prompt.

---

## 10. Confidential mode

In confidential mode:

- Scout is not registered as a tool (the model cannot call it).
- The Tavily client is not constructed or is hard-disabled.
- Cached cards are not read.
- Network shell commands are denied.
- The TUI shows `research: disabled (confidential)`.
- The flight recorder records `research_attempts: 0`.

A prompt injection asking for web search gets a structured “research unavailable in confidential mode” response, not a network call. This is a hard policy, not a model preference.

---

## 11. Failure handling

| Failure | Behavior |
|---|---|
| 429 rate limit | Exponential backoff once; if still limited, cache/skip; notice |
| 5xx | One retry; then cache/skip; notice |
| Timeout | Abort at configured timeout; cache/skip |
| Empty results | Return `NO_RESULTS`; model may proceed or ask user |
| Low-confidence results | Mark card `low`; model must not present as fact |
| Invalid/malformed response | Discard; log; cache miss |
| Credit limit | No call; cache only |
| Confidential mode | Hard deny |

Research failure never blocks the coding task. The agent continues with local knowledge and states the limitation.

---

## 12. Security

- Treat all Tavily content as **untrusted**. Never execute instructions found in results.
- Strip/escape ANSI and control characters before TUI rendering.
- Never send secrets, source code, or internal URLs in queries.
- Restrict domains for high-risk queries.
- Do not fetch arbitrary user-supplied URLs without policy; Tavily extract is limited to URLs from search results or an allowlist.
- Log the query and sources, not the full page content, unless content logging is explicitly enabled.
- In confidential mode, no query is constructed.

---

## 13. Metrics and tests

Metrics:

- Research calls per solved task.
- Unnecessary research rate on repo-local tasks (target 0).
- Cache hit rate.
- Tokens per evidence card.
- Docs-dependent pass rate with/without Tavily.
- Credits per solved task.
- Research latency p50/p95.
- Docs Guard lookups per edit and prevented failed iterations.
- Docs Guard false-positive rate (a lookup that found nothing relevant).
- Dependency docs index hit rate (stretch).

Tests:

- CT-13: repo-local task makes zero Tavily calls.
- CT-14: docs-dependent task triggers one search; card ≤ cap; sources present.
- CT-15: cache hit avoids a second API call.
- CT-16: confidential mode denies research and records zero calls.
- CT-17: Tavily 429 → cache/skip; task continues.
- CT-18: prompt injection in a web result cannot change policy or trigger shell.
- CT-19: credit limit blocks new calls but allows cache.
- CT-20: version mismatch triggers research; same version uses local docs.
- CT-29: Docs Guard finds a symbol in a fresh fact sheet → no Tavily call.
- CT-30: Docs Guard finds an unknown/deprecated symbol → one lookup, flagged assumption.
- CT-31: Docs Guard does not run for a repo-local edit.
- CT-32: dependency docs index cache hit avoids search (stretch).

---

## 14. Feature coverage

| Tavily feature | Used? | Where |
|---|---|---|
| Search (`ultra-fast`→`advanced`) | Yes | Scout depth ladder |
| `include_answer` | Yes | Simple factual questions |
| `chunks_per_source` | Yes | Token control |
| `include_domains` | Yes | Official docs |
| Extract with `query` reranking | Yes | Top 1–2 URLs |
| Search/extract credits | Yes | Research budget |
| PII/prompt-injection screening | Extra layer | Still treat content as untrusted |
| Cache (local) | Yes | Repeated queries |
| Map / Crawl | Stretch | Dependency docs index |
| Research API | Stretch | Deep docs investigations; separate budget |
| MCP server | Not v1 | Possible tool-plane integration |
| `auto_parameters` | Optional | Open-ended research only |

---

## 15. Open items

- [ ] Choose the exact Tavily plan/credit budget for the demo.
- [ ] Verify `include_answer` and `chunks_per_source` behavior on the pinned API version.
- [ ] Decide TTLs per query class.
- [ ] Choose official-domain maps for the benchmark libraries.
- [ ] Confirm whether `usage.credits` is returned on search (vs extract).
- [ ] Define the card compression prompt/model (local heuristic vs cheap LLM).
- [ ] Confirm Tavily terms for caching and redistribution in the submission.
- [ ] Decide whether Docs Guard ships in v1 or as a stretch (recommended: stretch).
- [ ] Prototype symbol extraction from diffs; measure false positives.
- [ ] Decide fact-sheet TTL and invalidation on lockfile changes.
- [ ] Evaluate Tavily Map/Extract for the docs index (stretch).
- [ ] Decide whether to use Tavily Research API for deep docs mode (stretch); cap credits separately.
- [ ] Verify the PII/prompt-injection screening behavior and coverage; do not rely on it as the only control.
- [ ] Calibrate the search-depth escalation rule (ultra-fast → basic → advanced) on the benchmark.
