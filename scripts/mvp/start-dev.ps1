Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

function Stop-ProcessTree([int]$ProcessId) {
  if ($ProcessId -le 0) { return }
  & cmd.exe /c "taskkill /PID $ProcessId /T /F >NUL 2>&1"
}

function Stop-ExistingWorkerProcesses {
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.Name -eq "node.exe" -and $_.CommandLine -like "*apps/worker/src/worker.ts*") -or
      ($_.Name -eq "cmd.exe" -and $_.CommandLine -like "*npm run worker:start*")
    }

  foreach ($proc in $processes) {
    Stop-ProcessTree -ProcessId $proc.ProcessId
  }
}

Write-Host "Running MVP preflight..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "$repoRoot\scripts\mvp\preflight.ps1"

Write-Host ""
Write-Host "Starting worker..." -ForegroundColor Cyan
Stop-ExistingWorkerProcesses
$workerProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run worker:start" -WorkingDirectory $repoRoot -PassThru
Write-Host "Worker started (PID $($workerProc.Id))." -ForegroundColor DarkGray

Write-Host ""
Write-Host "Starting API dev server..." -ForegroundColor Cyan
npm run api:dev
