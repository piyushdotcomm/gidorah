# Development and Testing

**Status:** Draft · **Owner:** Engineering · **Last updated:** 2026-11-03

---

## 1. Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 22 LTS or 24 LTS | Runtime |
| pnpm | 9+ via corepack | Workspace |
| Git | 2.40+ | Tools, worktrees |
| Bifrost | Pinned release | Model gateway |
| Ollama | Latest stable | Local model |
| Tavily API key | — | Research |
| DeepSeek API key | — | Cloud models via Bifrost |
| Windows Terminal / iTerm / GNOME Terminal | — | TUI |

Optional: Docker for Bifrost, `ripgrep` for fast search.

---

## 2. Local setup

```bash
corepack enable
pnpm install

# 1. Start Bifrost
npx -y @maximhq/bifrost
# or: docker run -p 8080:8080 -v $(pwd)/data:/app/data maximhq/bifrost

# 2. Start Ollama and pull a local model
ollama serve
ollama pull qwen2.5-coder:3b

# 3. Configure providers and virtual keys (Bifrost UI/API)
#    - deepseek flash/pro
#    - ollama local
#    - gidorah-<user>-cloud, gidorah-<user>-local

# 4. Environment
cp .env.example .env
# DEEPSEEK_API_KEY=...
# BIFROST_BASE_URL=http://127.0.0.1:8080/openai
# BIFROST_VK_CLOUD=...
# BIFROST_VK_LOCAL=...
# TAVILY_API_KEY=tvly-...
# OLLAMA_URL=http://127.0.0.1:11434

# 5. Run
pnpm gidorah
```

---

## 3. Environment variables

| Variable | Required | Secret | Notes |
|---|---|---|---|
| `DEEPSEEK_API_KEY` | For Bifrost provider | Yes | Stored in Bifrost, not Gidorah |
| `BIFROST_BASE_URL` | Yes | No | Default `http://127.0.0.1:8080/openai` |
| `BIFROST_VK_CLOUD` | Yes | Yes | Cloud virtual key |
| `BIFROST_VK_LOCAL` | Yes | Yes | Local-only virtual key |
| `TAVILY_API_KEY` | For research | Yes | Never logged |
| `OLLAMA_URL` | Local | No | Default `http://127.0.0.1:11434` |
| `GIDORAH_HOME` | No | No | Default `~/.gidorah` |
| `GIDORAH_USER` | No | No | Default OS user |
| `GIDORAH_LOG_LEVEL` | No | No | `info` default |

Secrets are read from env/keychain; `.env` is gitignored. `.env.example` contains names only.

---

## 4. Test strategy

### Pyramid

| Layer | Scope | Tools | Speed |
|---|---|---|---|
| Unit | Policy rules, shell parser, budget math, query builder, card compression, event serialization | Vitest | ms |
| Integration | Bifrost client (mock + real), Tavily client (mock), SQLite cache, session resume | Vitest + MSW/nock | seconds |
| E2E | CLI flows with mock provider: read/edit/approve/deny/resume | Vitest + temp repos | seconds |
| Conformance | Security and policy guarantees CT-01..CT-40 | Dedicated harness | minutes |
| Chaos | Kill Bifrost/Ollama/Tavily/network; verify guarantees | Process/network harness | minutes |
| Replay | Re-run recorded traces offline; same visible scenes | `gidorah demo --replay` | seconds |
| Benchmark | Real tasks, real models, 5 runs | `gidorah bench` | hours |

### Mock provider

A local OpenAI-compatible server used for deterministic tests:

- `/v1/chat/completions` returns scripted responses.
- Fault modes: 429, 503, timeout, malformed stream, budget 402.
- Can emulate fallback by responding only for a specific model.
- No API keys; no network.

This is required for the demo's failover scene and for CI.

### Fixtures

| Fixture | Purpose |
|---|---|
| `tests/fixtures/repo-auth` | Failing auth test; normal coding task |
| `tests/fixtures/repo-docs` | Docs-dependent task requiring Tavily |
| `tests/fixtures/repo-confidential` | Confidential classification + injection |
| `tests/fixtures/repo-budget` | Low-budget virtual key scenario |
| `tests/fixtures/policies/` | Valid/invalid policy files |
| `tests/fixtures/cards/` | Evidence card samples |

Fixtures must be small, deterministic, and free of secrets.

---

## 5. Conformance suite

