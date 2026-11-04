# TUI Adaptation

**Status:** Draft · **Owner:** Frontend / Engineering · **Last updated:** 2026-11-03

Gidorah will reuse the visual shell of the DeepSeek Harness TUI rather than build a terminal UI from scratch. The goal is a polished, familiar coding-agent experience with Gidorah's dual-plane panels added.

---

## 1. Source and license

| Item | Value |
|---|---|
| Source repo | `peiyuwang54/deepseek-harness-cli` (community DSH CLI) |
| Package | `packages/ui/tui` (`@deepseek-ai/dsh-tui`) |
| License | **MIT AND BSD-3-Clause** |
| UI framework | `@earendil-works/pi-tui` `0.80.7` |
| Runtime | TypeScript / Node |
| Copyright | DeepSeek (see package `LICENSE`) |

**Obligations**

- Include the full `LICENSE` text for the TUI package in `third_party/dsh-tui.LICENSE`.
- Include a `NOTICE` file with the source repo, package, copyright, and modifications.
- Mark modified files clearly in the README/NOTICE.
- Do not use the DeepSeek name or logo as Gidorah's product identity.
- Keep the SPDX expression `MIT AND BSD-3-Clause` for the adapted package until/unless the reused portions are fully replaced.

See [licensing and attribution](../06-legal/licensing-and-attribution.md).

---

## 2. What we copy

### Keep (high value)

| Area | Files / components | Why |
|---|---|---|
| Transcript | `components/transcript.ts`, `transcript-viewport.ts` | Message cards, scrollback, streaming |
| Markdown/code | transcript renderers | Headings, lists, tables, code fences |
| Diff cards | `chat/git-diff.ts`, diff renderers | Write/edit approval previews |
| Approval modal | `chat/approvals.ts` | Human gate UX |
| Composer | `prompt.ts`, autocomplete | Multiline input, `@` file completion |
| Status line | footer/status components | Model, tokens, context |
| Theme | `components/theme.ts` | Terminal-safe palette |
| Questions | `chat/questions.ts` | Structured user questions |
| Session resume UI | `chat/resume.ts` | Session picker (adapted) |
| Export/copy | `chat/transcript-export.ts` | Markdown export |

### Remove / replace (DSH-specific)

| Area | Action |
|---|---|
| Cordis dependency injection | Remove; Gidorah uses a plain service container |
| DSH agent/session/LLM services | Replace with Gidorah runtime and Bifrost client |
| Agent presets, skills, subagents, MCP, hooks | Remove from v1 |
| Web/desktop handoff | Remove |
| DSH settings/credentials/workspace services | Replace with Gidorah config/policy |
| Model picker over DSH routes | Replace with Bifrost route display (read-only) |
| Goal/plan/memory commands | Remove unless needed for the demo |
| Plugin overlays and extension API | Remove |
| `/fork`, `/rewind`, `/side`, `/btw` | Remove in v1 |
| Telemetry/feedback | Remove or opt-in only |

---

## 3. Adaptation architecture

```text
Gidorah core ── EventBus ──► TUI adapter ──► pi-tui components
     │                         │
     ├─ session events         ├─ message view model
     ├─ tool events            ├─ tool card view model
     ├─ approval requests      ├─ approval modal state
     ├─ route changes          ├─ status/banner view model
     ├─ budget updates         ├─ budget panel
     └─ research results       ├─ evidence card
                               └─ flight recorder table
```

- The TUI never calls Bifrost/Tavily directly.
- The adapter maps Gidorah events to view models; it does not read the session file.
- All untrusted text passes through the TUI's ANSI/control escaper.
- The TUI is a renderer; the benchmark and headless mode use the same event stream without it.

### View model contracts

```ts
type TuiEvent =
  | { type: "assistant_delta"; text: string }
  | { type: "assistant_done"; messageId: string }
  | { type: "tool_call"; callId: string; name: string; args: unknown }
  | { type: "tool_result"; callId: string; ok: boolean; summary: string; artifact?: string }
  | { type: "approval_request"; approvalId: string; tool: string; risk: string; preview: ApprovalPreview }
  | { type: "approval_decision"; approvalId: string; decision: "allow" | "deny" }
  | { type: "route_changed"; from: string; to: string; reason: string; fallbackIndex?: number }
  | { type: "budget_updated"; llmUsd: number; llmLimit: number; researchCredits: number; researchLimit: number; taskUsd?: number; taskCap?: number }
  | { type: "research_card"; card: EvidenceCard }
  | { type: "dlp_blocked"; class: string; action: "blocked" | "redacted" }
  | { type: "docs_check"; result: "verified" | "unknown" | "deprecated" | "skipped"; symbols?: string[] }
  | { type: "notice"; level: "info" | "warn" | "error"; text: string }
  | { type: "turn_done"; receipt: TaskReceipt };
```

---

## 4. Screens and panels

### Main view

