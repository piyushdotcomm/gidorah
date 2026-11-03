# Gidorah native TUI demo

Deterministic, offline (`gidorah tui --demo`). The model is a fake streaming model; the research card is fake; no provider or Tavily call is made.

### 1. Streaming assistant text + tool card
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: gidorah-auto  budget: $0.0000/$1.00  research: 0/50  dlp: clean  cache: 0%  cont…
────────────────────────────────────────────────────────────────────────────────────────────────────
› patch greeting.txt and verify the runtime
● I'll patch g ▍

























› 
running…  Ctrl+C cancel  Ctrl+O expand tools  Ctrl+L clear
```

### 2. Edit approval with path and numbered diff
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: fireworks/deepseek-v4p1-flash  budget: $0.0000/$1.00  research: 0/50  dlp: clean…
────────────────────────────────────────────────────────────────────────────────────────────────────
› patch greeting.txt and verify the runtime
● I'll patch greeting.txt so the check passes.
⚙ edit({"path":"greeting.txt","find":"hello","replace":"hello, world"}) [running]

















┌─ approval required ───────────────────────────────────────────────────────────────────────────────
│ edit (risk: write)
│     @ greeting.txt
│   1 - hello
│   2 + hello, world
│ [y] allow   [n] deny   [Esc] deny
└───────────────────────────────────────────────────────────────────────────────────────────────────
› Type a task, /help for commands
[y] allow  [n] deny  [Esc] deny
```

### 3. Shell approval hint (read-only/mutating)
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: fireworks/deepseek-v4p1-flash  budget: $0.0000/$1.00  research: 0/50  dlp: clean…
────────────────────────────────────────────────────────────────────────────────────────────────────
› patch greeting.txt and verify the runtime
● I'll patch greeting.txt so the check passes.
⚙ edit({"path":"greeting.txt","find":"hello","replace":"hello, world"}) [ok 18ms]
  patched greeting.txt (5 -> 12 chars)
● The patch is in. I'll run the shell check.
⚙ bash({"command":"npm test -- --watch"}) [running]














┌─ approval required ───────────────────────────────────────────────────────────────────────────────
│ bash (risk: shell)
│ shell command
│     @ shell
│   1   npm test -- --watch
│ [y] allow   [n] deny   [Esc] deny
└───────────────────────────────────────────────────────────────────────────────────────────────────
› Type a task, /help for commands
[y] allow  [n] deny  [Esc] deny
```

### 4. Research card and denied shell tool
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: fireworks/deepseek-v4p1-flash  budget: $0.0000/$1.00  research: 1/50  dlp: clean…
────────────────────────────────────────────────────────────────────────────────────────────────────
› patch greeting.txt and verify the runtime
● I'll patch greeting.txt so the check passes.
⚙ edit({"path":"greeting.txt","find":"hello","replace":"hello, world"}) [ok 18ms]
  patched greeting.txt (5 -> 12 chars)
● The patch is in. I'll run the shell check.
⚙ bash({"command":"npm test -- --watch"}) [denied 17ms]
  Denied by policy: package manager invocation
● Let me check the current Node docs before using AbortSignal.
⚙ research({"question":"How do I compose abort signals in current Node?"}) [ok 1ms]
  RESEARCH CARD (180 tokens, high confidence, fresh)
  Question: How do I compose abort signals in current Node?
  Answer: AbortSignal.any(signals) returns a signal that aborts when any input signal aborts.
  Facts:
  … (Ctrl+O expands)
≈ research: high confidence · 180 tokens · RESEARCH CARD (180 tokens, high confidence, fresh) Quest…
  sources: https://nodejs.org/api/globals.html#abortsignalany
● Done. greeti ▍










› 
running…  Ctrl+C cancel  Ctrl+O expand tools  Ctrl+L clear
```

### 5. Turn complete: takeover banner, receipt
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: fireworks/glm-5p3-flash  budget: $0.0016/$1.00  research: 1/50  dlp: clean  cach…
────────────────────────────────────────────────────────────────────────────────────────────────────
› patch greeting.txt and verify the runtime
● I'll patch greeting.txt so the check passes.
⚙ edit({"path":"greeting.txt","find":"hello","replace":"hello, world"}) [ok 18ms]
  patched greeting.txt (5 -> 12 chars)
● The patch is in. I'll run the shell check.
⚙ bash({"command":"npm test -- --watch"}) [denied 17ms]
  Denied by policy: package manager invocation
● Let me check the current Node docs before using AbortSignal.
⚙ research({"question":"How do I compose abort signals in current Node?"}) [ok 1ms]
  RESEARCH CARD (180 tokens, high confidence, fresh)
  Question: How do I compose abort signals in current Node?
  Answer: AbortSignal.any(signals) returns a signal that aborts when any input signal aborts.
  Facts:
  … (Ctrl+O expands)
≈ research: high confidence · 180 tokens · RESEARCH CARD (180 tokens, high confidence, fresh) Quest…
  sources: https://nodejs.org/api/globals.html#abortsignalany
● Done. greeting.txt is updated and the docs card is attached.
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt is updated and the …








