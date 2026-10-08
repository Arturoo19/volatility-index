param([string]$OutputDirectory = (Join-Path $PSScriptRoot '../data/research'))
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$requests = @()
foreach ($symbol in @('.BVOL7D', '.BVOL24H', '.BXBT')) {
    $requests += @{ name = "$symbol-instrument"; path = "instrument?symbol=$symbol" }
    $requests += @{ name = "$symbol-latest-trades"; path = "trade?symbol=$symbol&count=12&reverse=true" }
    $requests += @{ name = "$symbol-earliest-trades"; path = "trade?symbol=$symbol&count=3&reverse=false" }
    $requests += @{ name = "$symbol-minute-buckets"; path = "trade/bucketed?symbol=$symbol&binSize=1m&count=12&reverse=true&partial=false" }
}
$manifest = @()
foreach ($request in $requests) {
    $url = 'https://www.bitmex.com/api/v1/' + $request.path
    $entry = [ordered]@{ name = $request.name; url = $url; fetchedAtUtc = [DateTime]::UtcNow.ToString('o') }
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
        $file = $request.name.TrimStart('.') + '.json'
        [IO.File]::WriteAllText((Join-Path (Resolve-Path $OutputDirectory) $file), $response.Content)
        $rows = @($response.Content | ConvertFrom-Json)
        $entry.status = [int]$response.StatusCode
        $entry.file = $file
        $entry.count = $rows.Count
        $entry.firstTimestamp = if ($rows.Count) { $rows[0].timestamp } else { $null }
        $entry.lastTimestamp = if ($rows.Count) { $rows[-1].timestamp } else { $null }
    } catch {
        $entry.status = 'error'
        $entry.error = $_.Exception.Message
    }
    $manifest += [pscustomobject]$entry
    $entry | ConvertTo-Json -Compress
    Start-Sleep -Milliseconds 1200
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $OutputDirectory 'manifest.json')
if (@($manifest | Where-Object status -eq 'error').Count) { exit 1 }
