param(
  [switch]$IncludeRealOcr
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
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

function Resolve-AwsCliPath {
  if (Get-Command aws -ErrorAction SilentlyContinue) {
    return "aws"
  }

  foreach ($path in @(
    "C:\Program Files\Amazon\AWSCLIV2\aws.exe",
    "C:\Program Files (x86)\Amazon\AWSCLIV2\aws.exe"
  )) {
    if (Test-Path $path) {
      return $path
    }
  }

  return $null
}

function Convert-ToActionableError([string]$CheckName, [string]$RawMessage) {
  if ($RawMessage -match "Missing \.env") {
    return "$CheckName failed: environment file missing. Create '.env' from '.env.example', populate required values, and rerun."
  }

  if ($RawMessage -match "Missing required env vars in \.env") {
    return "$CheckName failed: required env vars are missing. Add AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and SQS_QUEUE_URL to '.env'."
  }

  if ($RawMessage -match "API did not become healthy|API health check failed") {
    return "$CheckName failed: API is down or not healthy. Start the API with 'npm run api:start' and verify http://127.0.0.1:3001/health."
  }

  if ($RawMessage -match "AWS CLI is not installed") {
    return "$CheckName failed: AWS CLI is unavailable. Install AWS CLI v2 and ensure 'aws' is on PATH."
  }

  if ($RawMessage -match "SQS|queue|send-message|get-queue-attributes|Failed to enqueue") {
    return "$CheckName failed: queue access failed. Verify SQS_QUEUE_URL, AWS_REGION, credentials, queue policy, and network connectivity. Details: $RawMessage"
  }

  return "$CheckName failed: $RawMessage"
}

function Invoke-QueueHealthCheck([string]$AwsCli, [string]$QueueUrl, [string]$Region) {
  $output = & $AwsCli sqs get-queue-attributes --queue-url $QueueUrl --region $Region --attribute-names ApproximateNumberOfMessages --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    $details = ($output | Out-String).Trim()
    throw "Queue health check failed for SQS_QUEUE_URL='$QueueUrl' in AWS_REGION='$Region'. Verify queue URL, credentials, queue permissions, and network access. AWS error: $details"
  }
}

