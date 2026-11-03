> **Current state (2026-11-03):** the runtime is npm + `node:test` + `node:sqlite` +
> custom scripts (ADR-0013). The pnpm/Vitest/better-sqlite3/tsdown table below is
> historical. See `README.md` and `FINAL_STATE.md` for what is verified today.
# Tech Stack and Repository

**Status:** Draft · **Owner:** Engineering · **Last updated:** 2026-11-03

---

## 1. Language and runtime

| Choice | Value | Rationale |
|---|---|---|
| Language | **TypeScript** (strict) | TUI, Tavily SDK, Bifrost/OpenAI SDK are TypeScript-first |
| Runtime | **Node.js 22 LTS** (or 24 LTS) | Stable, native fetch, broad package support |
| Package manager | **pnpm** (via corepack) | Workspace monorepo; TUI source uses pnpm |
| Module system | ESM | Modern packages; TUI is ESM |
| Test runner | **Vitest** | Fast, TS-native, good mocking |
| Build | **tsdown** or **tsup** | Simple ESM bundles; per-package builds |
| Bifrost plugin | **Go** (separate module) | Bifrost plugin hooks are Go; Apache-2.0 |

The development machine currently has Node 26; use Node 22/24 LTS for the submission build to reduce native-module risk. Record the exact version in `.nvmrc` and CI.

---

## 2. Key dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| `openai` | OpenAI-compatible client for Bifrost | Base URL override; custom headers |
| `@tavily/core` | Tavily search/extract | Official JS SDK |
| `@earendil-works/pi-tui` | TUI framework | Pinned; comes from DSH TUI |
| `better-sqlite3` | Research cache, budget cache | Synchronous, fast; native build |
| `zod` | Config/policy/event validation | Fail closed |
| `commander` | CLI commands | Simple, stable |
| `execa` | Shell tool | Better process control than child_process |
| `fast-glob` | File discovery | Respects ignore patterns |
| `diff` | Diff generation | Already a TUI dependency |
| `pino` | Structured logs | Redaction support |
| `canonicalize` | RFC 8785 canonical JSON for audit hashes | Deterministic chain |
| `@ast-grep/napi` or `web-tree-sitter` | Optional repo map/symbol index | Start with a simple extractor; add if needed |
| `picocolors` | ANSI color | Lightweight |
| `vitest` | Tests | Unit/integration |
| `msw` or `nock` | HTTP mocks | Bifrost/Tavily fixtures |

**Dependency policy**

- Pin exact versions in `pnpm-lock.yaml`; no `^` for critical infrastructure.
- Every new dependency needs a license check and a justification.
- No direct provider SDKs (OpenAI/Anthropic/etc.) beyond the Bifrost client.
- No web framework; v1 is CLI-only.

---

## 3. Repository layout

```text
gidorah/
├─ apps/
│  ├─ cli/                  # `gidorah` entrypoint, headless mode
│  └─ tui/                  # adapted @deepseek-ai/dsh-tui shell
├─ packages/
│  ├─ core/                 # agent loop, events, sessions, context
│  ├─ policy/               # repo classification, budgets, approvals
│  ├─ bifrost/              # gateway client, headers, logs, 402/fallback
│  ├─ tavily/               # Scout, query builder, evidence cards, cache
│  ├─ benchmark/            # task runner, arms, metrics, report
│  └─ shared/               # types, config, errors, redaction
├─ plugins/
│  └─ bifrost-dlp/          # Go plugin: confidential guard + DLP + headers
├─ skills/
│  └─ gidorah/              # project-specific agent skill
├─ config/
│  ├─ policy.example.yml
│  ├─ bifrost/
│  │  ├─ providers.example.json
│  │  ├─ virtual-keys.example.json
│  │  └─ routing-rules.example.json
│  └─ profiles/
│     ├─ cloud.yml
│     └─ confidential.yml
├─ third_party/
│  └─ dsh-tui/              # vendored TUI + LICENSE + NOTICE
├─ docs/
├─ tests/
│  ├─ fixtures/             # repos, tasks, mock provider
│  ├─ conformance/          # CT-01..CT-40
│  ├─ chaos/                # dependency-kill tests
│  ├─ replay/               # recorded demo traces
│  └─ e2e/
├─ scripts/
│  ├─ dev-bifrost.sh
│  ├─ dev-ollama.sh
│  └─ bench.sh
├─ .nvmrc
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ LICENSE
├─ NOTICE
└─ README.md
```

