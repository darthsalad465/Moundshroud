# Publishes the release that make-release.ps1 built in releases\ so every copy of Moundshroud can update to it.
#   1. the public download repo named in update.json gets a GitHub release "v<version>" holding the two zips and latest.json
#      (the repo only ever holds these downloads, never the source code; it is made, public, the first time)
#   2. itch.io (when update.json names an "itch" page and butler is installed and signed in) gets the same version
#   .\publish-update.ps1            ask before each step
#   .\publish-update.ps1 -Yes       no questions
# Before running it: bump VERSION, write this version's lines in RELEASE-NOTES.txt, run .\make-release.ps1 -Verify.
param([switch]$Yes)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ver = (Get-Content (Join-Path $root 'VERSION') -Raw).Trim()
$cfg = Get-Content (Join-Path $root 'update.json') -Raw | ConvertFrom-Json
$repo = [string]$cfg.repo; $itch = [string]$cfg.itch
$out = Join-Path $root 'releases'
$files = @("Moundshroud-$ver-part1-program.zip", "Moundshroud-$ver-part2-data.zip", 'latest.json') | ForEach-Object { Join-Path $out $_ }
foreach ($f in $files) { if (-not (Test-Path $f)) { throw "$f is missing. Run .\make-release.ps1 -Verify first." } }
$lj = Get-Content (Join-Path $out 'latest.json') -Raw | ConvertFrom-Json
if ($lj.version -ne $ver) { throw "releases\latest.json is for $($lj.version), not $ver. Run .\make-release.ps1 again." }
if (-not @($lj.notes).Count) { Write-Host 'Note: RELEASE-NOTES.txt is empty, so the update will show no "What is new" list.' -ForegroundColor Yellow }
function Ok($q) { if ($Yes) { return $true }; return ((Read-Host "$q [y/N]") -match '^[Yy]') }

$gh = @('C:\Program Files\GitHub CLI\gh.exe', (Get-Command gh -ErrorAction SilentlyContinue).Source) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $gh) { throw 'The GitHub CLI (gh) is not installed.' }
& $gh auth status *> $null; if ($LASTEXITCODE) { throw 'Sign in first:  gh auth login' }

# 1. GitHub
& $gh repo view $repo --json name *> $null
if ($LASTEXITCODE) {
  if (-not (Ok "Make the PUBLIC download repo github.com/$repo (it will only hold release downloads)?")) { throw 'Stopped.' }
  & $gh repo create $repo --public --add-readme --description 'Downloads and updates for Moundshroud, a private assistant that runs offline on your own Windows PC.'
  if ($LASTEXITCODE) { throw 'Could not make the repo.' }
}
& $gh release view "v$ver" --repo $repo *> $null
if (-not $LASTEXITCODE) { throw "v$ver is already published. Bump VERSION for a new release." }
if (-not (Ok "Publish Moundshroud $ver to github.com/$repo ? Every copy will be offered this update.")) { throw 'Stopped.' }
$notes = (@("Moundshroud $ver") + '' + (@($lj.notes) | ForEach-Object { "- $_" }) + '' + 'Download BOTH zips, unzip them into the same folder and run Setup-Moundshroud.bat. Copies already installed update themselves from Settings.') -join "`n"
& $gh release create "v$ver" @files --repo $repo --title "Moundshroud $ver" --notes $notes --latest
if ($LASTEXITCODE) { throw 'The GitHub release did not publish.' }
Write-Host "Published to https://github.com/$repo/releases/tag/v$ver" -ForegroundColor Green

# 2. itch.io
if ($itch) {
  $butler = @((Join-Path $env:USERPROFILE 'Tools\butler\butler.exe'), (Join-Path $env:APPDATA 'itch\apps\butler\butler.exe'), (Get-Command butler -ErrorAction SilentlyContinue).Source) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $butler) { Write-Host 'itch.io skipped: butler is not installed.' -ForegroundColor Yellow }
  elseif (Ok "Upload $ver to itch.io ($itch)?") {
    # itch gets the two parts unpacked into one folder, which it offers as a single download
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('moundshroud-itch-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $tmp | Out-Null
    try {
      Add-Type -AssemblyName System.IO.Compression.FileSystem
      foreach ($z in $files[0..1]) { [IO.Compression.ZipFile]::ExtractToDirectory($z, $tmp) }
      & $butler push (Join-Path $tmp 'Moundshroud') "${itch}:windows" --userversion $ver
      if ($LASTEXITCODE) { throw 'butler push failed.' }
      Write-Host "Uploaded to https://$($itch.Split('/')[0]).itch.io/$($itch.Split('/')[1])" -ForegroundColor Green
    } finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
  }
}
