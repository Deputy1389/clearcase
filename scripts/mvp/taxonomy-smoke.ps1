param(
  [switch]$StartApi = $true,
  [switch]$StartWorker = $true
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

function Stop-ProcessTree([int]$ProcessId) {
  if ($ProcessId -le 0) {
    return
  }

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

function Test-ApiHealthy {
  $code = curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:3001/health"
  return ($code -eq "200")
}

function Start-WorkerProcess([string]$RepoRoot, [hashtable]$EnvMap, [string]$QueueUrl) {
  $cmd = @(
    "set AWS_REGION=$($EnvMap["AWS_REGION"])",
    "set AWS_ACCESS_KEY_ID=$($EnvMap["AWS_ACCESS_KEY_ID"])",
    "set AWS_SECRET_ACCESS_KEY=$($EnvMap["AWS_SECRET_ACCESS_KEY"])",
    "set SQS_QUEUE_URL=$QueueUrl",
    "set SQS_WAIT_TIME_SECONDS=1",
    "set SQS_VISIBILITY_TIMEOUT_SECONDS=3",
    "set LLM_PROVIDER=stub",
    "npm run worker:start"
  ) -join "&& "

  return Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WorkingDirectory $RepoRoot -PassThru
}

function Test-WorkerRunning {
  $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.Name -eq "node.exe" -and $_.CommandLine -like "*apps/worker/src/worker.ts*") -or
      ($_.Name -eq "cmd.exe" -and $_.CommandLine -like "*npm run worker:start*")
    }
  return (@($processes).Count -gt 0)
}

function Invoke-AwsJson([string]$AwsCli, [string[]]$AwsArgs, [string]$FailureContext) {
  $output = & $AwsCli @AwsArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    $details = ($output | Out-String).Trim()
    throw "$FailureContext Details: $details"
  }

  if ([string]::IsNullOrWhiteSpace(($output | Out-String))) {
    return $null
  }

  return (($output | Out-String) | ConvertFrom-Json)
}

function Send-QueueMessage([string]$AwsCli, [string]$QueueUrl, [string]$Region, [string]$Body) {
  $tmpPath = Join-Path $env:TEMP ("cc-taxonomy-msg-" + [Guid]::NewGuid().ToString() + ".json")
  Set-Content -Path $tmpPath -Value $Body -Encoding ASCII -NoNewline

  try {
    $send = Invoke-AwsJson $AwsCli @(
      "sqs",
      "send-message",
      "--queue-url",
      $QueueUrl,
      "--region",
      $Region,
      "--message-body",
      ("file://" + $tmpPath),
      "--output",
      "json"
    ) "SQS send-message failed. Check AWS credentials, SQS_QUEUE_URL, queue policy, and network access."

    return $send.MessageId
  }
  finally {
    Remove-Item $tmpPath -ErrorAction SilentlyContinue
  }
}

function Wait-CaseClassified(
  [string]$CaseId,
  [string]$AssetId,
  [hashtable]$Headers,
  [string]$ExpectedDocumentType,
  [int]$TimeoutSeconds = 60
) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastDocType = ""
  $lastExtractionCount = 0
  $lastError = ""

  do {
    try {
      $case = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/cases/$CaseId" -Headers $Headers
      $lastDocType = [string]$case.documentType
      $lastExtractionCount = @($case.extractions).Count

      $extraction = $case.extractions | Where-Object { $_.assetId -eq $AssetId } | Select-Object -First 1
      if ($null -ne $extraction -and $case.documentType -eq $ExpectedDocumentType) {
        return $case
      }
    }
    catch {
      $lastError = $_.Exception.Message
    }

    Start-Sleep -Milliseconds 900
  } while ((Get-Date) -lt $deadline)

  if (-not [string]::IsNullOrWhiteSpace($lastError)) {
    throw "Timed out waiting for classification. caseId=$CaseId expectedDocumentType=$ExpectedDocumentType lastApiError='$lastError'"
  }
  throw "Timed out waiting for classification. caseId=$CaseId expectedDocumentType=$ExpectedDocumentType lastDocumentType='$lastDocType' extractions=$lastExtractionCount"
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
  throw "Missing required env vars in .env: $($missing -join ', '). Add them to .env and retry."
}

$awsCli = Resolve-AwsCliPath
if ([string]::IsNullOrWhiteSpace($awsCli)) {
  throw "AWS CLI is not installed or not in PATH. Install AWS CLI v2 and rerun smoke tests."
}

$queueUrl = $envMap["SQS_QUEUE_URL"]
$region = $envMap["AWS_REGION"]

Step "Checking queue connectivity"
Invoke-AwsJson $awsCli @(
  "sqs",
  "get-queue-attributes",
  "--queue-url",
  $queueUrl,
  "--region",
  $region,
  "--attribute-names",
  "ApproximateNumberOfMessages",
  "--output",
  "json"
) "SQS queue check failed. Verify SQS_QUEUE_URL, AWS_REGION, credentials, and network connectivity."

$apiProc = $null
$workerProc = $null
$startedApi = $false
$startedWorker = $false

