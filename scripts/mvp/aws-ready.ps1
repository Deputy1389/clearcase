Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-CheckedCommand([scriptblock]$Command, [string]$FailureMessage) {
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function Resolve-AwsCliPath {
  if (Get-Command aws -ErrorAction SilentlyContinue) {
    return "aws"
  }

  $knownPaths = @(
    "C:\Program Files\Amazon\AWSCLIV2\aws.exe",
    "C:\Program Files (x86)\Amazon\AWSCLIV2\aws.exe"
  )

  foreach ($path in $knownPaths) {
    if (Test-Path $path) {
      return $path
    }
  }

  return $null
}

function Get-DotEnvMap([string]$Path) {
  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    if ($line.StartsWith("#")) { return }
    if ($line -notmatch "^[A-Za-z_][A-Za-z0-9_]*=") { return }

    $split = $line.Split("=", 2)
    $key = $split[0].Trim()
    $value = $split[1].Trim()

    if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $map[$key] = $value
  }
  return $map
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $repoRoot ".env"

if (-not (Test-Path $envPath)) {
  throw "Missing .env at $envPath"
}

$envMap = Get-DotEnvMap $envPath

$requiredKeys = @(
  "AWS_REGION",
  "S3_BUCKET",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY"
)

Step "Checking required AWS env keys in .env"
$missing = @()
foreach ($key in $requiredKeys) {
  if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    $missing += $key
    continue
  }
  Write-Host "$key=OK"
  [Environment]::SetEnvironmentVariable($key, $envMap[$key], "Process")
}

if ($missing.Count -gt 0) {
  throw "Missing AWS settings in .env: $($missing -join ', ')"
}

Step "Checking AWS CLI"
$awsCli = Resolve-AwsCliPath
if ([string]::IsNullOrWhiteSpace($awsCli)) {
  throw "AWS CLI is not installed or not in PATH."
}

Step "Running aws sts get-caller-identity"
Invoke-CheckedCommand { & $awsCli sts get-caller-identity --output json } "AWS credentials are invalid or not usable."

Step "Checking S3 bucket access"
$bucket = $envMap["S3_BUCKET"]
Invoke-CheckedCommand { & $awsCli s3api head-bucket --bucket $bucket } "S3 bucket access check failed for '$bucket'. Verify bucket name, region, and IAM policy."

Step "AWS readiness complete"
Write-Host "AWS credentials and bucket access are valid." -ForegroundColor Green
