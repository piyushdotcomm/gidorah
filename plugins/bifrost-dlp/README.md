# bifrost-dlp

A small, Apache-2.0 Bifrost plugin that adds two security checks to the Gidorah model plane. Both checks run before a request can leave the machine.

1. Confidential guard: a request carrying `x-gidorah-confidential: true` may only be served by a local provider (`ollama`). A cloud provider is rejected with a structured error, even if the virtual key is misconfigured.
2. DLP scan: the serialized request body is scanned for high-confidence secret patterns. The default action is block. Redact-and-forward is optional and applies only to non-confidential sessions. A scanner error fails closed.

The plugin also adds policy headers to the response and writes one structured policy decision event per request for the flight recorder. It never logs or returns the secret value, only the pattern class, a truncated SHA-256 hash, the action, the provider, and the model.

## What it does

| Surface | Behavior |
|---|---|
| Confidential guard | Reads `x-gidorah-confidential`. If the value is `true` and the provider is not local, rejects the request with `confidential_violation`. The body is not scanned or forwarded. |
| DLP scan | Scans the serialized body for the pattern classes below. Default action is block. `redact` rewrites the body only when the request is not confidential. |
| Fail closed | A scanner error, an invalid UTF-8 body, an oversized body, or an unwritable decision sink blocks the request with a structured error. |
| Response headers | Adds `x-gidorah-policy`, `x-gidorah-policy-version`, and `x-gidorah-dlp`. |
| Audit | Emits one JSON `policy_decision` event per request to the configured sink (stderr by default). The event has no prompt or body field. |

## Pattern classes

| Class | What it matches |
|---|---|
| `private-key` | PEM private-key blocks, including RSA, EC, OpenSSH, and PGP variants. |
| `aws-access-key` | AWS access key ids with the `AKIA` or `ASIA` prefix. |
| `openai-style-key` | OpenAI-style `sk-` keys. |
| `github-token` | GitHub tokens with the `ghp_`, `gho_`, `ghu_`, `ghs_`, or `ghr_` prefix. |
| `google-api-key` | Google API keys with the `AIza` prefix. |
| `slack-token` | Slack tokens with the `xoxb-`, `xoxa-`, `xoxp-`, `xoxr-`, or `xoxs-` prefix. |
| `tavily-key` | Tavily keys with the `tvly-` prefix. |
| `jwt` | JSON Web Tokens with three dot-separated segments. |
| `bearer-token` | `Bearer` credentials of 20 or more characters. |
| `env-assignment` | `.env`-style assignments of a `KEY`, `TOKEN`, `SECRET`, or `PASSWORD` variable to a high-entropy value. |

The classes and regexes mirror the TypeScript twin in `packages/shared/src/redaction.ts` so the agent-side redactor and the gateway backstop report the same names.

False positives are handled by `Config.Allowlist`, a list of pattern class names whose matches are reported in the decision event but not blocked. The adapter should map `dlp.allowlist` from `policy.yml` to this field and `dlp.default_action` to `Config.DefaultAction`. An allowlisted class stays visible in the event, so it is never a silent ignore, and the allowlist is class-scoped: allowing `env-assignment` does not weaken AWS key detection.

## Hook contract

The local contract has two interfaces. They exist so this package does not import Bifrost's plugin packages, which are not vendored in the offline build.

```go
type PreLLMHook interface {
	PreLLMHook(ctx context.Context, req *LLMRequest) (*LLMRequest, error)
}

type HTTPTransportResponseHeadersHook interface {
	HTTPTransportResponseHeadersHook(ctx context.Context, req *LLMRequest, headers http.Header) error
}
```

`LLMRequest` carries `Provider`, `Model`, `Body`, `Headers`, and the `Decision` recorded by the pre-hook. `PolicyPlane` implements both interfaces and is designed for concurrent use: the pattern set is immutable, per-request state lives on the request, and the sink write is mutex-guarded. The adapter should map `providers.local` from `policy.yml` to `Config.LocalProviders`.

PENDING: Bifrost's plugin package is not present in this offline build. At integration time, replace the local interfaces and `LLMRequest` with the real Bifrost plugin types and bind `PolicyPlane` to Bifrost's plugin registration. The adapter must:

1. Copy the provider, model, serialized body, and headers from the Bifrost request.
2. Return `PolicyError` or wrap it in the Bifrost structured error type.
3. Keep the `Decision` reachable by the response hook, or store it in adapter state keyed by request id.
4. Confirm the hook can read the serialized body without breaking streaming, which is still an open item in `docs/01-architecture/bifrost-model-plane.md` section 13.

## Response headers

| Header | Values |
|---|---|
| `x-gidorah-policy` | `confidential-local-only` or `standard`. |
| `x-gidorah-policy-version` | The policy version, default `1`. |
| `x-gidorah-dlp` | `clean`, `blocked:<class>`, `redacted:<class>`, or `blocked:policy` for a block that is not a pattern match. |

The documented value set is `clean` and `blocked:<class>`. `redacted:<class>` and `blocked:policy` are explicit extensions so the header never claims a scan result that did not happen. If a request reaches the response hook without a decision, the hook returns `missing_decision` instead of claiming `clean`.

## Decision event

One event per request, newline-delimited JSON:

```json
{
  "event": "policy_decision",
  "timestamp": "2026-11-03T00:00:00Z",
  "policy_version": "1",
  "rule_id": "gidorah.dlp.secret-scan",
  "action": "blocked",
  "reason": "secret pattern matched before egress",
  "provider": "deepseek",
  "model": "deepseek-flash",
  "confidential": false,
  "pattern_classes": ["aws-access-key"],
  "secret_hashes": ["sha256:0f1e2d3c4b5a6978"]
}
```

There is deliberately no body or prompt field. Hashes are the first 16 hex characters of SHA-256 with a `sha256:` prefix.

## Build and test

From this directory:

```bash
go vet ./...
go test ./...
go build ./...
```

PENDING: none of these commands has been run in this build. The machine has no Go toolchain, and the Bifrost plugin SDK packages are not available offline. The real build and load mechanism for the pinned Bifrost release, whether a Go plugin, a subprocess, or an in-tree package, must be confirmed at integration time.

`go test ./...` is PENDING for the same reason: there is no Go toolchain on this machine.

## Why this is a real upstream contribution

The plugin is not a header decoration. It enforces two independent controls at the last point before egress: a confidential-mode provider rejection and a secret-pattern block. It is dependency-free, it fails closed, and it emits an audit event with no prompt content. That is the shape a gateway maintainer can review and merge: small surface, explicit rule ids, per-pattern tests, a false-positive allowlist, and no secret material in logs. The same code is useful outside Gidorah because every Bifrost user with confidential traffic needs an egress guard.

## Pending

Not compiled or tested in this build: Go toolchain unavailable offline. Requires Go 1.22+ and the Bifrost plugin SDK; see MORNING_RUNBOOK.md.

`BUILD_STATUS.md` records the Go plugin build and test as PENDING. Also pending: substitution of the real Bifrost plugin package, validation against a running gateway, and confirmation that body scanning does not break streaming.

## License

Apache-2.0. See `LICENSE`.
