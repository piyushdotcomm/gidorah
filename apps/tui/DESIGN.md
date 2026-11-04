# Native TUI design (Phase 0)

Goal: an interactive terminal coding session for a human, with live steps, approvals,
transcripts, and slash commands. No new runtime dependencies. The DSH TUI source has been removed; only its license/notice remain.

## State (`TuiApp`)

- `phase`: `idle | running | approval | exited`
- `input`, `cursor`, `history`, `historyIndex`
- `transcript`: ordered items (`user`, `assistant`, `tool`, `notice`, `research`, `dlp`, `docs`, `takeover`, `receipt`, `error`, `info`)
- `approval`: current request (tool, risk, preview/diff)
- `status`: mode, route, budget, research credits, DLP, cache, context, compaction
- `session`: one live `Session` per app; `/new` replaces it, `/resume` loads another
- `receipt`: last turn receipt
- `width`/`height`: from `stdout.columns`/`rows`, updated on `resize`

## Event flow

1. `TuiApp.submit(task)` builds `RuntimeDeps` via an injected `createDeps(session, hooks)`.
   The CLI owns Bifrost/mock/Tavily/budget/session setup and passes the factory.
2. `runTask` appends to the session. `Session.subscribe` delivers every `SessionEvent`
   synchronously after the hash chain update; listener errors are isolated, never written
   into the event stream.
3. The app maps events to transcript items: `user/message`, `assistant/message`,
   `tool/call`, `tool/result`, `approval/request`, `approval/decision`, `route/changed`,
   `budget/updated`, `dlp/blocked`, `docs/check`, `session/error`.
4. Streaming: `RuntimeDeps.onModelDelta` receives text deltas when set; the app appends
   them to a transient assistant item, then reconciles with the final `assistant/message`
   content. Without `onModelDelta`, the runtime keeps `model.complete()` unchanged.
5. `runTask` resolves with a receipt; the app appends it and returns to `idle`.

## Input handling

- Interactive: `stdin.setRawMode(true)` + `readline.emitKeypressEvents`, keypress events
  mapped to actions (chars, enter, backspace, arrows, Ctrl+C/D/L/O, Esc, y/n).
  `stdout` enters the alternate screen and is redrawn on change (throttled for deltas).
- Plain/non-TTY: no raw mode, no ANSI. A line REPL renders events with the existing
  plain renderer; approvals are denied with a clear message because there is no
  interactive channel. `gidorah tui --plain` works in pipes.
- Bare `gidorah` opens the TUI only when both stdin and stdout are TTYs; otherwise help.

## Approval flow

`InteractiveApprovalService` implements the runtime `ApprovalService`. `ask()` queues the
request and returns a promise; the app renders the tool, risk, preview (diff for edits)
and resolves on `y`/`n`/Esc. Requests are serialized; a denial is audited and honored.
Reads never reach the queue (policy allows them).

## Rendering

`layout.ts` is pure: header, status line, transcript (wrapped, capped), approval panel,
input composer with cursor, footer hints. All untrusted text is sanitized (ANSI/control
stripped) before wrapping; width uses a display-width approximation for CJK.

## Windows/Linux raw mode

Windows Terminal and Linux both support `setRawMode` and keypress escape sequences.
Node emits `\x1b[A` etc. on Windows Terminal and classic conhost; we handle arrows/Esc by
keypress name and never parse raw sequences ourselves. `stdout.columns` may be 0 in
tests; fall back to 100x30.
