param(
  [string]$ApiBase = $(if ($env:CLEARCASE_API_BASE) { $env:CLEARCASE_API_BASE } else { "http://127.0.0.1:3001" }),
  [string]$OpsToken = $env:OPS_METRICS_TOKEN,
  [switch]$FailOnWarning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-DoubleThreshold([string]$Name, [double]$DefaultValue) {
  $raw = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $DefaultValue
  }
  $parsed = 0.0
  if ([double]::TryParse($raw, [ref]$parsed)) {
    return $parsed
  }
  return $DefaultValue
}

$headers = @{
  "Accept" = "application/json"
}
if (-not [string]::IsNullOrWhiteSpace($OpsToken)) {
  $headers["x-ops-token"] = $OpsToken.Trim()
}

$kpiUrl = "$($ApiBase.TrimEnd('/'))/ops/growth/weekly-kpis"
try {
  $report = Invoke-RestMethod -Method Get -Uri $kpiUrl -Headers $headers
}
catch {
  Write-Host "Failed to fetch weekly KPIs from $kpiUrl" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor DarkRed
  exit 1
}

Write-Host "ClearCase Weekly Growth KPIs"
Write-Host "Generated at: $($report.generatedAt)"
Write-Host "Window start: $($report.windowStart)"
Write-Host "API base: $ApiBase"
Write-Host ""
Write-Host "Funnel"
Write-Host ("- Paywall viewed: {0}" -f $report.funnel.paywallViewed)
Write-Host ("- Checkout started: {0}" -f $report.funnel.checkoutStarted)
Write-Host ("- Checkout succeeded: {0}" -f $report.funnel.checkoutSucceeded)
Write-Host ("- Paywall variant: {0}" -f $report.funnel.paywallVariant)
Write-Host ""
Write-Host "KPIs"
Write-Host ("- Trial to paid conversion: {0}%" -f $report.kpis.trialToPaidConversionPct)
Write-Host ("- Day-7 retention: {0}%" -f $report.kpis.day7RetentionPct)
Write-Host ("- Reminders enabled: {0}%" -f $report.kpis.remindersEnabledPct)
Write-Host ("- Packet share rate: {0}%" -f $report.kpis.packetShareRatePct)
Write-Host ""
Write-Host "Event counts"
Write-Host ("- Upload started: {0}" -f $report.events.uploadStarted)
Write-Host ("- Upload completed: {0}" -f $report.events.uploadCompleted)
Write-Host ("- First deadline detected: {0}" -f $report.events.firstDeadlineDetected)
Write-Host ("- Free limit reached: {0}" -f $report.events.freeLimitReached)
Write-Host ""
Write-Host "Cohort"
Write-Host ("- Cohort size: {0}" -f $report.counts.cohortSize)
Write-Host ("- Retained users: {0}" -f $report.counts.retained)
Write-Host ("- Paid transitions (billing): {0}" -f $report.counts.paidTransitionCount)

$conversionWarn = Read-DoubleThreshold -Name "OPS_ALERT_TRIAL_TO_PAID_MIN_PCT" -DefaultValue 2.0
$retentionWarn = Read-DoubleThreshold -Name "OPS_ALERT_DAY7_RETENTION_MIN_PCT" -DefaultValue 20.0

$warnings = [System.Collections.Generic.List[string]]::new()
if ([double]$report.kpis.trialToPaidConversionPct -lt $conversionWarn) {
  $warnings.Add(("Trial to paid conversion is below target: {0}% < {1}%" -f $report.kpis.trialToPaidConversionPct, $conversionWarn))
}
if ([double]$report.kpis.day7RetentionPct -lt $retentionWarn) {
  $warnings.Add(("Day-7 retention is below target: {0}% < {1}%" -f $report.kpis.day7RetentionPct, $retentionWarn))
}

Write-Host ""
Write-Host "Threshold warnings"
if ($warnings.Count -eq 0) {
  Write-Host "No threshold warnings."
} else {
  foreach ($warning in $warnings) {
    Write-Host ("- WARNING: {0}" -f $warning) -ForegroundColor Yellow
  }
}

if ($FailOnWarning -and $warnings.Count -gt 0) {
  exit 2
}

exit 0
