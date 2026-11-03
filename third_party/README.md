# Third-party register

This register lists third-party components that Gidorah uses, adapts, or deliberately does not use in this offline build. It is an engineering summary, not legal advice. Verify each license against the exact pinned version and consult counsel before commercial distribution.

`BUILD_STATUS.md` records the current PENDING state: the build is mock-first, no registry access, no Go toolchain, and no real provider keys.

## Register

| Component | Use | License | Status and obligations |
|---|---|---|---|
| Bifrost (`maximhq/bifrost`) | Model gateway and only model egress path | Apache-2.0 | Runtime dependency, not vendored here. Include the license and NOTICE for the pinned release. State that Gidorah is not an official Bifrost product. PENDING: pin the release and copy its NOTICE. |
| Tavily API (`tavily.com`) | Web research and extraction service | Commercial API terms | Not open source. Follow the terms of service and acceptable use policy, cite sources, and do not redistribute page content beyond what the terms allow. PENDING: terms review for caching and benchmark publication. No API key is present in this build. |
| DeepSeek Harness TUI (`@deepseek-ai/dsh-tui`) | Adapted terminal UI shell | MIT AND BSD-3-Clause | NOT vendored in this offline build, PENDING. When vendored, include both license texts and the copyright notice, mark changes, and keep the SPDX expression. See `docs/06-legal/licensing-and-attribution.md`. |
| pi-tui (`@earendil-works/pi-tui`) | TUI framework used by the DSH TUI | MIT, pinned 0.80.7 | NOT vendored, PENDING. The DSH TUI pins 0.80.7; verify that version's license file before distribution. |
| Node.js | Runtime | MIT | Not vendored. Include the Node.js license in a distribution that bundles the binary. Standard attribution. |
| better-sqlite3 | Replaced by the built-in `node:sqlite` module | MIT (original library) | No dependency is installed, so no attribution is required for it. The replacement avoids a native build in the offline environment. |
| `openai` JavaScript SDK | Not installed | Apache-2.0 (if added) | NOT installed in this offline build. Gidorah talks to Bifrost over HTTP and must not import a provider SDK, so this should stay out unless a reviewed Bifrost client requires it. |
| `commander` | Not installed | MIT | NOT installed in this offline build. CLI parsing is hand-written. |
| `zod` | Not installed | MIT | NOT installed in this offline build. Validation is hand-written and fail-closed. |
| `vitest` | Not installed | MIT | NOT installed in this offline build. Tests use `node:test` through `scripts/run-tests.ts`. |
| Go plugin `plugins/bifrost-dlp` | Confidential guard, DLP scan, policy headers, decision events | Apache-2.0, original Gidorah code | Written for this repo. NOT compiled or tested: Go toolchain unavailable offline. See `plugins/bifrost-dlp/README.md` and `BUILD_STATUS.md`. |

## Pending

- Pin the Bifrost release and copy its license and NOTICE before distribution.
- Vendor the DSH TUI with `third_party/dsh-tui/LICENSE` and `third_party/dsh-tui/NOTICE`, or keep it unvendored and describe the plain renderer fallback.
- Verify the pi-tui 0.80.7 license file if the TUI is vendored.
- Review Tavily terms for caching and for publishing benchmark excerpts.
- Build and test the Go plugin when Go 1.22+ and the Bifrost plugin SDK are available. That step is PENDING, not verified.
- Re-run a dependency license scan after any package is added from a registry.

## Update 2026-11-03

- DeepSeek Harness TUI package is now vendored at `third_party/dsh-tui` (192 files) with its LICENSE and a NOTICE; the Gidorah panel adaptation is still PENDING.
- Bifrost DLP plugin now compiles and tests against the real Bifrost core SDK (v1.14.1).

