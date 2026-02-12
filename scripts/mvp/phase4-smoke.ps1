param(
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

  $knownPaths = @(
    "C:\Program Files\Amazon\AWSCLIV2\aws.exe",
    "C:\Program Files (x86)\Amazon\AWSCLIV2\aws.exe"
  )

  foreach ($path in $knownPaths) {
    if (Test-Path $path) {
      return $path
    }
  }

  return $null
}

function Invoke-AwsJson([string]$AwsCli, [string[]]$AwsArgs, [string]$FailureMessage) {
  $json = & $AwsCli @AwsArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    $details = ($json | Out-String).Trim()
    throw "$FailureMessage Details: $details"
  }

  if ([string]::IsNullOrWhiteSpace($json)) {
    return $null
  }

  return $json | ConvertFrom-Json
}

function Send-QueueMessage([string]$AwsCli, [string]$QueueUrl, [string]$Region, [string]$Body) {
  $tmpPath = Join-Path $env:TEMP ("cc-sqs-body-" + [Guid]::NewGuid().ToString() + ".json")
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
    ) "Failed to send SQS message. Verify SQS_QUEUE_URL, AWS_REGION, credentials, queue policy, and network access."

    return $send.MessageId
  }
  finally {
    Remove-Item $tmpPath -ErrorAction SilentlyContinue
  }
}

function Receive-Messages([string]$AwsCli, [string]$QueueUrl, [string]$Region, [int]$Max = 10, [int]$Wait = 1) {
  $result = Invoke-AwsJson $AwsCli @(
    "sqs",
    "receive-message",
    "--queue-url",
    $QueueUrl,
    "--region",
    $Region,
    "--max-number-of-messages",
    $Max.ToString(),
    "--wait-time-seconds",
    $Wait.ToString(),
    "--output",
    "json"
  ) "Failed to receive SQS messages. Queue may be unavailable; verify SQS_QUEUE_URL, AWS_REGION, and AWS credentials."

  if ($null -eq $result -or $null -eq $result.Messages) {
    return @()
  }

  return @($result.Messages)
}

function Try-ParseJson([string]$JsonText) {
  if ([string]::IsNullOrWhiteSpace($JsonText)) {
    return $null
  }

  try {
    return ($JsonText | ConvertFrom-Json)
  }
  catch {
    return $null
  }
}

function Find-RetryMessageById(
  [string]$AwsCli,
  [string]$QueueUrl,
  [string]$Region,
  [string]$ExpectedId,
  [int]$Attempts = 20
) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    $batch = @(Receive-Messages -AwsCli $AwsCli -QueueUrl $QueueUrl -Region $Region -Max 10 -Wait 2)
    foreach ($message in $batch) {
      $parsed = Try-ParseJson -JsonText $message.Body
      if ($null -eq $parsed) {
        continue
      }

      if ($parsed.id -eq $ExpectedId) {
        return @{
          message = $message
          parsed = $parsed
        }
      }
    }
  }

  return $null
}

function Delete-Message([string]$AwsCli, [string]$QueueUrl, [string]$Region, [string]$ReceiptHandle) {
  & $AwsCli sqs delete-message --queue-url $QueueUrl --region $Region --receipt-handle $ReceiptHandle | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to delete SQS message. Verify queue permissions and that the queue is reachable."
  }
}

function Drain-Queue([string]$AwsCli, [string]$QueueUrl, [string]$Region) {
  for ($i = 0; $i -lt 25; $i++) {
    $messages = @(Receive-Messages -AwsCli $AwsCli -QueueUrl $QueueUrl -Region $Region -Max 10 -Wait 1)
    if ($messages.Count -eq 0) {
      break
    }

    foreach ($message in $messages) {
      if (-not $message.ReceiptHandle) { continue }
      Delete-Message -AwsCli $AwsCli -QueueUrl $QueueUrl -Region $Region -ReceiptHandle $message.ReceiptHandle
    }
  }
}

function Get-QueueCounts([string]$AwsCli, [string]$QueueUrl, [string]$Region) {
  $attrs = Invoke-AwsJson $AwsCli @(
    "sqs",
    "get-queue-attributes",
    "--queue-url",
    $QueueUrl,
    "--region",
    $Region,
    "--attribute-names",
    "ApproximateNumberOfMessages",
    "ApproximateNumberOfMessagesNotVisible",
    "--output",
    "json"
  ) "Failed to fetch SQS queue attributes. Queue may be down; verify SQS_QUEUE_URL, AWS_REGION, and network access."

  $visible = 0
  $notVisible = 0
  if ($attrs -and $attrs.Attributes) {
    if ($attrs.Attributes.ApproximateNumberOfMessages) {
      $visible = [int]$attrs.Attributes.ApproximateNumberOfMessages
    }
    if ($attrs.Attributes.ApproximateNumberOfMessagesNotVisible) {
      $notVisible = [int]$attrs.Attributes.ApproximateNumberOfMessagesNotVisible
    }
  }

  return @{
    visible = $visible
    notVisible = $notVisible
  }
}

