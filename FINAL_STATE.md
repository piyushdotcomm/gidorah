# Final state (one page)

## Verified with real services
- Bifrost 2.4.0 built from source, real Fireworks routing and fallbacks, real Ollama 0.40.13 with a 3B GGUF model.
- Real coding task: a failing test fixed through `read/edit/bash` in a real CLI session; audit chain valid.
- Real Tavily card with citations and a zero-credit cache hit.
- Confidential path: local 3B inference through Bifrost; the local-only key rejects a cloud model with 403.
- Real chaos: Bifrost kill, Tavily outage, network drop.
- Native TUI: OpenTUI 0.8.2 (SST, the framework opencode uses; MIT) with Yoga layout, gradient GIDORAH logo, status pills, transcript cards, Markdown/diff renderables, bordered Textarea composer, mouse-clickable approval buttons, session picker, spinner; Node >=26.4. Screenshots in `apps/tui/screenshots/`; demo `apps/tui/DEMO-opentui.md`; plain/non-TTY fallback. (`apps/tui`; legacy pi-tui/text demos: `DEMO-pi.md`, `DEMO.md`.)

## Offline/mock only
- Budget 402, provider fallback chains, DLP twin, replay demo, conformance, red team, CLI contract, audit tamper tests.
- TUI demo uses a fake streaming model and a fake research card; no network.

## Benchmark (current)
- Current full run: `bench/real_mw0or6tw` with `promptVersion: edit-nudge-v1`, **48/48 solved, 100%, $0.111062 total, $0.002314 per solved task, 0 errored**.
- Per arm (all 12/12): F $0.001272, C $0.001802, D $0.002383, A $0.003797 per solved. F is cheapest; C is cheaper than D.
- Three-sample Tavily picture: current full C 12/12 vs D 12/12 with D about 32% more expensive per solved; Class B-only D 5/6 vs C 6/6; post-fix pilot D 9/9 vs C 8/9 vs A 7/9. The samples disagree at small n; no reliable pass-rate claim is made, and Tavily value is stated as citations plus cost avoidance.
- Superseded: earlier synthetic/hung/partial runs are archived outside the public repo and logged in `BUILD_LOG.md`. None are used as headline evidence.

## Pending (external)
- DSH package integration (vendored with LICENSE/NOTICE, not wired; the native TUI ships).
- Live gateway DLP and canary scan: needs a Linux Bifrost loading the Go plugin.
- 3-5 run variance sweep on the full set; harder tasks where F fails and C/D succeed.
- Demo recording/slides, Bifrost repo star, key rotation.
- Real Windows Terminal manual acceptance of the TUI (agent shell is non-TTY).

## Known limitations
- Real 402 budget behavior, real primary-provider fallback, and real confidential zero-egress beyond the local-key/403 checks are not demonstrated.
- The benchmark task set is authored over real Node APIs, not a third-party OSS repository; sample size is small.
- Windows cannot load the native Go plugin; plugin evidence is source-tested only.
- `pnpm install` is not usable in this sandbox; npm with `package-lock.json` is the standard.

## Exact commands
```bash
npm ci && npm run build && npm run lint && npm run typecheck && npm test
node apps/cli/src/main.ts doctor
node apps/cli/src/main.ts tui
node apps/cli/src/main.ts tui --demo
node apps/cli/src/main.ts tui --plain
node apps/cli/src/main.ts demo --replay
node apps/cli/src/main.ts conformance
node apps/cli/src/main.ts chaos
node apps/cli/src/main.ts audit verify --all
node apps/cli/src/main.ts redteam
node apps/cli/src/main.ts bench --real --pilot
node apps/cli/src/main.ts bench --real --full
```

## Terminal acceptance (manual)
The agent shell is non-TTY, so raw-mode operation was not verified in a real terminal. Manual check: open `node apps/cli/src/main.ts tui` in Windows Terminal, run a task and watch streaming, approve an edit, deny a shell command, press Ctrl+C, then `/status`, `/trace`, `/receipt`, `/resume`, `/model`, `/quit`; resize to 40 columns; confirm cursor and alternate screen restore.