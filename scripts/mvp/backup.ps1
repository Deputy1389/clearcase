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

$remotes = @(git remote)
$hasOrigin = $remotes -contains "origin"

function Push-OriginMainIfConfigured {
  if (-not $hasOrigin) {
    Write-Host "No 'origin' remote configured yet."
    return
  }

  $origin = git remote get-url origin
  if ([string]::IsNullOrWhiteSpace($origin)) {
    Write-Host "No 'origin' remote configured yet."
    return
  }

  git push origin main
  if ($LASTEXITCODE -ne 0) {
    throw "git push failed."
  }

  Write-Host "Backup complete: pushed to origin/main."
}

$status = git status --porcelain
if (-not $status) {
  Push-OriginMainIfConfigured
  if (-not $hasOrigin) {
    Write-Host "No changes to back up."
  }
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $Message = "chore: backup $timestamp"
}

git add -A
if ($LASTEXITCODE -ne 0) {
  throw "git add failed."
}

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  $postCommitStatus = git status --porcelain
  if (-not $postCommitStatus) {
    Push-OriginMainIfConfigured
    if (-not $hasOrigin) {
      Write-Host "No changes to back up."
    }
    exit 0
  }
  throw "git commit failed."
}

if (-not $hasOrigin) {
  Write-Host "Commit created locally. No 'origin' remote configured yet."
  exit 0
}

Push-OriginMainIfConfigured