### Package boundaries

| Package | May import | Must not import |
|---|---|---|
| `shared` | nothing internal | everything else |
| `core` | `shared` | `bifrost`, `tavily`, `policy` (use interfaces) |
| `policy` | `shared` | `core` runtime |
| `bifrost` | `shared` | `core`, `policy` |
| `tavily` | `shared` | `core`, `policy` |
| `benchmark` | all packages | UI |
| `apps/cli` | all packages | — |
| `apps/tui` | `core` events, `shared` | `bifrost`/`tavily` directly |

Dependency inversion: `core` defines `ModelClient`, `ResearchClient`, `ApprovalService`, and `BudgetService` interfaces; adapters implement them.

---

## 4. Coding standards

- TypeScript `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- No `any` in public APIs; use `unknown` + validation.
- All external input validated with Zod (policy, config, Tavily responses, Bifrost errors).
- Result types for expected failures; exceptions only for programmer errors.
- Every tool returns a structured `ToolResult`; no thrown errors across the tool boundary.
- No secrets in logs; use a redaction helper.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Changesets for versioning after v0.1.
- Formatting/linting: Biome or ESLint + Prettier; pick one and enforce in CI.
- File names: kebab-case; types: PascalCase; functions: camelCase.

---

## 5. Configuration

| File | Scope | Contents |
|---|---|---|
| `~/.gidorah/policy.yml` | User/machine | Confidential paths/remotes, budgets, research, approvals |
| `~/.gidorah/config.yml` | User/machine | Bifrost URL, model names, TUI theme, retention |
| `config/bifrost/*.json` | Repo examples | Providers, virtual keys, routing rules |
| Env vars | Secrets | API keys, Bifrost VKs, Tavily key |
| `.env.example` | Repo | Names only, no values |

Precedence: CLI flags > env > `~/.gidorah/config.yml` > repo defaults. Policy is **not** overridable by repo files.

---

## 6. Build and packaging

- `pnpm build` builds all packages with tsdown.
- `pnpm gidorah` runs the CLI from source.
- `pnpm package` produces a tarball; `npm pack` for local install.
- v1 install: `npm i -g gidorah` or `npx gidorah`.
- Native `better-sqlite3` requires prebuilds; test on Windows/macOS/Linux.
- Optional: a standalone binary via Node SEA or `pkg` after the hackathon.

---

## 7. Versioning

- `0.x.y` during the hackathon.
- Record Bifrost, Tavily SDK, pi-tui, Node, and model versions in `docs/releases/<version>.md`.
- Benchmark reports pin the exact versions; a model or Bifrost change invalidates comparisons.
- After v1.0, semver with changesets.

---

## 8. Open items

- [ ] Confirm Node 22 vs 24 for native module compatibility.
- [ ] Confirm `better-sqlite3` prebuilds on Windows with Node 22/24.
- [ ] Decide tsdown vs tsup.
- [ ] Decide Biome vs ESLint/Prettier.
- [ ] Confirm pi-tui license and pin its version.
- [ ] Confirm TUI package can build outside the DSH workspace (or vendor required internals).

## Implementation reality (2026-11-03)

Superseded assumptions above are kept as history. The actual runtime is:

- **Language/runtime:** TypeScript executed directly by Node 26 type stripping.
  No bundler in the loop; `tsc` is used for a strict no-emit typecheck only.
- **Package manager:** npm with a committed `package-lock.json`; `pnpm` files were
  removed after the sandbox could not complete a pnpm install (symlink denial).
- **Tests:** `node:test` via `scripts/run-tests.ts`; Vitest is not installed.
- **Storage:** `node:sqlite`; better-sqlite3 is not installed.
- **Build/lint:** `scripts/build.ts` (module-graph check) and a custom
  `scripts/lint.ts` enforcing the non-negotiables; Biome/ESLint are not installed.
- **TUI:** plain renderer plus the TUI adapter panels; the DSH TUI package is
  vendored, not yet wired behind the CLI.
- **Bifrost plugin:** Go, bound to `github.com/maximhq/bifrost/core/schemas`.

See ADR-0013 (dependency-free runtime), ADR-0014 (plain TUI first), ADR-0015
(mock-first evidence). The original pnpm/Vitest/better-sqlite3/tsdown plan is
historical.
