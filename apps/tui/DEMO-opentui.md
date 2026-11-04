# Gidorah OpenTUI demo

Rendered from the real OpenTUI renderer via `createTestRenderer` at 120x40 (plus 80x24 and 40x24 fixtures).

### welcome
```text
  ██║   ██║ ██║ ██║  ██║ ██║   ██║ ██╔══██╗ ██╔══██║ ██╔══██║
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.000/$1.00   research: 0/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │                                                                                                                  │
  │   Welcome to Gidorah                                                                                             │
  │                                                                                                                  │
  │   mode mock · model gidorah-auto                                                                                 │
  │                                                                                                                  │
  │   Ask for a code change, a review, or a shell task. `/help` lists commands.                                      │
  │                                                                                                                  │
  │   ╭─────────╮ ╭─────────╮ ╭────────╮ ╭──────────╮ ╭───────╮                                                      │
  │   │ /status │ │ /resume │ │ /trace │ │ /receipt │ │ /help │                                                      │
  │   ╰─────────╯ ╰─────────╯ ╰────────╯ ╰──────────╯ ╰───────╯                                                      │
  │                                                                                                                  │
  │   Cloud: set GIDORAH_MODE=cloud and BIFROST_BASE_URL, restart, then `/doctor`.                                   │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  main · gidorah-ot-QcjPKE · session ses_mw2hnyss_gxen77 · /help
```

### edit-approval
```text
  ██║   ██║ ██║ ██║  ██║ ██║   ██║ ██╔══██╗ ██╔══██║ ██╔══██║
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.000/$1.00   research: 0/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ │  you       ╔════════════════════════════════════════════════════════════════════════════════════╗              │
  │ │  patch gree║                                                                                    ║              │
  │              ║ Approval required · edit · write · 1 pending                                       ║              │
  │ │            ║                                                                                    ║              │
  │              ║ greeting.txt                                                                       ║              │
  │ ╭─ ⚙ edit · r║  1 - hello                                                                         ║────────────╮ │
  │ │ edit greeti║  1 + hello, world                                                                  ║            │ │
  │ ╰────────────║                                                                                    ║────────────╯ │
  │              ║                                                                                    ║              │
  │              ║                                                                                    ║              │
  │              ║                                                                                    ║              │
  │              ║                                                    ╭─────────────╮  ╭────────────╮ ║              │
  │              ║                                                    │ ▶ Allow (y) │  │ ✕ Deny (n) │ ║              │
  │              ║                                                    ╰─────────────╯  ╰────────────╯ ║              │
  │              ║                                                                                    ║              │
  │              ║ y allow · n/Esc deny · click a button                                              ║              │
  │              ║                                                                                    ║              │
  │              ╚════════════════════════════════════════════════════════════════════════════════════╝              │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  main · gidorah-ot-QcjPKE · session ses_mw2hnyss_gxen77 · /help
```

### shell-approval
```text
  ██║   ██║ ██║ ██║  ██║ ██║   ██║ ██╔══██╗ ██╔══██║ ██╔══██║
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.000/$1.00   research: 0/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ │  you                                                                                                           │
  │ │  patch greeting.txt and verify the runtime                                                                     │
  │              ╔════════════════════════════════════════════════════════════════════════════════════╗              │
  │ │            ║                                                                                    ║              │
  │              ║ Approval required · bash · shell · 1 pending                                       ║              │
  │ ╭─ ⚙ edit · o║                                                                                    ║────────────╮ │
  │ │ edit greeti║ ╭────────────────────────────────────────────────────────────────────────────────╮ ║            │ │
  │ │ patched gre║ │ $ npm test -- --watch                                                          │ ║            │ │
  │ ╰────────────║ ╰────────────────────────────────────────────────────────────────────────────────╯ ║────────────╯ │
  │              ║                                                                                    ║              │
  │ │            ║                                                    ╭─────────────╮  ╭────────────╮ ║              │
  │              ║                                                    │ ▶ Allow (y) │  │ ✕ Deny (n) │ ║              │
  │ ╭─ ⚙ bash · r║                                                    ╰─────────────╯  ╰────────────╯ ║────────────╮ │
  │ │ $ npm test ║                                                                                    ║            │ │
  │ ╰────────────║ y allow · n/Esc deny · click a button                                              ║────────────╯ │
  │              ║                                                                                    ║              │
  │              ╚════════════════════════════════════════════════════════════════════════════════════╝              │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  main · gidorah-ot-QcjPKE · session ses_mw2hnyss_gxen77 · /help
```

