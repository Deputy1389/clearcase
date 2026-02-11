param(
  [string]$Message = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

if (-not (Test-Path ".git")) {
  throw "Git repository not initialized at $repoRoot"
}

$status = git status --porcelain
if (-not $status) {
  Write-Host "No changes to back up."
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $Message = "chore: backup $timestamp"
}

git add -A
git commit -m $Message

$origin = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($origin)) {
  Write-Host "Commit created locally. No 'origin' remote configured yet."
  exit 0
}

git push origin main
Write-Host "Backup complete: pushed to origin/main."
