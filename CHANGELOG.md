# Changelog

## 0.1.0 — first public release

- OpenTUI terminal UI: gradient logo, status pills, transcript cards, Markdown
  and diff renderables, bordered composer, mouse-clickable approvals, session
  picker, theme picker (`/theme`, `Ctrl+T`), light/dark palettes.
- Governed agent runtime: Bifrost-only model plane, per-phase cascade, budget
  checks, fallbacks and takeover banners, approval policy, hash-chained audit,
  receipts, flight recorder.
- Tavily knowledge plane: cited evidence cards, credit budget, cache, Docs Guard.
- CLI: `run`, `tui`, `resume`, `doctor`, `audit verify/export`, `redteam`,
  `demo --replay`, `bench --real`, `conformance`, `chaos`, `completion`.
- Packaging: `npm install -g gidorah`, Node >= 26.4, compiled dist, no keys.
- 167 tests, 40 conformance scenarios, 8 chaos scenarios, real-provider evidence
  and a 48/48 full benchmark run.