### transcript
```text
  ██║   ██║ ██║ ██║  ██║ ██║   ██║ ██╔══██╗ ██╔══██║ ██╔══██║
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.002/$1.00   research: 1/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ │ question                                                                                                    │  │
  │ │ RESEARCH CARD (180 tokens, high confidence, fresh)                                                          │  │
  │ │ Question: AbortSignal.any in current Node                                                                   │  │
  │ │ Answer: AbortSignal.any(signals) composes abort signals.                                                    │  │
  │ │ … 5 more lines (click or Ctrl+O)                                                                            │  │
  │ ╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────╯  │
  │                                                                                                                  │
  │ │  ≈ research card                                                                                               │
  │ │  RESEARCH CARD (180 tokens, high confidence, fresh) Question: AbortSignal.any in current Node Answer:          │
  │ │  AbortSignal.any(signals) composes abort signals. Facts: - Available in current Node. - First aborte           │
  │ │  ↗ https://nodejs.org/api/globals.html#abortsignalany                                                         ▄│
  │                                                                                                                 █│
  │ │  Done. greeting.txt updated; the shell command was denied; docs card attached.                                █│
  │                                                                                                                 █│
  │ │  ⇄ takeover                                                                                                   █│
  │ │  fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                                        █│
  │                                                                                                                 █│
  │ │  ✓ receipt                                                                                                    █│
  │ │  success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt updated; the shell command was denied;  █│
  │ │  docs card attached.                                                                                          █│
  │                                                                                                                 █│
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  main · gidorah-ot-QcjPKE · session ses_mw2hnyss_gxen77 · /help
```

### status
```text
  ██║   ██║ ██║ ██║  ██║ ██║   ██║ ██╔══██╗ ██╔══██║ ██╔══██║
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.002/$1.00   research: 1/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ │ Answer: AbortSignal.any(signals) composes abort signals.                                                    │  │
  │ │ … 5 more lines (click or Ctrl+O)                                                                            │  │
  │ ╰─────────────────────────────────────────────────────────────────────────────────────────────────────────────╯  │
  │                                                                                                                  │
  │ │  ≈ research card                                                                                               │
  │ │  RESEARCH CARD (180 tokens, high confidence, fresh) Question: AbortSignal.any in current Node Answer:          │
  │ │  AbortSignal.any(signals) composes abort signals. Facts: - Available in current Node. - First aborte           │
  │ │  ↗ https://nodejs.org/api/globals.html#abortsignalany                                                          │
  │                                                                                                                  │
  │ │                                                                                                                │
  │                                                                                                                  │
  │ │  ⇄ takeover                                                                                                   █│
  │ │  fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                                        █│
  │                                                                                                                 █│
  │ │  ✓ receipt                                                                                                    █│
  │ │  success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt updated; the shell command was denied;  █│
  │ │  docs card attached.                                                                                          █│
  │                                                                                                                 █│
  │ │  ·                                                                                                            █│
  │ │  session ses_mw2hnyss_gxen77 · mock · gidorah-auto · $0.0016/$1.00 · receipts 1                               █│
  │                                                                                                                 █│
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  main · gidorah-ot-QcjPKE · session ses_mw2hnyss_gxen77 · /help
```

