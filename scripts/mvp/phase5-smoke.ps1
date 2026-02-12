param(
  [switch]$StartApi,
  [switch]$StartWorker
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

  foreach ($p in @("C:\Program Files\Amazon\AWSCLIV2\aws.exe", "C:\Program Files (x86)\Amazon\AWSCLIV2\aws.exe")) {
    if (Test-Path $p) {
      return $p
    }
  }

  return $null
}

function Stop-ProcessTree([int]$ProcessId) {
  if ($ProcessId -le 0) { return }
  & cmd.exe /c "taskkill /PID $ProcessId /T /F >NUL 2>&1"
}

function Stop-ExistingApiProcesses {
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.Name -eq "node.exe" -and $_.CommandLine -like "*apps/api/src/server.ts*") -or
      ($_.Name -eq "cmd.exe" -and $_.CommandLine -like "*npm run api:start*")
    }

  foreach ($proc in $processes) {
    Stop-ProcessTree -ProcessId $proc.ProcessId
  }
}

function Wait-ApiHealthy([int]$TimeoutSeconds = 35) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $code = curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:3001/health"
    if ($code -eq "200") {
      return
    }
    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)

  throw "API health check failed at http://127.0.0.1:3001/health after $TimeoutSeconds seconds. The API may be down or crashed; run 'npm run api:start' and retry."
}

function Wait-ExtractionPersisted(
  [string]$CaseId,
  [string]$AssetId,
  [hashtable]$Headers,
  [int]$TimeoutSeconds = 240
) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = ""
  do {
    try {
      $caseAfter = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/cases/$CaseId" -Headers $Headers
      $extraction = $caseAfter.extractions | Where-Object { $_.assetId -eq $AssetId } | Select-Object -First 1
      if ($null -ne $extraction) {
        return @{
          caseAfter = $caseAfter
          extraction = $extraction
        }
      }
    }
    catch {
      $lastError = $_.Exception.Message
    }
    Start-Sleep -Milliseconds 900
  } while ((Get-Date) -lt $deadline)

  if (-not [string]::IsNullOrWhiteSpace($lastError)) {
    throw "Timed out waiting for extraction persistence (caseId=$CaseId, assetId=$AssetId). Last API error: $lastError"
  }
  throw "Timed out waiting for extraction persistence (caseId=$CaseId, assetId=$AssetId). Queue backlog or worker/API issues may be delaying processing."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
  throw "Missing .env at $envPath. Create it from .env.example and set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and SQS_QUEUE_URL."
}

$envMap = Get-DotEnvMap $envPath
$required = @("AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "SQS_QUEUE_URL")
$missing = @()
foreach ($k in $required) {
  if (-not $envMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envMap[$k])) {
    $missing += $k
    continue
  }
  [Environment]::SetEnvironmentVariable($k, $envMap[$k], "Process")
}
if ($missing.Count -gt 0) {
  throw "Missing required env vars in .env: $($missing -join ', '). Add these values and rerun."
}

$awsCli = Resolve-AwsCliPath
if ([string]::IsNullOrWhiteSpace($awsCli)) {
  throw "AWS CLI is not installed or not in PATH. Install AWS CLI v2 and retry."
}

$apiProc = $null
$workerProc = $null
$tmpMsgPath = $null
$apiStdoutPath = $null
$apiStderrPath = $null