› Type a task, /help for commands
Enter send  ↑↓ history  /help  Ctrl+D quit
```

### 6. /status, /trace, /receipt
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: fireworks/glm-5p3-flash  budget: $0.0016/$1.00  research: 1/50  dlp: clean  cach…
────────────────────────────────────────────────────────────────────────────────────────────────────
● Let me check the current Node docs before using AbortSignal.
⚙ research({"question":"How do I compose abort signals in current Node?"}) [ok 1ms]
  RESEARCH CARD (180 tokens, high confidence, fresh)
  Question: How do I compose abort signals in current Node?
  Answer: AbortSignal.any(signals) returns a signal that aborts when any input signal aborts.
  Facts:
  … (Ctrl+O expands)
≈ research: high confidence · 180 tokens · RESEARCH CARD (180 tokens, high confidence, fresh) Quest…
  sources: https://nodejs.org/api/globals.html#abortsignalany
● Done. greeting.txt is updated and the docs card is attached.
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt is updated and the …
· session ses_mw0ql9wv_1rjpzk · cwd
C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl · mode mock · model
gidorah-auto · budget $0.0016/$1.00 · receipts 1
· #  Phase     Requested            Served               Fallback  Cache  Tokens  Cost
1   explore    fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         no      500
$0.000400
2   edit       fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         no      500
$0.000400
3   edit       fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         yes     500
$0.000400
4   edit       fireworks/deepseek-v4p1-flash  fireworks/glm-5p3-flash  yes #1     no      500
$0.000400
· success · Done. greeting.txt is updated and the docs card is attached. · 2000 tokens · $0.0016 · 1
fallback(s)

› Type a task, /help for commands
Enter send  ↑↓ history  /help  Ctrl+D quit
```

### 7. /resume picker (arrow keys or number, Esc cancels)
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: fireworks/glm-5p3-flash  budget: $0.0016/$1.00  research: 1/50  dlp: clean  cach…
────────────────────────────────────────────────────────────────────────────────────────────────────
● Let me check the current Node docs before using AbortSignal.
⚙ research({"question":"How do I compose abort signals in current Node?"}) [ok 1ms]
  RESEARCH CARD (180 tokens, high confidence, fresh)
  Question: How do I compose abort signals in current Node?
  Answer: AbortSignal.any(signals) returns a signal that aborts when any input signal aborts.
  Facts:
  … (Ctrl+O expands)
≈ research: high confidence · 180 tokens · RESEARCH CARD (180 tokens, high confidence, fresh) Quest…
  sources: https://nodejs.org/api/globals.html#abortsignalany
● Done. greeting.txt is updated and the docs card is attached.
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt is updated and the …
· session ses_mw0ql9wv_1rjpzk · cwd
C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl · mode mock · model
gidorah-auto · budget $0.0016/$1.00 · receipts 1
· #  Phase     Requested            Served               Fallback  Cache  Tokens  Cost
1   explore    fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         no      500
$0.000400
2   edit       fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         no      500
$0.000400
3   edit       fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         yes     500
$0.000400
4   edit       fireworks/deepseek-v4p1-flash  fireworks/glm-5p3-flash  yes #1     no      500
$0.000400
· success · Done. greeting.txt is updated and the docs card is attached. · 2000 tokens · $0.0016 · 1
fallback(s)

› Type a task, /help for commands
Enter send  ↑↓ history  /help  Ctrl+D quit
```

### 8. /model aliases
```text
Gidorah  the governed coding agent
cwd: C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl  ·  branch: main  ·  sess…
mode: mock  route: fireworks/glm-5p3-flash  budget: $0.0016/$1.00  research: 1/50  dlp: clean  cach…
────────────────────────────────────────────────────────────────────────────────────────────────────
  Question: How do I compose abort signals in current Node?
  Answer: AbortSignal.any(signals) returns a signal that aborts when any input signal aborts.
  Facts:
  … (Ctrl+O expands)
≈ research: high confidence · 180 tokens · RESEARCH CARD (180 tokens, high confidence, fresh) Quest…
  sources: https://nodejs.org/api/globals.html#abortsignalany
● Done. greeting.txt is updated and the docs card is attached.
⇄ takeover: fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)
✓ receipt: success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt is updated and the …
· session ses_mw0ql9wv_1rjpzk · cwd
C:/Users/13725/AppData/Local/Temp/dsh-bIcLkC/gidorah-tui-demo-oWxtJl · mode mock · model
gidorah-auto · budget $0.0016/$1.00 · receipts 1
· #  Phase     Requested            Served               Fallback  Cache  Tokens  Cost
1   explore    fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         no      500
$0.000400
2   edit       fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         no      500
$0.000400
3   edit       fireworks/deepseek-v4p1-flash  fireworks/deepseek-v4p1-flash  no         yes     500
$0.000400
4   edit       fireworks/deepseek-v4p1-flash  fireworks/glm-5p3-flash  yes #1     no      500
$0.000400
· success · Done. greeting.txt is updated and the docs card is attached. · 2000 tokens · $0.0016 · 1
fallback(s)
· model alias: gidorah-auto · available: gidorah-auto,
fireworks/accounts/fireworks/models/deepseek-v4p1-flash · phase routing resolved by Bifrost; the TUI
never calls providers directly

› Type a task, /help for commands
Enter send  ↑↓ history  /help  Ctrl+D quit
```

Demo finished. Run `node apps/cli/src/main.ts tui` for the real interactive session.
