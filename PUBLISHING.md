# Publishing Gidorah to npm

At the time of writing, the public name `gidorah` is unclaimed (`npm view gidorah`
returns 404). Confirm before publishing; use a scope if that changes.

## Build the tarball

```bash
npm run pack:npm
# -> .tools/gidorah-<version>.tgz
```

This runs `tsc` into `dist/`, stages runtime assets, and creates the tarball.
It includes the bin, compiled dist, config examples, demo replay data, README,
LICENSE, NOTICE and third-party licenses. It excludes keys, `.tools/`, `bench/`,
`evidence/`, docs, tests (except replay) and the Go plugin. Provider keys are
never included: users configure Bifrost and Tavily themselves.

## Publish

```bash
npm login                    # account with 2FA
npm publish .tools/gidorah-0.1.0.tgz --access public
npm view gidorah version
npm install -g gidorah@0.1.0
gidorah --version && gidorah doctor
```

The published package requires **Node >= 26.4** and pulls `@opentui/core`
(including its platform-native optional binary) plus pi-tui.

## Release checklist

- Bump `version` (semver); add `repository`, `homepage`, `bugs` URLs.
- Keep `engines.node` at `>=26.4.0`.
- Run `npm run lint`, `npm run typecheck`, `npm test`.
- Tag the source: `git tag v0.1.0 && git push --tags`.
- Rotate any development keys before announcing.

## Offline install smoke test

```bash
npm install --prefix .tools/pkg-test .tools/gidorah-0.1.0.tgz
GIDORAH_HOME=.tools/pkg-home GIDORAH_MODE=mock npm_config_prefix=.tools/pkg-test \
  node .tools/pkg-test/node_modules/gidorah/bin/gidorah.js doctor
```

The current tarball installs and reports `0.1.0` with PASS for node, mode and the
mock gateway. `npm publish --dry-run` also succeeds (auth is required only for the
real publish).