| ID | Test | Pass condition |
|---|---|---|
| CT-01 | 429 from primary | Fallback serves; banner; session continues |
| CT-02 | 503 from primary | Fallback serves; banner; resume preserves |
| CT-03 | All providers fail | Structured error; no hang |
| CT-04 | 80% budget | One warning; amber status |
| CT-05 | 100% budget | 402 handled; local or stop |
| CT-06 | Concurrent budget race | No overspend |
| CT-07 | Confidential cloud request | Rejected by local key |
| CT-08 | Forged confidential header | Plugin rejects cloud attempt |
| CT-09 | Confidential Tavily/network | Zero calls; command denied |
| CT-10 | Approval bypass prompt | Write/shell still prompts |
| CT-11 | Approval denial | No execution; audited |
| CT-12 | Direct provider path | Dependency/network test finds none |
| CT-13 | Repo-local task | Zero Tavily calls |
| CT-14 | Docs-dependent task | One search; cited card; cap respected |
| CT-15 | Research cache | Second call is a hit; no credit spend |
| CT-16 | Research in confidential | Denied; zero calls |
| CT-17 | Tavily 429 | Cache/skip; task continues |
| CT-18 | Prompt injection in web result | No policy change/execution |
| CT-19 | Research credit limit | No new call; cache allowed |
| CT-20 | Version mismatch | Research triggered; same version uses local |
| CT-21 | ANSI injection | Escaped in TUI |
| CT-22 | Secret scan | No keys in logs/transcripts |
| CT-23 | Path escape | Write outside workspace denied |
| CT-24 | Git alias/`-c` | Forces ask; no auto-allow |
| CT-25 | DLP fake AWS key | Blocked before cloud egress; no secret logged |
| CT-26 | DLP private key block | Blocked; audit hash only |
| CT-27 | DLP false-positive corpus | Normal prompts pass; allowlist works |
| CT-28 | Confidential header + cloud key | Plugin rejects even with a valid cloud key |
| CT-29 | Docs Guard fact-sheet hit | No Tavily call; symbol verified |
| CT-30 | Docs Guard unknown symbol | One lookup; flagged as assumption |
| CT-31 | Docs Guard repo-local edit | No lookup |
| CT-32 | Docs index cache (stretch) | Second lookup is a hit |
| CT-33 | Chaos kill Bifrost/Ollama/Tavily/network | Documented behavior; no silent cloud fallback |
| CT-34 | Tool cap vs cache | Stable cap; prefix hash unchanged; no compaction below 90% |
| CT-35 | Audit chain verify | Valid chain verifies; exit 0 |
| CT-36 | Audit tamper detect | Edited/reordered event fails with first bad link |
| CT-37 | Canary egress | Zero canary occurrences in model/Tavily requests |
| CT-38 | Red-team corpus | 0 bypasses on the committed corpus |
| CT-39 | Audit export redaction | No secrets/prompts in default export |
| CT-40 | Audit anchor | Chain head appended at turn boundary; export includes it |

Conformance tests are part of CI and the demo (`gidorah conformance`).

### Chaos tests

- Kill Bifrost: agent stops with a clear error; no direct provider path.
- Kill Ollama in confidential mode: stop; never cloud.
- Kill Tavily: cache/skip; task continues.
- Drop network: confidential mode unaffected; cloud mode fails gracefully.
- Kill the process mid-turn: resume restores the session; no duplicate tool execution.
- Assert: no cloud call in confidential mode; no budget overspend; no secret in logs.

### Replay tests

- Record a demo run (events, Bifrost headers, Tavily cards, usage).
- `gidorah demo --replay` must reproduce the visible scenes and receipt with no network.
- Replay drift (schema/version change) fails the test rather than silently rendering a different story.

### CLI contract tests

- `--help`, `--version`, `--json`, `--plain`, `--no-color`.
- Piped stdin never prompts; stdout contains only machine output with `--json`.
- SIGINT exits 130 and cancels the active call.
- Shell completions generate for bash/zsh/fish.
- Cold/warm startup measured and reported.

---

## 6. CI pipeline

```text
lint -> typecheck -> unit -> integration (mocks) -> e2e (mock provider)
     -> conformance -> license check -> secret scan -> build
```

- No real API calls in CI except an optional nightly benchmark.
- Benchmark PRs require a recorded artifact and a report diff.
- License check: `license-checker` or `pnpm licenses`.
- Secret scan: gitleaks/trufflehog.
- Windows and Linux jobs for the CLI; macOS best effort.
- A Devcontainer/Docker profile can run Bifrost, Ollama, the mock provider, and fixtures for a reproducible benchmark.

### Reproducibility container

Provide `docker compose`/Devcontainer with:
- Bifrost on 8080.
- Ollama on 11434 with the pinned model.
- Mock provider on 9090.
- A pinned benchmark repo and task set.
- `gidorah bench --container` or documented commands.

This is optional for the live demo but strongly recommended for judges.

---

## 7. Definition of done (engineering)

- [ ] Unit/integration tests for new code.
- [ ] Conformance test for any policy/security change.
- [ ] Docs updated (requirements, event schema, policy field).
- [ ] No secrets, no `any` in public APIs.
- [ ] Lint/typecheck/test pass locally and in CI.
- [ ] License/NOTICE updated if a dependency or copied file changed.
- [ ] Benchmark impact considered for token-related changes.
