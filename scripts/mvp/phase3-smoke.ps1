param(
  [switch]$StartApi
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Wait-ApiHealthy([string]$BaseUrl, [int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $code = curl.exe -s -o NUL -w "%{http_code}" "$BaseUrl/health"
    if ($code -eq "200") {
      return
    }
    Start-Sleep -Milliseconds 750
  } while ((Get-Date) -lt $deadline)

  throw "API did not become healthy at $BaseUrl within $TimeoutSeconds seconds."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$apiHost = if ($env:API_HOST) { $env:API_HOST } else { "127.0.0.1" }
if ($apiHost -eq "0.0.0.0") {
  $apiHost = "127.0.0.1"
}
$apiPort = if ($env:API_PORT) { $env:API_PORT } else { "3001" }
$baseUrl = "http://$apiHost`:$apiPort"

$apiProcess = $null
if ($StartApi) {
  Step "Starting API process for smoke test"
  $apiProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run api:start" -WorkingDirectory $repoRoot -PassThru
}

try {
  Step "Waiting for API health"
  Wait-ApiHealthy -BaseUrl $baseUrl -TimeoutSeconds 35

  $subject = "phase3-smoke-" + [Guid]::NewGuid().ToString("N").Substring(0, 8)
  $email = "$subject@example.com"
  $headers = @{
    "x-auth-subject" = $subject
    "x-user-email"   = $email
  }

  Step "Creating case"
  $caseBody = @{ title = "Phase3 smoke test case" } | ConvertTo-Json -Compress
  $case = Invoke-RestMethod -Method Post -Uri "$baseUrl/cases" -Headers $headers -ContentType "application/json" -Body $caseBody

  Step "Requesting upload-init"
  $assetRequest = @{
    fileName = "smoke-notice.jpg"
    mimeType = "image/jpeg"
    byteSize = 12
  } | ConvertTo-Json -Compress
  $uploadInit = Invoke-RestMethod -Method Post -Uri "$baseUrl/cases/$($case.id)/assets" -Headers $headers -ContentType "application/json" -Body $assetRequest

  Step "Uploading object to presigned URL"
  $payload = [byte[]](0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01)
  $putResponse = Invoke-WebRequest -Method Put -Uri $uploadInit.uploadUrl -ContentType "image/jpeg" -Body $payload

  Step "Fetching case and validating asset linkage"
  $caseAfterUpload = Invoke-RestMethod -Method Get -Uri "$baseUrl/cases/$($case.id)" -Headers $headers
  $ownedAsset = $caseAfterUpload.assets | Where-Object { $_.id -eq $uploadInit.assetId } | Select-Object -First 1
  if ($null -eq $ownedAsset) {
    throw "Asset $($uploadInit.assetId) was not found on case $($case.id)."
  }

  Step "Checking ownership enforcement"
  $otherHeaders = @{
    "x-auth-subject" = "$subject-other"
    "x-user-email"   = "$subject-other@example.com"
  }
  $status = curl.exe -s -o NUL -w "%{http_code}" -H "x-auth-subject: $($otherHeaders["x-auth-subject"])" -H "x-user-email: $($otherHeaders["x-user-email"])" "$baseUrl/cases/$($case.id)"
  if ($status -ne "404") {
    throw "Expected 404 for cross-user case read, got $status."
  }

  Step "Phase 3 smoke test passed"
  [ordered]@{
    caseId               = $case.id
    assetId              = $uploadInit.assetId
    s3Key                = $uploadInit.s3Key
    putStatusCode        = [int]$putResponse.StatusCode
    caseAssetCount       = $caseAfterUpload.assets.Count
    crossUserReadStatus  = [int]$status
    presignExpiresInSecs = $uploadInit.expiresInSeconds
  } | ConvertTo-Json -Compress
}
finally {
  if ($apiProcess -ne $null) {
    Stop-Process -Id $apiProcess.Id -ErrorAction SilentlyContinue
  }
}
