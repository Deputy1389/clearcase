Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$agents = @(
  @{ Name = "mobile";   Path = "C:\Clearcase\cc-agent-mobile\STATUS.md" },
  @{ Name = "backend";  Path = "C:\Clearcase\cc-agent-backend\STATUS.md" },
  @{ Name = "smokes";   Path = "C:\Clearcase\cc-agent-smokes\STATUS.md" },
  @{ Name = "devx";     Path = "C:\Clearcase\cc-agent-devx\STATUS.md" },
  @{ Name = "docs";     Path = "C:\Clearcase\cc-agent-docs\STATUS.md" },
  @{ Name = "taxonomy"; Path = "C:\Clearcase\cc-agent-taxonomy\STATUS.md" }
)

foreach ($agent in $agents) {
  Write-Host "`n=== $($agent.Name.ToUpper()) ===" -ForegroundColor Cyan
  if (Test-Path $agent.Path) {
    Get-Content $agent.Path -TotalCount 40
  } else {
    Write-Host "Missing STATUS.md" -ForegroundColor Yellow
  }
}
