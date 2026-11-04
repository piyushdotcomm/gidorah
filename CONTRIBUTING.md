# Contributing to Gidorah

Thanks for helping. Gidorah is a governed coding agent; correctness and evidence
matter more than feature count.

## Setup

```bash
git clone https://github.com/piyushdotcom/gidorah.git
cd gidorah
npm ci
node apps/cli/src/main.ts doctor
```

Requirements: Node **>= 26.4**. For real sessions you also need a Bifrost gateway
and a Tavily key; never commit keys. Use `.env.example` as a reference and keep
local secrets in `.tools/credentials.env` or your environment.

## Before a PR

```bash
npm run lint
npm run typecheck
npm test          # 167 tests
node apps/cli/src/main.ts conformance
node apps/cli/src/main.ts chaos
```

Rules:

- Do not bypass the approval policy, audit hash chain, confidential mode, or
  benchmark accounting.
- New behavior needs a test or a demo path. No fabricated benchmark numbers.
- Keep the provider path through Bifrost. No direct provider SDK calls.
- UI changes should include a screenshot or deterministic frame under
  `apps/tui/screenshots/` or `apps/tui/DEMO-*`.
- Major decisions get an ADR in `docs/05-decisions/`.

## Commits

Use a scoped prefix (`feat(tui):`, `fix(policy):`, `docs:`, `chore:`), keep the
diff focused, and explain why in the body. Squash noise before opening a PR.

## Reporting security issues

See `SECURITY.md` — do not open a public issue for a vulnerability.

## License

Contributions are accepted under Apache-2.0.