try {
  $apiAlreadyHealthy = Test-ApiHealthy
  if ($StartApi -or -not $apiAlreadyHealthy) {
    Step "Stopping existing API processes"
    Stop-ExistingApiProcesses

    Step "Starting API"
    $apiProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run api:start" -WorkingDirectory $repoRoot -PassThru
    $startedApi = $true
  }

  Step "Waiting for API health"
  Wait-ApiHealthy

  $workerAlreadyRunning = Test-WorkerRunning
  if ($StartWorker -or -not $workerAlreadyRunning) {
    Step "Stopping existing worker processes"
    Stop-ExistingWorkerProcesses

    Step "Starting worker"
    $workerProc = Start-WorkerProcess -RepoRoot $repoRoot -EnvMap $envMap -QueueUrl $queueUrl
    Start-Sleep -Seconds 8
    $startedWorker = $true
  }

  $headers = @{
    "x-auth-subject" = "taxonomy-smoke-" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
    "x-user-email"   = "taxonomy-smoke-" + [Guid]::NewGuid().ToString("N").Substring(0, 8) + "@example.com"
  }

  $cases = @(
    @{ name = "summons_complaint"; fileName = "summons-complaint-plaintiff-defendant-served.jpg"; documentType = "summons_complaint"; expectTimeSensitive = $false },
    @{ name = "eviction_notice"; fileName = "eviction-landlord-tenant-urgent.jpg"; documentType = "eviction_notice"; expectTimeSensitive = $true },
    @{ name = "debt_collection_notice"; fileName = "debt-collector-creditor-validation-notice.jpg"; documentType = "debt_collection_notice"; expectTimeSensitive = $false },
    @{ name = "court_hearing_notice"; fileName = "court-hearing-appearance-docket.jpg"; documentType = "court_hearing_notice"; expectTimeSensitive = $true },
    @{ name = "citation_ticket"; fileName = "citation-ticket-violation-fine-infraction.jpg"; documentType = "citation_ticket"; expectTimeSensitive = $false }
  )

  $results = @()

  foreach ($scenario in $cases) {
    Step "Running taxonomy scenario: $($scenario.name)"

    $caseBody = @{ title = "Taxonomy smoke $($scenario.name)" } | ConvertTo-Json -Compress
    $case = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cases" -Headers $headers -ContentType "application/json" -Body $caseBody

    $assetBody = @{
      fileName = $scenario.fileName
      mimeType = "image/jpeg"
      byteSize = 12
    } | ConvertTo-Json -Compress
    $asset = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cases/$($case.id)/assets" -Headers $headers -ContentType "application/json" -Body $assetBody

    $messageBody = @{
      type    = "asset_uploaded"
      caseId  = $case.id
      assetId = $asset.assetId
    } | ConvertTo-Json -Compress
    $messageId = Send-QueueMessage -AwsCli $awsCli -QueueUrl $queueUrl -Region $region -Body $messageBody

    $caseAfter = Wait-CaseClassified -CaseId $case.id -AssetId $asset.assetId -Headers $headers -ExpectedDocumentType $scenario.documentType -TimeoutSeconds 180

    if ($caseAfter.documentType -ne $scenario.documentType) {
      throw "Unexpected documentType for scenario '$($scenario.name)': expected '$($scenario.documentType)', got '$($caseAfter.documentType)'."
    }

    if ($null -eq $caseAfter.classificationConfidence -or [double]$caseAfter.classificationConfidence -le 0) {
      throw "classificationConfidence missing/invalid for scenario '$($scenario.name)'."
    }

    if ([bool]$scenario.expectTimeSensitive -and -not [bool]$caseAfter.timeSensitive) {
      throw "timeSensitive mismatch for scenario '$($scenario.name)': expected=$([bool]$scenario.expectTimeSensitive) actual=$([bool]$caseAfter.timeSensitive)."
    }

    $extraction = $caseAfter.extractions | Where-Object { $_.assetId -eq $asset.assetId } | Select-Object -First 1
    if ($null -eq $extraction) {
      throw "Missing extraction for scenario '$($scenario.name)'."
    }

    $truthAudit = $caseAfter.auditLogs |
      Where-Object { $_.eventType -eq "TRUTH_LAYER_RUN" -and $_.extractionId -eq $extraction.id } |
      Select-Object -First 1
    if ($null -eq $truthAudit) {
      throw "Missing TRUTH_LAYER_RUN audit event for scenario '$($scenario.name)'."
    }

    $results += [ordered]@{
      scenario                 = $scenario.name
      caseId                   = $case.id
      assetId                  = $asset.assetId
      queueMessageId           = $messageId
      documentType             = $caseAfter.documentType
      classificationConfidence = [double]$caseAfter.classificationConfidence
      timeSensitive            = [bool]$caseAfter.timeSensitive
      extractionId             = $extraction.id
      truthLayerAuditId        = $truthAudit.id
    }
  }

  Step "Taxonomy/document-type smoke passed"
  [ordered]@{
    scenarioCount = $results.Count
    scenarios     = $results
  } | ConvertTo-Json -Depth 8 -Compress
}
finally {
  if ($startedWorker -and $workerProc -ne $null) {
    Stop-ProcessTree -ProcessId $workerProc.Id
  }
  if ($startedApi -and $apiProc -ne $null) {
    Stop-ProcessTree -ProcessId $apiProc.Id
  }
}
