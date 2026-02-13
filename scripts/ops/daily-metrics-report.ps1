param(
  [string]$ApiBase = $(if ($env:CLEARCASE_API_BASE) { $env:CLEARCASE_API_BASE } else { "http://127.0.0.1:3001" }),
  [string]$OpsToken = $env:OPS_METRICS_TOKEN,
  [switch]$FailOnWarning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-IntThreshold([string]$Name, [int]$DefaultValue) {
  $raw = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $DefaultValue
  }
  $parsed = 0
  if ([int]::TryParse($raw, [ref]$parsed)) {
    return $parsed
  }
  return $DefaultValue
}

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

function Write-Section([string]$Title) {
  Write-Host ""
  Write-Host $Title -ForegroundColor Cyan
}

$thresholds = [ordered]@{
  OcrFailureRatePct      = Read-DoubleThreshold -Name "OPS_ALERT_OCR_FAILURE_RATE_PCT" -DefaultValue 15.0
  FreeLimitReached24h    = Read-IntThreshold -Name "OPS_ALERT_FREE_LIMIT_REACHED_24H" -DefaultValue 25
  PlusRequired24h        = Read-IntThreshold -Name "OPS_ALERT_PLUS_REQUIRED_24H" -DefaultValue 40
  EnqueueFailureRatePct  = Read-DoubleThreshold -Name "OPS_ALERT_ENQUEUE_FAILURE_RATE_PCT" -DefaultValue 5.0
}

$headers = @{
  "Accept" = "application/json"
}
if (-not [string]::IsNullOrWhiteSpace($OpsToken)) {
  $headers["x-ops-token"] = $OpsToken.Trim()
}

$metricsUrl = "$($ApiBase.TrimEnd('/'))/ops/metrics/summary"
try {
  $summary = Invoke-RestMethod -Method Get -Uri $metricsUrl -Headers $headers
}
catch {
  Write-Host "Failed to fetch metrics from $metricsUrl" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor DarkRed
  exit 1
}

$last24h = $summary.last24h
$last7d = $summary.last7d

Write-Host "ClearCase Ops Daily Metrics"
Write-Host "Generated at: $($summary.generatedAt)"
Write-Host "API base: $ApiBase"

Write-Section "Last 24h"
Write-Host ("FREE_LIMIT_REACHED: {0} ({1}/h)" -f $last24h.freeLimitReached.count, $last24h.freeLimitReached.perHour)
Write-Host ("FREE_OCR_DISABLED: {0} ({1}/h)" -f $last24h.freeOcrDisabled.count, $last24h.freeOcrDisabled.perHour)
Write-Host ("PLUS_REQUIRED: {0} ({1}/h)" -f $last24h.plusRequired.count, $last24h.plusRequired.perHour)
Write-Host ("OCR_RUN: success={0} fail={1} failRate={2}% pageUnits={3}" -f $last24h.ocrRuns.succeeded, $last24h.ocrRuns.failed, $last24h.ocrRuns.failureRatePct, $last24h.ocrRuns.pageUnitsTotal)
Write-Host ("Consult links: created={0} disabled={1}" -f $last24h.consultLinks.created, $last24h.consultLinks.disabled)
Write-Host ("Finalize enqueue: success={0} fail={1} failRate={2}%" -f $last24h.finalizeEnqueue.succeeded, $last24h.finalizeEnqueue.failed, $last24h.finalizeEnqueue.failureRatePct)

Write-Section "Last 7d"
Write-Host ("FREE_LIMIT_REACHED: {0} ({1}/day)" -f $last7d.freeLimitReached.count, $last7d.freeLimitReached.perDay)
Write-Host ("FREE_OCR_DISABLED: {0} ({1}/day)" -f $last7d.freeOcrDisabled.count, $last7d.freeOcrDisabled.perDay)
Write-Host ("PLUS_REQUIRED: {0} ({1}/day)" -f $last7d.plusRequired.count, $last7d.plusRequired.perDay)
Write-Host ("OCR_RUN: success={0} fail={1} failRate={2}% pageUnits={3}" -f $last7d.ocrRuns.succeeded, $last7d.ocrRuns.failed, $last7d.ocrRuns.failureRatePct, $last7d.ocrRuns.pageUnitsTotal)
Write-Host ("Consult links: created={0} disabled={1}" -f $last7d.consultLinks.created, $last7d.consultLinks.disabled)
Write-Host ("Finalize enqueue: success={0} fail={1} failRate={2}%" -f $last7d.finalizeEnqueue.succeeded, $last7d.finalizeEnqueue.failed, $last7d.finalizeEnqueue.failureRatePct)

$warnings = [System.Collections.Generic.List[string]]::new()

if ([double]$last24h.ocrRuns.failureRatePct -gt $thresholds.OcrFailureRatePct) {
  $warnings.Add(("OCR failure rate is high: {0}% > {1}%" -f $last24h.ocrRuns.failureRatePct, $thresholds.OcrFailureRatePct))
}
if ([int]$last24h.freeLimitReached.count -gt $thresholds.FreeLimitReached24h) {
  $warnings.Add(("FREE_LIMIT_REACHED spike: {0} > {1} (24h)" -f $last24h.freeLimitReached.count, $thresholds.FreeLimitReached24h))
}
if ([int]$last24h.plusRequired.count -gt $thresholds.PlusRequired24h) {
  $warnings.Add(("PLUS_REQUIRED spike: {0} > {1} (24h)" -f $last24h.plusRequired.count, $thresholds.PlusRequired24h))
}
if ([double]$last24h.finalizeEnqueue.failureRatePct -gt $thresholds.EnqueueFailureRatePct) {
  $warnings.Add(("Finalize enqueue failure rate is high: {0}% > {1}%" -f $last24h.finalizeEnqueue.failureRatePct, $thresholds.EnqueueFailureRatePct))
}

Write-Section "Threshold Warnings"
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

