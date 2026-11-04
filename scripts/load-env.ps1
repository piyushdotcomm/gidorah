# Dot-source me to load local Gidorah credentials into this PowerShell session:
#   . .\scripts\load-env.ps1
$repo = Split-Path -Parent $PSScriptRoot
$credPath = Join-Path $repo ".tools\credentials.env"
if (-not (Test-Path $credPath)) { throw "missing $credPath" }
$creds = Get-Content $credPath
function Get-GidorahCred([string]$name) {
  $line = $creds | Where-Object { $_ -like "$name=*" } | Select-Object -First 1
  if ($null -eq $line) { return "" }
  return ($line -replace "^$name=", "")
}
$env:GIDORAH_MODE = "cloud"
$env:BIFROST_BASE_URL = "http://127.0.0.1:8080/openai"
$env:BIFROST_VK_CLOUD = Get-GidorahCred "BENCH_VK"
$env:TAVILY_API_KEY = Get-GidorahCred "TV_KEY"
$env:GIDORAH_MODEL_ALIAS = "fireworks/accounts/fireworks/models/deepseek-v4p1-flash"
Remove-Item Function:\Get-GidorahCred -ErrorAction SilentlyContinue