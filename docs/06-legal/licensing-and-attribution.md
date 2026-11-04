# Licensing and Attribution

**Status:** Draft · **Owner:** Legal / Delivery · **Last updated:** 2026-11-03

> This is an engineering summary, not legal advice. Verify licenses against the exact versions used and consult counsel before commercial distribution.

---

## 1. Our license

**Proposed:** Apache-2.0 for Gidorah's original code.

Rationale: explicit patent grant, enterprise-friendly, compatible with the Apache-2.0 Bifrost ecosystem. MIT is a simpler alternative; decide before the first public release.

The DSH TUI license/notice are retained under `third_party/dsh-tui.LICENSE` and `.NOTICE`; its source is not distributed. Gidorah code is Apache-2.0.

---

## 2. Third-party components

| Component | Use | License | Obligations | Status |
|---|---|---|---|---|
| **Bifrost** (`maximhq/bifrost`) | Model gateway, runtime dependency | Apache-2.0 (verified from repo LICENSE) | Include license/notice; state changes if modified | Confirmed |
| **Tavily API** (`tavily.com`) | Web search/extract service | Commercial API terms | Acceptable use, attribution where required, no unlawful scraping/redistribution | Verify terms for caching/benchmark publication |
| **DeepSeek Harness TUI** (`@deepseek-ai/dsh-tui`) | Adapted terminal UI | **MIT AND BSD-3-Clause** | Include both license texts, copyright, notice, mark changes | Retain `third_party/dsh-tui.LICENSE` |
| **pi-tui** (`@earendil-works/pi-tui`) | TUI framework | MIT (verified; TUI package pins 0.80.7) | Include license/notice | Verify pinned version's license file |
| **DeepSeek models** | Cloud models via Bifrost | Provider terms | Acceptable use, no resale of model outputs contrary to terms | Verify |
| **Ollama** | Local model runtime | MIT (verify) | Include license if distributed | Verify |
| **Node.js** | Runtime | MIT-style | Include license in distribution | Standard |
| **better-sqlite3** | Storage | MIT | Include license | Standard |
| **openai** JS SDK | HTTP client | Apache-2.0 | Include license/notice | Standard |
| **@tavily/core** | Tavily SDK | MIT (verify) | Include license | Verify |

This table is a starting register. Expand it with the full dependency tree before release.

---

## 3. DSH TUI attribution

The TUI package states:

```text
License provenance for @deepseek-ai/dsh-tui

This package combines source restored from DeepSeek Harness history with new
adaptations and additions. The restored implementation predates the
repository's adoption of the MIT License and remains subject to the historical
BSD 3-Clause License. The adaptations and additions are provided under the MIT
License. Distribution of the combined package must therefore satisfy both
licenses, as recorded by the SPDX expression (MIT AND BSD-3-Clause).

MIT License
Copyright (c) 2026 DeepSeek

BSD 3-Clause License
Copyright (c) 2026, DeepSeek
```

### Required actions

1. The unused vendored source has been removed; the complete license is retained at `third_party/dsh-tui.LICENSE`.
2. Add `third_party/dsh-tui.NOTICE` with:
   - Source repo: `https://github.com/peiyuwang54/deepseek-harness-cli`
   - Package: `packages/ui/tui` (`@deepseek-ai/dsh-tui`)
   - Copyright: DeepSeek
   - License: `MIT AND BSD-3-Clause`
   - A summary of Gidorah's modifications.
3. Keep the SPDX expression in the adapted package's `package.json`.
4. Do not use the DeepSeek name or logo as Gidorah's product identity.
5. Do not imply endorsement by DeepSeek.

### Suggested NOTICE text

```text
Gidorah includes an adapted version of the DeepSeek Harness terminal UI
(@deepseek-ai/dsh-tui), originally from
https://github.com/peiyuwang54/deepseek-harness-cli (packages/ui/tui).

Copyright (c) 2026 DeepSeek.
Licensed under the MIT License and the BSD 3-Clause License.
See third_party/dsh-tui.LICENSE for the full texts.

Modifications: replaced the DSH service/data layer with Gidorah's event bus,
removed unused DSH commands and integrations, and added Gidorah-specific
status, budget, research, and flight-recorder panels.
```

---

## 4. Bifrost attribution

Bifrost is an open-source project by Maxim AI. If Gidorah links to or bundles Bifrost:

- Include Bifrost's Apache-2.0 license and NOTICE.
- State that Gidorah is not an official Bifrost product.
- If we publish a Bifrost plugin, keep its Apache-2.0 license and attribution.
- Star the repository per the hackathon instructions.

Suggested README line:

> Gidorah uses [Bifrost](https://github.com/maximhq/bifrost) as its model gateway. Bifrost is an open-source project by Maxim AI and is licensed under Apache-2.0. Gidorah is not an official Bifrost product.

---

## 5. Tavily attribution

- Tavily is a commercial API, not an open-source dependency.
- Follow Tavily's terms of service and acceptable-use policy.
- Cite sources returned by Tavily in agent answers.
- Do not redistribute Tavily content beyond what the terms allow; the benchmark report should store metadata, sources, and aggregate metrics, not full page dumps.
- Include a README line: “Research powered by Tavily.”

Verify whether cached Tavily content may be retained in the open-source repo; if not, commit only query hashes, source URLs, and aggregate metrics.

---

## 5a. Bifrost plugin

- The Gidorah DLP/policy plugin is original code, licensed Apache-2.0 to match Bifrost.
- It does not store prompt content or secret values; it logs pattern class, hash, action, provider, and timestamp.
- If upstreamed, follow Bifrost's contribution guidelines and keep the license/notice.

---

## 5b. Replay traces and benchmark artifacts

Replay traces may contain prompts, file paths, and tool output. Before publishing:

- Redact secrets, tokens, customer names, and absolute home paths.
- Prefer metadata + synthetic fixtures for public traces.
- Do not publish full Tavily page content unless the terms allow it.
- Publish the raw benchmark JSONL only after a secret scan and a privacy review.

---

## 6. Trademarks

| Mark | Use |
|---|---|
| DeepSeek / DeepSeek Harness | Descriptive attribution only; not in the product name/logo |
| Bifrost / Maxim AI | Descriptive attribution only; not in the product name/logo |
| Tavily | Descriptive attribution only; not in the product name/logo |
| Gidorah | Our project name; check trademark availability before commercial launch |

---

## 7. Distribution checklist

- [ ] `LICENSE` (Gidorah, Apache-2.0)
- [ ] `NOTICE` (third-party attributions)
- [ ] `third_party/dsh-tui.LICENSE` (MIT + BSD-3-Clause)
- [ ] `third_party/dsh-tui.NOTICE`
- [ ] `third_party/pi-tui/LICENSE` (verify)
- [ ] `third_party/bifrost/LICENSE` if bundled
- [ ] `plugins/bifrost-dlp/LICENSE` (Apache-2.0)
- [ ] Replay traces/benchmark artifacts redacted and privacy-reviewed
- [ ] Dependency license scan clean
- [ ] README “Built with / powered by” section
- [ ] No DeepSeek/Bifrost/Tavily logos used as product identity
- [ ] Tavily terms reviewed for caching/benchmark publication
- [ ] No secrets or proprietary content in the repo
- [ ] SPDX headers/expressions on adapted packages

---

## 8. Open items

- [ ] Confirm Bifrost NOTICE for the pinned version.
- [ ] Confirm pi-tui license file for the pinned version.
- [ ] Confirm Tavily terms for caching and publishing benchmark excerpts.
- [ ] Decide Apache-2.0 vs MIT for Gidorah.
- [ ] Legal review before any commercial launch.
