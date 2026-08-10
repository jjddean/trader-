# Maersk Open API smoke test (5 endpoints)
# Run from repo root:  pwsh -File scripts/maersk-smoke-test.ps1

$envFile = Join-Path $PSScriptRoot ".." ".env.local" | Resolve-Path
$key = (Get-Content $envFile | Where-Object { $_ -match '^\s*MAERSK_CONSUMER_KEY=(.+)$' }) -replace '^\s*MAERSK_CONSUMER_KEY=',''
if (-not $key) { Write-Error "MAERSK_CONSUMER_KEY missing in .env.local"; exit 1 }

$h = @{ "Consumer-Key" = $key.Trim() }

function Test-Maersk($label, $url) {
    $r = Invoke-WebRequest -Uri $url -Headers $h -SkipHttpErrorCheck -TimeoutSec 30
    $ok = $r.StatusCode -eq 200
    Write-Host ("[{0}] {1} - {2}" -f $(if ($ok) { "OK" } else { "FAIL" }), $r.StatusCode, $label)
    if (-not $ok) { Write-Host "  $url" }
    return $ok
}

$all = $true
$all = (Test-Maersk "Locations search" "https://api.maersk.com/reference-data/locations?cityName=Felixstowe") -and $all
$all = (Test-Maersk "Locations detail" "https://api.maersk.com/reference-data/carrier-locations/23KBBVVUYELJT") -and $all
$all = (Test-Maersk "Vessels" "https://api.maersk.com/reference-data/vessels?vesselIMONumbers=9928229") -and $all
$all = (Test-Maersk "Commodities" "https://api.maersk.com/commodity-classifications?commodityName=Palm%20oil&cargoType=DRY") -and $all
$all = (Test-Maersk "Booking offices" "https://api.maersk.com/booking-offices?carrierCode=MAEU&officeUNLocationCode=GBFXT") -and $all

exit $(if ($all) { 0 } else { 1 })
