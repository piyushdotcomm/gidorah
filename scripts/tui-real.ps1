param(
  [switch]$Doctor,
  [Parameter(ValueFromRemainingArguments = $true)]$Rest
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
. (Join-Path $PSScriptRoot "load-env.ps1")
if ([string]::IsNullOrEmpty($env:BIFROST_VK_CLOUD)) { throw "BENCH_VK missing from .tools/credentials.env" }
if ([string]::IsNullOrEmpty($env:TAVILY_API_KEY)) { throw "TV_KEY missing from .tools/credentials.env" }
if ($Doctor) { node apps/cli/src/main.ts doctor; exit $LASTEXITCODE }
node apps/cli/src/main.ts tui