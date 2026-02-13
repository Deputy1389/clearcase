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

  throw "API health check failed at http://127.0.0.1:3001/health after $TimeoutSeconds seconds."
}

function Wait-VerdictPersisted(
  [string]$CaseId,
  [string]$AssetId,
  [hashtable]$Headers,
  [int]$TimeoutSeconds = 180
) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $caseAfter = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:3001/cases/$CaseId" -Headers $Headers
    $extraction = $caseAfter.extractions | Where-Object { $_.assetId -eq $AssetId } | Select-Object -First 1
    $verdict = if ($null -ne $extraction) { $caseAfter.verdicts | Where-Object { $_.extractionId -eq $extraction.id } | Select-Object -First 1 } else { $null }
    if ($null -ne $extraction -and $null -ne $verdict) {
      return @{
        caseAfter = $caseAfter
        extraction = $extraction
        verdict = $verdict
      }
    }
    Start-Sleep -Milliseconds 900
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for extraction + verdict persistence (caseId=$CaseId, assetId=$AssetId)."
}

function Get-MimeTypeForPath([string]$Path) {
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  switch ($ext) {
    ".pdf" { return "application/pdf" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".tif" { return "image/tiff" }
    ".tiff" { return "image/tiff" }
    default { throw "Unsupported testdoc extension '$ext'. Use PDF/JPG/JPEG/PNG/TIFF." }
  }
}

function Resolve-RealTestDocPaths([string]$RepoRoot) {
  $dir = Join-Path $RepoRoot "testdocs\highanxiety"
  if (-not (Test-Path $dir)) {
    throw "Missing directory: $dir"
  }
  $all = Get-ChildItem -Path $dir -File |
    Where-Object { $_.Extension -match "^\.(pdf|png|jpg|jpeg|tif|tiff)$" } |
    Sort-Object Name

  if ($all.Count -eq 0) {
    throw "No PDF/image file found in $dir. Add at least one real document and rerun."
  }

  $selected = @()
  $preferred = @("sample-digital-text.pdf", "sample-scanned-page.pdf")
  foreach ($name in $preferred) {
    $match = $all | Where-Object { $_.Name -eq $name } | Select-Object -First 1
    if ($null -ne $match) {
      $selected += $match
    }
  }

  if ($selected.Count -eq 0) {
    $selected += ($all | Select-Object -First 1)
  }

  return $selected
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envPath = Join-Path $repoRoot ".env"
if (-not (Test-Path $envPath)) {
  throw "Missing .env at $envPath."
}

$envMap = Get-DotEnvMap $envPath
$required = @("AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "SQS_QUEUE_URL", "S3_BUCKET")
$missing = @()
foreach ($k in $required) {
  if (-not $envMap.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($envMap[$k])) {
    $missing += $k
    continue
  }
  [Environment]::SetEnvironmentVariable($k, $envMap[$k], "Process")
}
if ($missing.Count -gt 0) {
  throw "Missing required env vars in .env: $($missing -join ', ')."
}

$googleCreds = if ($envMap.ContainsKey("GOOGLE_APPLICATION_CREDENTIALS")) { $envMap["GOOGLE_APPLICATION_CREDENTIALS"] } else { $env:GOOGLE_APPLICATION_CREDENTIALS }
if ([string]::IsNullOrWhiteSpace($googleCreds)) {
  throw "Missing GOOGLE_APPLICATION_CREDENTIALS. Set it in .env or process env for google_vision OCR smoke."
}
[Environment]::SetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS", $googleCreds, "Process")

$awsCli = Resolve-AwsCliPath
if ([string]::IsNullOrWhiteSpace($awsCli)) {
  throw "AWS CLI is not installed or not in PATH."
}

$docFiles = Resolve-RealTestDocPaths -RepoRoot $repoRoot

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
    "x-auth-subject" = "phase8-real-ocr-user"
    "x-user-email"   = "phase8-real-ocr-user@example.com"
  }

  if ($StartWorker) {
    Step "Starting worker with OCR_PROVIDER=google_vision"
    $workerCmd = @(
      "set AWS_REGION=$($envMap["AWS_REGION"])",
      "set AWS_ACCESS_KEY_ID=$($envMap["AWS_ACCESS_KEY_ID"])",
      "set AWS_SECRET_ACCESS_KEY=$($envMap["AWS_SECRET_ACCESS_KEY"])",
      "set SQS_QUEUE_URL=$($envMap["SQS_QUEUE_URL"])",
      "set S3_BUCKET=$($envMap["S3_BUCKET"])",
      "set GOOGLE_APPLICATION_CREDENTIALS=$googleCreds",
      "set SQS_WAIT_TIME_SECONDS=1",
      "set SQS_VISIBILITY_TIMEOUT_SECONDS=3",
      "set OCR_PROVIDER=google_vision",
      "set LLM_PROVIDER=stub",
      "npm run worker:start"
    ) -join "&& "
    $workerProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $workerCmd -WorkingDirectory $repoRoot -PassThru
  }

  $smokeResults = @()
  foreach ($doc in $docFiles) {
    $docPath = $doc.FullName
    $docName = $doc.Name
    $mimeType = Get-MimeTypeForPath -Path $docPath
    $fileSize = (Get-Item $docPath).Length

    Step "Creating case and upload-init asset for $docName"
    $caseBody = @{ title = "Phase8 real OCR smoke case - $docName" } | ConvertTo-Json -Compress
    $case = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cases" -Headers $headers -ContentType "application/json" -Body $caseBody

    $assetBody = @{
      fileName = $docName
      mimeType = $mimeType
      byteSize = [int]$fileSize
    } | ConvertTo-Json -Compress
    $asset = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3001/cases/$($case.id)/assets" -Headers $headers -ContentType "application/json" -Body $assetBody

    Step "Uploading real document to presigned S3 URL ($docName)"
    $putResponse = Invoke-WebRequest -Method Put -Uri $asset.uploadUrl -ContentType $mimeType -InFile $docPath
    if ($putResponse.StatusCode -lt 200 -or $putResponse.StatusCode -ge 300) {
      throw "Upload failed with HTTP status $($putResponse.StatusCode)."
    }

    Step "Queueing asset_uploaded message ($docName)"
    $messageBody = @{
      type    = "asset_uploaded"
      caseId  = $case.id
      assetId = $asset.assetId
    } | ConvertTo-Json -Compress
    $tmpMsgPath = Join-Path $env:TEMP ("cc-phase8-msg-" + [Guid]::NewGuid().ToString() + ".json")
    Set-Content -Path $tmpMsgPath -Value $messageBody -Encoding ASCII -NoNewline

    $sendResult = & $awsCli sqs send-message --queue-url $envMap["SQS_QUEUE_URL"] --region $envMap["AWS_REGION"] --message-body ("file://" + $tmpMsgPath) --output json 2>&1
    if ($LASTEXITCODE -ne 0) {
      $details = ($sendResult | Out-String).Trim()
      throw "Failed to enqueue asset_uploaded message. Details: $details"
    }
    Remove-Item $tmpMsgPath -ErrorAction SilentlyContinue
    $tmpMsgPath = $null

    Step "Verifying extraction + OCR audit ($docName)"
    $waitResult = Wait-VerdictPersisted -CaseId $case.id -AssetId $asset.assetId -Headers $headers -TimeoutSeconds 180
    $caseAfter = $waitResult.caseAfter
    $extraction = $waitResult.extraction

    if ([string]::IsNullOrWhiteSpace($extraction.rawText)) {
      Write-Warning "Extraction rawText is empty for '$docName'; processing path ran but text was not detected."
    }

    $ocrAudit = $caseAfter.auditLogs |
      Where-Object { $_.eventType -eq "OCR_RUN" -and $_.extractionId -eq $extraction.id } |
      Select-Object -First 1
    if ($null -eq $ocrAudit) {
      throw "Expected OCR_RUN audit event for extractionId=$($extraction.id)."
    }

    if ($ocrAudit.payload.status -ne "succeeded") {
      throw "Expected OCR_RUN payload.status='succeeded' but got '$($ocrAudit.payload.status)'."
    }

    if ($extraction.engine -eq "stub-deterministic-ocr") {
      throw "Expected real OCR engine, but extraction.engine was '$($extraction.engine)'."
    }
    if ($ocrAudit.payload.provider -eq "stub-deterministic-ocr") {
      throw "Expected real OCR provider, but OCR_RUN payload.provider was '$($ocrAudit.payload.provider)'."
    }

    $processingPath = $ocrAudit.payload.processingPath
    if ($docName -eq "sample-digital-text.pdf" -and $processingPath -eq "google_vision") {
      throw "Expected non-OCR direct-text path for sample-digital-text.pdf, but got processingPath='google_vision'."
    }
    if ($docName -eq "sample-scanned-page.pdf" -and $processingPath -eq "pdf_text_direct") {
      throw "Expected OCR path for scanned PDF, but got processingPath='pdf_text_direct'."
    }

    $smokeResults += [ordered]@{
      caseId             = $case.id
      assetId            = $asset.assetId
      extractionId       = $extraction.id
      extractionEngine   = $extraction.engine
      processingPath     = $processingPath
      ocrAuditId         = $ocrAudit.id
      rawTextLength      = if ($null -eq $extraction.rawText) { 0 } else { $extraction.rawText.Length }
      sourceTestDocument = $docName
    }
  }

  Step "Phase 8 real OCR smoke test passed"
  $smokeResults | ConvertTo-Json -Compress
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
