# debug-payload.ps1 — Freightcode payload inspector
#
# Fetches a real declaration from Convex, runs the WCO mapper,
# validates all CDS fields, and dumps the XML. No HMRC call made.
#
# Usage (run from repo root):
#   .\test-evidence\debug-payload.ps1 <declarationId>
#   .\test-evidence\debug-payload.ps1 <declarationId> <userId>
#
# If userId is omitted, HMRC_TEST_USER_ID from .env.local is used.

param(
    [Parameter(Position=0)]
    [string]$DeclarationId,

    [Parameter(Position=1)]
    [string]$UserId
)

# Prompt if not supplied
if (-not $DeclarationId) {
    $DeclarationId = Read-Host "Declaration ID (paste from URL or Convex dashboard)"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

# Pass userId via env var if supplied as argument (avoids quoting issues in Node)
if ($UserId) {
    $env:DECLARATION_ID   = $DeclarationId
    $env:HMRC_TEST_USER_ID = $UserId
    node "$repoRoot\test-evidence\debug-payload.js"
} else {
    $env:DECLARATION_ID = $DeclarationId
    node "$repoRoot\test-evidence\debug-payload.js"
}

$exitCode = $LASTEXITCODE

# Open output files on success
if (Test-Path "$repoRoot\test-evidence\debug-payload.xml") {
    Write-Host ""
    Write-Host "Opening XML in default editor..."
    Invoke-Item "$repoRoot\test-evidence\debug-payload.xml"
}

exit $exitCode
