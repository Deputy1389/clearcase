param(
  [string]$ApiBase = $(if ($env:CLEARCASE_API_BASE) { $env:CLEARCASE_API_BASE } else { "http://127.0.0.1:3001" }),
  [string]$WebhookSecret = $env:BILLING_WEBHOOK_SECRET
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function To-JsonBody([object]$InputObject) {
  return ($InputObject | ConvertTo-Json -Depth 20 -Compress)
}

function Invoke-Json([string]$Method, [string]$Url, [hashtable]$Headers, [object]$Body = $null) {
  $reqHeaders = @{
    "Accept" = "application/json"
  }
  foreach ($key in $Headers.Keys) {
    $reqHeaders[$key] = [string]$Headers[$key]
  }

  $jsonBody = $null
  if ($null -ne $Body) {
    $jsonBody = To-JsonBody $Body
    $reqHeaders["Content-Type"] = "application/json"
  }

  try {
    if ($null -ne $jsonBody) {
      $response = Invoke-WebRequest -Method $Method -Uri $Url -Headers $reqHeaders -Body $jsonBody
    }
    else {
      $response = Invoke-WebRequest -Method $Method -Uri $Url -Headers $reqHeaders
    }
    $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
    return [pscustomobject]@{
      Status = [int]$response.StatusCode
      Data = $parsed
      Raw = $response.Content
    }
  }
  catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $content = $reader.ReadToEnd()
      $reader.Close()
      $parsed = $null
      if (-not [string]::IsNullOrWhiteSpace($content)) {
        try { $parsed = $content | ConvertFrom-Json } catch { $parsed = $content }
      }
      return [pscustomobject]@{
        Status = $status
        Data = $parsed
        Raw = $content
      }
    }
    throw
  }
}

function Get-HmacSha256Hex([string]$Secret, [string]$Payload) {
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($Secret)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($Payload)
  $hash = $hmac.ComputeHash($bytes)
  return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

function Invoke-BillingWebhook([string]$ApiBaseValue, [string]$Secret, [object]$Body) {
  $jsonBody = To-JsonBody $Body
  $headers = @{
    "Accept" = "application/json"
    "Content-Type" = "application/json"
  }
  if (-not [string]::IsNullOrWhiteSpace($Secret)) {
    $sig = Get-HmacSha256Hex -Secret $Secret -Payload $jsonBody
    $headers["x-billing-signature"] = "sha256=$sig"
  }
  $url = "$($ApiBaseValue.TrimEnd('/'))/billing/webhooks/subscription"
  try {
    $response = Invoke-WebRequest -Method "POST" -Uri $url -Headers $headers -Body $jsonBody
    $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
    return [pscustomobject]@{
      Status = [int]$response.StatusCode
      Data = $parsed
      Raw = $response.Content
    }
  }
  catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $content = $reader.ReadToEnd()
      $reader.Close()
      $parsed = $null
      if (-not [string]::IsNullOrWhiteSpace($content)) {
        try { $parsed = $content | ConvertFrom-Json } catch { $parsed = $content }
      }
      return [pscustomobject]@{
        Status = $status
        Data = $parsed
        Raw = $content
      }
    }
    throw
  }
}

$seed = "$(Get-Date -Format yyyyMMddHHmmss)-$([int](Get-Random -Minimum 1000 -Maximum 9999))"
$subject = "prompt-m-billing-$seed"
$email = "prompt.m.billing.$seed@example.com"
$authHeaders = @{
  "x-auth-subject" = $subject
  "x-user-email" = $email
}

$base = $ApiBase.TrimEnd('/')
$now = [DateTime]::UtcNow
$subId = "sub_promptm_$seed"
$custId = "cus_promptm_$seed"
$eventBase = "evt_promptm_$seed"

$case = Invoke-Json -Method "POST" -Url "$base/cases" -Headers $authHeaders -Body @{ title = "Prompt M Billing E2E $seed" }
if ($case.Status -ne 201) { throw "Failed to create case: status=$($case.Status) body=$($case.Raw)" }
$caseId = [string]$case.Data.id

$watchBefore = Invoke-Json -Method "POST" -Url "$base/cases/$caseId/watch-mode" -Headers $authHeaders -Body @{ enabled = $true }
$paywallEvent = Invoke-Json -Method "POST" -Url "$base/events/track" -Headers $authHeaders -Body @{ event = "paywall_viewed"; source = "prompt_m_e2e"; locale = "en" }
$checkout = Invoke-Json -Method "POST" -Url "$base/billing/checkout" -Headers $authHeaders -Body @{ plan = "plus_monthly"; triggerSource = "prompt_m_e2e"; locale = "en" }

if ($checkout.Status -ne 200) { throw "Checkout start failed: status=$($checkout.Status) body=$($checkout.Raw)" }

$createWebhook = Invoke-BillingWebhook -ApiBaseValue $base -Secret $WebhookSecret -Body @{
  provider = "internal_stub"
  eventId = "$eventBase-create"
  eventType = "create"
  createdAt = $now.AddSeconds(10).ToString("o")
  subscription = @{
    providerSubscriptionId = $subId
    providerCustomerId = $custId
    status = "active"
    currentPeriodStart = $now.ToString("o")
    currentPeriodEnd = $now.AddDays(30).ToString("o")
    cancelAtPeriodEnd = $false
  }
  user = @{
    subject = $subject
    email = $email
  }
}

