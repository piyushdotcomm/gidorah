# CLI Contract

**Status:** Draft · **Owner:** UX / Engineering · **Last updated:** 2026-11-03

The CLI is the product surface. This contract defines commands, flags, exit codes, output streams, and cross-platform behavior. It follows the `cli-developer` skill: help/version, TTY-aware color, SIGINT, non-interactive mode, stdout/stderr separation, shell completions, and a startup target.

---

## 1. Command tree

```text
gidorah
├─ run [task...]              # one task; interactive by default
├─ resume [session]           # resume a session (picker if omitted)
├─ doctor                     # check Bifrost, Ollama, Tavily, keys, policy, disk
├─ budget                     # show LLM + research budget
├─ trace [--last|--session]   # flight recorder
├─ receipt [--last]           # task receipt
├─ audit verify|export        # hash-chain verify / redacted evidence bundle
├─ redteam [--suite]          # injection + canary exfiltration suite
├─ demo [--replay]            # deterministic demo
├─ bench [--pilot|--full]     # benchmark
├─ conformance                # CT-01..CT-40
├─ chaos [--mode]             # dependency-kill tests
├─ policy validate <file>     # validate policy YAML
├─ config show|path           # redacted config
├─ version                    # also --version
└─ help                       # also --help
```

Global flags:

| Flag | Behavior |
|---|---|
| `--json` | Machine-readable JSON on stdout; no prompts; logs to stderr |
| `--plain` | No ANSI, no full-screen TUI; line-based renderer |
| `--no-color` | Disable color (also honors `NO_COLOR`) |
| `--user <id>` | Select the per-user policy/budget profile |
| `--task-budget <usd>` | Per-task cap; stop or ask at the cap |
| `--yes` | Auto-approve only in a documented sandbox/benchmark mode |
| `--config <path>` | Config file override |
| `--policy <path>` | Policy file override (never repo-local) |
| `--verbose` | Debug logs to stderr |
| `--version` | Print version and exit 0 |

---

## 2. Output streams

- **stdout:** task result, JSON, receipts, trace tables, benchmark summaries.
- **stderr:** progress, logs, warnings, spinners, prompts.
- **TTY detection:** color/spinner only when `stdout.isTTY` (and `NO_COLOR` unset).
- **Piped output:** no ANSI, no interactive prompts, no spinner.
- **`--json`:** one JSON object or JSONL stream; no human text on stdout.
- **Exit code:** always set; scripts must not parse prose.

---

## 3. Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Task ran but failed (tests failing, patch incomplete) |
| 2 | Usage/config error |
| 3 | Policy denial (confidential/Tavily/network) |
| 4 | Budget exhausted (LLM or research) |
| 5 | Provider/gateway error (all fallbacks failed) |
| 6 | Internal error |
| 130 | Interrupted by SIGINT |

---

## 4. Interactive behavior

- `Ctrl+C` cancels the active model/tool call; a second `Ctrl+C` exits with 130.
- Approval prompt: `allow once`, `deny`, `details`; never a blanket approve by default.
- `--yes` is only valid with `--sandbox` or the benchmark policy; otherwise it errors.
- No prompts when stdin is not a TTY unless `--yes` is set for a sandbox.
- Startup target: <150 ms cold, <50 ms warm; lazy-load the TUI, SQLite, and SDKs.

---

## 5. Shell completions

Generate for bash, zsh, and fish:

```bash
gidorah completion bash
gidorah completion zsh
gidorah completion fish
```

Document installation in the README. Completions are generated from the command tree and kept in sync by a test.

---

## 6. JSON shapes

### Task result

```json
{
  "sessionId": "ses_...",
  "taskId": "task_...",
  "status": "success|failed|denied|budget_exhausted|provider_error",
  "summary": "...",
  "receipt": {
    "tokens": { "input": 0, "cacheRead": 0, "cacheWrite": 0, "output": 0, "total": 0 },
    "llmCostUsd": 0,
    "researchCredits": 0,
    "fallbacks": 0,
    "budgetRemaining": { "llmUsd": 0, "researchCredits": 0 }
  },
  "tracePath": "..."
}
```

### Trace record

See `docs/01-architecture/data-and-events.md` for the full `TraceRecord` shape.

### Error

```json
{ "code": "BUDGET_EXCEEDED", "message": "...", "retryable": false, "requestId": "..." }
```

### Audit export

`gidorah audit export --format json` returns a redacted bundle:

```json
{
  "sessionId": "ses_...",
  "chain": { "valid": true, "head": "sha256:...", "anchor": "audit-anchor.log:42" },
  "policyVersion": "1",
  "routes": [],
  "approvals": [],
  "research": [],
  "dlp": [],
  "budget": [],
  "tests": { "passed": true, "patchHash": "..." }
}
```

No prompt text, secrets, or absolute home paths by default.

---

## 7. `doctor`

Checks:

- Node version and platform.
- Bifrost reachable and version.
- Ollama reachable and model present.
- Tavily key present (no live call by default).
- Policy valid and classification of cwd.
- Virtual keys present (names only).
- Disk space for sessions/artifacts.
- No direct provider keys in the environment for the agent.

Output is a table by default and JSON with `--json`.

---

## 8. Cross-platform

- Windows Terminal, macOS Terminal/iTerm2, Linux GNOME Terminal.
- Paths use `os.homedir()`; no hardcoded separators.
- `SIGINT` handled on all platforms; Windows uses `readline`/`AbortController`.
- No interactive prompts in CI; `--plain --json` is the CI contract.
- Shell completions documented per platform.

---

## 9. Acceptance criteria

- [ ] `gidorah --help` and `gidorah --version` exit 0.
- [ ] `--json` writes only JSON to stdout.
- [ ] `--plain` produces no ANSI.
- [ ] Piped stdin never prompts.
- [ ] SIGINT exits 130 and cancels the active call.
- [ ] Shell completions generate and are tested.
- [ ] `doctor` works with missing dependencies and gives actionable errors.
- [ ] `audit verify` exits 0 valid, 3 tampered.
- [ ] `audit export` contains no secrets/prompts by default.
- [ ] `redteam` runs offline and reports canary egress 0.
- [ ] Startup measured on Windows/Linux; target documented.
