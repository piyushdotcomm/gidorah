param(
  [switch]$Doctor
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# Load local credentials (gitignored).
. (Join-Path $repo "scripts\load-env.ps1")

function Test-Bifrost {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8080/" -UseBasicParsing -TimeoutSec 2
    return ($response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

if (-not (Test-Bifrost)) {
  Write-Host "Starting local model plane (datasheet + Bifrost)..." -ForegroundColor DarkGray
  $datasheet = Get-NetTCPConnection -LocalPort 8099 -State Listen -ErrorAction SilentlyContinue
  if (-not $datasheet) {
    Start-Process -FilePath (Get-Command node).Source -ArgumentList ".tools/datasheet-server.mjs" -WorkingDirectory $repo -WindowStyle Hidden
  }

  $creds = Get-Content (Join-Path $repo ".tools\credentials.env")
  $fwKey = (($creds | Where-Object { $_ -like "FW_KEY=*" }) -replace "^FW_KEY=", "")
  $env:FIREWORKS_API_KEY = $fwKey
  Start-Process -FilePath (Join-Path $repo ".tools\bifrost-bin\bifrost-http.exe") `
    -ArgumentList "-app-dir", ".tools\bifrost-app", "-port", "8080" `
    -WorkingDirectory $repo -WindowStyle Hidden
  Remove-Item Env:FIREWORKS_API_KEY -ErrorAction SilentlyContinue

  $ready = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Bifrost) { $ready = $true; break }
  }
  if (-not $ready) {
    throw "Bifrost did not start on http://127.0.0.1:8080. Run the commands in MORNING_RUNBOOK.md to see its logs."
  }
}

if ($Doctor) {
  node apps/cli/src/main.ts doctor
  exit $LASTEXITCODE
}

node apps/cli/src/main.ts tui