$meAfterCreate = Invoke-Json -Method "GET" -Url "$base/me" -Headers $authHeaders
$watchAfterCreate = Invoke-Json -Method "POST" -Url "$base/cases/$caseId/watch-mode" -Headers $authHeaders -Body @{ enabled = $true }

$pastDueWebhook = Invoke-BillingWebhook -ApiBaseValue $base -Secret $WebhookSecret -Body @{
  provider = "internal_stub"
  eventId = "$eventBase-pastdue"
  eventType = "past_due"
  createdAt = $now.AddSeconds(20).ToString("o")
  subscription = @{
    providerSubscriptionId = $subId
    providerCustomerId = $custId
    status = "past_due"
    currentPeriodStart = $now.ToString("o")
    currentPeriodEnd = $now.AddDays(30).ToString("o")
    cancelAtPeriodEnd = $false
    graceUntil = $now.AddDays(2).ToString("o")
  }
  user = @{
    subject = $subject
    email = $email
  }
}

$meAfterPastDue = Invoke-Json -Method "GET" -Url "$base/me" -Headers $authHeaders

$paymentFailedWebhook = Invoke-BillingWebhook -ApiBaseValue $base -Secret $WebhookSecret -Body @{
  provider = "internal_stub"
  eventId = "$eventBase-failed"
  eventType = "payment_failed"
  createdAt = $now.AddSeconds(30).ToString("o")
  subscription = @{
    providerSubscriptionId = $subId
    providerCustomerId = $custId
    status = "ended"
    currentPeriodStart = $now.AddDays(-30).ToString("o")
    currentPeriodEnd = $now.AddDays(-1).ToString("o")
    cancelAtPeriodEnd = $true
    graceUntil = $now.AddHours(-12).ToString("o")
  }
  user = @{
    subject = $subject
    email = $email
  }
}

$meAfterFailed = Invoke-Json -Method "GET" -Url "$base/me" -Headers $authHeaders
$watchAfterFailed = Invoke-Json -Method "POST" -Url "$base/cases/$caseId/watch-mode" -Headers $authHeaders -Body @{ enabled = $true }

$result = [ordered]@{
  generatedAt = [DateTime]::UtcNow.ToString("o")
  apiBase = $base
  identity = @{ subject = $subject; email = $email; caseId = $caseId }
  flow = [ordered]@{
    freeUserPlusRouteBlocked = @{ status = $watchBefore.Status; expected = 403 }
    paywallViewedTracked = @{ status = $paywallEvent.Status; expected = 202 }
    checkoutStarted = @{ status = $checkout.Status; provider = $checkout.Data.provider; sessionId = $checkout.Data.sessionId }
    webhookCreate = @{ status = $createWebhook.Status; transition = $createWebhook.Data.transition }
    entitlementAfterCreate = @{
      plan = $meAfterCreate.Data.entitlement.plan
      status = $meAfterCreate.Data.entitlement.status
      isPlus = $meAfterCreate.Data.entitlement.isPlus
    }
    plusRouteAfterCreate = @{ status = $watchAfterCreate.Status; expected = 200 }
    webhookPastDue = @{ status = $pastDueWebhook.Status; transition = $pastDueWebhook.Data.transition }
    entitlementAfterPastDue = @{
      plan = $meAfterPastDue.Data.entitlement.plan
      status = $meAfterPastDue.Data.entitlement.status
      isPlus = $meAfterPastDue.Data.entitlement.isPlus
    }
    webhookPaymentFailed = @{ status = $paymentFailedWebhook.Status; transition = $paymentFailedWebhook.Data.transition }
    entitlementAfterPaymentFailed = @{
      plan = $meAfterFailed.Data.entitlement.plan
      status = $meAfterFailed.Data.entitlement.status
      isPlus = $meAfterFailed.Data.entitlement.isPlus
    }
    plusRouteAfterPaymentFailed = @{ status = $watchAfterFailed.Status; expected = 403 }
  }
}

$pass = (
  $watchBefore.Status -eq 403 -and
  $paywallEvent.Status -eq 202 -and
  $checkout.Status -eq 200 -and
  $createWebhook.Status -eq 200 -and
  [bool]$meAfterCreate.Data.entitlement.isPlus -eq $true -and
  $watchAfterCreate.Status -eq 200 -and
  $pastDueWebhook.Status -eq 200 -and
  [bool]$meAfterPastDue.Data.entitlement.isPlus -eq $true -and
  $paymentFailedWebhook.Status -eq 200 -and
  [bool]$meAfterFailed.Data.entitlement.isPlus -eq $false -and
  $watchAfterFailed.Status -eq 403
)
$result["pass"] = $pass

if (-not (Test-Path "output/ops")) { New-Item -ItemType Directory -Path "output/ops" | Out-Null }
$resultPath = "output/ops/prompt-m-billing-e2e.json"
($result | ConvertTo-Json -Depth 30) | Set-Content $resultPath

Write-Host "Prompt M billing E2E report written to $resultPath"
Write-Host ($result | ConvertTo-Json -Depth 20)

if (-not $pass) {
  exit 2
}

exit 0
