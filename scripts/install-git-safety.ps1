$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
  $git = Get-Command git -ErrorAction Stop
  & $git.Source config --local core.hooksPath .githooks
  if ($LASTEXITCODE -ne 0) { throw 'Could not enable the repository push safety hook.' }
  Write-Host 'GitHub safety push check is enabled for this repository.' -ForegroundColor Green
  Write-Host 'Before each push, it scans outgoing files and commits for private paths, common credentials, and local home-folder paths.'
  Write-Host 'GitHub Actions runs the same scan as a second check after pushes and on pull requests.'
} finally { Pop-Location }
