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

function Wait-TruthPersisted(
  [string]$CaseId,
  [string]$AssetId,
  [hashtable]$Headers,
  [int]$TimeoutSeconds = 100
) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = ""
  do {
    try {
      $caseAfter = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/cases/$CaseId" -Headers $Headers
      $extraction = $caseAfter.extractions | Where-Object { $_.assetId -eq $AssetId } | Select-Object -First 1
      if ($null -ne $extraction -and -not [string]::IsNullOrWhiteSpace([string]$caseAfter.documentType)) {
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
    throw "Timed out waiting for truth-layer persistence (caseId=$CaseId, assetId=$AssetId). Last API error: $lastError"
  }
  throw "Timed out waiting for truth-layer persistence (caseId=$CaseId, assetId=$AssetId). Queue backlog or worker/API issues may be delaying processing."
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

try {
  if ($StartApi) {
    Step "Stopping existing API processes"
    Stop-ExistingApiProcesses

    Step "Starting API"
    $apiProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run api:start" -WorkingDirectory $repoRoot -PassThru
  }

  Step "Waiting for API health"
  Wait-ApiHealthy

  $headers = @{
    "x-auth-subject" = "phase6-smoke-user"
    "x-user-email"   = "phase6-smoke-user@example.com"
  }

  $uploadDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
  $deadlineDate = (Get-Date).ToUniversalTime().AddDays(14).ToString("yyyy-MM-dd")
  $fileName = "eviction-notice-deadline-$deadlineDate.jpg"

  Step "Creating case and upload-init asset"
  $caseBody = @{ title = "Phase6 smoke case" } | ConvertTo-Json -Compress
  $case = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cases" -Headers $headers -ContentType "application/json" -Body $caseBody

  $assetBody = @{
    fileName = $fileName
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
  $tmpMsgPath = Join-Path $env:TEMP ("cc-phase6-msg-" + [Guid]::NewGuid().ToString() + ".json")
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

  Step "Verifying extraction + truth layer persistence"
  $waitResult = Wait-TruthPersisted -CaseId $case.id -AssetId $asset.assetId -Headers $headers -TimeoutSeconds 110
  $caseAfter = $waitResult.caseAfter
  $extraction = $waitResult.extraction

  if ($caseAfter.documentType -ne "eviction_notice") {
    throw "Expected case.documentType='eviction_notice' but got '$($caseAfter.documentType)'."
  }

  if (-not $caseAfter.timeSensitive) {
    throw "Expected case.timeSensitive=true after truth-layer run."
  }

  if ([string]::IsNullOrWhiteSpace($caseAfter.earliestDeadline)) {
    throw "Expected case.earliestDeadline to be populated."
  }

  $actualDeadlineDate = ([DateTime]::Parse($caseAfter.earliestDeadline)).ToUniversalTime().ToString("yyyy-MM-dd")
  if ($actualDeadlineDate -ne $uploadDate -and $actualDeadlineDate -ne $deadlineDate) {
    throw "Expected earliestDeadline to match either upload date '$uploadDate' or embedded deadline '$deadlineDate', but got '$actualDeadlineDate'."
  }

  if ($null -eq $caseAfter.classificationConfidence -or [double]$caseAfter.classificationConfidence -le 0) {
    throw "Expected classificationConfidence to be populated with a positive number."
  }

  $truthAudit = $caseAfter.auditLogs |
    Where-Object { $_.eventType -eq "TRUTH_LAYER_RUN" -and $_.extractionId -eq $extraction.id } |
    Select-Object -First 1
  if ($null -eq $truthAudit) {
    throw "Expected TRUTH_LAYER_RUN audit event for extractionId=$($extraction.id)."
  }

  Step "Phase 6 smoke test passed"
  [ordered]@{
    caseId                   = $case.id
    assetId                  = $asset.assetId
    extractionId             = $extraction.id
    documentType             = $caseAfter.documentType
    classificationConfidence = [double]$caseAfter.classificationConfidence
    timeSensitive            = [bool]$caseAfter.timeSensitive
    earliestDeadline         = $caseAfter.earliestDeadline
    truthLayerAuditId        = $truthAudit.id
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
}
