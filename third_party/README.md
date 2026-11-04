> **Current state (2026-11-03):** the DSH TUI is vendored at
> `third_party/dsh-tui` with LICENSE/NOTICE, and the Go plugin compiles and
> tests against the real Bifrost SDK. The historical notes below describing
> "not vendored" or "Go toolchain not installed" are superseded.
# Third-party register

This register lists third-party components that Gidorah uses, adapts, or deliberately does not use in this offline build. It is an engineering summary, not legal advice. Verify each license against the exact pinned version and consult counsel before commercial distribution.

Current state is in `README.md`, `BUILD_REPORT.md`, and `FINAL_STATE.md`. The build has real provider runs, a Go toolchain, and the plugin compiles against the real Bifrost SDK; the old PENDING note is historical.

## Register

| Component | Use | License | Status and obligations |
|---|---|---|---|
| Bifrost (`maximhq/bifrost`) | Model gateway and only model egress path | Apache-2.0 | Runtime dependency, not vendored here. Include the license and NOTICE for the pinned release. State that Gidorah is not an official Bifrost product. Pinned release and NOTICE are recorded in this repo. |
| Tavily API (`tavily.com`) | Web research and extraction service | Commercial API terms | Not open source. Follow the terms of service and acceptable use policy, cite sources, and do not redistribute page content beyond what the terms allow. PENDING: terms review for caching and benchmark publication. No API key is present in this build. |
| DeepSeek Harness TUI (`@deepseek-ai/dsh-tui`) | Vendored terminal UI package at `third_party/dsh-tui` (192 files) | MIT AND BSD-3-Clause | Vendored with both license texts (`LICENSE`) and `NOTICE`; SPDX expression preserved. Gidorah-specific adapter panels live in `apps/tui`; full package integration is pending. |
| pi-tui (`@earendil-works/pi-tui`) | Legacy TUI framework (plain/demo path) | MIT, pinned 0.80.7 | Installed; license at `third_party/pi-tui.LICENSE`; no longer used by `gidorah tui`. |
| OpenTUI (`@opentui/core`) | Interactive TUI framework (opencode uses it) | MIT, pinned 0.8.2 | Installed with native win32/darwin/linux prebuilds; license at `third_party/opentui.LICENSE`. |
| Node.js | Runtime | MIT | Not vendored. Include the Node.js license in a distribution that bundles the binary. Standard attribution. |
| better-sqlite3 | Replaced by the built-in `node:sqlite` module | MIT (original library) | No dependency is installed, so no attribution is required for it. The replacement avoids a native build in the offline environment. |
| `openai` JavaScript SDK | Not installed | Apache-2.0 (if added) | NOT installed in this offline build. Gidorah talks to Bifrost over HTTP and must not import a provider SDK, so this should stay out unless a reviewed Bifrost client requires it. |
| `commander` | Not installed | MIT | NOT installed in this offline build. CLI parsing is hand-written. |
| `zod` | Not installed | MIT | NOT installed in this offline build. Validation is hand-written and fail-closed. |
| `vitest` | Not installed | MIT | NOT installed in this offline build. Tests use `node:test` through `scripts/run-tests.ts`. |
| Go plugin `plugins/bifrost-dlp` | Confidential guard, DLP scan, policy headers, decision events | Apache-2.0, original Gidorah code | Written for this repo. Compiles and passes `go test` against the real Bifrost core SDK (v1.14.1); loading requires a Linux host because Go plugins are Linux .so files. See `plugins/bifrost-dlp/README.md`. |

## Pending

- Pin the Bifrost release and copy its license and NOTICE before distribution.

-  if the TUI is vendored.
- Review Tavily terms for caching and for publishing benchmark excerpts.

- Re-run a dependency license scan after any package is added from a registry.

## Update 2026-11-03

- DeepSeek Harness TUI package is now vendored at `third_party/dsh-tui` (192 files) with its LICENSE and a NOTICE; the Gidorah panel adaptation is still PENDING.
- Bifrost DLP plugin now compiles and tests against the real Bifrost core SDK (v1.14.1).

