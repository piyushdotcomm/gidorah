# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | yes |

## Reporting a vulnerability

Do **not** open a public issue. Email the maintainer through the address on the
npm package (`npm view gidorah maintainers`) with a description, repro, and
impact. You will get an acknowledgement within 72 hours.

## Threat model and guarantees

- **Provider keys** belong to Bifrost, never to the agent. The package contains
  no keys.
- **One model egress path:** all model calls go through the Bifrost gateway.
- **Policy is below the prompt:** repo classification, virtual-key selection,
  budgets, confidentiality, and research access are decided outside the model.
- **Approvals:** reads are free; writes, shell, and git mutations require an
  explicit allow. Denials are audited.
- **Confidential mode:** local virtual key only, Tavily disabled, network shell
  commands denied.
- **Audit:** sessions are append-only JSONL with a SHA-256 hash chain;
  `gidorah audit verify` recomputes it. A hash chain is tamper-evident, not
  tamper-proof.
- **DLP:** outbound secrets are scanned; the Go plugin is source-tested and must
  be loaded into Bifrost on Linux for gateway-side enforcement.
- **Local data:** sessions/traces live under `~/.gidorah`. Protect that
  directory; it contains prompts and tool output.

## Dependencies

`@opentui/core` ships platform-native optional binaries. `npm audit` and pinned
versions are expected in CI. Report supply-chain concerns through the private
channel above.