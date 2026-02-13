param(
  [string]$ApiBase = $(if ($env:CLEARCASE_API_BASE) { $env:CLEARCASE_API_BASE } else { "http://127.0.0.1:3001" }),
  [string]$Subject,
  [string]$Email,
  [switch]$IncludeHistory,
  [int]$Limit = 20,
  [string]$OpsToken = $(if ($env:OPS_ADMIN_TOKEN) { $env:OPS_ADMIN_TOKEN } else { $env:OPS_METRICS_TOKEN })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Subject) -and [string]::IsNullOrWhiteSpace($Email)) {
  throw "Provide -Subject or -Email."
}

$headers = @{
  "Accept" = "application/json"
}
if (-not [string]::IsNullOrWhiteSpace($OpsToken)) {
  $headers["x-ops-token"] = $OpsToken.Trim()
}

$query = @()
if (-not [string]::IsNullOrWhiteSpace($Subject)) { $query += "subject=$([uri]::EscapeDataString($Subject.Trim()))" }
if (-not [string]::IsNullOrWhiteSpace($Email)) { $query += "email=$([uri]::EscapeDataString($Email.Trim()))" }
if ($IncludeHistory) { $query += "includeHistory=true" }
if ($Limit -gt 0) { $query += "limit=$Limit" }

$uri = "$($ApiBase.TrimEnd('/'))/ops/entitlements"
if ($query.Count -gt 0) {
  $uri = "$uri?$(($query -join '&'))"
}

$response = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
$response | ConvertTo-Json -Depth 8
