param(
  [string]$ApiBase = $(if ($env:CLEARCASE_API_BASE) { $env:CLEARCASE_API_BASE } else { "http://127.0.0.1:3001" }),
  [string]$Subject,
  [string]$Email,
  [ValidateSet("manual", "billing")]
  [string]$Source = "manual",
  [string]$Reason,
  [string]$OpsToken = $(if ($env:OPS_ADMIN_TOKEN) { $env:OPS_ADMIN_TOKEN } else { $env:OPS_METRICS_TOKEN })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Subject) -and [string]::IsNullOrWhiteSpace($Email)) {
  throw "Provide -Subject or -Email."
}

$headers = @{
  "Accept" = "application/json"
  "Content-Type" = "application/json"
}
if (-not [string]::IsNullOrWhiteSpace($OpsToken)) {
  $headers["x-ops-token"] = $OpsToken.Trim()
}

$body = [ordered]@{
  source = $Source
}
if (-not [string]::IsNullOrWhiteSpace($Subject)) { $body.subject = $Subject.Trim() }
if (-not [string]::IsNullOrWhiteSpace($Email)) { $body.email = $Email.Trim().ToLowerInvariant() }
if (-not [string]::IsNullOrWhiteSpace($Reason)) { $body.reason = $Reason.Trim() }

$uri = "$($ApiBase.TrimEnd('/'))/ops/entitlements/revoke"
$payload = $body | ConvertTo-Json -Depth 6
$response = Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -Body $payload
$response | ConvertTo-Json -Depth 8
