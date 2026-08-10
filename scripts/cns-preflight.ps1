<#
  CNS EUAT preflight — T01, T02, T03.

  Run after scripts/cns-setup.ps1 and `npx convex deploy`.

  The consumer check comes first deliberately: if a push consumer is attached to
  the topic, batch reads return 423 and polling is unavailable, which changes
  what the rest of the integration can do.

  Usage:  pwsh -File scripts/cns-preflight.ps1
#>

$ErrorActionPreference = "Stop"

function Step($n, $name) {
  Write-Host ""
  Write-Host "[$n] $name" -ForegroundColor Cyan
}

# --- T01: configuration -----------------------------------------------------
Step "T01" "Configuration validation"
$missing = @()
foreach ($k in @("CNS_ENABLED","CNS_BASE_URL","CNS_API_USERNAME","CNS_TOPIC","CNS_BADGE_ID")) {
  $line = (npx convex env get $k 2>$null)
  if ([string]::IsNullOrWhiteSpace($line)) { $missing += $k }
}
# Presence only — the value is never printed.
$pw = (npx convex env get CNS_API_PASSWORD 2>$null)
if ([string]::IsNullOrWhiteSpace($pw)) { $missing += "CNS_API_PASSWORD" }

if ($missing.Count -gt 0) {
  Write-Host "  MISSING in Convex: $($missing -join ', ')" -ForegroundColor Red
  Write-Host "  Run scripts/cns-setup.ps1 first."
  exit 1
}
Write-Host "  All required Convex variables present." -ForegroundColor Green

# --- Pull-mode preflight ----------------------------------------------------
Step "PRE" "Topic consumer check (pull vs push)"
$consumer = npx convex run cns_notifications:checkTopicConsumer 2>&1 | Out-String
Write-Host $consumer.Trim()
if ($consumer -match '"ok"\s*:\s*false') {
  Write-Host "  Pull mode is NOT available. Stop and resolve before continuing." -ForegroundColor Red
  exit 1
}
Write-Host "  Pull mode available." -ForegroundColor Green

# --- T02: heartbeat ---------------------------------------------------------
Step "T02" "Heartbeat"
$heartbeat = npx convex run cns_notifications:sendTopicHeartbeat 2>&1 | Out-String
Write-Host $heartbeat.Trim()
if ($heartbeat -notmatch '"ok"\s*:\s*true') {
  Write-Host "  Heartbeat failed." -ForegroundColor Red
  exit 1
}
Write-Host "  Heartbeat accepted. It should arrive on the topic as a test notification." -ForegroundColor Green

# --- T02/T03: poll ----------------------------------------------------------
Step "T02/T03" "Poll — expect the heartbeat, then an empty topic"
$first = npx convex run cns_notifications:pollTopic 2>&1 | Out-String
Write-Host "  first poll : $($first.Trim())"

Write-Host "  waiting 35s for the 30s floor..." -ForegroundColor DarkGray
Start-Sleep -Seconds 35

$second = npx convex run cns_notifications:pollTopic 2>&1 | Out-String
Write-Host "  second poll: $($second.Trim())"

Step "HEALTH" "Poller health"
npx convex run cns_notifications:getPollHealthInternal 2>&1 | Out-String | Write-Host

Write-Host ""
Write-Host "Preflight complete." -ForegroundColor Cyan
Write-Host "Expected: heartbeat persisted and acknowledged on the first poll, nothing on the second."
Write-Host "Next: T04 — a Cargo Registered declaration against LGP100DPS00100"
Write-Host "      (container TDRY1234567, 220 packages, 860kg)."
