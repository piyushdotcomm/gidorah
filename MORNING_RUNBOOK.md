# Morning runbook: turning mock evidence into real evidence

This build is complete offline. Everything below is PENDING only because this
machine has no provider keys, no Bifrost gateway, no Ollama, and no Go toolchain.
Do not edit BUILD_REPORT.md with estimates; run the commands and paste the real
numbers.

## 1. Environment

```bash
# Gidorah shell
export GIDORAH_MODE=cloud
export BIFROST_BASE_URL=http://127.0.0.1:8080/openai
export BIFROST_VK_CLOUD=gidorah-<user>-cloud
export BIFROST_VK_LOCAL=gidorah-<user>-local
export TAVILY_API_KEY=tvly-...
export OLLAMA_URL=http://127.0.0.1:11434
export GIDORAH_HOME=~/.gidorah
```

## 2. Start the real dependencies

```bash
# terminal 1: Bifrost gateway (pin the release in the report)
npx -y @maximhq/bifrost
# or: docker run -p 8080:8080 -v "$(pwd)/data:/app/data" maximhq/bifrost

# terminal 2: local model for confidential mode
ollama serve
ollama pull qwen2.5-coder:3b

# Bifrost provider key lives in Bifrost config, never in the Gidorah process.
# Create providers: deepseek flash/pro, ollama qwen2.5-coder:3b.
# Create virtual keys from config/bifrost/virtual-keys.example.json:
#   gidorah-<user>-cloud  (deepseek/*, monthly budget)
#   gidorah-<user>-local  (ollama/* only, no dollar budget)
# Apply routing rules from config/bifrost/routing-rules.example.json and the
# aliases gidorah-auto/fast/strong/local.
```

## 3. Verify wiring

```bash
node apps/cli/src/main.ts doctor          # expect PASS for bifrost, policy, mode=cloud
node apps/cli/src/main.ts policy validate config/policy.example.yml
```

## 4. Run the real evidence

```bash
# 3-task pilot first; inspect every row of raw.jsonl before the full run
node apps/cli/src/main.ts bench --pilot

# Full run only if the pilot rows are clean and the budget allows
node apps/cli/src/main.ts bench --full

# Real demo plus a fresh replay trace
node apps/cli/src/main.ts demo --record
node apps/cli/src/main.ts demo --replay

# Security evidence
node apps/cli/src/main.ts audit verify --all
node apps/cli/src/main.ts redteam
node apps/cli/src/main.ts chaos
node apps/cli/src/main.ts conformance
```

## 5. Go plugin

```bash
cd plugins/bifrost-dlp
go vet ./...
go test ./...
# then load the plugin into the pinned Bifrost build per its plugin docs
```

## 6. Update the report

For each command, replace the matching PENDING row in BUILD_REPORT.md with:
- the exact command,
- the date and machine,
- the exit code,
- the headline numbers from `bench/<run>/report.md` and `raw.jsonl`.

Rules that do not relax with keys:
- 402 is never retried; a task cap never authorizes spend Bifrost would reject.
- Confidential sessions still make zero cloud and zero Tavily calls.
- No benchmark number is estimated; every number comes from Bifrost/Tavily usage.
- If a lever loses (Tavily, compaction, Code Mode), report the negative result.

## Appendix: what was actually installed and how (2026-11-03)

### Bifrost 2.4.0 from source (npm CDN was throttled)

```bash
# Go is installed under .tools/go; sparse clone avoids the docs-heavy tarball
git -c http.sslBackend=openssl clone --depth 1 --filter=blob:none --sparse https://github.com/maximhq/bifrost .tools/bifrost-git
cd .tools/bifrost-git && git -c http.sslBackend=openssl sparse-checkout set cmd core framework transports plugins cli
go work init && go work use -r .
mkdir -p transports/bifrost-http/ui && echo '<!doctype html><html><body>placeholder</body></html>' > transports/bifrost-http/ui/index.html
cd transports/bifrost-http && go build -trimpath -o ../../../bifrost-bin/bifrost-http.exe .
```

Start it (PowerShell BOM pitfall: config.json must have no BOM):

```bash
node .tools/datasheet-server.mjs            # serves {} for pricing / model-parameters on :8099
bifrost-http.exe --app-dir .tools/bifrost-app --port 8080
```

`config.json` needs `framework.pricing.pricing_url` and `model_parameters_url` pointing at the local datasheet server, otherwise Bifrost fatals on startup. Read the generated virtual key from `.tools/bifrost-app/config.db` table `governance_virtual_keys` column `value`.

### Ollama 0.40.13

Download `ollama-windows-amd64.zip` from the Ollama releases, extract, then run with a workspace home so the sandbox does not block `~/.ollama`:

```bash
USERPROFILE=.tools/home HOME=.tools/home OLLAMA_MODELS=.tools/ollama-models .tools/ollama/ollama.exe serve
curl -X POST http://127.0.0.1:11434/api/pull -d '{"model":"qwen2.5-coder:0.5b","stream":true}'
```

The model blob CDN (Cloudflare R2) failed at 379/398 MB in this environment; retry on a normal network.

### pnpm

pnpm 12.16.1 is installed as a standalone binary under `.tools/pnpm`. `pnpm run ...` works. `pnpm install` cannot complete in this sandbox because pnpm needs symlinks and a store lock outside the workspace; use `npm install` here.
## Verified real-run commands (2026-11-03)

```bash
# Real Bifrost (built from source) + real Ollama are running on :8080 and :11434.
# The local dev virtual key is read from .tools/bifrost-app/config.db (governance_virtual_keys.value).
export GIDORAH_MODE=cloud
export BIFROST_BASE_URL=http://127.0.0.1:8080/openai
export BIFROST_VK_CLOUD=<the sk-bf key from config.db>
export GIDORAH_HOME=./.gidorah-real
export GIDORAH_MODEL_ALIAS=ollama/qwen2.5-coder:0.5b   # provider-qualified model for a real gateway
export GIDORAH_MAX_TOKENS=48                            # required with the tiny model
node apps/cli/src/main.ts run "Say hi" --yes
node apps/cli/src/main.ts audit verify --all
```

Ollama model install note: if the weights CDN stalls near completion, finish the tail with an HTTP range request to
`https://registry.ollama.ai/v2/library/<model>/blobs/sha256:<digest>`, move the completed file to
`.tools/ollama-models/blobs/sha256-<digest>`, then re-run `ollama pull` so it verifies the digest.
## Real cloud provider setup used (Fireworks AI, 2026-11-03)

```bash
# Bifrost config: providers.fireworks with key value env.FIREWORKS_API_KEY
export FIREWORKS_API_KEY=fw_...
# governance virtual key "gidorah-cloud" (value sk-bf-gidorah-cloud-dev) with provider_configs provider=fireworks

# Gidorah shell
export GIDORAH_MODE=cloud
export BIFROST_BASE_URL=http://127.0.0.1:8080/openai
export BIFROST_VK_CLOUD=sk-bf-gidorah-cloud-dev
export GIDORAH_MODEL_ALIAS=fireworks/accounts/fireworks/models/deepseek-v4p1-flash
export GIDORAH_MAX_TOKENS=1200
node apps/cli/src/main.ts run "fix the failing test" --yes
```

Tavily:

```bash
export TAVILY_API_KEY=tvly-...
# packages/tavily/src/client.ts is the real client; the Scout uses it when configured
```

Both keys are in `.tools/credentials.env` on this machine (gitignored). Rotate them after the demo because they were shared in chat.