# Downloads the 19 ultra-small open-source repos integrated into Moundshroud:
#   - 15 tiny JS drop-in libraries -> web\vendor\micro\
#   - 4 single-file native tools (sqlite-vec, fd, jq, ripgrep) -> engines\micro\
# Safe to run again; skips files already present unless -Force is passed.
param([switch]$Force)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$jsDir = Join-Path $root 'web\vendor\micro'
$binDir = Join-Path $root 'engines\micro'
New-Item -ItemType Directory -Force $jsDir, $binDir | Out-Null

$hdr = @{ 'User-Agent' = 'moundshroud-micro-installer' }

function Get-File($url, $dest, $label) {
  if ((-not $Force) -and (Test-Path $dest) -and ((Get-Item $dest).Length -gt 200)) {
    Write-Host "  [ok] $label (cached)"
    return $true
  }
  $tmp = "$dest.part"
  try {
    Invoke-WebRequest -Uri $url -OutFile $tmp -Headers $hdr -MaximumRedirection 8 -TimeoutSec 45
    if ((Get-Item $tmp).Length -lt 100) { throw "Downloaded file too small" }
    Move-Item -Force $tmp $dest
    $kb = [math]::Round((Get-Item $dest).Length / 1KB, 1)
    Write-Host "  [dl] $label ($kb KB)"
    return $true
  } catch {
    if (Test-Path $tmp) { Remove-Item -Force $tmp }
    Write-Warning "  [fail] $label ($url): $($_.Exception.Message)"
    return $false
  }
}

Write-Host '=== 1. Downloading 15 micro JS libraries -> web\vendor\micro\ ==='