function Start-WorkerProcess([string]$RepoRoot, [hashtable]$EnvMap, [string]$QueueUrl) {
  $cmd = @(
    "set AWS_REGION=$($EnvMap["AWS_REGION"])",
    "set AWS_ACCESS_KEY_ID=$($EnvMap["AWS_ACCESS_KEY_ID"])",
    "set AWS_SECRET_ACCESS_KEY=$($EnvMap["AWS_SECRET_ACCESS_KEY"])",
    "set SQS_QUEUE_URL=$QueueUrl",
    "set SQS_WAIT_TIME_SECONDS=1",
    "set SQS_VISIBILITY_TIMEOUT_SECONDS=3",
    "npm run worker:start"
  ) -join "&& "

  return Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -WorkingDirectory $RepoRoot -PassThru
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

$queueUrl = $envMap["SQS_QUEUE_URL"]
$region = $envMap["AWS_REGION"]

Step "Stopping existing worker processes"
Stop-ExistingWorkerProcesses

Step "Draining queue before tests"
Drain-Queue -AwsCli $awsCli -QueueUrl $queueUrl -Region $region

Step "Sending ACK test message"
$ackId = [Guid]::NewGuid().ToString()
$ackBody = (@{ type = "phase4-smoke-ack"; id = $ackId } | ConvertTo-Json -Compress)
$ackMessageId = Send-QueueMessage -AwsCli $awsCli -QueueUrl $queueUrl -Region $region -Body $ackBody

$worker = $null
if ($StartWorker) {
  Step "Starting worker for ACK test"
  $worker = Start-WorkerProcess -RepoRoot $repoRoot -EnvMap $envMap -QueueUrl $queueUrl
  Start-Sleep -Seconds 8
  Stop-ProcessTree -ProcessId $worker.Id
}

Step "Checking queue counts after ACK run (informational)"
$ackCounts = Get-QueueCounts -AwsCli $awsCli -QueueUrl $queueUrl -Region $region
Write-Host "Queue state after ACK run: visible=$($ackCounts.visible), notVisible=$($ackCounts.notVisible)"

Step "Sending RETRY test message (forceFail=true)"
$retryId = [Guid]::NewGuid().ToString()
$retryBody = (@{ type = "phase4-smoke-retry"; id = $retryId; forceFail = $true } | ConvertTo-Json -Compress)
$retryMessageId = Send-QueueMessage -AwsCli $awsCli -QueueUrl $queueUrl -Region $region -Body $retryBody

if ($StartWorker) {
  Step "Starting worker for RETRY test"
  $worker = Start-WorkerProcess -RepoRoot $repoRoot -EnvMap $envMap -QueueUrl $queueUrl
  Start-Sleep -Seconds 3
  Stop-ProcessTree -ProcessId $worker.Id
}

Step "Waiting for visibility timeout and checking retry availability"
Start-Sleep -Seconds 7
$retryLookup = Find-RetryMessageById -AwsCli $awsCli -QueueUrl $queueUrl -Region $region -ExpectedId $retryId -Attempts 25
if ($null -eq $retryLookup) {
  throw "RETRY test failed: no retried message with id=$retryId became visible. Queue backlog or worker processing delay may be preventing observation."
}

$retryMessage = $retryLookup.message
$retryParsed = $retryLookup.parsed

if ($retryParsed.id -ne $retryId -or $retryParsed.forceFail -ne $true) {
  throw "RETRY test failed: received unexpected payload for id=$retryId."
}

if (-not $retryMessage.ReceiptHandle) {
  throw "RETRY test failed: missing receipt handle on retried message."
}

Delete-Message -AwsCli $awsCli -QueueUrl $queueUrl -Region $region -ReceiptHandle $retryMessage.ReceiptHandle

Step "Phase 4 smoke test passed"
[ordered]@{
  queueUrl       = $queueUrl
  ackMessageId   = $ackMessageId
  retryMessageId = $retryMessageId
  retryPayloadId = $retryParsed.id
  ackVisible     = $ackCounts.visible
  ackNotVisible  = $ackCounts.notVisible
} | ConvertTo-Json -Compress