```text
┌ Gidorah ────────────────────────────────────────────────┐
│ mode: cloud   route: gidorah-strong   budget: $0.01/$0.50 │
│ task: $0.01/$0.10   research: 2/50   dlp: clean           │
│ cache: 87%   context: 42%   compaction: off               │
├─────────────────────────────────────────────────────────┤
│ transcript                                              │
│  > user message                                         │
│  • assistant markdown                                   │
│  ⚙ tool card (read/grep/bash/diff)                      │
│  ⌕ research card (sources, confidence)                  │
│  ⛨ docs guard: verified 3 symbols                       │
├─────────────────────────────────────────────────────────┤
│ composer                                                │
│ status: tokens · context · research credits              │
└─────────────────────────────────────────────────────────┘
```

### Required panels

1. **Status bar** — mode (cloud/local/confidential), route alias, budget, task cap, research credits, DLP state, cache hit, context pressure, compaction state.
2. **Transcript** — streaming markdown, tool cards, diff cards, notices.
3. **Approval modal** — exact command/diff, risk class, allow/deny, audit note.
4. **Takeover banner** — from → to, reason, fallback index; persistent.
5. **Research card** — answer, facts, sources, confidence, cached flag.
6. **Docs Guard badge** — verified/unknown/deprecated, symbols checked.
7. **DLP block notice** — class and action, never the secret.
8. **Flight recorder** — table of calls with tokens/cost/fallback/cache; `gidorah trace`.
9. **Receipt** — end-of-task summary.

### Color semantics

| State | Color | Meaning |
|---|---|---|
| Local / confidential | green | No external egress |
| Cloud / normal | blue/neutral | Cloud model |
| Budget warning | amber | ≥80% |
| Budget exhausted / policy block | red | Denied or stopped |
| Research | cyan | Tavily evidence |
| Fallback | amber | Model changed |
| DLP block | red | Secret blocked before egress |
| Docs Guard | green/amber | Verified vs unknown/deprecated |

No color-only status; include text labels.

---

## 5. Commands (v1)

| Command | Behavior |
|---|---|
| `/help` | Show commands |
| `/mode` | Show cloud/local/confidential (read-only unless policy allows) |
| `/budget` | LLM and research budget |
| `/trace` | Flight recorder for current/last task |
| `/research <question>` | Explicit Scout request (if allowed) |
| `/approve <id>` | Approve a pending request |
| `/deny <id>` | Deny a pending request |
| `/resume` | Session picker |
| `/replay` | Replay the last task offline (if traces exist) |
| `/export` | Markdown/JSON export |
| `/clear` | New session |
| `/quit` | Exit |

Do not clone the entire DSH command surface. Keep it small and testable.

---

## 6. Adaptation phases

| Phase | Work | Exit criteria |
|---|---|---|
| A0 — Vendor | Copy package, LICENSE, NOTICE; pin pi-tui; build in isolation | `pnpm build` succeeds; license check passes |
| A1 — Stub | Replace DSH services with Gidorah stubs; render a static transcript | App launches, no DSH imports remain |
| A2 — Wire | Connect EventBus; streaming, tool cards, approvals | A real task renders end-to-end |
| A3 — Panels | Add status, budget, research, takeover, trace, DLP, Docs Guard | All required panels visible |
| A4 — Polish | Theme, keyboard, resize, Windows, `--plain` | Demo passes 3×; plain mode works |
| A5 — Trim | Remove unused DSH commands/components | Bundle size and dependency surface reduced |

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| TUI is tightly coupled to DSH services | High adaptation cost | Stub/adapter layer; phase A1 gate; timebox |
| `pi-tui` version/API drift | Build breakage | Pin exact version; vendor if necessary |
| Windows terminal behavior | Demo failure | Test Windows Terminal early; provide `--plain` |
| License obligations | Submission issue | LICENSE + NOTICE + SPDX; legal review |
| Copying too much | Maintenance burden, audit surface | Trim aggressively after A3 |
| ANSI injection from model/web | Terminal compromise | Escape all untrusted text; test corpus |
| TUI consumes engineering time | Delays core | TUI work starts only after M2 agent spine |

---

## 8. Acceptance criteria

- [ ] App launches on Windows Terminal, macOS, and Linux (best effort).
- [ ] Streaming markdown, tool cards, and diff cards render correctly.
- [ ] Approval modal shows exact command/diff and blocks execution until decision.
- [ ] Takeover banner persists in the transcript.
- [ ] Status bar shows mode, route, budget, research credits, cache hit, context pressure, compaction state.
- [ ] Research card shows sources and confidence.
- [ ] DLP block notice shows class/action, never the secret.
- [ ] Docs Guard badge shows verified/unknown/deprecated.
- [ ] `gidorah trace` table is readable and exportable.
- [ ] `--plain` mode works for CI/benchmark.
- [ ] `/replay` reproduces the last task offline.
- [ ] No DSH service/Cordis imports remain in the adapted package.
- [ ] LICENSE/NOTICE/SPDX complete.