$jsList = @(
  @{ name = 'suncalc.min.js';    url = 'https://cdn.jsdelivr.net/npm/suncalc@1.9.0/suncalc.js' },
  @{ name = 'codejar.esm.js';    url = 'https://cdn.jsdelivr.net/npm/codejar@4.2.0/dist/codejar.js' },
  @{ name = 'qrcodegen.min.js';  url = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js' },
  @{ name = 'ts-fsrs.umd.js';    url = 'https://cdn.jsdelivr.net/npm/ts-fsrs@4.6.0/dist/index.umd.js' },
  @{ name = 'minisearch.min.js'; url = 'https://cdn.jsdelivr.net/npm/minisearch@7.1.1/dist/umd/index.min.js' },
  @{ name = 'papaparse.min.js';  url = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js' },
  @{ name = 'purify.min.js';     url = 'https://cdn.jsdelivr.net/npm/dompurify@3.2.4/dist/purify.min.js' },
  @{ name = 'diff.min.js';       url = 'https://cdn.jsdelivr.net/npm/diff@7.0.0/dist/diff.min.js' },
  @{ name = 'fflate.min.js';     url = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js' },
  @{ name = 'rough.min.js';      url = 'https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js' },
  @{ name = 'sortable.min.js';   url = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js' },
  @{ name = 'uplot.min.js';      url = 'https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.iife.min.js' },
  @{ name = 'uplot.min.css';     url = 'https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.min.css' },
  @{ name = 'jsqr.min.js';       url = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js' },
  @{ name = 'graphre.min.js';    url = 'https://cdn.jsdelivr.net/npm/graphre@0.1.3/dist/graphre.js' },
  @{ name = 'nomnoml.min.js';    url = 'https://cdn.jsdelivr.net/npm/nomnoml@1.6.2/dist/nomnoml.js' },
  @{ name = 'chrono.min.js';     url = 'https://cdn.jsdelivr.net/npm/chrono-node@1.4.8/dist/chrono.min.js' },
  # Round 2 ultra-small drop-ins
  @{ name = 'otpauth.min.js';    url = 'https://cdn.jsdelivr.net/npm/otpauth@9.3.6/dist/otpauth.umd.min.js' },
  @{ name = 'exifr.min.js';      url = 'https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/lite.umd.js' },
  @{ name = 'readability.min.js'; url = 'https://cdn.jsdelivr.net/npm/@mozilla/readability@0.5.0/Readability.js' },
  @{ name = 'fraction.min.js';   url = 'https://cdn.jsdelivr.net/npm/fraction.js@4.3.7/fraction.min.js' },
  @{ name = 'colord.cjs.js';     url = 'https://cdn.jsdelivr.net/npm/colord@2.9.3/index.js' },
  @{ name = 'midi.min.js';       url = 'https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/build/Midi.js' },
  @{ name = 'panzoom.min.js';    url = 'https://cdn.jsdelivr.net/npm/@panzoom/panzoom@4.6.0/dist/panzoom.min.js' },
  @{ name = 'split.min.js';      url = 'https://cdn.jsdelivr.net/npm/split.js@1.6.5/dist/split.min.js' },
  @{ name = 'confetti.min.js';   url = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js' },
  @{ name = 'prism.min.js';      url = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js' },
  @{ name = 'prism-tomorrow.min.css'; url = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css' },
  @{ name = 'jsbarcode.min.js';  url = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js' },
  @{ name = 'js-yaml.min.js';    url = 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js' },
  @{ name = 'ical.min.js';       url = 'https://cdn.jsdelivr.net/npm/ical.js@1.5.0/build/ical.min.js' },
  @{ name = 'temml.min.js';      url = 'https://cdn.jsdelivr.net/npm/temml@0.11.4/dist/temml.min.js' },
  @{ name = 'temml.min.css';     url = 'https://cdn.jsdelivr.net/npm/temml@0.11.4/dist/Temml-Local.css' },
  @{ name = 'franc.esm.js';      url = 'https://esm.sh/v135/franc-min@6.2.0/es2022/franc-min.bundle.mjs' }
)

foreach ($item in $jsList) {
  $ok = Get-File $item.url (Join-Path $jsDir $item.name) $item.name
  # Fallback for jsQR if .min.js is not published on jsDelivr
  if ((-not $ok) -and $item.name -eq 'jsqr.min.js') {
    Get-File 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' (Join-Path $jsDir $item.name) 'jsqr.min.js (fallback)' | Out-Null
  }
  # Fallback for ts-fsrs latest UMD
  if ((-not $ok) -and $item.name -eq 'ts-fsrs.umd.js') {
    Get-File 'https://cdn.jsdelivr.net/npm/ts-fsrs/dist/index.umd.js' (Join-Path $jsDir $item.name) 'ts-fsrs.umd.js (latest)' | Out-Null
  }
}

# Wrap codejar ESM export into a tiny UMD-compatible classic script (window.CodeJar)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$cjEsm = Join-Path $jsDir 'codejar.esm.js'
$cjUmd = Join-Path $jsDir 'codejar.min.js'
if (Test-Path $cjEsm) {
  $src = Get-Content -Raw $cjEsm
  $wrapped = "(function(__G){`n" + ($src -replace 'export\s+function\s+CodeJar', 'function CodeJar') + "`n__G.CodeJar = CodeJar;`n})(typeof window !== 'undefined' ? window : globalThis);`n"
  [System.IO.File]::WriteAllText($cjUmd, $wrapped, $utf8NoBom)
  Remove-Item -Force $cjEsm
  Write-Host "  [wrap] codejar.min.js ($([math]::Round((Get-Item $cjUmd).Length / 1KB, 1)) KB)"
}

# Wrap colord CJS export into window.colord
$cdCjs = Join-Path $jsDir 'colord.cjs.js'
$cdUmd = Join-Path $jsDir 'colord.min.js'
if (Test-Path $cdCjs) {
  $src = Get-Content -Raw $cdCjs
  $wrapped = "(function(__G){var exports={},module={exports:exports};`n" + $src + "`n__G.colord = module.exports.colord || exports.colord; __G.Colord = module.exports.Colord || exports.Colord; __G.colordExtend = module.exports.extend || exports.extend;`n})(typeof window !== 'undefined' ? window : globalThis);`n"
  [System.IO.File]::WriteAllText($cdUmd, $wrapped, $utf8NoBom)
  Remove-Item -Force $cdCjs
  Write-Host "  [wrap] colord.min.js ($([math]::Round((Get-Item $cdUmd).Length / 1KB, 1)) KB)"
}

# Wrap franc-min ESM bundle into classic script (window.franc / window.francAll)
$frEsm = Join-Path $jsDir 'franc.esm.js'
$frUmd = Join-Path $jsDir 'franc.min.js'
if (Test-Path $frEsm) {
  $src = Get-Content -Raw $frEsm
  if ($src -match 'from\s*"(/[^"]+)"') {
    $realUrl = 'https://esm.sh' + $Matches[1]
    Invoke-WebRequest -Uri $realUrl -OutFile $frEsm -Headers $hdr -MaximumRedirection 8 -TimeoutSec 45
    $src = Get-Content -Raw $frEsm
  }
  $body = [regex]::Replace($src, 'export\s*\{([^}]+)\}\s*;', { param($m) ($m.Groups[1].Value -split ',' | ForEach-Object { if ($_.Trim() -match '^(\S+)\s+as\s+(\S+)$') { "__G.$($Matches[2])=$($Matches[1]);" } else { "__G.$($_.Trim())=$($_.Trim());" } }) -join ' ' })
  $wrapped = "(function(__G){`n" + $body + "`n})(typeof window !== 'undefined' ? window : globalThis);`n"
  [System.IO.File]::WriteAllText($frUmd, $wrapped, $utf8NoBom)
  Remove-Item -Force $frEsm
  Write-Host "  [wrap] franc.min.js ($([math]::Round((Get-Item $frUmd).Length / 1KB, 1)) KB)"
}

Write-Host "`n=== 2. Downloading 5 single-file native tools -> engines\micro\ ==="

function Get-GitHubRelease($repo, $assetRegex, $extractFile, $destName) {
  $dest = Join-Path $binDir $destName
  if ((-not $Force) -and (Test-Path $dest) -and ((Get-Item $dest).Length -gt 10000)) {
    Write-Host "  [ok] $destName (cached)"
    return
  }
  try {
    $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers $hdr -TimeoutSec 30
    $asset = $rel.assets | Where-Object { $_.name -match $assetRegex } | Select-Object -First 1
    if (-not $asset) { throw "No asset matching $assetRegex in $repo" }
    $tmp = Join-Path $binDir ("dl-" + $asset.name)
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $tmp -Headers $hdr -MaximumRedirection 8 -TimeoutSec 90
    if ($extractFile) {
      $exDir = Join-Path $binDir ("ex-" + [guid]::NewGuid().ToString('N'))
      New-Item -ItemType Directory -Force $exDir | Out-Null
      if ($tmp -match '\.zip$') {
        Expand-Archive -LiteralPath $tmp -DestinationPath $exDir -Force
      } elseif ($tmp -match '\.tar\.gz$|\.tgz$') {
        & tar.exe -xzf $tmp -C $exDir
      }
      $found = Get-ChildItem -Path $exDir -Recurse -File | Where-Object { $_.Name -ieq $extractFile } | Select-Object -First 1
      if (-not $found) { throw "Could not find $extractFile inside $($asset.name)" }
      Move-Item -Force $found.FullName $dest
      Remove-Item -Recurse -Force $exDir
      Remove-Item -Force $tmp
    } else {
      Move-Item -Force $tmp $dest
    }
    $mb = [math]::Round((Get-Item $dest).Length / 1MB, 2)
    Write-Host "  [dl] $destName ($mb MB) from $repo"
  } catch {
    Write-Warning "  [fail] $destName ($repo): $($_.Exception.Message)"
  }
}

Get-GitHubRelease 'asg017/sqlite-vec' 'loadable-windows-x86_64\.(tar\.gz|zip)$' 'vec0.dll' 'vec0.dll'
Get-GitHubRelease 'sharkdp/fd' 'x86_64-pc-windows-msvc\.zip$' 'fd.exe' 'fd.exe'
Get-GitHubRelease 'jqlang/jq' 'jq-windows-amd64\.exe$' '' 'jq.exe'
Get-GitHubRelease 'BurntSushi/ripgrep' 'x86_64-pc-windows-msvc\.zip$' 'rg.exe' 'rg.exe'
Get-GitHubRelease 'chmln/sd' 'x86_64-pc-windows-msvc\.zip$' 'sd.exe' 'sd.exe'

Write-Host "`n=== Summary ==="
Get-ChildItem $jsDir, $binDir -File | Sort-Object Length | ForEach-Object {
  $sz = if ($_.Length -ge 1MB) { "{0:N2} MB" -f ($_.Length / 1MB) } else { "{0:N1} KB" -f ($_.Length / 1KB) }
  Write-Host ("  {0,-24} {1,10}" -f $_.Name, $sz)
}