### trace
```text
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.002/$1.00   research: 1/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ │  ≈ research card                                                                                               │
  │ │  RESEARCH CARD (180 tokens, high confidence, fresh) Question: AbortSignal.any in current Node Answer:          │
  │ │  AbortSignal.any(signals) composes abort signals. Facts: - Available in current Node. - First aborte           │
  │ │  ↗ https://nodejs.org/api/globals.html#abortsignalany                                                          │
  │                                                                                                                  │
  │ │                                                                                                                │
  │                                                                                                                  │
  │ │  ⇄ takeover                                                                                                    │
  │ │  fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                                         │
  │                                                                                                                  │
  │ │  ✓ receipt                                                                                                     │
  │ │  success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt updated; the shell command was denied;   │
  │ │  docs card attached.                                                                                          ▄│
  │                                                                                                                 █│
  │ │  ·                                                                                                            █│
  │ │  session ses_mw2hnyss_gxen77 · mock · gidorah-auto · $0.0016/$1.00 · receipts 1                               █│
  │                                                                                                                 █│
  │ │  ·                                                                                                            █│
  │ │  explore: fireworks/deepseek-v4p1-flash · 500 tokens · $0.000400 · fallback no                                █│
  │ │  edit: fireworks/deepseek-v4p1-flash · 500 tokens · $0.000400 · fallback no                                   █│
  │ │  edit: fireworks/deepseek-v4p1-flash · 500 tokens · $0.000400 · fallback no                                   █│
  │ │  edit: fireworks/glm-5p3-flash · 500 tokens · $0.000400 · fallback yes                                        █│
  │                                                                                                                 █│
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### receipt
```text
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.002/$1.00   research: 1/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │                                                                                                                  │
  │ │                                                                                                                │
  │                                                                                                                  │
  │ │  ⇄ takeover                                                                                                    │
  │ │  fireworks/deepseek-v4p1-flash → fireworks/glm-5p3-flash (fallback #1)                                         │
  │                                                                                                                  │
  │ │  ✓ receipt                                                                                                     │
  │ │  success · 2000 tokens · $0.0016 · 1 fallback(s) · Done. greeting.txt updated; the shell command was denied;   │
  │ │  docs card attached.                                                                                           │
  │                                                                                                                  │
  │ │  ·                                                                                                             │
  │ │  session ses_mw2hnyss_gxen77 · mock · gidorah-auto · $0.0016/$1.00 · receipts 1                                │
  │                                                                                                                  │
  │ │  ·                                                                                                            ▄│
  │ │  explore: fireworks/deepseek-v4p1-flash · 500 tokens · $0.000400 · fallback no                                █│
  │ │  edit: fireworks/deepseek-v4p1-flash · 500 tokens · $0.000400 · fallback no                                   █│
  │ │  edit: fireworks/deepseek-v4p1-flash · 500 tokens · $0.000400 · fallback no                                   █│
  │ │  edit: fireworks/glm-5p3-flash · 500 tokens · $0.000400 · fallback yes                                        █│
  │                                                                                                                 █│
  │ │  ·                                                                                                            █│
  │ │  success · 2000 tokens · $0.0016 · Done. greeting.txt updated; the shell command was denied; docs card        █│
  │ │  attached.                                                                                                    █│
  │                                                                                                                 █│
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### resume-picker
```text
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.002/$1.00   research: 1/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │                                                                                                                  │
  │ │  Done. greet╔══════════════════════════════════════════════════════════════════════════════════╗               │
  │               ║                                                                                  ║               │
  │ │  ⇄ takeover ║ Resume session                                                                   ║               │
  │ │  fireworks/d║                                                                                  ║               │
  │               ║  ▶ ses_mw2hnyss_gxen77                                                           ║               │
  │ │  ✓ receipt  ║    ses_mw2hnyss_gxen77 · patch greeting.txt and verify the runtime               ║               │
  │ │  success · 2║                                                                                  ║ was denied;   │
  │ │  docs card a║                                                                                  ║               │
  │               ║                                                                                  ║               │
  │ │  ·          ║                                                                                  ║               │
  │ │  session ses║                                                                                  ║               │
  │               ║                                                                                  ║               │
  │ │  ·          ║                                                                                  ║              ▄│
  │ │  explore: fi║                                                                                  ║              █│
  │ │  edit: firew║                                                                                  ║              █│
  │ │  edit: firew║ ↑/↓ select · Enter resume · Esc cancel                                           ║              █│
  │ │  edit: firew║                                                                                  ║              █│
  │               ╚══════════════════════════════════════════════════════════════════════════════════╝              █│
  │ │  ·                                                                                                            █│
  │ │  success · 2000 tokens · $0.0016 · Done. greeting.txt updated; the shell command was denied; docs card        █│
  │ │  attached.                                                                                                    █│
  │                                                                                                                 █│
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### model
```text
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.002/$1.00   research: 1/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ │  ⇄ takeover                                                                                                    │
  │ │  fireworks/d╔══════════════════════════════════════════════════════════════════════════════════╗               │
  │               ║                                                                                  ║               │
  │ │  ✓ receipt  ║ Resume session                                                                   ║               │
  │ │  success · 2║                                                                                  ║ was denied;   │
  │ │  docs card a║  ▶ ses_mw2hnyss_gxen77                                                           ║               │
  │               ║    ses_mw2hnyss_gxen77 · patch greeting.txt and verify the runtime               ║               │
  │ │  ·          ║                                                                                  ║               │
  │ │  session ses║                                                                                  ║               │
  │               ║                                                                                  ║               │
  │ │  ·          ║                                                                                  ║               │
  │ │  explore: fi║                                                                                  ║               │
  │ │  edit: firew║                                                                                  ║               │
  │ │  edit: firew║                                                                                  ║               │
  │ │  edit: firew║                                                                                  ║              █│
  │               ║                                                                                  ║              █│
  │ │  ·          ║ ↑/↓ select · Enter resume · Esc cancel                                           ║              █│
  │ │  success · 2║                                                                                  ║s card        █│
  │ │  attached.  ╚══════════════════════════════════════════════════════════════════════════════════╝              █│
  │                                                                                                                 █│
  │ │  ·                                                                                                            █│
  │ │  model gidorah-auto · available gidorah-auto, fireworks/accounts/fireworks/models/deepseek-v4p1-flash         █│
  │                                                                                                                 █│
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### 80x24
```text
  plane                                                               auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set            │
  │ GIDORAH_╔══════════════════════════════════════════════════════╗ the     │
  ╰─────────║                                                      ║─────────╯
   mode: moc║ Resume session                                       ║h: 1/50
   dlp: clea║                                                      ║
  ╭─────────║  ▶ ses_mw2hnyss_gxen77                               ║─────────╮
  │         ║    ses_mw2hnyss_gxen77 · patch greeting.txt and veri ║         │
  │ │  ·    ║                                                      ║         │
  │ │  succe║                                                      ║ the     │
  │ │  shell║                                                      ║         │
  │         ║                                                      ║         │
  │ │  ·    ║                                                      ║         │
  │ │  model║                                                      ║ts/      │
  │ │  firew║                                                      ║         │
  │         ║                                                      ║        █│
  ╰─────────║                                                      ║─────────╯
  ╭─────────║ ↑/↓ select · Enter resume · Esc cancel               ║─────────╮
  │ Ask Gido║                                                      ║         │
  │         ╚══════════════════════════════════════════════════════╝         │
  │                                                                          │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools ·  │
  ╰──────────────────────────────────────────────────────────────────────────╯
```

### 40x24
```text
  knowledge plane               h-auto
  ╭─ MOCK MODE ──────────────────────╮
  │ Synthetic replies — no real      │
════════════════════════════════════════
esume session
▶ ses_mw2hnyss_gxen77
  ses_mw2hnyss_gxen77 · patch greeting.t
/↓ select · Enter resume · Esc cancel
════════════════════════════════════════
  │                                  │
  │ Enter send · Shift+Enter newline │
  ╰──────────────────────────────────╯
```

### 120x40
```text
  ╚██████╔╝ ██║ ██████╔╝ ╚██████╔╝ ██║  ██║ ██║  ██║ ██║  ██║
   ╚═════╝  ╚═╝ ╚═════╝   ╚═════╝  ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝                                                MOCK MODE
  governed coding agent · Bifrost model plane × Tavily knowledge plane                                    gidorah-auto
  ╭─ MOCK MODE ──────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Synthetic replies — no real model call. Start Bifrost and set GIDORAH_MODE=cloud for real coding. Run `gidorah   │
  │ tui --demo` for the scripted demo.                                                                               │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
   mode: mock   model: gidorah-auto   budget: $0.002/$1.00   research: 1/50
   dlp: clean   cache: 0%   ctx: 0%   compact: off
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ │  ⇄ takeover                                                                                                    │
  │ │  fireworks/d╔══════════════════════════════════════════════════════════════════════════════════╗               │
  │               ║                                                                                  ║               │
  │ │  ✓ receipt  ║ Resume session                                                                   ║               │
  │ │  success · 2║                                                                                  ║ was denied;   │
  │ │  docs card a║  ▶ ses_mw2hnyss_gxen77                                                           ║               │
  │               ║    ses_mw2hnyss_gxen77 · patch greeting.txt and verify the runtime               ║               │
  │ │  ·          ║                                                                                  ║               │
  │ │  session ses║                                                                                  ║               │
  │               ║                                                                                  ║               │
  │ │  ·          ║                                                                                  ║               │
  │ │  explore: fi║                                                                                  ║               │
  │ │  edit: firew║                                                                                  ║               │
  │ │  edit: firew║                                                                                  ║               │
  │ │  edit: firew║                                                                                  ║              █│
  │               ║                                                                                  ║              █│
  │ │  ·          ║ ↑/↓ select · Enter resume · Esc cancel                                           ║              █│
  │ │  success · 2║                                                                                  ║s card        █│
  │ │  attached.  ╚══════════════════════════════════════════════════════════════════════════════════╝              █│
  │                                                                                                                 █│
  │ │  ·                                                                                                            █│
  │ │  model gidorah-auto · available gidorah-auto, fireworks/accounts/fireworks/models/deepseek-v4p1-flash         █│
  │                                                                                                                 █│
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
  ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
  │ Ask Gidorah to inspect, edit, or run something…                                                                  │
  │                                                                                                                  │
  │                                                                                                                  │
  │ Enter send · Shift+Enter newline · Tab complete · Ctrl+O expand tools · Ctrl+C cancel                            │
  ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```