function Invoke-SmokeScript(
  [System.Collections.Generic.List[object]]$Results,
  [string]$CheckName,
  [string]$ScriptPath,
  [hashtable]$NamedArguments = @{}
) {
  Step "Running $CheckName"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()

  try {
    & $ScriptPath @NamedArguments
    $sw.Stop()
    $Results.Add([pscustomobject]@{
      Check       = $CheckName
      Status      = "PASS"
      DurationSec = [Math]::Round($sw.Elapsed.TotalSeconds, 1)
      Detail      = "ok"
    })
  }
  catch {
    $sw.Stop()
    $rawMessage = $_.Exception.Message
    $detail = Convert-ToActionableError -CheckName $CheckName -RawMessage $rawMessage
    $Results.Add([pscustomobject]@{
      Check       = $CheckName
      Status      = "FAIL"
      DurationSec = [Math]::Round($sw.Elapsed.TotalSeconds, 1)
      Detail      = $detail
    })
    throw $detail
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $repoRoot ".env"
$results = [System.Collections.Generic.List[object]]::new()

try {
  Step "Precheck: environment file"
  try {
    if (-not (Test-Path $envPath)) {
      throw "Missing .env at $envPath. Create it from .env.example and retry."
    }
    $results.Add([pscustomobject]@{
      Check       = "Precheck env file"
      Status      = "PASS"
      DurationSec = 0
      Detail      = "ok"
    })
  }
  catch {
    $detail = Convert-ToActionableError -CheckName "Precheck env file" -RawMessage $_.Exception.Message
    $results.Add([pscustomobject]@{
      Check       = "Precheck env file"
      Status      = "FAIL"
      DurationSec = 0
      Detail      = $detail
    })
    throw $detail
  }

  Step "Precheck: required environment variables"
  try {
    $envMap = Get-DotEnvMap $envPath
    $required = @("AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "SQS_QUEUE_URL")
    $missing = @()
    foreach ($k in $required) {
      if (-not $envMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envMap[$k])) {
        $missing += $k
      } else {
        [Environment]::SetEnvironmentVariable($k, $envMap[$k], "Process")
      }
    }
    if ($missing.Count -gt 0) {
      throw "Missing required env vars in .env: $($missing -join ', ')"
    }
    $results.Add([pscustomobject]@{
      Check       = "Precheck env vars"
      Status      = "PASS"
      DurationSec = 0
      Detail      = "ok"
    })
  }
  catch {
    $detail = Convert-ToActionableError -CheckName "Precheck env vars" -RawMessage $_.Exception.Message
    $results.Add([pscustomobject]@{
      Check       = "Precheck env vars"
      Status      = "FAIL"
      DurationSec = 0
      Detail      = $detail
    })
    throw $detail
  }

  Step "Precheck: AWS CLI + queue connectivity"
  try {
    $awsCli = Resolve-AwsCliPath
    if ([string]::IsNullOrWhiteSpace($awsCli)) {
      throw "AWS CLI is not installed or not in PATH."
    }
    Invoke-QueueHealthCheck -AwsCli $awsCli -QueueUrl $envMap["SQS_QUEUE_URL"] -Region $envMap["AWS_REGION"]
    $results.Add([pscustomobject]@{
      Check       = "Precheck queue"
      Status      = "PASS"
      DurationSec = 0
      Detail      = "ok"
    })
  }
  catch {
    $detail = Convert-ToActionableError -CheckName "Precheck queue" -RawMessage $_.Exception.Message
    $results.Add([pscustomobject]@{
      Check       = "Precheck queue"
      Status      = "FAIL"
      DurationSec = 0
      Detail      = $detail
    })
    throw $detail
  }

  Invoke-SmokeScript -Results $results -CheckName "Phase 3 smoke" -ScriptPath (Join-Path $PSScriptRoot "phase3-smoke.ps1") -NamedArguments @{ StartApi = $true }
  Invoke-SmokeScript -Results $results -CheckName "Phase 4 smoke" -ScriptPath (Join-Path $PSScriptRoot "phase4-smoke.ps1") -NamedArguments @{ StartWorker = $true }
  Invoke-SmokeScript -Results $results -CheckName "Phase 5 smoke" -ScriptPath (Join-Path $PSScriptRoot "phase5-smoke.ps1") -NamedArguments @{ StartApi = $true; StartWorker = $true }
  Invoke-SmokeScript -Results $results -CheckName "Phase 6 smoke" -ScriptPath (Join-Path $PSScriptRoot "phase6-smoke.ps1") -NamedArguments @{ StartApi = $true; StartWorker = $true }
  Invoke-SmokeScript -Results $results -CheckName "Phase 7 smoke" -ScriptPath (Join-Path $PSScriptRoot "phase7-smoke.ps1") -NamedArguments @{ StartApi = $true; StartWorker = $true }
  Invoke-SmokeScript -Results $results -CheckName "Taxonomy smoke" -ScriptPath (Join-Path $PSScriptRoot "taxonomy-smoke.ps1") -NamedArguments @{ StartApi = $true; StartWorker = $true }
  if ($IncludeRealOcr) {
    Invoke-SmokeScript -Results $results -CheckName "Phase 8 real OCR smoke" -ScriptPath (Join-Path $PSScriptRoot "phase8-real-ocr-smoke.ps1") -NamedArguments @{ StartApi = $true; StartWorker = $true }
  }
}
catch {
  Write-Host ""
  Write-Host "Smoke summary (failure)" -ForegroundColor Red
  $results | Format-Table -AutoSize | Out-Host
  throw
}

Write-Host ""
Write-Host "Smoke summary (success)" -ForegroundColor Green
$results | Format-Table -AutoSize | Out-Host

[ordered]@{
  totalChecks = $results.Count
  passed      = @($results | Where-Object { $_.Status -eq "PASS" }).Count
  failed      = @($results | Where-Object { $_.Status -eq "FAIL" }).Count
  checks      = $results
} | ConvertTo-Json -Depth 6 -Compress
