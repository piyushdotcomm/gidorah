# Native Gidorah TUI

Interactive terminal UI for coding sessions, built on **`@earendil-works/pi-tui`
0.80.7** (MIT, pinned in package-lock; license at `third_party/pi-tui.LICENSE`).
The framework owns differential rendering, the transcript viewport, the Editor
composer, focus-capturing overlays and the picker. The vendored DSH package is
**not** wired.

## Run

```bash
node apps/cli/src/main.ts tui          # interactive (TTY required)
node apps/cli/src/main.ts tui --demo   # deterministic offline demo, prints frames
node apps/cli/src/main.ts tui --plain  # line mode, works in pipes, no ANSI
node apps/cli/src/main.ts              # bare: TUI on a TTY, help otherwise
```

The interactive surface needs a TTY on both stdin and stdout. In non-TTY shells
(CI, pipes) `tui` falls back to plain mode; `--plain` is always ANSI-free.
Plain mode denies write/shell approvals explicitly because there is no approval
channel.

## Two renderers

The interactive TTY path is `pi-app.ts` + `pi-shell.ts` on pi-tui. The legacy
`app.ts`/`layout.ts` text renderer still serves `--plain`, the deterministic
`--demo` transcript, and the legacy tests; it is not the interactive surface.
`DEMO-pi.md` is generated from pi-tui components; `DEMO.md` is the legacy demo.

Keys on the pi path: Ctrl+O expands the latest tool card, Ctrl+E expands all
cards, Tab completes slash commands and workspace paths, Enter submits,
Shift+Enter inserts a newline (pi-tui Editor), arrows/history and paste are
handled by the Editor, PgUp/PgDn scroll the transcript, Ctrl+C cancels/exits,
Ctrl+D quits.

## Keys

| Key | Action |
|---|---|
| Enter | send the task (or select the highlighted `/resume` entry) |
| Shift+Enter / trailing `\` | newline (multiline input) |
| ↑ / ↓ | history (or move in the `/resume` picker) |
| ← / → / Home / End | move the cursor |
| Backspace / Delete | edit the input |
| Tab | slash-command or workspace path completion |
| Esc | clear input / cancel the picker / deny the approval |
| y / n | allow / deny the pending approval |
| Ctrl+C | cancel the running turn; again to exit (idle: first press warns) |
| Ctrl+D | exit |
| Ctrl+L | clear and redraw |
| Ctrl+O | expand/collapse the latest tool card |
| Ctrl+E | expand/collapse all tool cards |

## Slash commands

| Command | Behavior |
|---|---|
| `/help` | keys and commands |
| `/status` | session, cwd, mode, model, budget, receipts |
| `/model` | current alias and configured aliases; `/model <alias>` selects for the next turn |
| `/budget` | LLM budget snapshot |
| `/trace` | flight-recorder table for the last turn |
| `/receipt` | last turn receipt |
| `/new` | start a new session (transcript clears, budget resets) |
| `/resume` | session picker (↑/↓ + Enter, number keys, or `/resume <id>`) |
| `/quit` | exit |

`/resume` replays the last 200 session events into the transcript: user and
assistant messages, tool cards, approval requests/decisions (including denials),
takeover banners, Docs Guard, DLP, and errors. It never opens an empty screen.

## What the screen shows

- Header: `Gidorah`, cwd, git branch, session id, mode, selected model alias.
- Status: mode, served route/model, LLM budget, research credits, DLP, cache hit
  rate, context pressure, compaction state.
- Transcript: user task, streaming assistant text, tool cards (name, args,
  status, elapsed, capped output; expandable), research cards with confidence/
  tokens/sources, DLP and Docs Guard notices, takeover banner, receipt, errors.
- Approval panel: tool, risk, path, numbered red/green diff (edit), first 10
  lines (write), shell command with a read-only/network hint (bash); capped at 14
  diff lines with "... N more lines".
- Input composer with cursor and footer hints. Minimum width 40 columns;
  resize redraws.

## Behavior notes

- Streaming: when `onModelDelta` is set, the runtime uses `model.stream()` and
  forwards deltas; the final `assistant/message` reconciles the text. Without it,
  `model.complete()` is unchanged (benchmark behavior is untouched).
- Cancellation: Ctrl+C aborts the model stream and the signal is passed to
  `runProcess` for bash/git. If a tool does not honor the signal, the UI returns
  to idle when it finishes; a second Ctrl+C exits.
- Terminal safety: raw mode, cursor visibility, and the alternate screen are
  restored on quit, errors, SIGINT/SIGTERM/SIGHUP; pending redraw timers are
  cleared before restore.
- Security: all model/tool text is sanitized (ANSI/control stripped) before it
  reaches the screen; approvals are policy-driven and audited; confidential mode
  keeps its policy behavior.
- DSH: vendored with LICENSE/NOTICE, not integrated (missing `lib/`, pi-tui, and
  30+ peer packages would be a submission risk).

## Demo

`apps/tui/DEMO-pi.md` is generated from the pi-tui components by `apps/tui/src/demo-pi.ts` (UTF-8, no BOM/NUL/ANSI): header/status, Markdown assistant, tool card, bordered edit approval with numbered diff, denied shell card, research card, takeover, receipt, `/status`, `/trace`, `/receipt`, searchable `/resume` picker, and `/model`. `apps/tui/DEMO.md` is the **legacy text renderer** demo, not the pi-tui path.


## Native modules

pi-tui ships native helpers only for win32 and darwin (keyboard modifiers and
Windows console VT input); the Linux path uses the JS fallback and does not
require a native prebuild. `npm ci` and all gates pass in a clean worktree on
Windows; Ubuntu was not executed in this environment.

## Terminal acceptance (manual)

The agent shell used to build this repository is non-TTY, so raw-mode operation was
**not** verified in a real terminal. Manual acceptance checklist:

1. Open `node apps/cli/src/main.ts tui` in Windows Terminal (and once on Linux).
2. Run a task and confirm assistant text streams in and tool cards appear live.
3. Approve an edit (check the numbered diff) and deny a shell command.
4. Press Ctrl+C during a turn; confirm it cancels and returns to idle; press twice to exit.
5. Check `/status`, `/trace`, `/receipt`, `/resume`, `/model`, `/quit`.
6. Resize the window to 40 columns and back; confirm the layout does not break.
7. After exit, confirm the cursor is visible and the normal screen is restored.

If anything fails, capture the sequence and file it; raw-mode behavior is the only
part of the native TUI not covered by automated tests. No screen recorder was
available in this environment, so `apps/tui/DEMO-pi.md` is the repeatable pi-tui artifact.

## Tests

`apps/tui/test/pi-app.test.ts` covers the pi-tui session: streaming, one receipt per turn, approval overlay, stale-approval cleanup after a provider error, and multi-frame redraw with two approval modal cycles. The legacy `app.test.ts` suite still covers the non-TTY/text path and its state helpers. `apps/tui/test/plain.test.ts` proves every advertised plain command is handled, no ANSI is emitted, and mock mode uses the generic reply instead of the demo script. `tests/cli/cli-contract.test.ts` covers bare-`gidorah` fallback and `tui --plain` in a pipe.
