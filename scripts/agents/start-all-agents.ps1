Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$agents = @(
  "C:\Clearcase\cc-agent-mobile",
  "C:\Clearcase\cc-agent-backend",
  "C:\Clearcase\cc-agent-smokes",
  "C:\Clearcase\cc-agent-devx",
  "C:\Clearcase\cc-agent-docs",
  "C:\Clearcase\cc-agent-taxonomy"
)

foreach ($dir in $agents) {
  $starter = Join-Path $dir "START_AGENT.ps1"
  if (-not (Test-Path $starter)) {
    Write-Warning "Missing starter: $starter"
    continue
  }

  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", $starter
  ) | Out-Null
}

Write-Host "Launched all agent terminals." -ForegroundColor Green