try {
  if ($StartApi) {
    Step "Stopping existing API processes"
    Stop-ExistingApiProcesses

    Step "Starting API"
    $apiStdoutPath = Join-Path $env:TEMP ("cc-phase5-api-out-" + [Guid]::NewGuid().ToString() + ".log")
    $apiStderrPath = Join-Path $env:TEMP ("cc-phase5-api-err-" + [Guid]::NewGuid().ToString() + ".log")
    $apiProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run api:start" -WorkingDirectory $repoRoot -PassThru -RedirectStandardOutput $apiStdoutPath -RedirectStandardError $apiStderrPath
    Start-Sleep -Milliseconds 750
    if ($apiProc.HasExited) {
      $stderr = if (Test-Path $apiStderrPath) { (Get-Content $apiStderrPath -Tail 40 | Out-String).Trim() } else { "" }
      $stdout = if (Test-Path $apiStdoutPath) { (Get-Content $apiStdoutPath -Tail 40 | Out-String).Trim() } else { "" }
      throw "API process exited immediately (exitCode=$($apiProc.ExitCode)). stderr=`"$stderr`" stdout=`"$stdout`""
    }
  }

  Step "Waiting for API health"
  try {
    Wait-ApiHealthy
  } catch {
    $stderr = if ($apiStderrPath -and (Test-Path $apiStderrPath)) { (Get-Content $apiStderrPath -Tail 40 | Out-String).Trim() } else { "" }
    $stdout = if ($apiStdoutPath -and (Test-Path $apiStdoutPath)) { (Get-Content $apiStdoutPath -Tail 40 | Out-String).Trim() } else { "" }
    throw "$($_.Exception.Message) API stderr tail: `"$stderr`" stdout tail: `"$stdout`""
  }

  $headers = @{
    "x-auth-subject" = "phase5-smoke-user"
    "x-user-email"   = "phase5-smoke-user@example.com"
  }

  Step "Creating case and upload-init asset"
  $caseBody = @{ title = "Phase5 smoke case" } | ConvertTo-Json -Compress
  $case = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cases" -Headers $headers -ContentType "application/json" -Body $caseBody

  $assetBody = @{
    fileName = "phase5-smoke.jpg"
    mimeType = "image/jpeg"
    byteSize = 12
  } | ConvertTo-Json -Compress
  $asset = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cases/$($case.id)/assets" -Headers $headers -ContentType "application/json" -Body $assetBody

  Step "Queueing asset_uploaded message"
  $messageBody = @{
    type    = "asset_uploaded"
    caseId  = $case.id
    assetId = $asset.assetId
  } | ConvertTo-Json -Compress
  $tmpMsgPath = Join-Path $env:TEMP ("cc-phase5-msg-" + [Guid]::NewGuid().ToString() + ".json")
  Set-Content -Path $tmpMsgPath -Value $messageBody -Encoding ASCII -NoNewline

  $sendResult = & $awsCli sqs send-message --queue-url $envMap["SQS_QUEUE_URL"] --region $envMap["AWS_REGION"] --message-body ("file://" + $tmpMsgPath) --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    $details = ($sendResult | Out-String).Trim()
    throw "Failed to enqueue asset_uploaded message. Verify queue connectivity (SQS_QUEUE_URL/AWS_REGION/credentials). Details: $details"
  }

  if ($StartWorker) {
    Step "Starting worker"
    $workerCmd = @(
      "set AWS_REGION=$($envMap["AWS_REGION"])",
      "set AWS_ACCESS_KEY_ID=$($envMap["AWS_ACCESS_KEY_ID"])",
      "set AWS_SECRET_ACCESS_KEY=$($envMap["AWS_SECRET_ACCESS_KEY"])",
      "set SQS_QUEUE_URL=$($envMap["SQS_QUEUE_URL"])",
      "set SQS_WAIT_TIME_SECONDS=1",
      "set SQS_VISIBILITY_TIMEOUT_SECONDS=3",
      "npm run worker:start"
    ) -join "&& "
    $workerProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $workerCmd -WorkingDirectory $repoRoot -PassThru
  }

  Step "Verifying extraction persistence"
  $waitResult = Wait-ExtractionPersisted -CaseId $case.id -AssetId $asset.assetId -Headers $headers -TimeoutSeconds 240
  $caseAfter = $waitResult.caseAfter
  $extraction = $waitResult.extraction

  Step "Phase 5 smoke test passed"
  [ordered]@{
    caseId          = $case.id
    assetId         = $asset.assetId
    extractionId    = $extraction.id
    extractionEngine = $extraction.engine
    extractionCount = $caseAfter.extractions.Count
  } | ConvertTo-Json -Compress
}
finally {
  if ($tmpMsgPath) {
    Remove-Item $tmpMsgPath -ErrorAction SilentlyContinue
  }
  if ($workerProc -ne $null) {
    Stop-ProcessTree -ProcessId $workerProc.Id
  }
  if ($apiProc -ne $null) {
    Stop-ProcessTree -ProcessId $apiProc.Id
  }
  if ($apiStdoutPath) {
    Remove-Item $apiStdoutPath -ErrorAction SilentlyContinue
  }
  if ($apiStderrPath) {
    Remove-Item $apiStderrPath -ErrorAction SilentlyContinue
  }
}
