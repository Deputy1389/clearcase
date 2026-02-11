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

function Wait-ApiHealthy([int]$TimeoutSeconds = 35) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $code = curl.exe -s -o NUL -w "%{http_code}" "http://127.0.0.1:3001/health"
    if ($code -eq "200") {
      return
    }
    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)

  throw "API did not become healthy in time."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
  throw "Missing .env at $envPath"
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
  throw "Missing required env vars in .env: $($missing -join ', ')"
}

$awsCli = Resolve-AwsCliPath
if ([string]::IsNullOrWhiteSpace($awsCli)) {
  throw "AWS CLI is not installed or not in PATH."
}

$apiProc = $null
$workerProc = $null
$tmpMsgPath = $null

try {
  if ($StartApi) {
    Step "Starting API"
    $apiProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run api:start" -WorkingDirectory $repoRoot -PassThru
  }

  Step "Waiting for API health"
  Wait-ApiHealthy

  $headers = @{
    "x-auth-subject" = "phase7-smoke-user"
    "x-user-email"   = "phase7-smoke-user@example.com"
  }

  $deadlineDate = (Get-Date).ToUniversalTime().AddDays(10).ToString("yyyy-MM-dd")
  $fileName = "summons-deadline-$deadlineDate-urgent.jpg"

  Step "Creating case and upload-init asset"
  $caseBody = @{ title = "Phase7 smoke case" } | ConvertTo-Json -Compress
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
  $tmpMsgPath = Join-Path $env:TEMP ("cc-phase7-msg-" + [Guid]::NewGuid().ToString() + ".json")
  Set-Content -Path $tmpMsgPath -Value $messageBody -Encoding ASCII -NoNewline

  & $awsCli sqs send-message --queue-url $envMap["SQS_QUEUE_URL"] --region $envMap["AWS_REGION"] --message-body ("file://" + $tmpMsgPath) --output json | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to enqueue asset_uploaded message."
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
      "set LLM_PROVIDER=stub",
      "npm run worker:start"
    ) -join "&& "
    $workerProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $workerCmd -WorkingDirectory $repoRoot -PassThru
    Start-Sleep -Seconds 8
    Stop-ProcessTree -ProcessId $workerProc.Id
  }

  Step "Verifying extraction + truth + verdict persistence"
  $caseAfter = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/cases/$($case.id)" -Headers $headers
  $extraction = $caseAfter.extractions | Where-Object { $_.assetId -eq $asset.assetId } | Select-Object -First 1
  if ($null -eq $extraction) {
    throw "No extraction persisted for assetId=$($asset.assetId)."
  }

  if ([string]::IsNullOrWhiteSpace($caseAfter.plainEnglishExplanation)) {
    throw "Expected case.plainEnglishExplanation to be populated."
  }
  if ([string]::IsNullOrWhiteSpace($caseAfter.nonLegalAdviceDisclaimer)) {
    throw "Expected case.nonLegalAdviceDisclaimer to be populated."
  }
  if ($caseAfter.nonLegalAdviceDisclaimer -notlike "*not legal advice*") {
    throw "Expected nonLegalAdviceDisclaimer to include 'not legal advice'."
  }

  $verdict = $caseAfter.verdicts | Where-Object { $_.extractionId -eq $extraction.id } | Select-Object -First 1
  if ($null -eq $verdict) {
    throw "Expected a verdict linked to extractionId=$($extraction.id)."
  }
  if ($verdict.llmModel -ne "deterministic-formatter-v1") {
    throw "Expected verdict.llmModel='deterministic-formatter-v1' but got '$($verdict.llmModel)'."
  }
  if ([string]::IsNullOrWhiteSpace($verdict.inputHash)) {
    throw "Expected verdict.inputHash to be populated."
  }
  if ($null -eq $verdict.outputJson.receipts -or $null -eq $verdict.outputJson.deadlines) {
    throw "Expected verdict.outputJson to include receipts and deadlines."
  }

  $llmAudit = $caseAfter.auditLogs |
    Where-Object { $_.eventType -eq "LLM_FORMAT_RUN" -and $_.verdictId -eq $verdict.id } |
    Select-Object -First 1
  if ($null -eq $llmAudit) {
    throw "Expected LLM_FORMAT_RUN audit event for verdictId=$($verdict.id)."
  }

  Step "Phase 7 smoke test passed"
  [ordered]@{
    caseId                 = $case.id
    assetId                = $asset.assetId
    extractionId           = $extraction.id
    verdictId              = $verdict.id
    verdictModel           = $verdict.llmModel
    explanationPresent     = -not [string]::IsNullOrWhiteSpace($caseAfter.plainEnglishExplanation)
    disclaimerPresent      = -not [string]::IsNullOrWhiteSpace($caseAfter.nonLegalAdviceDisclaimer)
    llmFormatAuditId       = $llmAudit.id
    outputJsonHasReceipts  = $null -ne $verdict.outputJson.receipts
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
