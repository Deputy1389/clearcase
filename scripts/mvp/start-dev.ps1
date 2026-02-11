Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

Write-Host "Running MVP preflight..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File "$repoRoot\scripts\mvp\preflight.ps1"

Write-Host ""
Write-Host "Starting API dev server..." -ForegroundColor Cyan
npm run api:dev
