<#
  CNS EUAT setup.

  Writes the CNS variables into both stores the app uses:
    - .env.local   (Next.js API routes: submit / amend / cancel)
    - Convex       (the notification poller)

  The password is prompted for and never written to this file, the repo, or the
  console. Everything else comes from the CNS onboarding configuration.

  Usage:  pwsh -File scripts/cns-setup.ps1
#>

$ErrorActionPreference = "Stop"

# EUAT values supplied by CNS. Production values are deliberately NOT here.
$vars = [ordered]@{
  CNS_ENABLED              = "true"
  CNS_ENVIRONMENT          = "euat"
  CNS_BASE_URL             = "https://www.euat.cnsonline.co.uk/api"
  CNS_API_USERNAME         = "SOTFRECCMI"
  CNS_BADGE_ID             = "RKA"
  CNS_TOPIC                = "SOTFRETOP"
  CNS_GATEWAY_EPU          = "155"
  CNS_GOODS_LOCATION_CODE  = "GBAULGPLGPLGP1"
  CNS_DECLARATION_ACCEPT   = "application/vnd.hmrc.1.0+xml"
  CNS_NOTIFICATION_ACCEPT  = "application/vnd.csp.1.0+xml"
  CNS_NOTIFICATION_MODE    = "pull"
  CNS_COMPASS_URL          = "https://www.euat.cnsonline.co.uk"
}

# Variables the Convex runtime needs. The rest are transport-side only.
$convexKeys = @(
  "CNS_ENABLED", "CNS_BASE_URL", "CNS_API_USERNAME", "CNS_API_PASSWORD",
  "CNS_TOPIC", "CNS_BADGE_ID", "CNS_NOTIFICATION_ACCEPT", "CNS_NOTIFICATION_MODE"
)

Write-Host "CNS EUAT setup" -ForegroundColor Cyan
Write-Host "Set the password first at the CNS link, then enter it here."
Write-Host ""

$secure = Read-Host "CNS API password for SOTFRECCMI" -AsSecureString
$password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)
if ([string]::IsNullOrWhiteSpace($password)) {
  throw "No password entered. Nothing was written."
}
$vars["CNS_API_PASSWORD"] = $password

# --- .env.local -------------------------------------------------------------
# Existing content is preserved; any previous CNS_ block is replaced.
$envPath = Join-Path $PSScriptRoot "..\.env.local"
$existing = if (Test-Path $envPath) { Get-Content $envPath } else { @() }
$kept = $existing | Where-Object { $_ -notmatch '^\s*CNS_[A-Z_]+\s*=' }

$block = @("", "# CNS inventory-linked imports (EUAT) — added by scripts/cns-setup.ps1")
foreach ($k in $vars.Keys) { $block += "$k=$($vars[$k])" }

Set-Content -Path $envPath -Value ($kept + $block) -Encoding utf8
Write-Host "Wrote $($vars.Count) variables to .env.local" -ForegroundColor Green

# --- Convex -----------------------------------------------------------------
Write-Host "Setting Convex environment variables..."
foreach ($k in $convexKeys) {
  if (-not $vars.Contains($k)) { continue }
  npx convex env set $k $vars[$k] | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to set $k in Convex." }
  Write-Host "  $k" -ForegroundColor DarkGray
}
Write-Host "Convex environment set." -ForegroundColor Green

Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  1. npx convex deploy        # push the new tables and fields"
Write-Host "  2. pwsh -File scripts/cns-preflight.ps1"
Write-Host ""
Write-Host "Confirm .env.local is git-ignored before committing anything." -ForegroundColor Yellow
