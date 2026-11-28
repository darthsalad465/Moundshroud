param(
  [string] $Output = 'desktop/dist/editions',
  [string[]] $Edition = @('library', 'studio', 'cyber', 'chess', 'office', 'media'),
  [string] $SevenZip = 'C:\Program Files\7-Zip\7z.exe'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $Output).Path
if (!(Test-Path -LiteralPath $SevenZip -PathType Leaf)) { throw '7-Zip is required to extract the installers.' }
$verification = Join-Path $root ('verify-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $verification | Out-Null
$priorProfile = $env:MOUNDSHROUD_EDITION_PROFILE
$checksums = @()
try {
  foreach ($id in $Edition) {
    if ($id -notin @('library', 'studio', 'cyber', 'chess', 'office', 'media')) { throw "Unknown edition $id" }
    $stem = 'Moundshroud-' + $id.Substring(0, 1).ToUpperInvariant() + $id.Substring(1)
    $directory = Join-Path $verification $id
    $contents = Join-Path $directory 'contents'
    New-Item -ItemType Directory -Path $directory | Out-Null
    $setup = Join-Path $root "$id\$stem-Setup-0.1.0.exe"
    if (!(Test-Path -LiteralPath $setup -PathType Leaf)) { throw "Installer missing for $id" }
    & $SevenZip e $setup '-ir!app-64.7z' "-o$directory" -y -bso0
    if ($LASTEXITCODE) { throw "Cannot extract the installer payload for $id" }
    $payload = Join-Path $directory 'app-64.7z'
    & $SevenZip x $payload "-o$contents" -y -bso0
    if ($LASTEXITCODE) { throw "Cannot extract the desktop app for $id" }
    $exe = Join-Path $contents "$stem.exe"
    $env:MOUNDSHROUD_EDITION_PROFILE = Join-Path $directory 'profile'
    $out = Join-Path $directory 'stdout.txt'
    $err = Join-Path $directory 'stderr.txt'
    $process = Start-Process -FilePath $exe -ArgumentList '--edition-smoke' -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
    if (!$process.WaitForExit(75000)) { $process.Kill(); throw "Packaged smoke test timed out for $id" }
    if ($process.ExitCode) {
      Get-Content -LiteralPath $out,$err
      throw "Packaged smoke test failed for $id with exit code $($process.ExitCode)"
    }
    $log = Get-Content -LiteralPath $out -Raw
    if ($log -notmatch 'Verified Moundshroud') { throw "No successful smoke-test marker for $id" }
    Write-Output $log.Trim()
    $hash = (Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant()
    $checksums += "$hash  $(Split-Path $setup -Leaf)"
  }
  $checksums | Set-Content -LiteralPath (Join-Path $root 'SHA256SUMS.txt') -Encoding ASCII
} finally {
  $env:MOUNDSHROUD_EDITION_PROFILE = $priorProfile
  $resolved = (Resolve-Path -LiteralPath $verification).Path
  if ((Split-Path $resolved -Parent) -eq $root -and (Split-Path $resolved -Leaf) -match '^verify-[a-f0-9]{32}$') {
    Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Continue
  }
}
